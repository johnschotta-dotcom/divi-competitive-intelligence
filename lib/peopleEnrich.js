/**
 * Enrich extracted team members: local bio parsing + optional People Data Labs.
 * Never invents people — only fills fields for names already found on the website.
 */

const LEADERSHIP_RE =
  /\b(founder|co-?founder|ceo|cto|coo|cfo|chief|partner|managing\s+partner|general\s+partner|\bgp\b|president|head\s+of|vp\b|vice\s+president|director|managing\s+director|owner|principal)\b/i;

const PRIOR_PATTERNS = [
  /formerly\s+(?:at\s+|with\s+|of\s+)?([^.,;|]+)/gi,
  /previously\s+(?:at\s+|with\s+|of\s+)?([^.,;|]+)/gi,
  /ex[-–—]\s*([A-Z][\w&.\- ]{1,40})/g,
  /before\s+that,?\s+(?:at\s+|with\s+)?([^.,;|]+)/gi,
  /(?:alum(?:nus|na)?|alumni)\s+(?:of\s+)?([^.,;|]+)/gi,
  /(?:spent|worked)\s+(?:\d+\+?\s+years?\s+)?(?:at\s+|with\s+)([^.,;|]+)/gi,
];

function cleanOrg(raw) {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    .replace(/^(the|a|an)\s+/i, '')
    .replace(/\s+(where|and|before|after|as)\b.*$/i, '')
    .trim()
    .slice(0, 80);
}

/** Pull prior companies / schools hinted in an on-page bio. */
export function parseBioHints(bio) {
  const text = String(bio || '');
  if (!text) return { prior_companies: [], education: [] };

  const prior = new Set();
  for (const re of PRIOR_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      const org = cleanOrg(m[1]);
      if (org.length >= 2 && org.length <= 60 && !/^(he|she|they|his|her|the|our)/i.test(org)) {
        prior.add(org);
      }
    }
  }

  const education = [];
  const eduRe =
    /(?:MBA|M\.?S\.?|B\.?S\.?|B\.?A\.?|Ph\.?D\.?|degree)\s+(?:from\s+|at\s+)?([A-Z][^.,;|]{2,50})|(?:University|College|School|Institute)\s+of\s+[^.,;|]{2,40}|[A-Z][^.,;|]{2,40}\s+(?:University|College)/g;
  let em;
  while ((em = eduRe.exec(text)) && education.length < 3) {
    const hit = cleanOrg(em[0]);
    if (hit.length >= 4) education.push(hit);
  }

  return {
    prior_companies: Array.from(prior).slice(0, 5),
    education: [...new Set(education)].slice(0, 3),
  };
}

export function isLeadershipTitle(title) {
  return LEADERSHIP_RE.test(String(title || ''));
}

/**
 * Prefer founders/execs; keep LinkedIn-linked people; cap size.
 */
export function preferLeadershipTeam(people, { max = 12 } = {}) {
  const list = Array.isArray(people) ? people.filter((p) => p?.name) : [];
  if (list.length <= max) {
    // Still rank leadership first when we have titles
    return [...list].sort((a, b) => {
      const as = (isLeadershipTitle(a.title) ? 2 : 0) + (a.linkedin_url ? 1 : 0);
      const bs = (isLeadershipTitle(b.title) ? 2 : 0) + (b.linkedin_url ? 1 : 0);
      return bs - as;
    });
  }

  const leaders = list.filter((p) => isLeadershipTitle(p.title) || p.linkedin_url);
  const pool = leaders.length >= 3 ? leaders : list;
  return pool
    .sort((a, b) => {
      const as = (isLeadershipTitle(a.title) ? 2 : 0) + (a.linkedin_url ? 1 : 0) + (a.bio ? 1 : 0);
      const bs = (isLeadershipTitle(b.title) ? 2 : 0) + (b.linkedin_url ? 1 : 0) + (b.bio ? 1 : 0);
      return bs - as;
    })
    .slice(0, max);
}

function mergePerson(base, patch) {
  const prior = [
    ...new Set(
      [...(base.prior_companies || []), ...(patch.prior_companies || [])]
        .map((x) => String(x || '').trim())
        .filter(Boolean)
    ),
  ].slice(0, 6);
  const education = [
    ...new Set(
      [...(base.education || []), ...(patch.education || [])]
        .map((x) => String(x || '').trim())
        .filter(Boolean)
    ),
  ].slice(0, 4);

  return {
    ...base,
    title: patch.title || base.title || null,
    linkedin_url: patch.linkedin_url || base.linkedin_url || null,
    twitter_url: patch.twitter_url || base.twitter_url || null,
    bio: base.bio || patch.bio || null,
    location: patch.location || base.location || null,
    prior_companies: prior,
    education,
    enrichment_source: patch.enrichment_source || base.enrichment_source || null,
  };
}

