// Canonicalisation gate.
//
// The published documentation is the canonical source of truth. ADRs
// (docs/decisions/) and spec/ are internal: ADRs are point-in-time records that
// are never amended, so they drift from the truth by design, and spec/'s future
// is undecided. Neither may be linked from, nor deferred to, a published page.
//
// Deleting the links is the easy half. The hard half is prose that DELEGATES
// authority — "規範は spec/ が持つ", "食い違ったら spec/ が正しい". Unlinked, those
// sentences tell the reader to consult a document that does not exist. The
// worst of them (guide/README.md) declares that any page making an unlinked
// assertion is defective, which after canonicalisation condemns every page.
//
// Existing gates catch none of this: prepare-content.mjs rewrites unmapped
// targets into valid github.com URLs, so onBrokenLinks never fires. The
// contamination ships as working links.
//
// Ratchet, not a cliff. ~600 references exist today and cannot be removed in
// one change. The committed baseline may only go down: new contamination fails
// the build, and removing contamination requires lowering the baseline in the
// same commit. Run with --strict once the baseline reaches zero.

import {readFile, readdir, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const websiteDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const repositoryDir = path.resolve(websiteDir, '..');
const baselinePath = path.join(
  websiteDir,
  'scripts',
  'canonical-baseline.json',
);

const generatedRoots = {docs: path.join(websiteDir, '.generated', 'docs')};

// A published document id maps back to exactly one source file. Deriving the
// scan set from what prepare-content.mjs actually emitted means the gate cannot
// disagree with the publisher about what "published" means: drop spec/ from the
// publisher and this gate stops scanning it, with no edit here.
function sourceFor(id) {
  for (const candidate of [`docs/${id}.md`, `${id}.md`]) {
    const absolute = path.join(repositoryDir, candidate);
    if (existsSync(absolute)) return candidate;
  }
  return null;
}

async function publishedSources() {
  const sources = [];

  for (const [locale, root] of Object.entries(generatedRoots)) {
    const walk = async (directory) => {
      let entries;
      try {
        entries = await readdir(directory, {withFileTypes: true});
      } catch {
        return;
      }
      for (const entry of entries) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          await walk(absolute);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          const id = path
            .relative(root, absolute)
            .split(path.sep)
            .join('/')
            .replace(/\.md$/, '');
          const source = sourceFor(id, locale);
          if (source) sources.push({locale, id, source});
        }
      }
    };
    await walk(root);
  }

  return sources;
}

// Same link grammar prepare-content.mjs uses, so the two agree on what a link is.
const LINK_PATTERN = /(!?\[[^\]]*\]\()(<[^>]+>|[^\s)]+)([^)]*\))/g;

// Deliberately broad. A false positive costs one exemption line; a false
// negative ships a lie.
const MENTION_RULES = [
  {
    id: 'no-adr-mention',
    // Bare "ADR-0032" survives link removal and still points nowhere.
    pattern: /\bADR[‐-―-]?\s?\d{3,4}\b|\bADRs?\b/g,
    inFences: true,
    fix: 'この頁の言葉でその決定を述べ、ADR への言及を消す',
  },
  {
    id: 'no-spec-mention',
    pattern: /(?<![\w./])spec\//g,
    inFences: false,
    fix: 'その規範をこの頁が自分で述べ、spec/ への言及を消す',
  },
  {
    id: 'no-delegation-prose',
    // Sentences that hand authority to a document the reader cannot open.
    pattern: new RegExp(
      [
        '食い違ったら',
        '規範的な事実',
        '定義の正',
        '規範は',
        '規範の定義',
        '規範の台帳',
        '正確な定義は',
        '正確な契約は',
        'が所有する',
        'なぜそう決めたか',
        '決定の理由は',
        'Where they disagree',
        'Normative facts are owned',
        'The norm for a definition',
        'The norms are held by',
        'the normative definitions',
        'the normative ledger',
      ].join('|'),
      'g',
    ),
    inFences: false,
    fix: '権威の委譲をやめ、この頁が事実を述べ切る',
  },
];

function isLaunderedInternal(destination) {
  return /(?:github\.com\/kensnzk\/koyu\/(?:blob|tree)\/[^\s)]*?|raw\.githubusercontent\.com\/kensnzk\/koyu\/[^\s)]*?)\/(?:docs\/decisions|spec)\//.test(
    destination,
  );
}

function classifyLink(destination, sourceRelative) {
  if (isLaunderedInternal(destination)) return 'no-rendered-external';
  if (/^[a-z][a-z+.-]*:/i.test(destination) || destination.startsWith('#')) {
    return null;
  }
  const target = destination.split('#')[0];
  if (!target) return null;
  const resolved = path
    .relative(
      repositoryDir,
      path.resolve(path.dirname(path.join(repositoryDir, sourceRelative)), target),
    )
    .split(path.sep)
    .join('/');
  if (/^docs\/decisions(\/|$)/.test(resolved)) return 'no-adr-link';
  if (/^spec(\/|$)/.test(resolved)) return 'no-spec-link';
  return null;
}

