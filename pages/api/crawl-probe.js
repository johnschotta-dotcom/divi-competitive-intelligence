import { fetchPresenceBundle, fetchWebpage, htmlToText } from '../../lib/freeData.js';

export const config = {
  maxDuration: 60,
};

/**
 * Debug endpoint: /api/crawl-probe?url=https://example.com
 * Shows whether Vercel can fetch usable website copy.
 */
export default async function handler(req, res) {
  const url = String(req.query.url || '').trim();
  if (!url) {
    return res.status(400).json({
      error: 'Pass ?url=https://example.com',
    });
  }

  try {
    const started = Date.now();
    const html = await fetchWebpage(url, { maxChars: 28000, timeoutMs: 18000 });
    const text = html ? htmlToText(html, 8000) : '';
    const signalMatch = html?.match(/<!--SIGNALS\n([\s\S]*?)\n-->/);
    const bundle = await fetchPresenceBundle(url);
    return res.status(200).json({
      ok: true,
      url,
      ms: Date.now() - started,
      html_chars: html?.length || 0,
      text_chars: text.length,
      signals: signalMatch?.[1] || null,
      text_sample: text.slice(0, 500),
      bundle: {
        pages_fetched: bundle.pagesFetched || [],
        crawl_text_chars: bundle.crawl_text_chars,
        crawl_thin: bundle.crawl_thin,
        facts: bundle.websiteFacts?.factsBlock || null,
        presence_sample: String(bundle.presenceText || '').slice(0, 800),
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
