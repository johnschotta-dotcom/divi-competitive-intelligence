import runIntelligence from '../lib/agentRunner';

export const config = {
  maxDuration: 300,
};

export default async function handler(req, res) {
  try {
    return await runIntelligence(req, res);
  } catch (error) {
    console.error('intelligence-enhanced crash:', error);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: error?.message || 'Intelligence agent failed',
      });
    }
  }
}

