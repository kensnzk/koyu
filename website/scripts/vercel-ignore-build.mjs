import {spawnSync} from 'node:child_process';

// Vercel runs this script from website/, the configured Root Directory.
// Exit 0 skips the deployment; exit 1 continues the build.
//
// **Vercel clones shallow (depth 1).** The commit to compare against is therefore
// usually absent from the clone, `git diff` exits 128 rather than 0 or 1, and this
// script used to fall straight through to "build anyway" — so every push to every
// branch deployed. Reproduce it with:
//
//     git clone --depth 1 <repo> && cd <repo> && git rev-parse HEAD^
//     fatal: ambiguous argument 'HEAD^': unknown revision …
//
// So: fetch the comparison commit into the clone before deciding.
const watchedPaths = [
  '.',
  '../docs/img',
  '../editors/vscode/syntaxes/koyu.tmLanguage.json',
];

const git = (args) => spawnSync('git', args, {encoding: 'utf8'});
const isPresent = (sha) =>
  Boolean(sha) && git(['cat-file', '-e', `${sha}^{commit}`]).status === 0;

const currentSha = process.env.VERCEL_GIT_COMMIT_SHA?.trim() || 'HEAD';
const declaredPrevious = process.env.VERCEL_GIT_PREVIOUS_SHA?.trim() || '';

/** Bring the commit we compare against into the shallow clone, if we can. */
function resolveBase() {
  if (isPresent(declaredPrevious)) return declaredPrevious;

  // GitHub allows fetching an arbitrary commit by sha.
  if (declaredPrevious) {
    git(['fetch', '--depth=1', 'origin', declaredPrevious]);
    if (isPresent(declaredPrevious)) return declaredPrevious;
  }

  // No usable previous sha (first deployment on a branch, or the env var is
  // absent): deepen until this commit has a parent to compare against.
  if (!isPresent(`${currentSha}^`)) git(['fetch', '--deepen=25']);
  if (isPresent(`${currentSha}^`)) return `${currentSha}^`;

  return null;
}

const base = resolveBase();

if (!base) {
  // Build rather than risk leaving the public documentation stale. This is the
  // safe direction but the expensive one — **if deployments start firing on every
  // push again, this branch is the first thing to look at**, because it is the
  // one that ignores the watched paths entirely.
  console.warn(
    'Could not reach any commit to compare against; continuing deployment safely.',
  );
  process.exit(1);
}

const diff = git(['diff', '--quiet', base, currentSha, '--', ...watchedPaths]);

if (diff.status === 0) {
  console.log(
    `No documentation-site or source-document changes between ${base} and ${currentSha}; skipping deployment.`,
  );
  process.exit(0);
}

if (diff.status === 1) {
  console.log(
    `Documentation changes detected between ${base} and ${currentSha}; continuing deployment.`,
  );
  process.exit(1);
}

console.warn(
  `git diff failed (status ${diff.status}): ${(diff.stderr || '').trim()}`,
);
console.warn('Continuing deployment safely.');
process.exit(1);
