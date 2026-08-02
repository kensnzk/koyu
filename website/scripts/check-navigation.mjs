// Navigation gate.
//
// A page that prepare-content.mjs publishes but no sidebar references is
// reachable only by guessing its URL. Six such pages existed when the site
// shipped — including spec/scope.md, the page AGENTS.md calls authoritative
// over every other spec page. Make the class impossible rather than fixing it
// once. Same shape as `npm run check:examples` in the repository root.
//
// The two-locale parity check that used to live here went with the Japanese
// mirror: there is one tree now, so there is no half of the readership to
// silently drop a page for.

import {readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const websiteDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const contentRoot = path.join(websiteDir, '.generated', 'docs');

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
const published = await documentIds(contentRoot);

const problems = [];

for (const id of [...published].sort()) {
  if (!navigable.has(id)) {
    problems.push(`orphan     ${id} is published but appears in no sidebar`);
  }
}

for (const id of [...navigable].sort()) {
  if (!published.has(id)) {
    problems.push(`dangling   sidebar references ${id}, which has no file`);
  }
}

if (problems.length > 0) {
  console.error(`Navigation gate failed — ${problems.length} problem(s):\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error(
    '\nEvery published page must be reachable from a sidebar.',
  );
  process.exit(1);
}

console.log(
  `Navigation gate passed — ${published.size} pages, all reachable.`,
);
