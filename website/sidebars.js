/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  guide: [
    'guide/README',
    'guide/start',
    'guide/concepts',
    'guide/gallery',
    'guide/cheatsheet',
    {
      type: 'category',
      label: 'How-to',
      link: {type: 'doc', id: 'guide/howto/README'},
      collapsed: true,
      items: [
        'guide/howto/add-a-level',
        'guide/howto/unit-layout',
        'guide/howto/daylight',
        'guide/howto/doors-and-escape',
        'guide/howto/site-and-far',
        'guide/howto/split-into-files',
        'guide/howto/agent-mcp',
        'guide/howto/editor',
        'guide/howto/troubleshooting',
      ],
    },
    'guide/diagnostics',
    'guide/glossary',
    'guide/cli',
    'guide/api',
  ],
  reference: [
    'spec/README',
    'spec/language',
    'spec/semantics',
    'spec/vocabulary',
    'spec/canonical-json',
    'spec/tools',
    'spec/notation-v0',
  ],
};

export default sidebars;
