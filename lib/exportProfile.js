/**
 * Client-side profile export (PDF / DOCX) for sharing Divi comparisons externally.
 */

function asList(value) {
  if (Array.isArray(value)) return value.map((x) => String(x || '').trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function slugify(name) {
  return String(name || 'competitor')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

export function buildExportModel({
  competitor,
  profile,
  comparison,
  strengths = [],
  weaknesses = [],
  founders = [],
  sentiment = null,
  isDivi = false,
} = {}) {
  const name = competitor?.name || 'Competitor';
  const matrix = Array.isArray(comparison?.feature_matrix) ? comparison.feature_matrix : [];
  const whereWeWin = asList(comparison?.divi_wins || comparison?.where_we_win);
  const whereWeFallShort = asList(comparison?.competitor_wins || comparison?.where_we_fall_short);
  const whereSame = asList(comparison?.where_same);
  const whereDiff = asList(comparison?.where_differentiate || comparison?.where_they_differentiate);
  const overlap =
    competitor?.market_overlap_score ?? comparison?.market_overlap_score ?? competitor?.threat_score;
  const trueLabel = (
    competitor?.true_competitor_label ||
    comparison?.true_competitor_label ||
    competitor?.tier ||
    ''
  )
    .toString()
    .replace(/_/g, ' ');

  return {
    title: isDivi ? `Divi — Gold Standard Reference` : `Divi vs ${name}`,
    subtitle: isDivi
      ? 'Internal reference profile'
      : 'Competitive intelligence — website positioning',
    name,
    website: competitor?.website || '',
    tagline: competitor?.tagline || profile?.primary_value_prop || '',
    overlap: overlap != null ? String(overlap) : '—',
    trueLabel: trueLabel || '—',
    analyzedAt: competitor?.last_analyzed
      ? new Date(competitor.last_analyzed).toLocaleString()
      : new Date().toLocaleString(),
    summary: profile?.overall_summary || '',
    valueProp: profile?.primary_value_prop || '',
    audience: profile?.target_audience || '',
    businessModel: profile?.business_model || '',
    verdict: comparison?.overall_verdict || '',
    recommendation: comparison?.strategic_recommendation || '',
    evidence: comparison?.evidence_basis || 'company websites',
    whereWeWin,
    whereWeFallShort,
    whereSame,
    whereDiff,
    matrix: matrix.map((row) => ({
      capability: row.label || row.feature || '',
      divi: row.divi || '',
      competitor: row.competitor || '',
      edge: (row.winner || 'tie').toString().toUpperCase(),
      evidence: row.evidence || '',
    })),
    strengths: (strengths || [])
      .map((s) => ({ title: s.title || '', why: s.why || s.description || '' }))
      .filter((s) => s.title),
    weaknesses: (weaknesses || [])
      .map((w) => ({
        title: w.title || '',
        advantage: w.divi_advantage || w.description || '',
      }))
      .filter((w) => w.title),
    founders: (founders || [])
      .map((f) => {
        const extras = [
          f.location,
          f.prior_companies
            ? `Prior: ${Array.isArray(f.prior_companies) ? f.prior_companies.join(', ') : f.prior_companies}`
            : null,
          f.education
            ? `Education: ${Array.isArray(f.education) ? f.education.join(', ') : f.education}`
            : null,
        ].filter(Boolean);
        return `${f.name}${f.title ? ` — ${f.title}` : ''}${extras.length ? ` (${extras.join(' · ')})` : ''}`;
      })
      .filter(Boolean),
    siteTone:
      sentiment?.score != null
        ? `${sentiment.score}/100${sentiment.summary ? ` — ${sentiment.summary}` : ''}`
        : '',
    filenameBase: `divi-vs-${slugify(name)}-${new Date().toISOString().slice(0, 10)}`,
  };
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function wrapPdfText(doc, text, x, y, maxWidth, lineHeight = 5.2) {
  const lines = doc.splitTextToSize(String(text || ''), maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function ensurePdfSpace(doc, y, need = 24) {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + need < pageHeight - 16) return y;
  doc.addPage();
  return 18;
}

export async function downloadProfilePdf(model) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 16;
  const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;
  let y = 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  y = wrapPdfText(doc, model.title, margin, y, maxWidth, 7);
  y += 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90);
  y = wrapPdfText(doc, model.subtitle, margin, y, maxWidth);
  y += 2;
  doc.setTextColor(20);
  y = wrapPdfText(
    doc,
    `${model.website || ''}  ·  Overlap ${model.overlap}/100  ·  ${model.trueLabel}  ·  ${model.analyzedAt}`,
    margin,
    y,
    maxWidth
  );
  y += 4;

  const section = (heading) => {
    y = ensurePdfSpace(doc, y, 14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(197, 35, 161);
    y = wrapPdfText(doc, heading, margin, y, maxWidth, 6);
    doc.setTextColor(20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y += 1;
  };

  const para = (text) => {
    if (!text) return;
    y = ensurePdfSpace(doc, y, 16);
    y = wrapPdfText(doc, text, margin, y, maxWidth);
    y += 3;
  };

  const bullets = (items) => {
    for (const item of items) {
      y = ensurePdfSpace(doc, y, 10);
      y = wrapPdfText(doc, `• ${item}`, margin, y, maxWidth);
      y += 1.5;
    }
    y += 2;
  };

  if (model.verdict) {
    section('Positioning verdict');
    para(model.verdict);
  }
  if (model.summary) {
    section('Website snapshot');
    para(model.summary);
  }
  if (model.valueProp || model.audience || model.businessModel) {
    section('Positioning basics');
    if (model.valueProp) para(`Value prop: ${model.valueProp}`);
    if (model.audience) para(`Audience: ${model.audience}`);
    if (model.businessModel) para(`Business model: ${model.businessModel}`);
  }

  if (model.whereWeWin.length) {
    section('Where Divi wins');
    bullets(model.whereWeWin);
  }
  if (model.whereWeFallShort.length) {
    section('Where Divi falls short');
    bullets(model.whereWeFallShort);
  }
  if (model.whereSame.length) {
    section('Where we look the same');
    bullets(model.whereSame);
  }
  if (model.whereDiff.length) {
    section('How they differentiate');
    bullets(model.whereDiff);
  }

  if (model.matrix.length) {
    section('Capability claims');
    for (const row of model.matrix) {
      y = ensurePdfSpace(doc, y, 18);
      doc.setFont('helvetica', 'bold');
      y = wrapPdfText(doc, `${row.capability}  [${row.edge}]`, margin, y, maxWidth);
      doc.setFont('helvetica', 'normal');
      y = wrapPdfText(doc, `Divi: ${row.divi}`, margin, y, maxWidth);
      y = wrapPdfText(doc, `${model.name}: ${row.competitor}`, margin, y, maxWidth);
      if (row.evidence) y = wrapPdfText(doc, `Evidence: ${row.evidence}`, margin, y, maxWidth);
      y += 3;
    }
  }

  if (model.strengths.length) {
    section('Strengths (from their site)');
    bullets(model.strengths.map((s) => (s.why ? `${s.title} — ${s.why}` : s.title)));
  }
  if (model.weaknesses.length) {
    section('Gaps vs Divi');
    bullets(
      model.weaknesses.map((w) => (w.advantage ? `${w.title} — Divi edge: ${w.advantage}` : w.title))
    );
  }
  if (model.founders.length) {
    section('Team listed on website');
    bullets(model.founders);
  }
  if (model.siteTone) {
    section('Site tone');
    para(model.siteTone);
  }
  if (model.recommendation) {
    section('Strategic recommendation');
    para(model.recommendation);
  }

  y = ensurePdfSpace(doc, y, 12);
  doc.setFontSize(8);
  doc.setTextColor(120);
  wrapPdfText(
    doc,
    `Prepared with Divi Competitive Intelligence · Evidence: ${model.evidence}`,
    margin,
    y,
    maxWidth,
    4
  );

  doc.save(`${model.filenameBase}.pdf`);
}

export async function downloadProfileDocx(model) {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    Table,
    TableRow,
    TableCell,
    WidthType,
    BorderStyle,
  } = await import('docx');

  const h = (text, level = HeadingLevel.HEADING_1) =>
    new Paragraph({
      text,
      heading: level,
      spacing: { before: 240, after: 120 },
    });

  const p = (text) =>
    new Paragraph({
      children: [new TextRun({ text: String(text || ''), size: 20 })],
      spacing: { after: 120 },
    });

  const bullets = (items) =>
    items.map(
      (item) =>
        new Paragraph({
          text: String(item),
          bullet: { level: 0 },
          spacing: { after: 60 },
        })
    );

  const thin = { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' };
  const borders = { top: thin, bottom: thin, left: thin, right: thin };

  const cell = (text, bold = false) =>
    new TableCell({
      borders,
      width: { size: 2500, type: WidthType.DXA },
      children: [
        new Paragraph({
          children: [new TextRun({ text: String(text || ''), bold, size: 18 })],
        }),
      ],
    });

  const children = [
    new Paragraph({
      children: [new TextRun({ text: model.title, bold: true, size: 32, color: 'C523A1' })],
      spacing: { after: 80 },
    }),
    p(model.subtitle),
    p(
      `${model.website || ''} · Overlap ${model.overlap}/100 · ${model.trueLabel} · Analyzed ${model.analyzedAt}`
    ),
  ];

  if (model.verdict) {
    children.push(h('Positioning verdict', HeadingLevel.HEADING_2), p(model.verdict));
  }
  if (model.summary) {
    children.push(h('Website snapshot', HeadingLevel.HEADING_2), p(model.summary));
  }
  if (model.valueProp || model.audience || model.businessModel) {
    children.push(h('Positioning basics', HeadingLevel.HEADING_2));
    if (model.valueProp) children.push(p(`Value prop: ${model.valueProp}`));
    if (model.audience) children.push(p(`Audience: ${model.audience}`));
    if (model.businessModel) children.push(p(`Business model: ${model.businessModel}`));
  }
  if (model.whereWeWin.length) {
    children.push(h('Where Divi wins', HeadingLevel.HEADING_2), ...bullets(model.whereWeWin));
  }
  if (model.whereWeFallShort.length) {
    children.push(
      h('Where Divi falls short', HeadingLevel.HEADING_2),
      ...bullets(model.whereWeFallShort)
    );
  }
  if (model.whereSame.length) {
    children.push(h('Where we look the same', HeadingLevel.HEADING_2), ...bullets(model.whereSame));
  }
  if (model.whereDiff.length) {
    children.push(h('How they differentiate', HeadingLevel.HEADING_2), ...bullets(model.whereDiff));
  }

  if (model.matrix.length) {
    children.push(h('Capability claims', HeadingLevel.HEADING_2));
    children.push(
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        rows: [
          new TableRow({
            children: [
              cell('Capability', true),
              cell('Divi', true),
              cell(model.name, true),
              cell('Edge', true),
            ],
          }),
          ...model.matrix.map(
            (row) =>
              new TableRow({
                children: [
                  cell(row.capability),
                  cell(row.divi),
                  cell(row.competitor),
                  cell(row.edge),
                ],
              })
          ),
        ],
      })
    );
  }

  if (model.strengths.length) {
    children.push(
      h('Strengths (from their site)', HeadingLevel.HEADING_2),
      ...bullets(model.strengths.map((s) => (s.why ? `${s.title} — ${s.why}` : s.title)))
    );
  }
  if (model.weaknesses.length) {
    children.push(
      h('Gaps vs Divi', HeadingLevel.HEADING_2),
      ...bullets(
        model.weaknesses.map((w) =>
          w.advantage ? `${w.title} — Divi edge: ${w.advantage}` : w.title
        )
      )
    );
  }
  if (model.founders.length) {
    children.push(h('Team listed on website', HeadingLevel.HEADING_2), ...bullets(model.founders));
  }
  if (model.siteTone) {
    children.push(h('Site tone', HeadingLevel.HEADING_2), p(model.siteTone));
  }
  if (model.recommendation) {
    children.push(h('Strategic recommendation', HeadingLevel.HEADING_2), p(model.recommendation));
  }

  children.push(
    new Paragraph({
      spacing: { before: 400 },
      children: [
        new TextRun({
          text: `Prepared with Divi Competitive Intelligence · Evidence: ${model.evidence}`,
          italics: true,
          size: 16,
          color: '888888',
        }),
      ],
    })
  );

  const doc = new Document({
    creator: 'Divi Competitive Intelligence',
    title: model.title,
    description: model.subtitle,
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, `${model.filenameBase}.docx`);
}
