// Navigation gate.
//
// A page that prepare-content.mjs publishes but no sidebar references is
// reachable only by guessing its URL. Six such pages existed when the site
// shipped — including spec/scope.md, the page AGENTS.md calls authoritative
// over every other spec page. Make the class impossible rather than fixing it
// once. Same shape as `npm run check:examples` in the repository root.
//
// Also checks ja/en parity: a locale missing a page silently drops it for
// half the readers.

import {readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const websiteDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const localeRoots = {
  ja: path.join(websiteDir, '.generated', 'docs'),
  en: path.join(
    websiteDir,
    'i18n',
    'en',
    'docusaurus-plugin-content-docs',
    'current',
  ),
};

// Pages deliberately published in one locale only.
const LOCALE_EXEMPT = new Set();

async function documentIds(root) {
  const ids = new Set();

  async function walk(directory) {
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
        ids.add(
          path
            .relative(root, absolute)
            .split(path.sep)
            .join('/')
            .replace(/\.md$/, ''),
        );
      }
    }
  }

  await walk(root);
  return ids;
}

function sidebarIds(sidebars) {
  const ids = new Set();

  const visit = (item) => {
    if (typeof item === 'string') {
      ids.add(item);
      return;
    }
    if (Array.isArray(item)) {
      item.forEach(visit);
      return;
    }
    if (!item || typeof item !== 'object') return;
    if (item.type === 'doc' && item.id) ids.add(item.id);
    if (item.type === 'ref' && item.id) ids.add(item.id);
    if (item.link?.type === 'doc' && item.link.id) ids.add(item.link.id);
    if (item.items) visit(item.items);
  };

  visit(Object.values(sidebars));
  return ids;
}

const {default: sidebars} = await import('../sidebars.js');
const navigable = sidebarIds(sidebars);
const published = {
  ja: await documentIds(localeRoots.ja),
  en: await documentIds(localeRoots.en),
};

const problems = [];

for (const [locale, ids] of Object.entries(published)) {
  for (const id of [...ids].sort()) {
    if (!navigable.has(id)) {
      problems.push(
        `orphan     [${locale}] ${id} is published but appears in no sidebar`,
      );
    }
  }
}

for (const id of [...navigable].sort()) {
  if (!published.ja.has(id)) {
    problems.push(`dangling   [ja] sidebar references ${id}, which has no file`);
  }
}

for (const id of [...published.ja].sort()) {
  if (!published.en.has(id) && !LOCALE_EXEMPT.has(id)) {
    problems.push(`ja only    ${id} has no English counterpart`);
  }
}
for (const id of [...published.en].sort()) {
  if (!published.ja.has(id) && !LOCALE_EXEMPT.has(id)) {
    problems.push(`en only    ${id} has no Japanese counterpart`);
  }
}

if (problems.length > 0) {
  console.error(`Navigation gate failed — ${problems.length} problem(s):\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error(
    '\nEvery published page must be reachable from a sidebar in both locales.',
  );
  process.exit(1);
}

console.log(
  `Navigation gate passed — ${published.ja.size} ja / ${published.en.size} en pages, all reachable.`,
);