const findings = [];

for (const {locale, source} of await publishedSources()) {
  const text = await readFile(path.join(repositoryDir, source), 'utf8');
  const lines = text.split('\n');
  let inFence = false;

  lines.forEach((line, index) => {
    if (/^\s*(?:```|~~~)/.test(line)) {
      inFence = !inFence;
      return;
    }

    if (!inFence) {
      for (const match of line.matchAll(LINK_PATTERN)) {
        const wrapped =
          match[2].startsWith('<') && match[2].endsWith('>');
        const destination = wrapped ? match[2].slice(1, -1) : match[2];
        const rule = classifyLink(destination, source);
        if (rule) {
          findings.push({
            rule,
            locale,
            file: source,
            line: index + 1,
            text: destination.slice(0, 80),
          });
        }
      }
    }

    for (const rule of MENTION_RULES) {
      if (inFence && !rule.inFences) continue;
      for (const match of line.matchAll(rule.pattern)) {
        findings.push({
          rule: rule.id,
          locale,
          file: source,
          line: index + 1,
          text: match[0].slice(0, 80),
        });
      }
    }
  });
}

const counts = {};
for (const finding of findings) {
  counts[finding.rule] = (counts[finding.rule] ?? 0) + 1;
}

const strict = process.argv.includes('--strict');
const accept = process.argv.includes('--accept');

const baseline = existsSync(baselinePath)
  ? JSON.parse(await readFile(baselinePath, 'utf8'))
  : null;

if (accept) {
  await writeFile(
    baselinePath,
    `${JSON.stringify({total: findings.length, counts}, null, 2)}\n`,
  );
  console.log(`Baseline written: ${findings.length} references.`);
  process.exit(0);
}

const byRule = [...MENTION_RULES.map((r) => r.id), 'no-adr-link', 'no-spec-link', 'no-rendered-external'];
// docs/ is the canonical tree and must reach zero. Anything still counted
// outside it is the old guide/ and spec/ layout, which disappears wholesale
// when the migration completes — no sentence there has to be rewritten.
const isCanonical = (f) => f.file.startsWith('docs/');
console.log('Canonicalisation gate — references to internal documents\n');
console.log(`  ${''.padEnd(22)} ${'docs/'.padStart(7)} ${'legacy'.padStart(7)}`);
for (const rule of byRule) {
  const canonicalCount = findings.filter(
    (f) => f.rule === rule && isCanonical(f),
  ).length;
  const legacyCount = (counts[rule] ?? 0) - canonicalCount;
  const was = baseline?.counts?.[rule] ?? null;
  const now = counts[rule] ?? 0;
  const delta =
    was === null ? '' : now > was ? `  +${now - was} ✖` : now < was ? `  -${was - now} ✓` : '';
  console.log(
    `  ${rule.padEnd(22)} ${String(canonicalCount).padStart(7)} ${String(legacyCount).padStart(7)}${delta}`,
  );
}
const canonicalTotal = findings.filter(isCanonical).length;
console.log(
  `  ${'TOTAL'.padEnd(22)} ${String(canonicalTotal).padStart(7)} ${String(findings.length - canonicalTotal).padStart(7)}   = ${findings.length}`,
);

if (strict && findings.length > 0) {
  console.error(
    `\nStrict mode: ${findings.length} reference(s) to ADRs or spec/ remain in published pages.`,
  );
  process.exit(1);
}

if (baseline && findings.length > baseline.total) {
  console.error(
    `\nRatchet broken: ${findings.length} references, baseline is ${baseline.total}.`,
  );
  const worse = byRule.filter(
    (rule) => (counts[rule] ?? 0) > (baseline.counts?.[rule] ?? 0),
  );
  for (const rule of worse) {
    console.error(
      `  ${rule}: ${baseline.counts?.[rule] ?? 0} -> ${counts[rule] ?? 0}`,
    );
    for (const finding of findings.filter((f) => f.rule === rule).slice(0, 10)) {
      console.error(`    ${finding.file}:${finding.line}  ${finding.text}`);
    }
  }
  console.error(
    '\nA published page may not defer to a document the reader cannot open.',
  );
  process.exit(1);
}

if (baseline && findings.length < baseline.total) {
  console.log(
    `\nBaseline is ${baseline.total}; now ${findings.length}. Lower it in this commit: npm run gate:canonical -- --accept`,
  );
}

console.log(
  findings.length === 0
    ? '\nThe published documentation is self-contained.'
    : '\nRatchet holding. These must reach zero before spec/ and the ADRs are withdrawn.',
);
