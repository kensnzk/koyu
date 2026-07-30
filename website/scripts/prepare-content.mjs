import {existsSync} from 'node:fs';
import {
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const websiteDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const repositoryDir = path.resolve(websiteDir, '..');
const jaContentDir = path.join(websiteDir, '.generated', 'docs');
const enContentDir = path.join(
  websiteDir,
  'i18n',
  'en',
  'docusaurus-plugin-content-docs',
  'current',
);
const generatedStaticDir = path.join(websiteDir, 'static', 'generated');
const repositoryWebUrl = 'https://github.com/kensnzk/koyu';
const repositoryRawUrl =
  'https://raw.githubusercontent.com/kensnzk/koyu/main';

function toPosix(value) {
  return value.split(path.sep).join('/');
}

async function walkMarkdown(directory) {
  const files = [];

  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkMarkdown(absolute)));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(absolute);
    }
  }

  return files;
}

// The canonical documentation lives in docs/. Everything else under docs/ is
// internal and stays internal: ADRs are point-in-time records that are never
// amended and so drift from the truth by design; the log and reviews are
// working notes. They remain in the repository as history — they are simply
// not part of what the site publishes.
const INTERNAL = [
  'docs/decisions/',
  'docs/log/',
  'docs/reviews/',
  'docs/notes/',
];
// Source material for the canonical pages, kept in the repo, not published.
const INTERNAL_FILES = [
  'docs/policy.md',
  'docs/horizon.md',
  'docs/ifc-coverage.md',
  'docs/ifcx-notes.md',
  'docs/modules.md',
  'docs/terminology.md',
  'docs/writing-architecture.md',
];

function isInternal(relative) {
  return (
    INTERNAL.some((prefix) => relative.startsWith(prefix)) ||
    INTERNAL_FILES.includes(relative)
  );
}

function outputDocumentPath(sourceAbsolute, locale) {
  const relative = toPosix(path.relative(repositoryDir, sourceAbsolute));

  // Only markdown becomes a document. Without this, an image under docs/ maps
  // to a document path and link rewriting sends the reader to a page that does
  // not exist instead of to the picture.
  if (!relative.endsWith('.md')) return null;

  if (relative.startsWith('docs/')) {
    if (isInternal(relative)) return null;
    const isEnglish = relative.startsWith('docs/en/');
    if (locale === 'en') {
      return isEnglish ? relative.slice('docs/en/'.length) : null;
    }
    return isEnglish ? null : relative.slice('docs/'.length);
  }

  if (locale === 'en') {
    return null;
  }

  return null;
}

function outputAssetPath(sourceAbsolute) {
  const relative = toPosix(path.relative(repositoryDir, sourceAbsolute));
  if (relative.startsWith('docs/img/')) return relative;
  return null;
}

function splitDestination(destination) {
  const hashIndex = destination.indexOf('#');
  if (hashIndex === -1) return {pathname: destination, hash: ''};
  return {
    pathname: destination.slice(0, hashIndex),
    hash: destination.slice(hashIndex),
  };
}

async function rewriteDestination({
  destination,
  locale,
  sourceAbsolute,
  outputRelative,
}) {
  if (
    destination.startsWith('#') ||
    /^[a-z][a-z+.-]*:/i.test(destination) ||
    destination.startsWith('//')
  ) {
    return destination;
  }

  const {pathname: linkPath, hash} = splitDestination(destination);
  if (!linkPath) return destination;

  const targetAbsolute = path.resolve(path.dirname(sourceAbsolute), linkPath);
  const repositoryRelative = toPosix(
    path.relative(repositoryDir, targetAbsolute),
  );

  if (
    repositoryRelative.startsWith('../') ||
    path.isAbsolute(repositoryRelative)
  ) {
    return destination;
  }

  let targetStat = null;
  try {
    targetStat = await stat(targetAbsolute);
  } catch {
    return destination;
  }

  const markdownTarget = targetStat.isDirectory()
    ? path.join(targetAbsolute, 'README.md')
    : targetAbsolute;
  const mappedDocument = outputDocumentPath(markdownTarget, locale);

  if (mappedDocument) {
    const relative = toPosix(
      path.relative(path.dirname(outputRelative), mappedDocument),
    );
    return `${relative || path.basename(mappedDocument)}${hash}`;
  }

  const mappedAsset = outputAssetPath(targetAbsolute);
  if (mappedAsset) {
    const relative = toPosix(
      path.relative(path.dirname(outputRelative), mappedAsset),
    );
    return `${relative || path.basename(mappedAsset)}${hash}`;
  }

  const isImage = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(
    repositoryRelative,
  );
  if (isImage) {
    return `${repositoryRawUrl}/${repositoryRelative}${hash}`;
  }

  const view = targetStat.isDirectory() ? 'tree' : 'blob';
  return `${repositoryWebUrl}/${view}/main/${repositoryRelative}${hash}`;
}

