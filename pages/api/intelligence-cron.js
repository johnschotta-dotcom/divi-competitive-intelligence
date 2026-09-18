import runIntelligence from '../../lib/agentRunner';

export const config = {
  maxDuration: 300,
};

/**
 * Cron entrypoint — keeps vercel.json path clean (no query string).
 * Refreshes the oldest 2 active competitors per run.
 */
export default async function handler(req, res) {
  req.query = {
    ...(req.query || {}),
    stale: '1',
    limit: '2',
  };
  try {
    return await runIntelligence(req, res);
  } catch (error) {
    console.error('Intelligence cron crash:', error);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: error?.message || 'Intelligence cron failed',
      });
    }
  }
}
