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
