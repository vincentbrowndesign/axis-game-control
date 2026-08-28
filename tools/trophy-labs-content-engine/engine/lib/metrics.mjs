/**
 * The learning loop.
 *
 * Raw reach is deliberately the least valuable signal here. A campaign that
 * reaches 50,000 people and produces no film is worth less to Trophy Labs than
 * one that reaches 2,000 and produces ten qualified uploads.
 */
export const VALUE_LADDER = [
  { key: 'qualifiedFilmUploads', label: 'Qualified film uploads', weight: 100 },
  { key: 'resourceClicks', label: 'Resource clicks', weight: 20 },
  { key: 'dmOptIns', label: 'DM opt-ins', weight: 12 },
  { key: 'keywordComments', label: 'Keyword conversations', weight: 10 },
  { key: 'shares', label: 'Shares', weight: 4 },
  { key: 'saves', label: 'Saves', weight: 3 },
  { key: 'follows', label: 'Profile follows', weight: 2 },
  { key: 'websiteVisits', label: 'Website visits', weight: 2 },
  { key: 'profileVisits', label: 'Profile visits', weight: 1 },
  { key: 'reach', label: 'Raw reach', weight: 0.01 },
  { key: 'unfollows', label: 'Unfollows and negative responses', weight: -3 },
];

export const METRIC_FIELDS = [
  'reach', 'carouselCompletionRate', 'saves', 'shares', 'profileVisits', 'follows',
  'keywordComments', 'openingDmsSent', 'dmOptIns', 'followRequestConversions',
  'resourceClicks', 'unfollows', 'websiteVisits', 'qualifiedFilmUploads',
];

export function blankPerformance(campaignId) {
  const measured = Object.fromEntries(METRIC_FIELDS.map((field) => [field, null]));
  return {
    campaignId,
    measuredAt: null,
    windowDays: 7,
    measured,
    notes: '',
  };
}

const FUNNEL = [
  ['reach', 'keywordComments', 'Reach to keyword comment'],
  ['keywordComments', 'openingDmsSent', 'Comment to opening DM'],
  ['openingDmsSent', 'dmOptIns', 'Opening DM to opt-in'],
  ['dmOptIns', 'resourceClicks', 'Opt-in to resource click'],
  ['resourceClicks', 'qualifiedFilmUploads', 'Resource click to qualified film upload'],
];

export function scorePerformance(performance) {
  const measured = performance.measured ?? {};
  let value = 0;
  const contributions = [];
  for (const rung of VALUE_LADDER) {
    const count = measured[rung.key];
    if (typeof count !== 'number') continue;
    const points = count * rung.weight;
    value += points;
    contributions.push({ ...rung, count, points: Math.round(points * 100) / 100 });
  }
  const funnel = FUNNEL.map(([from, to, label]) => {
    const start = measured[from];
    const end = measured[to];
    const rate = typeof start === 'number' && typeof end === 'number' && start > 0
      ? Math.round((end / start) * 10000) / 100
      : null;
    return { label, from, to, start, end, ratePercent: rate };
  });
  const missing = METRIC_FIELDS.filter((field) => typeof measured[field] !== 'number');
  return {
    campaignValue: Math.round(value * 100) / 100,
    contributions: contributions.sort((a, b) => b.points - a.points),
    funnel,
    missingMetrics: missing,
    complete: missing.length === 0,
  };
}

export function performanceMarkdown(campaign, performance, score) {
  const rows = score.contributions
    .map((row) => `| ${row.label} | ${row.count} | ${row.weight} | ${row.points} |`)
    .join('\n');
  const funnel = score.funnel
    .map((step) => `| ${step.label} | ${step.start ?? '-'} | ${step.end ?? '-'} | ${step.ratePercent === null ? '-' : `${step.ratePercent}%`} |`)
    .join('\n');
  return `# Performance - ${campaign.campaignId}

Measured: ${performance.measuredAt ?? 'not yet measured'} (${performance.windowDays}-day window)

Campaign value: **${score.campaignValue}**

The value score weights outcomes the way Trophy Labs actually values them:
qualified film uploads first, raw reach last. It is a comparison instrument
between campaigns, not a public metric.

## Value contributions

| Signal | Count | Weight | Points |
|---|---|---|---|
${rows}

## Funnel

| Step | Start | End | Rate |
|---|---|---|---|
${funnel}

${score.complete ? 'All metrics recorded.' : `Missing metrics: ${score.missingMetrics.join(', ')}`}

## Notes

${performance.notes || '_none_'}
`;
}

export function comparisonMarkdown(entries) {
  const rows = entries
    .map((entry) => {
      const measured = entry.performance?.measured ?? {};
      return `| ${entry.campaignId} | ${entry.date} | ${entry.pillar} | ${entry.keyword} | ` +
        `${measured.reach ?? '-'} | ${measured.saves ?? '-'} | ${measured.keywordComments ?? '-'} | ` +
        `${measured.resourceClicks ?? '-'} | ${measured.qualifiedFilmUploads ?? '-'} | ${entry.score?.campaignValue ?? '-'} |`;
    })
    .join('\n');
  return `# Campaign comparison

Ranked by campaign value, not by reach.

| Campaign | Date | Pillar | Keyword | Reach | Saves | Keyword comments | Resource clicks | Film uploads | Value |
|---|---|---|---|---|---|---|---|---|---|
${rows}
`;
}
