/**
 * Free / no-key data helpers for competitive intelligence enrichment.
 */

import { enrichFounders, formatFounderForPrompt, preferLeadershipTeam, looksLikePersonName } from './peopleEnrich.js';

const TECH_SIGNATURES = [
  { tech: 'React', category: 'frontend', patterns: [/react/i, /_next\/static/i, /data-reactroot/i] },
  { tech: 'Next.js', category: 'frontend', patterns: [/_next\//i, /__NEXT_DATA__/i] },
  { tech: 'Vue.js', category: 'frontend', patterns: [/vue\.js/i, /__vue__/i] },
  { tech: 'Angular', category: 'frontend', patterns: [/ng-version/i, /angular/i] },
  { tech: 'WordPress', category: 'cms', patterns: [/wp-content/i, /wordpress/i] },
  { tech: 'Webflow', category: 'cms', patterns: [/webflow/i] },
  { tech: 'Framer', category: 'cms', patterns: [/framer\.com/i, /framerusercontent/i] },
  { tech: 'Stripe', category: 'payments', patterns: [/js\.stripe\.com/i, /stripe/i] },
  { tech: 'Segment', category: 'analytics', patterns: [/cdn\.segment\.com/i, /analytics\.js/i] },
  { tech: 'Google Analytics', category: 'analytics', patterns: [/google-analytics\.com|gtag\/js|googletagmanager/i] },
  { tech: 'Mixpanel', category: 'analytics', patterns: [/mixpanel/i] },
  { tech: 'Intercom', category: 'support', patterns: [/intercom/i, /widget\.intercom/i] },
  { tech: 'HubSpot', category: 'marketing', patterns: [/hs-scripts|hubspot/i] },
  { tech: 'Salesforce', category: 'crm', patterns: [/salesforce|force\.com/i] },
  { tech: 'Cloudflare', category: 'infrastructure', patterns: [/cloudflare|cf-ray/i] },
  { tech: 'Vercel', category: 'infrastructure', patterns: [/vercel/i, /_vercel/i] },
  { tech: 'AWS', category: 'infrastructure', patterns: [/amazonaws\.com|aws/i] },
  { tech: 'Tailwind CSS', category: 'frontend', patterns: [/tailwindcss/i] },
  { tech: 'Typeform', category: 'forms', patterns: [/typeform/i] },
  { tech: 'Calendly', category: 'scheduling', patterns: [/calendly/i] },
];

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/** Pull title/meta/JSON-LD/noscript before scripts are stripped. */
export function extractHeadSignals(rawHtml = '') {
  const raw = String(rawHtml || '');
  const title =
    raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() || null;
  const metaDescription =
    raw.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    raw.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)?.[1] ||
    raw.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    null;
  const ogTitle =
    raw.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] || null;
  const jsonLdChunks = [];
  const ldRe = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = ldRe.exec(raw)) && jsonLdChunks.length < 4) {
    const chunk = m[1].replace(/\s+/g, ' ').trim();
    if (chunk.length > 40) jsonLdChunks.push(chunk.slice(0, 4000));
  }
  const noscript = [...raw.matchAll(/<noscript\b[^>]*>([\s\S]*?)<\/noscript>/gi)]
    .map((x) => x[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((t) => t.length > 40)
    .join(' ')
    .slice(0, 6000);

  const signalText = [
    title ? `Title: ${title}` : null,
    ogTitle && ogTitle !== title ? `OG title: ${ogTitle}` : null,
    metaDescription ? `Meta description: ${metaDescription}` : null,
    noscript ? `Noscript copy: ${noscript}` : null,
    jsonLdChunks.length ? `JSON-LD: ${jsonLdChunks.join(' | ')}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return { title, metaDescription, ogTitle, noscript, jsonLdChunks, signalText };
}

/**
 * Fetch HTML and keep title/meta + body. Prefer <body> so huge <head> chrome does not
 * burn the char budget. Preserve JSON-LD / noscript; attach head signals for SPA shells.
 * Set allowFallbacks=true for homepages — some hosts block Vercel/datacenter IPs.
 */
function isExpectedMissStatus(status) {
  return status === 404 || status === 410 || status === 405;
}

export async function fetchWebpage(
  url,
  { maxChars = 24000, timeoutMs = 18000, allowFallbacks = false, quiet = false } = {}
) {
  const attemptDirect = async (target, ms = 8000) => {
    const response = await fetch(target, {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
        ...(String(target).includes('.co.uk')
          ? { Cookie: 'siteTopCountry=United%20Kingdom' }
          : {}),
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(ms),
    });
    if (!response.ok) {
      const err = new Error(`HTTP ${response.status}`);
      err.status = response.status;
      throw err;
    }
    const raw = (await response.text()).slice(0, 900_000);
    if (!raw || raw.length < 80) return null;
    return htmlFromRaw(raw, maxChars);
  };

  const logFetchFailure = (err) => {
    if (!err) return;
    // Speculative seed paths (/about-us, /team, …) often 404 — not worth alarming logs
    if (quiet || isExpectedMissStatus(err.status)) return;
    console.warn('fetchWebpage failed for', url, err.message || err);
  };

  const variants = [];
  try {
    const u = new URL(url.includes('://') ? url : `https://${url}`);
    variants.push(u.href);
    if (allowFallbacks) {
      if (u.hostname.startsWith('www.')) {
        variants.push(`${u.protocol}//${u.hostname.slice(4)}${u.pathname}${u.search}`);
      } else {
        variants.push(`${u.protocol}//www.${u.hostname}${u.pathname}${u.search}`);
      }
    }
  } catch {
    variants.push(url);
  }

  let lastError = null;
  for (const target of [...new Set(variants)]) {
    try {
      const html = await attemptDirect(target, Math.min(timeoutMs, allowFallbacks ? 8000 : timeoutMs));
      if (html && html.length > 120) return html;
    } catch (err) {
      lastError = err;
    }
  }

  if (!allowFallbacks) {
    logFetchFailure(lastError);
    return null;
  }

  // Race mirror + microlink — don't burn the whole serverless budget serially
  const primary = variants[0];
  const fallbacks = await Promise.allSettled([
    (async () => {
      const mirror = await fetch(
        `https://api.allorigins.win/raw?url=${encodeURIComponent(primary)}`,
        { signal: AbortSignal.timeout(12000) }
      );
      if (!mirror.ok) return null;
      const raw = (await mirror.text()).slice(0, 900_000);
      if (!raw || raw.length < 200 || /just a moment/i.test(raw.slice(0, 500))) return null;
      return htmlFromRaw(raw, maxChars);
    })(),
    (async () => {
      const metaRes = await fetch(
        `https://api.microlink.io/?url=${encodeURIComponent(primary)}&meta=true`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (!metaRes.ok) return null;
      const json = await metaRes.json();
      const d = json?.data;
      if (json?.status !== 'success' || !d) return null;
      const signalText = [
        d.title ? `Title: ${d.title}` : null,
        d.description ? `Meta description: ${d.description}` : null,
        d.publisher ? `Publisher: ${d.publisher}` : null,
        d.author ? `Author: ${d.author}` : null,
        `Source: microlink meta fallback`,
      ]
        .filter(Boolean)
        .join('\n');
      const safeTitle = String(d.title || '').replace(/</g, '');
      const safeDesc = String(d.description || '').replace(/"/g, '&quot;');
      return `<!--SIGNALS\n${signalText}\n-->\n<title>${safeTitle}</title>\n<meta name="description" content="${safeDesc}">\n<body>${safeTitle}. ${d.description || ''}</body>`;
    })(),
  ]);

  const mirrorHtml = fallbacks[0].status === 'fulfilled' ? fallbacks[0].value : null;
  const microHtml = fallbacks[1].status === 'fulfilled' ? fallbacks[1].value : null;
  if (mirrorHtml && mirrorHtml.length > 200) return mirrorHtml;
  if (microHtml) return microHtml;

  logFetchFailure(lastError);
  return null;
}

function htmlFromRaw(raw, maxChars) {
  const signals = extractHeadSignals(raw);
  const cleaned = raw
    .replace(
      /<script\b(?![^>]*type=["']application\/ld\+json["'])[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      ' '
    )
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  const head = cleaned.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] || '';
  const headKeep =
    (
      head.match(
        /<title[\s\S]*?<\/title>|<meta\b[^>]*>|<link\b[^>]*rel=["'][^"']*(?:apple-touch-icon|icon|shortcut icon|mask-icon)[^"']*["'][^>]*>|<script[^>]*application\/ld\+json[\s\S]*?<\/script>/gi
      ) || []
    ).join('\n') || head.slice(0, 4000);
  const body = cleaned.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)?.[1] || cleaned;
  const combined = `${headKeep}\n${body}`.substring(0, maxChars);
  return signals.signalText ? `<!--SIGNALS\n${signals.signalText}\n-->\n${combined}` : combined;
}

const SEED_PATHS = [
  '/',
  '/about',
  '/about-us',
  '/company',
  '/team',
  '/pricing',
  '/product',
  '/products',
  '/features',
  '/platform',
  '/solutions',
  '/blog',
  '/news',
  '/updates',
  '/changelog',
  '/customers',
  '/case-studies',
  '/resources',
];

const PRIORITY_PATTERNS = [
  { re: /about|company|our-story|who-we-are|nerdy\s*team|meet\s+(our\s+)?(the\s+)?team/i, score: 100 },
  { re: /\/team\b|team\b|founders|leadership|people|roster|crew/i, score: 98 },
  { re: /product|platform|features|solutions|how-it-works/i, score: 90 },
  { re: /pricing|plans|packages/i, score: 88 },
  { re: /blog|news|updates|changelog|press|announcements|latest/i, score: 85 },
  { re: /customers|case-stud|testimonials|stories/i, score: 70 },
  { re: /resources|docs|learn|education|guides/i, score: 60 },
  { re: /investors|angel|syndicate|portfolio|cap-?table/i, score: 80 },
  { re: /security|trust|compliance/i, score: 40 },
];

const SKIP_PATTERNS =
  /login|signin|sign-up|signup|register|cart|checkout|privacy|terms|cookie|careers|jobs|legal|mailto:|tel:|\.(pdf|png|jpe?g|gif|svg|zip|mp4)(\?|$)/i;

function normalizeSiteUrl(website) {
  try {
    const u = new URL(website.includes('://') ? website : `https://${website}`);
    return u;
  } catch {
    return null;
  }
}

function scoreCandidate(url, anchorText = '') {
  const hay = `${url} ${anchorText}`;
  if (SKIP_PATTERNS.test(hay)) return -1;
  let score = 10;
  for (const p of PRIORITY_PATTERNS) {
    if (p.re.test(hay)) score = Math.max(score, p.score);
  }
  // Prefer shorter marketing paths over deep app routes
  try {
    const path = new URL(url).pathname;
    if (path.split('/').filter(Boolean).length <= 2) score += 5;
    if (path === '/' || path === '') score += 20;
  } catch {
    /* ignore */
  }
  return score;
}

/**
 * Pull same-origin <a href> targets + anchor text from HTML.
 */
export function extractInternalLinks(html, baseUrl) {
  if (!html) return [];
  const base = normalizeSiteUrl(baseUrl);
  if (!base) return [];

  const links = [];
  const re = /<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = re.exec(html))) {
    const href = match[1].trim();
    if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
      continue;
    }
    let absolute;
    try {
      absolute = new URL(href, base).href;
    } catch {
      continue;
    }
    let parsed;
    try {
      parsed = new URL(absolute);
    } catch {
      continue;
    }
    if (parsed.origin !== base.origin) continue;
    // Drop hash-only / query noise for dedupe key
    parsed.hash = '';
    const clean = parsed.href;
    const anchorText = String(match[2] || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);
    links.push({ url: clean, anchorText });
  }
  return links;
}

function stripTags(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseJsonLdBlocks(html) {
  const blocks = [];
  const ldRe = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = ldRe.exec(html)) && blocks.length < 12) {
    const raw = m[1].trim();
    if (!raw) continue;
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      // Some sites concatenate objects; try wrapping
      try {
        blocks.push(JSON.parse(`[${raw.replace(/}\s*{/g, '},{')}]`));
      } catch {
        /* ignore bad JSON-LD */
      }
    }
  }
  return blocks;
}