function applyLocalEnrichment(person) {
  const hints = parseBioHints(person.bio);
  return mergePerson(person, {
    prior_companies: hints.prior_companies,
    education: hints.education,
    enrichment_source: hints.prior_companies.length || hints.education.length ? 'website_bio' : null,
  });
}

function pdlApiKey() {
  return process.env.PEOPLE_DATA_LABS_API_KEY || process.env.PDL_API_KEY || '';
}

function mapPdlRecord(data) {
  if (!data || typeof data !== 'object') return null;
  const experience = Array.isArray(data.experience) ? data.experience : [];
  const prior = experience
    .map((e) => e?.company?.name || e?.company_name || null)
    .filter(Boolean)
    .slice(0, 6);
  // Drop current company duplicate later in caller
  const education = (Array.isArray(data.education) ? data.education : [])
    .map((e) => e?.school?.name || e?.school_name || null)
    .filter(Boolean)
    .slice(0, 3);

  const linkedin =
    data.linkedin_url ||
    (Array.isArray(data.profiles)
      ? data.profiles.find((p) => /linkedin/i.test(p?.network || p?.url || ''))?.url
      : null) ||
    null;
  const twitter =
    data.twitter_url ||
    (Array.isArray(data.profiles)
      ? data.profiles.find((p) => /twitter|x\.com/i.test(p?.network || p?.url || ''))?.url
      : null) ||
    null;

  return {
    title: data.job_title || data.headline || null,
    linkedin_url: linkedin,
    twitter_url: twitter,
    location: data.location_name || data.job_company_location_name || null,
    prior_companies: prior,
    education,
    bio: data.summary ? String(data.summary).slice(0, 400) : null,
    enrichment_source: 'peopledatalabs',
  };
}

async function enrichViaPdl(person, { companyName, website } = {}) {
  const key = pdlApiKey();
  if (!key) return null;

  const params = new URLSearchParams();
  params.set('pretty', 'false');
  params.set('min_likelihood', '5');
  if (person.linkedin_url) {
    params.set('profile', person.linkedin_url);
  } else {
    params.set('name', person.name);
    if (companyName) params.set('company', companyName);
    else if (website) params.set('company', website);
    else return null;
  }

  try {
    const res = await fetch(`https://api.peopledatalabs.com/v5/person/enrich?${params}`, {
      headers: {
        'X-Api-Key': key,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(12000),
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      console.warn(`[peopleEnrich] PDL ${res.status} for ${person.name}`);
      return null;
    }
    const json = await res.json();
    const mapped = mapPdlRecord(json.data || json);
    if (!mapped) return null;

    // Prefer website title/bio; use PDL for missing identity fields
    const companyLc = String(companyName || '').toLowerCase();
    mapped.prior_companies = (mapped.prior_companies || []).filter(
      (c) => c.toLowerCase() !== companyLc && !c.toLowerCase().includes(companyLc.slice(0, 12))
    );
    return mapped;
  } catch (err) {
    console.warn(`[peopleEnrich] PDL failed for ${person.name}:`, err?.message || err);
    return null;
  }
}

/**
 * Enrich a list of website-extracted people.
 * Local bio hints always run; PDL runs when PEOPLE_DATA_LABS_API_KEY / PDL_API_KEY is set.
 */
export async function enrichFounders(
  people,
  { companyName = '', website = '', maxEnrich = 8 } = {}
) {
  const ranked = preferLeadershipTeam(people, { max: Math.max(maxEnrich, 12) });
  const local = ranked.map(applyLocalEnrichment);
  const toEnrich = local.slice(0, maxEnrich);

  if (!pdlApiKey()) {
    return local;
  }

  const enriched = [];
  for (const person of toEnrich) {
    const pdl = await enrichViaPdl(person, { companyName, website });
    enriched.push(pdl ? mergePerson(person, pdl) : person);
  }
  // Append any leftover local-only people beyond maxEnrich
  return [...enriched, ...local.slice(maxEnrich)];
}

export function formatFounderForPrompt(p) {
  const bits = [
    p.name,
    p.title ? ` — ${p.title}` : '',
    p.location ? ` | Location: ${p.location}` : '',
    p.linkedin_url ? ` | LinkedIn: ${p.linkedin_url}` : '',
    p.twitter_url ? ` | X: ${p.twitter_url}` : '',
    p.prior_companies?.length ? ` | Prior: ${p.prior_companies.join(', ')}` : '',
    p.education?.length ? ` | Education: ${p.education.join(', ')}` : '',
    p.bio ? ` | Bio: ${p.bio}` : '',
  ];
  return `- ${bits.join('')}`;
}
