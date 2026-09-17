/**
 * DIVI gold standard — the reference every competitor is scored against.
 * Sourced from Divi product baseline + company one-pager. Update as Divi ships.
 */
export const DIVI_BASELINE = {
  name: 'Divi',
  website: 'https://divi.fund',
  tagline: 'The intelligence layer for private-market investors',
  audience:
    'Aspiring and active angel investors, syndicate leaders, emerging managers, accelerators, angel groups, family offices, and venture firms',
  vision:
    'Make private-market investing more informed, connected, and accessible—especially beyond traditional Silicon Valley networks',
  businessModel:
    'SaaS — AI portfolio intelligence, syndicate workflows, and investor operating tools for angels and emerging managers (including accessible syndicate packaging ~$99/mo)',
  headquarters: 'United States',
  founded_year: null,
  employee_estimate: 'Early-stage / lean',
  revenue_estimate: 'Early SaaS (internal)',
  total_funding_display: 'Private / not used as a public funding benchmark',
  primary_value_prop:
    'Bring portfolio data, founder communications, market context, co-investor activity, and syndicate workflows into one system of record — with AI-powered Investment Health Score™ and longitudinal intelligence that turn fragmented information into timely signals',
  company_overview: `Divi is building the intelligence layer for private-market investors. Angel investors and syndicate leaders currently manage portfolios across inboxes, spreadsheets, founder updates, and informal conversations, making it difficult to see what changed, identify risk early, or know where they can help. Divi brings portfolio data, founder communications, market context, co-investor activity, and syndicate workflows into one system of record. Our AI-powered Investment Health Score™ and longitudinal intelligence turn fragmented information into timely signals so investors can make better decisions and become more valuable partners to founders.`,
  company_history_summary:
    'Divi is building the intelligence layer for private-market investors: one system of record for portfolio data, founder communications, market context, co-investor activity, and syndicate workflows, powered by Investment Health Score™ and longitudinal AI intelligence.',
  problem_statement:
    'Angels and syndicate leaders juggle inboxes, spreadsheets, founder updates, and informal conversations — hard to see what changed, spot risk early, or know where to help',
  pillars: [
    'System of record for private-market portfolios (holdings + ownership context)',
    'Founder communications and updates in one place',
    'Market context + co-investor activity signals',
    'AI-powered Investment Health Score™ and longitudinal intelligence',
    'Syndicate / SPV workflows for angels and emerging managers',
    'Help investors become more valuable partners to founders',
  ],
  strengths: [
    {
      title: 'Intelligence layer, not just a tracker',
      why: 'Investment Health Score™ and longitudinal AI turn fragmented portfolio noise into timely decision signals',
    },
    {
      title: 'System of record across the real angel workflow',
      why: 'Unifies portfolio data, founder communications, market context, co-investor activity, and syndicate workflows',
    },
    {
      title: 'Built for private-market operators beyond SV networks',
      why: 'Vision is informed, connected, accessible investing for aspiring and active angels, syndicates, groups, and emerging managers',
    },
    {
      title: 'Makes investors more valuable to founders',
      why: 'Surfaces where investors can help — not only what they own',
    },
  ],
  positioning_vs_market:
    'Divi is the gold standard reference: the intelligence layer / system of record for private-market investors. Competitors whose primary job is angel/individual portfolio tracking and reporting are DIRECT on overlap even without AI or syndicates. Deal marketplaces and institutional LP/fund-admin portals are usually adjacent or tangential.',
  comparisonDimensions: [
    {
      key: 'portfolio_tracking',
      label: 'Portfolio / system of record',
      divi: 'One system of record for private-market holdings and ownership context',
    },
    {
      key: 'ai_intelligence',
      label: 'AI investor intelligence',
      divi: 'Investment Health Score™ + longitudinal intelligence for timely risk and opportunity signals',
    },
    {
      key: 'founder_comms',
      label: 'Founder communications / updates',
      divi: 'Founder communications and updates captured alongside portfolio data',
    },
    {
      key: 'coinvestor_context',
      label: 'Co-investor & market context',
      divi: 'Market context and co-investor activity in the same operating surface',
    },
    {
      key: 'syndicate_tools',
      label: 'Syndicate / SPV tools',
      divi: 'Syndicate workflows designed for angels and emerging managers',
    },
    {
      key: 'education',
      label: 'Investor skill-building / partner value',
      divi: 'Helps investors make better decisions and become more valuable partners to founders',
    },
    {
      key: 'deal_flow',
      label: 'Deal flow & discovery',
      divi: 'Primary focus is post-investment intelligence + ops; discovery is secondary',
    },
    {
      key: 'pricing_accessibility',
      label: 'Pricing accessibility for individual angels',
      divi: 'Packaged for aspiring/active angels and small syndicates, not only institutional funds',
    },
    {
      key: 'workflow_depth',
      label: 'Day-to-day angel workflow depth',
      divi: 'End-to-end private-market OS: track → communicate → score health → act via syndicates',
    },
    {
      key: 'ai_differentiation',
      label: 'True AI differentiation (not marketing veneer)',
      divi: 'AI is a first-class product surface (Investment Health Score™ / longitudinal signals)',
    },
  ],
};

export function isDiviCompany(comp) {
  const name = String(comp?.name || '').trim().toLowerCase();
  const site = String(comp?.website || '').toLowerCase();
  return (
    name === 'divi' ||
    name === 'divi.fund' ||
    site.includes('divi.fund') ||
    site.includes('divi.com')
  );
}

export function diviGoldStandardBrief() {
  return `
DIVI GOLD STANDARD (our company — compare every competitor against this, never treat Divi as a peer threat to itself):
- Product: ${DIVI_BASELINE.tagline}
- Website: ${DIVI_BASELINE.website}
- ICP / who we serve: ${DIVI_BASELINE.audience}
- Vision: ${DIVI_BASELINE.vision}
- Problem we solve: ${DIVI_BASELINE.problem_statement}
- Company overview: ${DIVI_BASELINE.company_overview}
- Business model: ${DIVI_BASELINE.businessModel}
- Value prop: ${DIVI_BASELINE.primary_value_prop}
- Pillars: ${DIVI_BASELINE.pillars.join('; ')}
- Core strengths: ${DIVI_BASELINE.strengths.map((s) => `${s.title} (${s.why})`).join('; ')}
- Positioning: ${DIVI_BASELINE.positioning_vs_market}
- Comparison dimensions:
${DIVI_BASELINE.comparisonDimensions.map((d) => `  • ${d.label}: Divi = ${d.divi}`).join('\n')}
`.trim();
}
