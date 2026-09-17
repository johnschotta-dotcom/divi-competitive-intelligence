/**
 * Free / no-key data helpers for competitive intelligence enrichment.
 */

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

export async function fetchWebpage(url, { maxChars = 8000, timeoutMs = 8000 } = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; DiviIntelligenceBot/1.0; +https://divi.fund)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return null;
    const html = await response.text();
    return html.substring(0, maxChars);
  } catch {
    return null;
  }
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
  { re: /about|company|our-story|who-we-are/i, score: 100 },
  { re: /team|founders|leadership|people/i, score: 95 },
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
    perPageChars = 3200,
    maxTotalChars = 16000,
    maxPages = 14,
    fetchConcurrency = 4,
    followBlogPosts = 3,
  } = {}
) {
  const base = normalizeSiteUrl(website);
  if (!base) {
    return {
      html: null,
      text: '',
      pagesFetched: [],
      discoveredLinks: [],
      social: { linkedin: null, twitter: null },
    };
  }

  const homeHtml = await fetchWebpage(base.href, {
    maxChars: perPageChars + 4000,
    timeoutMs: 8000,
  });

  const candidateMap = new Map();
  const addCandidate = (url, anchorText = '', bonus = 0) => {
    try {
      const u = new URL(url, base);
      if (u.origin !== base.origin) return;
      u.hash = '';
      const key = u.href;
      const score = scoreCandidate(key, anchorText) + bonus;
      if (score < 0) return;
      const prev = candidateMap.get(key);
      if (!prev || score > prev.score) {
        candidateMap.set(key, { url: key, anchorText, score });
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

  // Discover whatever the homepage actually links to
  for (const link of extractInternalLinks(homeHtml || '', base.href)) {
    addCandidate(link.url, link.anchorText, 20);
  }

  let ranked = Array.from(candidateMap.values()).sort((a, b) => b.score - a.score);

  // First wave: top marketing pages
  const firstWave = ranked.slice(0, maxPages);
  const firstPages = (
    await mapPool(firstWave, fetchConcurrency, async (c) => {
      const html = await fetchWebpage(c.url, { maxChars: perPageChars + 2000, timeoutMs: 7000 });
      if (!html) return null;
      return {
        url: c.url,
        html,
        text: htmlToText(html, perPageChars),
        score: c.score,
        anchorText: c.anchorText,
      };
    })
  ).filter(Boolean);

  // Second wave: from blog/news/updates index pages, pull a few latest article links
  const blogIndexes = firstPages.filter((p) =>
    /blog|news|updates|changelog|press|announcements/i.test(p.url)
  );
  for (const idxPage of blogIndexes.slice(0, 2)) {
    for (const link of extractInternalLinks(idxPage.html, idxPage.url)) {
      addCandidate(link.url, link.anchorText, 30);
    }
  }

  ranked = Array.from(candidateMap.values()).sort((a, b) => b.score - a.score);
  const fetchedSet = new Set(firstPages.map((p) => p.url));
  const articleCandidates = ranked
    .filter((c) => !fetchedSet.has(c.url))
    .filter((c) => /blog|news|updates|changelog|press|post|article|announcement/i.test(`${c.url} ${c.anchorText}`))
    .slice(0, followBlogPosts);

  const articlePages = (
    await mapPool(articleCandidates, Math.min(3, fetchConcurrency), async (c) => {
      const html = await fetchWebpage(c.url, { maxChars: perPageChars + 2000, timeoutMs: 7000 });
      if (!html) return null;
      return {
        url: c.url,
        html,
        text: htmlToText(html, perPageChars),
        score: c.score,
        anchorText: c.anchorText,
      };
    })
  ).filter(Boolean);

  const pages = [...firstPages, ...articlePages];
  // Dedupe by URL
  const byUrl = new Map();
  for (const p of pages) {
    if (!byUrl.has(p.url)) byUrl.set(p.url, p);
  }
  const uniquePages = Array.from(byUrl.values()).sort((a, b) => (b.score || 0) - (a.score || 0));

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

  return {
    html: combinedHtml || homeHtml || null,
    text: textParts.join('').trim(),
    pagesFetched: uniquePages.map((p) => p.url),
    discoveredLinks: ranked.slice(0, 40).map((c) => ({
      url: c.url,
      anchorText: c.anchorText,
      score: c.score,
    })),
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

export async function fetchPresenceBundle(website) {
  const site = await fetchCompanyCorpus(website);
  const linkedin = await fetchLinkedInCorpus(site.social?.linkedin);
  return {
    ...site,
    linkedin,
    presenceText: [
      site.text ? `=== WEBSITE ===\n${site.text}` : '=== WEBSITE ===\n(unavailable)',
      linkedin.url
        ? `=== LINKEDIN (${linkedin.url}) ===\n${linkedin.text || `(${linkedin.note})`}`
        : '=== LINKEDIN ===\n(no company LinkedIn link found on website)',
    ].join('\n\n'),
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
    cmp.market_overlap_score != null,
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
  if (!html) return { linkedin: null, twitter: null, foundersHint: [] };
  const linkedin =
    html.match(/https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[A-Za-z0-9\-_%/]+/i)?.[0] ||
    null;
  const twitter =
    html.match(/https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[A-Za-z0-9_]+/i)?.[0] || null;

  let domain = '';
  try {
    domain = new URL(website).hostname.replace(/^www\./, '');
  } catch {
    domain = '';
  }

  return { linkedin, twitter, domain };
}

export function logoUrlFor(website) {
  try {
    const domain = new URL(website).hostname.replace(/^www\./, '');
    return `https://logo.clearbit.com/${domain}`;
  } catch {
    return null;
  }
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
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.substring(start, end + 1));
  } catch {
    return null;
  }
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
