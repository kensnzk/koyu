import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import rehypeShiki from '@shikijs/rehype';

const grammarPath = fileURLToPath(
  new URL('../editors/vscode/syntaxes/koyu.tmLanguage.json', import.meta.url),
);
const koyuGrammar = {
  ...JSON.parse(readFileSync(grammarPath, 'utf8')),
  name: 'muro',
  aliases: ['koyu', 'muro-part', 'muro-bad', 'muro-warn'],
};
const {version: koyuVersion} = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../package.json', import.meta.url)),
    'utf8',
  ),
);

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
    defaultLocale: 'ja',
    locales: ['ja', 'en'],
    localeConfigs: {
      ja: {
        label: '日本語',
        htmlLang: 'ja-JP',
      },
      en: {
        label: 'English',
        htmlLang: 'en',
      },
    },
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
        {
          type: 'docSidebar',
          sidebarId: 'guide',
          position: 'left',
          label: 'Guide',
        },
        {
          type: 'docSidebar',
          sidebarId: 'reference',
          position: 'left',
          label: 'Reference',
        },
        {
          to: '/guide/cli/',
          label: 'CLI',
          position: 'left',
        },
        {
          to: '/guide/api/',
          label: 'TypeScript API',
          position: 'left',
        },
        {
          href: 'https://www.npmjs.com/package/@kensnzk/koyu',
          label: `v${koyuVersion}`,
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
          items: [
            {label: 'Get started', to: '/guide/start/'},
            {label: 'How-to guides', to: '/guide/howto/'},
            {label: 'Language reference', to: '/spec/language/'},
          ],
        },
        {
          title: 'Develop',
          items: [
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
