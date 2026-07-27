# Koyu documentation site

The public documentation site for Koyu. It is a private Docusaurus application
inside the public `koyu` repository; it is not part of the
`@kensnzk/koyu` npm package.

The product landing page remains at [koyucore.dev](https://koyucore.dev/).
This site starts directly with the guide and does not duplicate the landing
page's product introduction, positioning, news, or calls to action.

The source documents remain where they are:

- `../guide/` and `../spec/` are Japanese;
- `../guide/en/` and `../spec/en/` are their English translations;
- `../editors/vscode/syntaxes/koyu.tmLanguage.json` is the single TextMate
  grammar used by both VS Code and Shiki.

`npm run prepare:content` builds an ignored Docusaurus content tree from those
sources. Never edit `.generated/` or the generated content under `i18n/`.

```sh
npm install
npm start
```

Build both locales:

```sh
npm run build
```

## Deployment

The documentation is a separate Vercel project from the landing page:

- import the public `kensnzk/koyu` repository as a new project;
- set **Root Directory** to `website`;
- keep **Include source files outside of the Root Directory in the Build
  Step** enabled;
- use the settings from `website/vercel.json`;
- assign `docs.koyucore.dev` under **Settings → Domains**.

The custom install and build commands run only inside `website`. The site reads
the canonical `guide/`, `spec/`, and referenced `docs/img/` files, but it does
not install or build the parent Koyu package. Vercel serves only
`website/build`.

`website/vercel.json` also provides the Ignored Build Step. A deployment
continues only when the commit changes `website/`, `guide/`, `spec/`, or
`docs/img/`, or the shared `.muro` syntax grammar; unrelated Koyu commits are
skipped. If Vercel cannot compare the commits in its shallow clone, the script
deliberately builds rather than risk leaving the public documentation stale.

The default production origin is already `https://docs.koyucore.dev` with a
root base path (`/`). No deployment environment variables are required.

`.github/workflows/docs.yml` remains a deploy-independent validation workflow:
it type-checks and builds every relevant pull request. Vercel's Git integration
creates Preview Deployments and deploys the production branch.
