import {existsSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import rehypeShiki from '@shikijs/rehype';
// CommonMark cannot close a `**` run that sits between CJK punctuation and a
// letter, so bold markup leaks into the rendered page as literal asterisks.
import remarkCjkFriendly from 'remark-cjk-friendly';

const grammarPath = fileURLToPath(
  new URL('../editors/vscode/syntaxes/koyu.tmLanguage.json', import.meta.url),
);
const koyuGrammar = {
  ...JSON.parse(readFileSync(grammarPath, 'utf8')),
  name: 'muro',
  aliases: [
    'koyu',
    'muro-part',
    'muro-bad',
    'muro-warn',
    'muro-fail',
    'muro-caution',
  ],
};

// The top level is the four Diataxis modes, and the product surfaces (記法 /
// 診断 / CLI / MCP / API / 形) are the second level inside リファレンス — the
// shape Django, Python and Kubernetes all settle on. The old top level split on
// which repository folder a page lived in, which is a governance question the
// reader cannot see and does not care about.
const canonical = existsSync(
  fileURLToPath(new URL('../docs/reference', import.meta.url)),
);

// The canonical site has ONE navigation: the sidebar. Duplicating the four
// modes in the navbar would split it in two, and the reader would have to guess
// which half holds what they want before looking. The navbar keeps only what
// leaves the documentation.
const navbarSections = canonical
  ? []
  : [
      {type: 'docSidebar', sidebarId: 'guide', position: 'left', label: 'Guide'},
      {
        type: 'docSidebar',
        sidebarId: 'reference',
        position: 'left',
        label: 'Reference',
      },
      {to: '/guide/cli/', label: 'CLI', position: 'left'},
      {to: '/guide/api/', label: 'TypeScript API', position: 'left'},
    ];

const repositoryUrl = 'https://github.com/kensnzk/koyu';
const siteUrl = process.env.DOCS_URL ?? 'https://docs.koyucore.dev';
const siteBaseUrl = process.env.DOCS_BASE_URL ?? '/';

function editUrl({docPath, locale}) {
  let sourcePath = docPath;

  if (locale === 'en') {
    if (docPath.startsWith('guide/')) {
      sourcePath = `guide/en/${docPath.slice('guide/'.length)}`;
    } else if (docPath.startsWith('spec/')) {
      sourcePath = `spec/en/${docPath.slice('spec/'.length)}`;
    }
  }

  return `${repositoryUrl}/edit/main/${sourcePath}`;
}

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'koyu developer documentation',
  tagline: 'Guides, language reference, CLI and TypeScript API.',
  favicon: 'img/favicon.png',
  url: siteUrl,
  baseUrl: siteBaseUrl,
  organizationName: 'kensnzk',
  projectName: 'koyu',
  // GitHub Pages serves directory indexes but has no server-side rewrites.
  trailingSlash: true,
  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',
  future: {
    faster: true,
    v4: {
      removeLegacyPostBuildHeadAttribute: true,
    },
  },
  markdown: {
    format: 'detect',
    mermaid: false,
    mdx1Compat: {
      headingIds: true,
    },
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },
  presets: [
    [
      'classic',
      {
        docs: {
          path: '.generated/docs',
          routeBasePath: '/',
          sidebarPath: './sidebars.js',
          breadcrumbs: true,
          editUrl,
          remarkPlugins: [remarkCjkFriendly],
          beforeDefaultRehypePlugins: [
            [
              rehypeShiki,
              {
                themes: {
                  light: 'github-light',
                  dark: 'github-dark',
                },
                defaultColor: false,
                addLanguageClass: true,
                langs: [koyuGrammar],
              },
            ],
          ],
        },
        blog: false,
        pages: {},
        theme: {
          customCss: './src/css/custom.css',
        },
        sitemap: {
          changefreq: 'weekly',
          priority: 0.5,
        },
      },
    ],
  ],
  // Every URL the two-book layout ever published keeps working. Two of them
  // (/guide/cli/, /guide/api/) were promoted in the navbar, so they are the
  // ones most likely to be bookmarked and linked from outside.
  plugins: canonical
    ? [
        [
          '@docusaurus/plugin-client-redirects',
          {
            redirects: [
              {from: '/guide/start', to: '/start'},
              {from: '/guide/concepts', to: '/why'},
              {from: '/guide/gallery', to: '/examples'},
              {from: '/guide/cheatsheet', to: '/reference/muro'},
              {from: '/guide/howto', to: '/howto'},
              {from: '/guide/howto/add-a-level', to: '/howto/add-a-storey'},
              {from: '/guide/howto/unit-layout', to: '/howto/subdivide-a-unit'},
              {from: '/guide/howto/daylight', to: '/howto/windows-and-daylight'},
              {from: '/guide/howto/doors-and-escape', to: '/howto/find-unreachable'},
              {from: '/guide/howto/site-and-far', to: '/howto/describe-a-site'},
              {from: '/guide/howto/split-into-files', to: '/howto/split-into-layers'},
              {from: '/guide/howto/identity', to: '/howto/survive-a-rename'},
              {from: '/guide/howto/agent-mcp', to: '/howto/agent-loop'},
              {from: '/guide/howto/editor', to: '/reference/cli/editor'},
              {from: '/guide/howto/troubleshooting', to: '/howto/troubleshooting'},
              {from: '/guide/diagnostics', to: '/reference/diagnostics'},
              {from: '/guide/validation', to: '/reference/validate'},
              {from: '/guide/glossary', to: '/glossary'},
              {from: '/guide/cli', to: '/reference/cli'},
              {from: '/guide/api', to: '/reference/api'},
              {from: '/spec', to: '/reference'},
              {from: '/spec/scope', to: '/reference/scope'},
              {from: '/spec/language', to: '/reference/muro'},
              {from: '/spec/vocabulary', to: '/reference/muro/attributes'},
              {from: '/spec/composition', to: '/reference/muro/composition'},
              {from: '/spec/semantics', to: '/reference/diagnostics'},
              {from: '/spec/derivation', to: '/reference/form'},
              {from: '/spec/validation', to: '/reference/validate'},
              {from: '/spec/canonical-json', to: '/reference/json'},
              {from: '/spec/tools', to: '/reference/cli'},
              {from: '/spec/notation-v0', to: '/why/dsl-not-yaml'},
            ],
          },
        ],
      ]
    : [],
  // Search is a precondition for the one-page-one-thing reference, not a
  // nicety: once a 1,564-line page becomes N pages, Ctrl-F stops working.
  themes: [
    [
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: true,
        language: ['en', 'ja'],
        docsDir: '.generated/docs',
        docsRouteBasePath: '/',
        indexBlog: false,
        highlightSearchTermsOnTargetPage: true,
        explicitSearchResultPath: true,
      },
    ],
  ],
  themeConfig: {
    image: 'img/og.png',
    announcementBar: {
      id: 'exploratory-project-v1',
      content: 'Koyu project notice',
      backgroundColor: '#141715',
      textColor: '#b8c0ba',
      isCloseable: true,
    },
    tableOfContents: {
      minHeadingLevel: 2,
      maxHeadingLevel: 3,
    },
    colorMode: {
      defaultMode: 'light',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'koyu / docs',
      hideOnScroll: false,
      items: [
        ...navbarSections,
        {
          href: 'https://www.npmjs.com/package/@kensnzk/koyu',
          label: 'npm',
          position: 'right',
          className: 'navbar__version',
        },
        {
          type: 'localeDropdown',
          position: 'right',
          dropdownItemsAfter: [],
        },
        {
          href: 'https://koyucore.dev/',
          label: 'koyucore.dev',
          position: 'right',
        },
        {
          href: repositoryUrl,
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: canonical
            ? [
                {label: 'はじめる', to: '/start/'},
                {label: '手順', to: '/howto/'},
                {label: '記法 (.muro)', to: '/reference/muro/'},
                {label: '用語集', to: '/glossary/'},
              ]
            : [
                {label: 'Get started', to: '/guide/start/'},
                {label: 'How-to guides', to: '/guide/howto/'},
                {label: 'Language reference', to: '/spec/language/'},
              ],
        },
        {
          title: 'Develop',
          items: canonical
            ? [
                {label: 'CLI', to: '/reference/cli/'},
                {label: 'MCP', to: '/reference/mcp/'},
                {label: 'TypeScript API', to: '/reference/api/'},
                {label: 'GitHub', href: repositoryUrl},
              ]
            : [
                {label: 'CLI', to: '/guide/cli/'},
                {label: 'TypeScript API', to: '/guide/api/'},
                {label: 'GitHub', href: repositoryUrl},
              ],
        },
        {
          title: 'Project',
          items: [
            {label: 'koyucore.dev', href: 'https://koyucore.dev/'},
            {label: 'Discussions', href: `${repositoryUrl}/discussions`},
            {label: 'Ugatsu', href: 'https://www.ugatsu.dev/'},
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} Koyu contributors · Apache-2.0`,
    },
    prism: {
      additionalLanguages: [],
    },
    metadata: [
      {
        name: 'keywords',
        content:
          'koyu, muro, architecture, BIM, spatial DSL, building description language',
      },
    ],
  },
};

export default config;