async function transformMarkdown(
  source,
  {locale, sourceAbsolute, outputRelative},
) {
  const lines = source
    .replace(
      /^<a id="([^"]+)"><\/a>\n(#{1,6}\s+.+)$/gm,
      (_match, id, heading) => `${heading} {#${id}}`,
    )
    // Prose that names a fence marker writes it as `<code>```muro-bad</code>`.
    // Raw <code> holding three backticks derails the MDX parser, which swallows
    // the rest of the sentence into a code block. Rewrite it as inline code.
    // Every marker must be listed: a missed one fails silently, mid-paragraph.
    .replace(
      /<code>(```muro(?:-(?:part|bad|warn|fail|caution))?)<\/code>/g,
      (_match, fence) => `\`\`\`\` ${fence} \`\`\`\``,
    )
    .split('\n');
  const transformed = [];
  let inFence = false;

  for (const line of lines) {
    if (/^\s*(?:```|~~~)/.test(line)) {
      inFence = !inFence;
      transformed.push(line);
      continue;
    }

    if (inFence) {
      transformed.push(line);
      continue;
    }

    const linkPattern = /(!?\[[^\]]*\]\()(<[^>]+>|[^\s)]+)([^)]*\))/g;
    let cursor = 0;
    let rewritten = '';

    for (const match of line.matchAll(linkPattern)) {
      const index = match.index ?? 0;
      rewritten += line.slice(cursor, index);
      const wrapped = match[2].startsWith('<') && match[2].endsWith('>');
      const destination = wrapped ? match[2].slice(1, -1) : match[2];
      const nextDestination = await rewriteDestination({
        destination,
        locale,
        sourceAbsolute,
        outputRelative,
      });
      rewritten += `${match[1]}${wrapped ? `<${nextDestination}>` : nextDestination}${match[3]}`;
      cursor = index + match[0].length;
    }

    transformed.push(rewritten + line.slice(cursor));
  }

  while (
    transformed[0]?.trim() === '' ||
    /^\s*(?:\*\*English\*\*|\[English\]).*(?:日本語|Japanese)/.test(
      transformed[0] ?? '',
    )
  ) {
    transformed.shift();
  }

  // An index page addresses its directory, so /reference/muro/index.md is
  // /reference/muro/ — not /reference/muro/index/.
  const basename = path.basename(outputRelative).toLowerCase();
  let frontMatter = '';
  if (basename === 'index.md' || basename === 'readme.md') {
    const documentDirectory = toPosix(path.dirname(outputRelative)).replace(
      /^\.$/,
      '',
    );
    const slug =
      documentDirectory === ''
        ? '/'
        : `/${documentDirectory}`;
    // Pages the authors gave front matter of their own keep it; the slug is
    // prepended into the same block rather than opening a second one.
    if (/^---\r?\n/.test(transformed[0] ?? '') || transformed[0] === '---') {
      transformed.splice(1, 0, `slug: ${slug}`);
    } else {
      frontMatter = `---\nslug: ${slug}\n---\n\n`;
    }
  }

  return `${frontMatter}${transformed.join('\n')}`;
}

async function writeLocale(locale, sourceRoots, outputRoot) {
  for (const sourceRoot of sourceRoots) {
    for (const sourceAbsolute of await walkMarkdown(sourceRoot)) {
      const outputRelative = outputDocumentPath(sourceAbsolute, locale);
      if (!outputRelative) continue;

      const source = await readFile(sourceAbsolute, 'utf8');
      const transformed = await transformMarkdown(source, {
        locale,
        sourceAbsolute,
        outputRelative,
      });
      const outputAbsolute = path.join(outputRoot, outputRelative);
      await mkdir(path.dirname(outputAbsolute), {recursive: true});
      await writeFile(outputAbsolute, transformed);
    }
  }
}

async function copyContentAssets(outputRoot) {
  const assetRoots = ['docs/img'];
  for (const relative of assetRoots) {
    const source = path.join(repositoryDir, relative);
    if (!existsSync(source)) continue;
    await cp(source, path.join(outputRoot, relative), {recursive: true});
  }
}

await rm(jaContentDir, {recursive: true, force: true});
await rm(enContentDir, {recursive: true, force: true});
await rm(generatedStaticDir, {recursive: true, force: true});

// The canonical tree is the only one published. The two-book layout (guide/ + spec/) it grew out
// of has been withdrawn (ADR-0046), so there is no branch to choose any more.
const roots = {
  ja: [path.join(repositoryDir, 'docs')],
  en: [path.join(repositoryDir, 'docs', 'en')],
};

await writeLocale('ja', roots.ja, jaContentDir);
await writeLocale('en', roots.en, enContentDir);
await copyContentAssets(jaContentDir);
await copyContentAssets(enContentDir);

console.log('Prepared the canonical documentation (docs/), Japanese and English.');