function walkJsonLd(node, visit, depth = 0) {
  if (!node || depth > 8) return;
  if (Array.isArray(node)) {
    for (const item of node) walkJsonLd(item, visit, depth + 1);
    return;
  }
  if (typeof node !== 'object') return;
  visit(node);
  for (const key of Object.keys(node)) {
    if (key === '@context') continue;
    walkJsonLd(node[key], visit, depth + 1);
  }
}

function jsonLdTypes(node) {
  const t = node?.['@type'];
  if (!t) return [];
  return (Array.isArray(t) ? t : [t]).map((x) => String(x).toLowerCase());
}

function jsonLdName(node) {
  if (!node) return null;
  if (typeof node.name === 'string') return node.name;
  if (Array.isArray(node.name)) return node.name.find((n) => typeof n === 'string') || null;
  return null;
}

function jsonLdSameAsUrls(node) {
  const raw = node?.sameAs;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const urls = list.map(String);
  return {
    linkedin_url: urls.find((u) => /linkedin\.com\/in\//i.test(u)) || null,
    twitter_url: urls.find((u) => /(?:twitter|x)\.com\//i.test(u)) || null,
  };
}

/**
 * Pull Person / founder / employee entries from schema.org JSON-LD.
 */
export function extractPeopleFromJsonLd(html) {
  if (!html) return [];
  const people = [];
  const pushPerson = (node, roleHint = null) => {
    const types = jsonLdTypes(node);
    const isPerson = types.some((t) => t === 'person' || t.endsWith('/person'));
    const name = jsonLdName(node);
    if (!looksLikePersonName(name) && !(isPerson && name && String(name).trim().length >= 3)) return;
    if (!looksLikePersonName(name) && !/\s/.test(String(name || ''))) return;
    const social = jsonLdSameAsUrls(node);
    const linkedin =
      social.linkedin_url ||
      (typeof node.url === 'string' && /linkedin\.com\/in\//i.test(node.url) ? node.url : null);
    const title =
      roleHint ||
      node.jobTitle ||
      node.roleName ||
      (typeof node.description === 'string' && node.description.length < 80 ? node.description : null) ||
      null;
    if (!title && !linkedin) return;
    const bio =
      typeof node.description === 'string' && node.description.length >= 80
        ? node.description.slice(0, 400)
        : null;
    people.push({
      name: String(name).replace(/\s+/g, ' ').trim(),
      title: title ? String(title).replace(/\s+/g, ' ').trim().slice(0, 120) : null,
      linkedin_url: linkedin,
      twitter_url: social.twitter_url,
      bio,
      source: 'json_ld',
    });
  };

  for (const block of parseJsonLdBlocks(html)) {
    walkJsonLd(block, (node) => {
      const types = jsonLdTypes(node);
      if (types.some((t) => t === 'person' || t.endsWith('/person'))) {
        pushPerson(node);
      }
      // Organization founders / employees / members
      for (const key of ['founder', 'founders', 'employee', 'employees', 'member', 'members', 'alumni']) {
        const val = node[key];
        if (!val) continue;
        const items = Array.isArray(val) ? val : [val];
        for (const item of items) {
          if (typeof item === 'string' && looksLikePersonName(item)) {
            people.push({
              name: item.trim(),
              title: /founder/i.test(key) ? 'Founder' : null,
              linkedin_url: null,
              twitter_url: null,
              bio: null,
              source: 'json_ld',
            });
          } else if (item && typeof item === 'object') {
            pushPerson(item, /founder/i.test(key) ? 'Founder' : null);
          }
        }
      }
    });
  }

  return people;
}

/**
 * Deterministic people extractor for team/about HTML.
 * Sources: JSON-LD Person/Organization, LinkedIn/X links, team cards — does not invent people.
 */
export function extractTeamMembersFromHtml(html) {
  if (!html) return [];
  const people = new Map();

  const addPerson = ({ name, title, linkedin_url, twitter_url, bio, source }) => {
    const cleanName = String(name || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!looksLikePersonName(cleanName)) return;
    const key = cleanName.toLowerCase();
    const prev = people.get(key) || {};
    people.set(key, {
      name: cleanName,
      title: title || prev.title || null,
      linkedin_url: linkedin_url || prev.linkedin_url || null,
      twitter_url: twitter_url || prev.twitter_url || null,
      bio: bio || prev.bio || null,
      source: source || prev.source || 'html',
    });
  };

  for (const p of extractPeopleFromJsonLd(html)) {
    addPerson(p);
  }

  // LinkedIn profile links with aria-label "Name on LinkedIn"
  const liRe =
    /aria-label=["']([^"']+?)\s+on\s+LinkedIn["'][^>]*href=["'](https?:\/\/(?:www\.)?linkedin\.com\/in\/[^"']+)["']|href=["'](https?:\/\/(?:www\.)?linkedin\.com\/in\/[^"']+)["'][^>]*aria-label=["']([^"']+?)\s+on\s+LinkedIn["']/gi;
  let m;
  while ((m = liRe.exec(html))) {
    const name = (m[1] || m[4] || '').trim();
    const url = (m[2] || m[3] || '').trim();
    if (name) addPerson({ name, linkedin_url: url, source: 'linkedin_link' });
  }

  // Bare /in/ links: use nearby title/aria or preceding heading text
  const bareLiRe =
    /(?:title|aria-label)=["']([^"']{3,80})["'][^>]{0,120}href=["'](https?:\/\/(?:www\.)?linkedin\.com\/in\/[^"']+)["']|href=["'](https?:\/\/(?:www\.)?linkedin\.com\/in\/[^"']+)["'][^>]{0,120}(?:title|aria-label)=["']([^"']{3,80})["']/gi;
  while ((m = bareLiRe.exec(html))) {
    const label = stripTags(m[1] || m[4] || '').replace(/\s+on\s+LinkedIn$/i, '');
    const url = (m[2] || m[3] || '').trim();
    if (looksLikePersonName(label)) addPerson({ name: label, linkedin_url: url, source: 'linkedin_link' });
  }

  // X/Twitter profile links with nearby name labels
  const twRe =
    /(?:title|aria-label)=["']([^"']{3,80})["'][^>]{0,120}href=["'](https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[A-Za-z0-9_]+)["']|href=["'](https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[A-Za-z0-9_]+)["'][^>]{0,120}(?:title|aria-label)=["']([^"']{3,80})["']/gi;
  while ((m = twRe.exec(html))) {
    const label = stripTags(m[1] || m[4] || '')
      .replace(/\s+on\s+(?:Twitter|X)$/i, '')
      .replace(/^@/, '');
    const url = (m[2] || m[3] || '').trim();
    if (looksLikePersonName(label)) addPerson({ name: label, twitter_url: url, source: 'twitter_link' });
  }

  // Card patterns: <h2|h3|h4>Name</h*> ... title ... optional bio
    /<h([234])\b[^>]*>([\s\S]*?)<\/h\1>\s*<p\b[^>]*>([\s\S]*?)<\/p>(?:\s*<p\b[^>]*>([\s\S]*?)<\/p>)?/gi;
  while ((m = cardRe.exec(html))) {
    const name = stripTags(m[2]);
    const title = stripTags(m[3]);
    const bio = m[4] ? stripTags(m[4]) : null;
    if (!looksLikePersonName(name)) continue;
    if (
      title &&
      /partner|founder|ceo|cto|coo|cfo|chief|head|director|engineer|manager|associate|analyst|ops|gm\b|investor|president|vp\b|lead/i.test(
        title
      ) &&
      title.length < 120
    ) {
      addPerson({
        name,
        title,
        bio: bio && bio.length < 400 ? bio : null,
        source: 'team_card',
      });
    }
  }

  // Name + role on same line / adjacent spans (common Framer/Webflow pattern)
  const inlineRe =
    />([A-Z][\p{L}'’.\-]+(?:\s+[A-Z][\p{L}'’.\-]+){1,3})<\/(?:span|div|p|h[234])>\s*<(?:span|div|p)[^>]*>\s*([^<]{2,80}?)\s*<\/(?:span|div|p)>/gu;
  while ((m = inlineRe.exec(html))) {
    const name = m[1].trim();
    const title = m[2].replace(/\s+/g, ' ').trim();
    if (
      looksLikePersonName(name) &&
      title.length < 100 &&
      /partner|founder|ceo|cto|coo|cfo|chief|head|director|manager|president|vp\b|lead|engineer|investor/i.test(
        title
      )
    ) {
      addPerson({ name, title, source: 'inline_card' });
    }
  }

  return Array.from(people.values());
}

function pageCharBudget(url) {
  if (/team|about|people|leadership|company|nerdy/i.test(url)) return 40000;
  if (/blog|news|updates|changelog|press/i.test(url)) return 20000;
  // Homepages often need a large body window after stripping head chrome
  return 28000;
}

async function mapPool(items, concurrency, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) || 1 }, () => worker()));
  return out;
}

