import {spawnSync} from 'node:child_process';

// Vercel runs this script from website/, the configured Root Directory.
// Exit 0 skips the deployment; exit 1 continues the build.
const watchedPaths = [
  '.',
  '../guide',
  '../spec',
  '../docs/img',
  '../editors/vscode/syntaxes/koyu.tmLanguage.json',
];
const previousSha = process.env.VERCEL_GIT_PREVIOUS_SHA?.trim() || 'HEAD^';
const currentSha = process.env.VERCEL_GIT_COMMIT_SHA?.trim() || 'HEAD';

const diff = spawnSync(
  'git',
  ['diff', '--quiet', previousSha, currentSha, '--', ...watchedPaths],
  {stdio: 'inherit'},
);

if (diff.status === 0) {
  console.log(
    'No documentation-site or source-document changes; skipping deployment.',
  );
  process.exit(0);
}

if (diff.status === 1) {
  console.log('Documentation changes detected; continuing deployment.');
  process.exit(1);
}

// If the shallow clone does not contain the comparison commit, build rather
// than risk leaving the public documentation stale.
console.warn('Could not inspect the Git diff; continuing deployment safely.');
process.exit(1);
