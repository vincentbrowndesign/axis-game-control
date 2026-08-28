#!/usr/bin/env node
/**
 * Trophy Labs content engine.
 *
 * One basketball topic in, one approval-gated Instagram campaign package out.
 * Internal marketing and operations tooling. It is not imported by the Axis app,
 * it adds no route, and it never publishes anything by itself.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { brand } from './lib/brand.mjs';
import { blankPerformance, comparisonMarkdown, performanceMarkdown, scorePerformance } from './lib/metrics.mjs';
import {
  altTextMarkdown, campaignJson, captionMarkdown, manychatMarkdown,
  receiptMarkdown, resourceUrl, sourcesMarkdown,
} from './lib/package.mjs';
import { draftingPrompt } from './lib/prompt.mjs';
import { findChromium, measureResource, measureSlides, renderPdf, renderSlidePngs, writeSlideHtml } from './lib/render.mjs';
import { runQa } from './lib/qa.mjs';
import { resourceHtml } from './lib/resource.mjs';
import { fontFaces } from './lib/brand.mjs';
import { ROOT, fail, heading, info, ok, readJson, sha256, slugify, warn } from './lib/util.mjs';

const ENGINE = { name: 'trophy-labs-content-engine', version: readJson(join(ROOT, 'package.json')).version };
const TOPICS = join(ROOT, 'topics');
const CAMPAIGNS = join(ROOT, 'campaigns');

const REQUIRED_FIELDS = [
  'campaignId', 'date', 'profile', 'pillar', 'title', 'sourceType', 'centralQuestion',
  'pointOfView', 'hooks', 'slides', 'caption', 'keyword', 'resource', 'manychat',
  'claims', 'productClaims',
];

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token.startsWith('--')) {
      const [key, inline] = token.slice(2).split('=');
      if (inline !== undefined) flags[key] = inline;
      else if (argv[index + 1] && !argv[index + 1].startsWith('--')) flags[key] = argv[++index];
      else flags[key] = true;
    } else positional.push(token);
  }
  return { positional, flags };
}

function loadSpec(reference) {
  const candidates = [
    reference,
    join(TOPICS, reference),
    join(TOPICS, `${reference}.json`),
  ];
  const path = candidates.find((candidate) => candidate && existsSync(candidate) && statSync(candidate).isFile());
  if (!path) throw new Error(`No topic spec found for "${reference}". Try: trophy-labs list`);
  const spec = readJson(path);
  const missing = REQUIRED_FIELDS.filter((field) => spec[field] === undefined);
  if (missing.length) throw new Error(`Topic spec is missing required fields: ${missing.join(', ')}`);
  if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/.test(spec.campaignId)) {
    throw new Error(`campaignId must look like YYYY-MM-DD-slug, got "${spec.campaignId}"`);
  }
  return { spec, path };
}

function writeArtifact(artifacts, outDir, relativePath, contents) {
  const path = join(outDir, relativePath);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, contents);
  const bytes = Buffer.isBuffer(contents) ? contents.length : Buffer.byteLength(contents);
  artifacts.push({ path: relativePath, bytes, sha256: sha256(readFileSync(path)) });
  return path;
}

function recordExisting(artifacts, outDir, relativePath) {
  const path = join(outDir, relativePath);
  const contents = readFileSync(path);
  artifacts.push({ path: relativePath, bytes: contents.length, sha256: sha256(contents) });
}

function commandGenerate({ positional, flags }) {
  const reference = positional[0] ?? readdirSync(TOPICS).find((name) => name.endsWith('.json'));
  if (!reference) throw new Error('No topic spec given and topics/ is empty.');
  const { spec, path: specPath } = loadSpec(reference);
  const outDir = flags.out ? resolve(String(flags.out)) : join(CAMPAIGNS, spec.campaignId);
  const source = flags['source-text'] ? { text: readFileSync(String(flags['source-text']), 'utf8') } : null;

  heading(`Trophy Labs campaign: ${spec.campaignId}`);
  info(`spec ${specPath}`);
  info(`out  ${outDir}`);

  const artifacts = [];
  const prepared = writeSlideHtml(spec, outDir);
  const textLayers = prepared.flatMap((entry) => entry.textLayers);
  ok(`${prepared.length} slide layouts composed`);

  const binary = flags['no-render'] ? null : findChromium();
  let measurements = [];
  let renderer = 'skipped';
  if (binary) {
    measurements = measureSlides(binary, prepared, outDir);
    ok(`layout measured in ${binary}`);
    const pngs = renderSlidePngs(binary, prepared, outDir);
    for (const png of pngs) recordExisting(artifacts, outDir, png.slice(outDir.length + 1));
    ok(`${pngs.length} slides rendered at ${brand.canvas.width}x${brand.canvas.height}`);
    renderer = binary;
  } else {
    warn('no Chromium found - slides not rendered, overflow check skipped');
  }

  const resourcePath = writeArtifact(artifacts, outDir, 'resource.html', resourceHtml(spec));
  let resourceMeasurement = null;
  if (binary) {
    renderPdf(binary, resourcePath, join(outDir, 'resource.pdf'));
    recordExisting(artifacts, outDir, 'resource.pdf');
    resourceMeasurement = measureResource(binary, resourcePath, outDir);
    ok(`resource rendered: ${spec.resource.title}`);
  }

  const qa = runQa(spec, { textLayers, measurements, resource: resourceMeasurement, source });
  writeArtifact(artifacts, outDir, 'caption.md', captionMarkdown(spec));
  writeArtifact(artifacts, outDir, 'alt-text.md', altTextMarkdown(spec));
  writeArtifact(artifacts, outDir, 'manychat.md', manychatMarkdown(spec));
  writeArtifact(artifacts, outDir, 'sources.md', sourcesMarkdown(spec));
  writeArtifact(artifacts, outDir, 'qa.json', `${JSON.stringify(qa, null, 2)}\n`);
  const performanceFile = join(outDir, 'performance.json');
  if (!existsSync(performanceFile)) {
    writeArtifact(artifacts, outDir, 'performance.json', `${JSON.stringify(blankPerformance(spec.campaignId), null, 2)}\n`);
  } else recordExisting(artifacts, outDir, 'performance.json');

  const receipt = {
    generatedAt: new Date().toISOString(),
    engine: ENGINE,
    render: {
      renderer,
      width: brand.canvas.width,
      height: brand.canvas.height,
      fontsEmbedded: fontFaces().embedded,
    },
    humanApproval: 'REQUIRED',
    publicationAuthorization: false,
    artifacts,
  };
  const manifest = campaignJson(spec, receipt, qa);
  writeArtifact(artifacts, outDir, 'campaign.json', `${JSON.stringify(manifest, null, 2)}\n`);
  writeArtifact(artifacts, outDir, 'receipt.md', receiptMarkdown(spec, receipt, qa));

  heading('Quality gate');
  for (const finding of qa.findings) {
    if (finding.level === 'FAIL') fail(`${finding.check}: ${finding.detail}`);
    else if (finding.level === 'WARN') warn(`${finding.check}: ${finding.detail}`);
  }
  ok(`${qa.counts.pass} checks passed`);

  heading(`${qa.status}`);
  info(`resource url  ${resourceUrl(spec)}`);
  info(`comment keyword  ${spec.keyword}`);
  info('human approval REQUIRED - nothing here is published by the engine');
  return qa.counts.fail ? 1 : 0;
}

function commandQa({ positional }) {
  const { spec } = loadSpec(positional[0]);
  const prepared = writeSlideHtml(spec, join(tmpdir(), 'trophy-labs-qa', spec.campaignId));
  const qa = runQa(spec, { textLayers: prepared.flatMap((entry) => entry.textLayers) });
  heading(`Quality gate: ${spec.campaignId}`);
  for (const finding of qa.findings) {
    if (finding.level === 'FAIL') fail(`${finding.check}: ${finding.detail}`);
    else if (finding.level === 'WARN') warn(`${finding.check}: ${finding.detail}`);
    else ok(`${finding.check}: ${finding.detail}`);
  }
  heading(qa.status);
  return qa.counts.fail ? 1 : 0;
}

function commandDraft({ flags }) {
  const input = {
    type: String(flags.type ?? (flags.url ? 'reel_url' : flags.text ? 'transcript' : 'original_topic')),
    url: flags.url ? String(flags.url) : null,
    topic: flags.topic ? String(flags.topic) : null,
    text: flags.text ? readFileSync(String(flags.text), 'utf8') : null,
  };
  const prompt = draftingPrompt(input);
  const name = slugify(input.topic ?? input.url ?? 'draft');
  const path = flags.out ? resolve(String(flags.out)) : join(ROOT, 'drafts', `${name || 'draft'}.prompt.md`);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, prompt);
  heading('Drafting prompt written');
  info(path);
  info('Hand this to the drafting model, save the JSON it returns into topics/, then run: trophy-labs generate <id>');
  return 0;
}

function commandRecord({ positional, flags }) {
  const campaignId = positional[0];
  if (!campaignId) throw new Error('Usage: trophy-labs record <campaignId> [--from performance.json]');
  const outDir = join(CAMPAIGNS, campaignId);
  if (!existsSync(outDir)) throw new Error(`No campaign package at ${outDir}`);
  const performanceFile = join(outDir, 'performance.json');
  if (flags.from) writeFileSync(performanceFile, readFileSync(String(flags.from)));
  const performance = readJson(performanceFile);
  const score = scorePerformance(performance);
  const manifest = readJson(join(outDir, 'campaign.json'));
  manifest.performance = { ...performance, score };
  writeFileSync(join(outDir, 'campaign.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(outDir, 'performance.md'), performanceMarkdown(manifest, performance, score));
  heading(`Recorded: ${campaignId}`);
  info(`campaign value ${score.campaignValue}`);
  if (!score.complete) warn(`missing metrics: ${score.missingMetrics.join(', ')}`);
  return 0;
}

function commandCompare() {
  const entries = readdirSync(CAMPAIGNS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(CAMPAIGNS, entry.name, 'campaign.json')))
    .map((entry) => {
      const manifest = readJson(join(CAMPAIGNS, entry.name, 'campaign.json'));
      return {
        campaignId: manifest.campaignId,
        date: manifest.date,
        pillar: manifest.pillar,
        keyword: manifest.keyword,
        performance: manifest.performance,
        score: manifest.performance?.score ?? null,
      };
    })
    .sort((a, b) => (b.score?.campaignValue ?? -1) - (a.score?.campaignValue ?? -1));
  if (!entries.length) {
    warn('No generated campaigns to compare yet.');
    return 0;
  }
  process.stdout.write(`\n${comparisonMarkdown(entries)}\n`);
  return 0;
}

function commandList() {
  heading('Topics');
  for (const name of readdirSync(TOPICS).filter((file) => file.endsWith('.json'))) info(name.replace(/\.json$/, ''));
  heading('Campaign packages');
  const built = existsSync(CAMPAIGNS)
    ? readdirSync(CAMPAIGNS, { withFileTypes: true }).filter((entry) => entry.isDirectory())
    : [];
  if (!built.length) info('none yet');
  for (const entry of built) {
    const manifestPath = join(CAMPAIGNS, entry.name, 'campaign.json');
    const status = existsSync(manifestPath) ? readJson(manifestPath).qa.status : 'incomplete';
    info(`${entry.name} - ${status}`);
  }
  return 0;
}

/** Proves the gate bites: a deliberately bad campaign must be refused. */
function commandSelftest() {
  const { spec } = loadSpec(readdirSync(TOPICS).find((name) => name.endsWith('.json')));
  const clean = runQa(spec, { textLayers: writeSlideHtml(spec, join(tmpdir(), 'trophy-labs-qa', 'selftest')).flatMap((e) => e.textLayers) });
  const bad = structuredClone(spec);
  bad.caption.body += '\nThis will almost always go viral and get you thousands of followers in less than 15 minutes.';
  bad.slides[1].lines = ['Trophy Labs grades your form on 87% of reps.'];
  bad.productClaims.formGrades = true;
  bad.publicationAuthorization = true;
  const badResult = runQa(bad, { textLayers: [], measurements: [{ slide: '02', primitive: 'PROBLEM', overflowY: 220, escapes: 3 }] });
  const expected = [
    'language.banned_marketing', 'claims.capability_boundary', 'claims.product_claims',
    'claims.undeclared_figures', 'visual.overflow', 'authority.publication',
  ];
  const caught = new Set(badResult.findings.filter((f) => f.level === 'FAIL').map((f) => f.check));
  const missed = expected.filter((check) => !caught.has(check));

  heading('Self test');
  if (clean.counts.fail) fail(`the shipped campaign does not pass its own gate (${clean.counts.fail} failures)`);
  else ok(`shipped campaign passes the gate: ${clean.status}`);
  if (missed.length) fail(`gate missed: ${missed.join(', ')}`);
  else ok(`gate caught all ${expected.length} planted violations`);
  return clean.counts.fail || missed.length ? 1 : 0;
}

const COMMANDS = {
  generate: commandGenerate,
  qa: commandQa,
  draft: commandDraft,
  record: commandRecord,
  compare: commandCompare,
  list: commandList,
  selftest: commandSelftest,
};

function usage() {
  process.stdout.write(`Trophy Labs content engine

  trophy-labs generate [topic]        build the campaign package (default: first topic)
  trophy-labs qa <topic>              run the quality gate without rendering
  trophy-labs draft [--url|--text|--topic]  write the drafting prompt for the model
  trophy-labs record <id> --from f    record measured performance and score it
  trophy-labs compare                 rank campaigns by value, not reach
  trophy-labs list                    list topics and built packages
  trophy-labs selftest                prove the quality gate still bites

Flags: --out <dir>  --no-render  --source-text <file>
`);
  return 0;
}

const { positional, flags } = parseArgs(process.argv.slice(2));
const command = COMMANDS[positional[0]] ?? (positional[0] ? null : usage);
if (!command) {
  process.stderr.write(`Unknown command: ${positional[0]}\n`);
  process.exit(2);
}
try {
  process.exit(command({ positional: positional.slice(1), flags }));
} catch (error) {
  process.stderr.write(`\n  ERROR  ${error.message}\n`);
  process.exit(2);
}
