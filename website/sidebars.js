import {existsSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// One sidebar, not four sidebars plus a navbar. Splitting navigation across two
// places means the reader has to know which of the two holds the thing they
// want before they can look for it — the same defect, one level up, as the old
// Guide/Reference split. The four modes are collapsible sections here; the
// navbar keeps only what leaves the documentation (locale, npm, GitHub).
//
// The sidebar is derived from the published tree, never hand-listed. Hand-listed
// ids are how six pages — including the one declared authoritative over every
// other — shipped unreachable.

const generatedDocs = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '.generated',
  'docs',
);

const SECTIONS = [
  {
    label: 'Start',
    index: 'start/index',
    prefix: 'start/',
    order: ['start/install', 'start/first-program', 'start/next'],
  },
  {
    // Explanation is an argument, so it is ordered the way the argument builds,
    // not alphabetically: what the notation takes as primary, what follows from
    // that, what the tools therefore can and cannot promise, and only then the
    // comparisons with what already exists.
    label: 'Why',
    index: 'why/index',
    prefix: 'why/',
    groupsLast: true,
    order: [
      'why/space-is-primary',
      'why/boundary-is-a-relation',
      'why/silence',
      'why/source-and-derived',
      'why/paths',
      'why/open-vocabulary',
      'why/green-is-not-a-building',
      'why/two-kinds-of-green',
      'why/three-domains',
      'why/composition-is-for-time',
      'why/form-must-be-unique',
      'why/plan-is-not-a-section',
      'why/resolution',
      'why/bim-ifc-usd',
      'why/vs-ifc',
      'why/ifc4-coverage',
      'why/dsl-not-yaml',
    ],
    groups: [{label: 'Examples', prefix: 'examples/', index: 'examples/index'}],
  },
  {
    // The same three bands the how-to index uses: write a building, drive the
    // tools, get unstuck.
    label: 'How-to',
    index: 'howto/index',
    prefix: 'howto/',
    order: [
      'howto/add-a-storey',
      'howto/connect-storeys',
      'howto/subdivide-a-unit',
      'howto/typical-floors',
      'howto/windows-and-daylight',
      'howto/find-unreachable',
      'howto/describe-a-site',
      'howto/split-into-layers',
      'howto/survive-a-rename',
      'howto/write-as-built',
      'howto/uncounted-divisions',
      'howto/choose-dimensions',
      'howto/install-mcp',
      'howto/agent-loop',
      'howto/debug-mcp',
      'howto/embed-in-a-program',
      'howto/write-docs',
      'howto/by-symptom',
      'howto/troubleshooting',
    ],
  },
  {
    label: 'Reference',
    index: 'reference/index',
    prefix: 'reference/',
    groups: [
      {label: 'Notation (.muro)', prefix: 'reference/muro/', index: 'reference/muro/index'},
      {
        label: 'Diagnostics — koyu check',
        prefix: 'reference/diagnostics/',
        index: 'reference/diagnostics/index',
      },
      {
        label: 'Validation — koyu validate',
        prefix: 'reference/validate/',
        index: 'reference/validate/index',
      },
      {label: 'CLI', prefix: 'reference/cli/', index: 'reference/cli/index'},
      {label: 'MCP server', prefix: 'reference/mcp/', index: 'reference/mcp/index'},
      {
        label: 'TypeScript API',
        prefix: 'reference/api/',
        index: 'reference/api/index',
      },
      {label: 'Form', prefix: 'reference/form/', index: 'reference/form/index'},
      {label: 'Canonical JSON', prefix: 'reference/json/', index: 'reference/json/index'},
      {label: 'Glossary', prefix: 'glossary'},
    ],
    // Loose reference pages come after the volumes: they are the promise, not
    // a surface. Then the roadmap, which belongs to nothing else.
    order: [
      'reference/scope',
      'reference/stability',
      'reference/identity',
      'reference/not-held',
    ],
    tail: ['roadmap'],
  },
];

function documentIds(root) {
  const ids = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, {withFileTypes: true}).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'img') continue;
        walk(absolute);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        ids.push(
          path.relative(root, absolute).split(path.sep).join('/').replace(/\.md$/, ''),
        );
      }
    }
  };
  walk(root);
  return ids;
}

function build() {
  const all = documentIds(generatedDocs);
  const placed = new Set(['index']);

  const take = (predicate) => {
    const taken = all.filter((id) => !placed.has(id) && predicate(id));
    taken.forEach((id) => placed.add(id));
    return taken;
  };

  const sections = SECTIONS.map((section) => {
    // The section's own index is its category link, so it must not also appear
    // as an item inside itself.
    placed.add(section.index);

    const groups = (section.groups ?? []).map((group) => {
      if (group.index) placed.add(group.index);
      const items = take((id) => id.startsWith(group.prefix));
      return {group, items};
    }).filter(({group, items}) => items.length > 0 || all.includes(group.index ?? ''));

    const ordered = (section.order ?? []).filter((id) => all.includes(id));
    ordered.forEach((id) => placed.add(id));
    const rest = take((id) => id.startsWith(section.prefix));
    const tail = (section.tail ?? []).filter((id) => all.includes(id));
    tail.forEach((id) => placed.add(id));

    return {
      type: 'category',
      label: section.label,
      collapsed: true,
      collapsible: true,
      ...(all.includes(section.index) ? {link: {type: 'doc', id: section.index}} : {}),
      items: (() => {
        const categories = groups.map(({group, items}) => ({
          type: 'category',
          label: group.label,
          collapsed: true,
          collapsible: true,
          ...(group.index && all.includes(group.index)
            ? {link: {type: 'doc', id: group.index}}
            : {}),
          items,
        }));
        const pages = [...ordered, ...rest];
        // Reference leads with its volumes — they are what a reader came for,
        // and the pages about the extent of the promise read as a coda.
        // Explanation is the other way round: the argument first, examples last.
        return section.groupsLast
          ? [...pages, ...categories, ...tail]
          : [...categories, ...pages, ...tail];
      })(),
    };
  });

  // Anything the layout forgot still gets a home rather than disappearing.
  const orphans = all.filter((id) => !placed.has(id));

  return {docs: ['index', ...sections, ...orphans]};
}

// The generated tree is the only source for navigation. There used to be a
// hand-listed fallback here for the old two-book layout, kept so the site would
// not go dark mid-migration; the migration landed and the fallback outlived it.
// What it actually did was turn "the content has not been generated yet" into a
// list of pages deleted in July, which reads as a broken sidebar rather than a
// missing step.
const canonical = existsSync(path.join(generatedDocs, 'reference'));

if (!canonical) {
  throw new Error(
    'website/.generated/docs is missing — run `npm run prepare:content` in website/ first. ' +
      'The sidebar is derived from the published tree and has no other source.',
  );
}

export default build();