/**
 * Discover site pages from homepage navigation + seed paths, then fetch the best ones.
 * Follows About / Blog / Updates / Product links listed on the site (same domain only).
 */
export async function fetchCompanyCorpus(
  website,
  {
    perPageChars = 4500,
    maxTotalChars = 24000,
    maxPages = 14,
    fetchConcurrency = 4,
    followBlogPosts = 3,
    companyName = '',
  } = {}
) {
  const base = normalizeSiteUrl(website);
  if (!base) {
    return {
      html: null,
      text: '',
      pagesFetched: [],
      discoveredLinks: [],
      people: [],
      social: { linkedin: null, twitter: null, facebook: null, instagram: null, youtube: null },
    };
  }

  const homeHtml = await fetchWebpage(base.href, {
    maxChars: pageCharBudget(base.href),
    timeoutMs: 18000,
    allowFallbacks: true,
  });

  const candidateMap = new Map();
  const seenOnSite = new Set(); // real <a href>s — not just our seed guesses
  const addCandidate = (url, anchorText = '', bonus = 0, { fromSite = false } = {}) => {
    try {
      const u = new URL(url, base);
      if (u.origin !== base.origin) return;
      u.hash = '';
      const key = u.href;
      const score = scoreCandidate(key, anchorText) + bonus;
      if (score < 0) return;
      if (fromSite) seenOnSite.add(key);
      const prev = candidateMap.get(key);
      if (!prev || score > prev.score) {
        candidateMap.set(key, { url: key, anchorText, score, fromSite: fromSite || prev?.fromSite });
      } else if (fromSite) {
        prev.fromSite = true;
      }
    } catch {
      /* ignore */
    }
  };

  // Always include homepage + common seeds (in case nav is JS-rendered)
  addCandidate(base.href, 'home', 25);
  for (const path of SEED_PATHS) {
    addCandidate(new URL(path, base).href, path.replace(/^\//, '') || 'home', 15);
  }
  // Hard-prioritize team page — Hustle Fund "Meet our Nerdy Team" → /team
  addCandidate(new URL('/team', base).href, 'Meet our Nerdy Team', 50);

  // Discover whatever the homepage actually links to
  for (const link of extractInternalLinks(homeHtml || '', base.href)) {
    addCandidate(link.url, link.anchorText, 20, { fromSite: true });
  }

  let ranked = Array.from(candidateMap.values()).sort((a, b) => b.score - a.score);

  // If the homepage already linked to about/team, skip speculative seed-only misses
  // (e.g. microventures.com has no /about-us — probing it only creates 404 noise)
  const hasSiteAboutOrTeam = ranked.some(
    (c) =>
      c.fromSite && /team|about|people|leadership|our-story|who-we-are/i.test(`${c.url} ${c.anchorText}`)
  );
  if (hasSiteAboutOrTeam) {
    ranked = ranked.filter((c) => {
      if (c.fromSite) return true;
      const path = (() => {
        try {
          return new URL(c.url).pathname.replace(/\/$/, '') || '/';
        } catch {
          return '';
        }
      })();
      // Keep homepage + non-about/team seeds; drop guessed about/team paths
      if (path === '/' || path === '') return true;
      return !/\/(about|about-us|company|team|people|leadership|our-story)(\/|$)/i.test(path);
    });
  }

  // Guarantee team/about URLs are in the first wave even if score ties push them down
  const mustFetch = ranked.filter((c) => /team|about|people|leadership|nerdy/i.test(`${c.url} ${c.anchorText}`));
  const firstWave = [
    ...mustFetch.slice(0, 4),
    ...ranked.filter((c) => !mustFetch.some((m) => m.url === c.url)),
  ].slice(0, maxPages);

  const fetchOne = async (c, { allowFallbacks = false } = {}) => {
    const budget = Math.max(pageCharBudget(c.url), perPageChars + 8000);
    const html = await fetchWebpage(c.url, {
      maxChars: budget,
      timeoutMs: allowFallbacks ? 18000 : 10000,
      allowFallbacks,
      // Seed guesses commonly 404 — don't treat that as a crawl failure
      quiet: !c.fromSite,
    });
    if (!html) return null;
    const signalMatch = html.match(/<!--SIGNALS\n([\s\S]*?)\n-->/);
    const signalText = signalMatch?.[1] || '';
    const textBudget = /team|about|people|leadership/i.test(c.url)
      ? 14000
      : Math.max(perPageChars, 7000);
    const bodyText = htmlToText(html, textBudget);
    const text = [signalText, bodyText].filter(Boolean).join('\n\n').trim();
    // Keep pages with meaningful meta even when body is a JS shell
    if (!text || (text.length < 40 && !signalText)) return null;
    return {
      url: c.url,
      html,
      text,
      score: c.score,
      anchorText: c.anchorText,
      people: extractTeamMembersFromHtml(html),
    };
  };

  // Homepage first (sequential) — most important evidence; allows IP-block fallbacks
  const homeCandidate = { url: base.href, anchorText: 'home', score: 999 };
  const homePage = await fetchOne(homeCandidate, { allowFallbacks: true });
  // If homepage only came via meta fallback, skip blasting seed URLs (they'll also be blocked)
  const homepageBlocked = !homeHtml || /microlink meta fallback/i.test(homePage?.text || '');
  const firstWaveRest = homepageBlocked
    ? []
    : firstWave.filter((c) => c.url !== base.href).slice(0, Math.max(0, maxPages - 1));
  const restPages = (
    await mapPool(firstWaveRest, Math.min(2, fetchConcurrency), (c) => fetchOne(c))
  ).filter(Boolean);
  const firstPages = [homePage, ...restPages].filter(Boolean);

  // Second wave: from blog/news/updates index pages, pull a few latest article links
  const blogIndexes = firstPages.filter((p) =>
    /blog|news|updates|changelog|press|announcements/i.test(p.url)
  );
  for (const idxPage of blogIndexes.slice(0, 2)) {
    for (const link of extractInternalLinks(idxPage.html, idxPage.url)) {
      addCandidate(link.url, link.anchorText, 30, { fromSite: true });
    }
  }

  ranked = Array.from(candidateMap.values()).sort((a, b) => b.score - a.score);
  const fetchedSet = new Set(firstPages.map((p) => p.url));
  const articleCandidates = ranked
    .filter((c) => !fetchedSet.has(c.url))
    .filter((c) =>
      /blog|news|updates|changelog|press|post|article|announcement/i.test(`${c.url} ${c.anchorText}`)
    )
    .slice(0, followBlogPosts);

  const articlePages = (await mapPool(articleCandidates, Math.min(2, fetchConcurrency), fetchOne)).filter(
    Boolean
  );

  const pages = [...firstPages, ...articlePages];
  const byUrl = new Map();
  for (const p of pages) {
    if (!byUrl.has(p.url)) byUrl.set(p.url, p);
  }
  // Always keep homepage HTML for title/meta even if body text is thin (SPA shells)
  if (homeHtml && !byUrl.has(base.href)) {
    const signalMatch = homeHtml.match(/<!--SIGNALS\n([\s\S]*?)\n-->/);
    const signalText = signalMatch?.[1] || extractHeadSignals(homeHtml).signalText || '';
    const homeText = [signalText, htmlToText(homeHtml, Math.max(perPageChars, 7000))]
      .filter(Boolean)
      .join('\n\n')
      .trim();
    if (homeText.length >= 20) {
      byUrl.set(base.href, {
        url: base.href,
        html: homeHtml,
        text: homeText,
        score: 999,
        anchorText: 'home',
        people: extractTeamMembersFromHtml(homeHtml),
      });
    }
  }
  const uniquePages = Array.from(byUrl.values()).sort((a, b) => (b.score || 0) - (a.score || 0));

  // Merge people extracted from team/about pages + JSON-LD; prefer leadership
  const peopleMap = new Map();
  for (const p of uniquePages) {
    for (const person of p.people || []) {
      const key = person.name.toLowerCase();
      const prev = peopleMap.get(key) || {};
      peopleMap.set(key, {
        name: person.name,
        title: person.title || prev.title || null,
        linkedin_url: person.linkedin_url || prev.linkedin_url || null,
        twitter_url: person.twitter_url || prev.twitter_url || null,
        bio: person.bio || prev.bio || null,
        source: person.source || prev.source || 'html',
      });
    }
  }
  const combinedHtmlEarly = uniquePages.map((p) => p.html).filter(Boolean).join('\n');
  const socialEarly = extractSocialLinks(combinedHtmlEarly || homeHtml || '', website);
  const peopleRaw = preferLeadershipTeam(Array.from(peopleMap.values()), {
    max: 12,
    companyName,
    companySocial: socialEarly,
  });
  // Local bio hints + optional PDL — before roster is written into the Claude pack
  const people = await enrichFounders(peopleRaw, {
    companyName:
      companyName ||
      (() => {
        try {
          return base.hostname.replace(/^www\./, '');
        } catch {
          return '';
        }
      })(),
    website,
    maxEnrich: 8,
  });

  const combinedHtml = uniquePages.map((p) => p.html).join('\n');
  const textParts = [];
  let used = 0;
  for (const p of uniquePages) {
    if (!p.text) continue;
    const label = p.anchorText ? ` (${p.anchorText})` : '';
    const chunk = `\n\n--- PAGE: ${p.url}${label} ---\n${p.text}`;
    if (used + chunk.length > maxTotalChars) {
      textParts.push(chunk.slice(0, Math.max(0, maxTotalChars - used)));
      break;
    }
    textParts.push(chunk);
    used += chunk.length;
  }

  // Explicit team roster block for Claude (high signal)
  if (people.length) {
    const roster = people.map((p) => formatFounderForPrompt(p)).join('\n');
    textParts.unshift(
      `\n\n--- EXTRACTED TEAM ROSTER (from website markup / JSON-LD) ---\n${roster}\n`
    );
  }

  // Only surface links actually found on crawled HTML — seed guesses looked like fake "nav"
  const discoveredLinks = ranked
    .filter((c) => c.fromSite || seenOnSite.has(c.url))
    .slice(0, 40)
    .map((c) => ({
      url: c.url,
      anchorText: c.anchorText,
      score: c.score,
    }));

  return {
    html: combinedHtml || homeHtml || null,
    homeHtml: homeHtml || null,
    text: textParts.join('').trim(),
    pagesFetched: uniquePages.map((p) => p.url),
    discoveredLinks,
    people,
    social: extractSocialLinks(combinedHtml || homeHtml || '', website),
  };
}

/**
 * Fetch LinkedIn company (or /in/) page text when a URL is known.
 * LinkedIn often returns a login wall — we still capture whatever public HTML is available.
 */
export async function fetchLinkedInCorpus(linkedinUrl, { maxChars = 6000 } = {}) {
  if (!linkedinUrl) {
    return { url: null, text: '', fetched: false, note: 'No LinkedIn URL found on website' };
  }
  const html = await fetchWebpage(linkedinUrl, { maxChars: maxChars + 2000, timeoutMs: 8000 });
  if (!html) {
    return {
      url: linkedinUrl,
      text: '',
      fetched: false,
      note: 'LinkedIn fetch failed or blocked — use URL as presence signal only',
    };
  }
  const text = htmlToText(html, maxChars);
  const blocked =
    /sign in|join linkedin|authwall|session_redirect/i.test(text) && text.length < 800;
  return {
    url: linkedinUrl,
    text: blocked ? '' : text,
    fetched: !blocked && text.length > 100,
    note: blocked
      ? 'LinkedIn returned login wall; comparison relies on website + LinkedIn URL presence'
      : 'LinkedIn public text captured',
    html,
  };
}

export async function fetchPresenceBundle(website, { companyName = '' } = {}) {
  const site = await fetchCompanyCorpus(website, { companyName });
  const linkedin = await fetchLinkedInCorpus(site.social?.linkedin);
  const homepageHtml = site.homeHtml || site.html || '';
  const facts = extractWebsiteFacts(homepageHtml, website, site);
  const textChars = (site.text || '').length;
  const thinCrawl = textChars < 200;

  // When body crawl is thin (SPA shell or blocked), still surface meta/JSON-LD loudly
  const fallbackCopy = [
    facts.title ? `Page title: ${facts.title}` : null,
    facts.metaDescription ? `Meta description: ${facts.metaDescription}` : null,
    facts.h1 ? `H1: ${facts.h1}` : null,
    facts.navOffers?.length
      ? `On-site links: ${facts.navOffers.map((n) => n.label).join(' · ')}`
      : null,
    thinCrawl
      ? 'Note: live HTML body was thin (likely JS-rendered SPA or bot-limited response). Prefer title/meta/JSON-LD below.'
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  const websiteBlock = [
    site.text || null,
    fallbackCopy || null,
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    ...site,
    linkedin,
    websiteFacts: facts,
    crawl_text_chars: textChars,
    crawl_thin: thinCrawl,
    presenceText: [
      `=== WEBSITE ===\n${websiteBlock || '(unavailable)'}`,
      facts.factsBlock ? `=== DETERMINISTIC WEBSITE FACTS ===\n${facts.factsBlock}` : '',
      // Only include LinkedIn block when real public copy was captured (not login walls)
      linkedin.fetched && linkedin.text
        ? `=== LINKEDIN (${linkedin.url}) ===\n${linkedin.text}`
        : '',
    ]
      .filter(Boolean)
      .join('\n\n'),
  };
}

/**
 * Reliable, crawl-only fields we can usually fill without guessing.
 */
export function extractWebsiteFacts(html, website, corpus = {}) {
  const title =
    html?.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() || null;
  const metaDescription =
    html?.match(
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i
    )?.[1] ||
    html?.match(
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i
    )?.[2] ||
    null;
  const h1 =
    html
      ?.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
      ?.replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || null;

  const social = corpus.social || extractSocialLinks(html || '', website);
  const navOffers = (corpus.discoveredLinks || [])
    .filter((l) => l.score >= 60)
    .slice(0, 12)
    .map((l) => ({
      label: l.anchorText || l.url,
      url: l.url,
    }));

  const blogHeadlines = [];
  const headingRe = /<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/gi;
  let hm;
  const blogHtmlParts = (corpus.pagesFetched || [])
    .filter((u) => /blog|news|updates|press/i.test(u))
    .slice(0, 3);
  // Use combined html if available
  const scanHtml = html || '';
  while ((hm = headingRe.exec(scanHtml)) && blogHeadlines.length < 8) {
    const t = hm[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (t && t.length > 12 && t.length < 140 && !/our team|pricing|features|about/i.test(t)) {
      blogHeadlines.push(t);
    }
  }

  const people = corpus.people || [];
  const pagesFetched = corpus.pagesFetched || [];
  const tech = detectTechStack(html || '');

  const factsBlock = [
    title ? `Page title: ${title}` : null,
    h1 ? `H1: ${h1}` : null,
    metaDescription ? `Meta description: ${metaDescription}` : null,
    social.linkedin ? `Company LinkedIn: ${social.linkedin}` : null,
    social.twitter ? `Company X/Twitter: ${social.twitter}` : null,
    pagesFetched.length ? `Pages crawled: ${pagesFetched.join(', ')}` : null,
    navOffers.length
      ? `Nav / offers: ${navOffers.map((n) => n.label).join(' · ')}`
      : null,
    people.length
      ? `Team on site (${people.length}): ${people.map((p) => `${p.name}${p.title ? ` (${p.title})` : ''}`).join('; ')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    title,
    h1,
    metaDescription,
    tagline: h1 || metaDescription || title,
    social,
    navOffers,
    blogHeadlines: [...new Set(blogHeadlines)].slice(0, 8),
    people,
    pagesFetched,
    tech,
    factsBlock,
  };
}

export function scoreProfileCompleteness(data) {
  if (!data) return 0;
  let score = 0;
  const cmp = data.comparison || {};
  const checks = [
    data.summary && data.summary.length > 80,
    data.tagline,
    data.primary_value_prop,
    data.target_audience,
    data.business_model,
    Array.isArray(data.strengths) && data.strengths.filter((s) => s?.title).length >= 3,
    Array.isArray(data.weaknesses) && data.weaknesses.filter((w) => w?.title).length >= 3,
    cmp.overall_verdict,
    Array.isArray(cmp.where_we_win) && cmp.where_we_win.length >= 2,
    Array.isArray(cmp.where_we_fall_short) && cmp.where_we_fall_short.length >= 1,
    Array.isArray(cmp.where_same) && cmp.where_same.length >= 1,
    Array.isArray(cmp.where_they_differentiate) && cmp.where_they_differentiate.length >= 1,
    cmp.overlap_level || cmp.market_overlap_score != null,
    cmp.true_competitor_label,
    Array.isArray(cmp.feature_matrix) && cmp.feature_matrix.length >= 4,
  ];
  for (const ok of checks) if (ok) score += 1;
  return Math.round((score / checks.length) * 100);
}

export function htmlToText(html, maxChars = 5000) {
  if (!html) return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, maxChars);
}

export function detectTechStack(html) {
  if (!html) return [];
  const found = [];
  for (const sig of TECH_SIGNATURES) {
    if (sig.patterns.some((p) => p.test(html))) {
      found.push({
        technology: sig.tech,
        category: sig.category,
        confidence: 'high',
        evidence: 'Detected in page HTML/assets',
      });
    }
  }
  return found;
}

export function extractSocialLinks(html, website) {
  if (!html) {
    return { linkedin: null, twitter: null, facebook: null, instagram: null, youtube: null, domain: '' };
  }
  const first = (re) => {
    const match = String(html).match(re);
    if (!match) return null;
    return match[0].replace(/["'>\s]+$/, '').split('"')[0];
  };

  const linkedin =
    first(/https?:\/\/(?:www\.)?linkedin\.com\/company\/[A-Za-z0-9\-_%/]+/i) || null;
  const twitter =
    first(/https?:\/\/(?:www\.)?(?:twitter|x)\.com\/(?!share|intent|home|search|i\/|hashtag\/)[A-Za-z0-9_]+/i) ||
    null;
  const facebook =
    first(/https?:\/\/(?:www\.)?facebook\.com\/(?!sharer|share\.php|dialog\/)[A-Za-z0-9.]+/i) || null;
  const instagram =
    first(/https?:\/\/(?:www\.)?instagram\.com\/(?!p\/|reel\/|stories\/)[A-Za-z0-9_.]+/i) || null;
  const youtube =
    first(/https?:\/\/(?:www\.)?youtube\.com\/(?:c\/|channel\/|@|user\/)[A-Za-z0-9_\-]+/i) || null;

  let domain = '';
  try {
    domain = new URL(website.includes('://') ? website : `https://${website}`).hostname.replace(/^www\./, '');
  } catch {
    domain = '';
  }

  return { linkedin, twitter, facebook, instagram, youtube, domain };
}

export function companySocialEntries(social = {}) {
  return [
    social.linkedin && { label: 'LinkedIn', url: social.linkedin },
    social.twitter && { label: 'X / Twitter', url: social.twitter },
    social.facebook && { label: 'Facebook', url: social.facebook },
    social.instagram && { label: 'Instagram', url: social.instagram },
    social.youtube && { label: 'YouTube', url: social.youtube },
  ].filter(Boolean);
}

/**
 * Site tone = clarity/confidence of website messaging (NOT Twitter/social listening).
 * 80–100 strong · 60–79 solid · 40–59 mixed · 0–39 weak/thin
 */
export function deriveSiteTone({
  facts = {},
  presenceText = '',
  strengths = [],
  weaknesses = [],
  modelTone = null,
} = {}) {
  const positive = [];
  const negative = [];
  let score = 32;

  if (facts.metaDescription && facts.metaDescription.length > 50) {
    score += 14;
    positive.push('Clear meta value proposition');
  } else if (facts.metaDescription) {
    score += 6;
  } else {
    score -= 6;
    negative.push('Missing or weak meta description');
  }

  if (facts.h1 && facts.h1.length > 8) {
    score += 10;
    positive.push(`Lead claim: “${facts.h1.slice(0, 80)}”`);
  } else {
    negative.push('No strong H1 claim on crawled pages');
  }

  if (facts.title) score += 4;

  const pages = facts.pagesFetched?.length || 0;
  if (pages >= 5) {
    score += 12;
    positive.push('Multi-page site depth');
  } else if (pages >= 2) {
    score += 6;
  } else {
    score -= 4;
    negative.push('Thin crawlable footprint');
  }

  if ((facts.people || []).length >= 2) {
    score += 8;
    positive.push('Team visible on site');
  }
  if ((facts.navOffers || []).length >= 4) {
    score += 8;
    positive.push('Clear product / offer navigation');
  }

  const text = String(presenceText || '');
  if (
    /portfolio|syndicate|cap\s*table|angel|investor|pricing|\$\d+|AI|dashboard|deal|fundraise/i.test(
      text
    )
  ) {
    score += 10;
    positive.push('Specific category language');
  }
  if (/microlink meta fallback|JS-rendered SPA|bot-limited|thin crawl/i.test(text)) {
    score -= 12;
    negative.push('Limited live HTML (SPA shell or blocked crawl)');
  }

  for (const s of (strengths || []).slice(0, 3)) {
    if (s?.title) positive.push(s.title);
  }
  for (const w of (weaknesses || []).slice(0, 3)) {
    if (w?.title) negative.push(w.title);
  }

  // Prefer Claude tone when present and well-formed
  if (modelTone && typeof modelTone === 'object') {
    const mScore = Number(modelTone.score);
    if (!Number.isNaN(mScore)) score = Math.round(0.55 * score + 0.45 * mScore);
    const mPos = Array.isArray(modelTone.positive_themes)
      ? modelTone.positive_themes
      : String(modelTone.positive_themes || '')
          .split(/[·|,;]/)
          .map((x) => x.trim())
          .filter(Boolean);
    const mNeg = Array.isArray(modelTone.negative_themes)
      ? modelTone.negative_themes
      : String(modelTone.negative_themes || '')
          .split(/[·|,;]/)
          .map((x) => x.trim())
          .filter(Boolean);
    for (const t of mPos.slice(0, 4)) positive.push(t);
    for (const t of mNeg.slice(0, 4)) negative.push(t);
    if (modelTone.summary && String(modelTone.summary).length > 40) {
      // keep model summary but stamp grading note below
    }
  }

  score = Math.min(100, Math.max(0, Math.round(score)));
  const band =
    score >= 80 ? 'strong' : score >= 60 ? 'solid' : score >= 40 ? 'mixed' : 'weak';

  const uniq = (arr) =>
    [...new Set(arr.map((x) => String(x).trim()).filter((x) => x && x !== '—'))].slice(0, 6);

  const pos = uniq(positive);
  const neg = uniq(negative);

  const modelSummary =
    modelTone?.summary && String(modelTone.summary).length > 40 ? String(modelTone.summary) : null;

  const summary =
    modelSummary ||
    `Website messaging reads as ${band} (${score}/100). This scores how clearly and confidently the site states what they do and for whom — from value prop, specificity, and crawlable depth — not Twitter/social listening.`;

  return {
    sentiment_score: score,
    sentiment_summary: summary,
    positive_themes: pos.length ? pos.join(' · ') : '',
    negative_themes: neg.length ? neg.join(' · ') : '',
    tone_band: band,
  };
}

export function domainFromWebsite(website) {
  try {
    const u = new URL(website.includes('://') ? website : `https://${website}`);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** Prefer high-res icons when present in crawled HTML. Never use OG social cards. */
export function extractLogoFromHtml(html, website) {
  if (!html) return null;
  const domain = domainFromWebsite(website);
  const base = website?.includes('://') ? website : domain ? `https://${domain}` : null;
  const candidates = [];
  const push = (raw) => {
    if (!raw) return;
    try {
      const abs = new URL(raw, base || undefined).href;
      if (!/^https?:\/\//i.test(abs)) return;
      // Skip Open Graph / Twitter card images (often homepage screenshots)
      if (isSocialCardImageUrl(abs)) return;
      candidates.push(abs);
    } catch {
      /* ignore */
    }
  };

  for (const m of html.matchAll(
    /<link[^>]+rel=["'][^"']*(?:apple-touch-icon|icon|shortcut icon|mask-icon)[^"']*["'][^>]*>/gi
  )) {
    const href = m[0].match(/href=["']([^"']+)["']/i)?.[1];
    push(href);
  }
  // Do NOT fall back to og:image — those are marketing cards, not logos

  const ranked = candidates.sort((a, b) => scoreLogoUrl(b) - scoreLogoUrl(a));
  return ranked[0] || null;
}

export function isSocialCardImageUrl(url) {
  const u = String(url || '').toLowerCase();
  return (
    /\/og(\.|$|\/)|opengraph|open-graph|og-image|ogimage|twitter-card|social[-_]?card|unfurl|link[-_]?preview/i.test(
      u
    ) || /[?&](og|utm_|width=1200|h=630)/i.test(u)
  );
}

function scoreLogoUrl(url) {
  const u = String(url || '');
  if (isSocialCardImageUrl(u)) return -100;
  return (
    (/apple-touch/i.test(u) ? 60 : 0) +
    (/icon-192|icon-512|android-chrome/i.test(u) ? 40 : 0) +
    (/\.svg(\?|$)/i.test(u) ? 35 : 0) +
    (/favicon/i.test(u) ? 10 : 0) +
    (/\.png(\?|$)/i.test(u) ? 15 : 0)
  );
}

/**
 * Stable logo URL for storage — site icons only, never OG screenshots.
 */
export function logoUrlFor(website) {
  const domain = domainFromWebsite(website);
  if (!domain) return null;
  if (domain === 'divi.fund' || domain.endsWith('.divi.fund')) return '/divi-logo.png';
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}

export function logoCandidatesFor(website, preferred = null) {
  const domain = domainFromWebsite(website);
  const list = [];
  if (preferred && !isSocialCardImageUrl(preferred)) list.push(preferred);
  if (domain) {
    list.push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`);
    list.push(`https://icons.duckduckgo.com/ip3/${domain}.ico`);
    list.push(`https://icon.horse/icon/${domain}`);
    list.push(`https://${domain}/apple-touch-icon.png`);
    list.push(`https://${domain}/favicon.ico`);
    list.push(`https://${domain}/favicon.svg`);
  }
  return [...new Set(list.filter(Boolean))];
}

/**
 * Free Google News RSS — no API key required.
 */
export async function fetchGoogleNews(companyName, limit = 6) {
  try {
    const q = encodeURIComponent(`"${companyName}"`);
    const url = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DiviIntelligenceBot/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;
    while ((match = itemRegex.exec(xml)) && items.length < limit) {
      const block = match[1];
      const title = decodeXml(block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/i)?.[1] || block.match(/<title>(.*?)<\/title>/i)?.[1] || '');
      const link = block.match(/<link>(.*?)<\/link>/i)?.[1] || '';
      const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/i)?.[1] || '';
      const source = decodeXml(block.match(/<source[^>]*>(.*?)<\/source>/i)?.[1] || 'Google News');
      if (title) {
        items.push({
          title: title.trim(),
          url: link.trim(),
          published_at: pubDate.trim(),
          source_name: source.trim(),
        });
      }
    }
    return items;
  } catch {
    return [];
  }
}

function decodeXml(str) {
  return String(str || '')
    .replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function parseJsonFromModel(text) {
  if (!text) return null;
  let cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  if (start === -1) return null;
  let candidate = cleaned.substring(start);
  const end = candidate.lastIndexOf('}');
  if (end !== -1) candidate = candidate.substring(0, end + 1);

  const attempts = [candidate];
  // Soft-repair truncated JSON: close open braces/brackets
  let repaired = candidate.replace(/,\s*$/, '');
  const opens = (repaired.match(/\{/g) || []).length;
  const closes = (repaired.match(/\}/g) || []).length;
  const openArr = (repaired.match(/\[/g) || []).length;
  const closeArr = (repaired.match(/\]/g) || []).length;
  if (openArr > closeArr) repaired += ']'.repeat(openArr - closeArr);
  if (opens > closes) repaired += '}'.repeat(opens - closes);
  attempts.push(repaired);

  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch {
      /* try next */
    }
  }
  return null;
}

export function calculateOverallRisk(funding, team, feature, market, growth) {
  return Math.round(
    (funding || 50) * 0.15 +
      (team || 50) * 0.25 +
      (feature || 50) * 0.35 +
      (market || 50) * 0.15 +
      (growth || 50) * 0.1
  );
}

export function threatTierFromScore(score) {
  if (score > 75) return 'critical';
  if (score > 60) return 'high';
  if (score > 40) return 'medium';
  return 'monitor';
}
