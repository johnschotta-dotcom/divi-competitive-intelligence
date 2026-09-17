/**
 * DIVI gold standard — the reference every competitor is scored against.
 * Update this file as Divi ships product; the agent injects it into every analysis.
 */
export const DIVI_BASELINE = {
  name: 'Divi',
  website: 'https://divi.fund',
  tagline: 'AI-native platform that helps angel investors manage portfolios and become better investors',
  audience: 'Angel investors, syndicate leads, emerging managers, and operators who invest personally',
  businessModel:
    'SaaS — accessible syndicate creation/management (~$99/mo) plus AI portfolio intelligence and investor education',
  headquarters: 'United States',
  founded_year: null,
  employee_estimate: 'Early-stage / lean',
  revenue_estimate: 'Early SaaS (internal)',
  total_funding_display: 'Private / not used as a public funding benchmark',
  primary_value_prop:
    'Turn angel investing from scattered spreadsheets and gut feel into an AI-assisted operating system for portfolios, syndicates, and skill-building',
  company_history_summary:
    'Divi is building the AI-native operating layer for angels: portfolio tracking from cap tables, intelligence dashboards, syndicate tooling, and education in one product.',
  pillars: [
    'Portfolio tracking from cap tables (single source of truth for holdings)',
    'AI Intelligence Dashboard for deal/portfolio insight and monitoring',
    'Syndicate creation and management tools priced for individual angels',
    'Investor education that helps angels become better decision-makers',
  ],
  strengths: [
    {
      title: 'AI-native investor OS',
      why: 'Intelligence is core product, not a bolt-on report — designed around angel workflows end-to-end',
    },
    {
      title: 'Portfolio + syndicate + education in one',
      why: 'Competitors often specialize in one wedge; Divi combines operating tools with skill-building',
    },
    {
      title: 'Accessible syndicate economics',
      why: 'Syndicate tools priced for angels (~$99/mo) vs enterprise fund platforms',
    },
    {
      title: 'Cap-table-aware portfolio tracking',
      why: 'Grounds intelligence in actual ownership data rather than vanity dashboards',
    },
  ],
  positioning_vs_market:
    'Divi is the gold standard reference: AI-assisted angel operations. Competitors whose primary job is angel/individual portfolio tracking and reporting are DIRECT on overlap even without AI, syndicates, or education. Deal marketplaces and institutional LP/fund-admin portals are usually adjacent or tangential.',
  comparisonDimensions: [
    {
      key: 'portfolio_tracking',
      label: 'Portfolio / cap table tracking',
      divi: 'Native AI-assisted portfolio tracking grounded in cap tables',
    },
    {
      key: 'ai_intelligence',
      label: 'AI investor intelligence',
      divi: 'AI Intelligence Dashboard for monitoring, insight, and better decisions',
    },
    {
      key: 'syndicate_tools',
      label: 'Syndicate / SPV tools',
      divi: 'Syndicate creation & management designed for angels (~$99/mo entry)',
    },
    {
      key: 'education',
      label: 'Investor education & skill-building',
      divi: 'Built-in education to help angels become better investors',
    },
    {
      key: 'deal_flow',
      label: 'Deal flow & discovery',
      divi: 'Primary focus is portfolio ops + syndicates; discovery is secondary to operating intelligence',
    },
    {
      key: 'pricing_accessibility',
      label: 'Pricing accessibility for individual angels',
      divi: 'Priced and packaged for individual angels and small syndicates',
    },
    {
      key: 'workflow_depth',
      label: 'Day-to-day angel workflow depth',
      divi: 'End-to-end angel OS: track → analyze → syndicate → learn',
    },
    {
      key: 'ai_differentiation',
      label: 'True AI differentiation (not marketing veneer)',
      divi: 'AI is a first-class product surface for investor intelligence',
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
- ICP: ${DIVI_BASELINE.audience}
- Business model: ${DIVI_BASELINE.businessModel}
- Value prop: ${DIVI_BASELINE.primary_value_prop}
- Pillars: ${DIVI_BASELINE.pillars.join('; ')}
- Core strengths: ${DIVI_BASELINE.strengths.map((s) => `${s.title} (${s.why})`).join('; ')}
- Positioning: ${DIVI_BASELINE.positioning_vs_market}
- Comparison dimensions:
${DIVI_BASELINE.comparisonDimensions.map((d) => `  • ${d.label}: Divi = ${d.divi}`).join('\n')}
`.trim();
}
