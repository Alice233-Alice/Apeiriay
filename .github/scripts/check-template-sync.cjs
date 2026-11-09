const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

const git = args => execFileSync('git', args, { encoding: 'utf8' });
const base = process.env.TEMPLATE_BASE_SHA;
if (!/^[a-f0-9]{40}$/.test(base || '')) {
  throw new Error('Missing the project version recorded before template synchronization.');
}

const untracked = git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean);
const changedSource = git(['diff', '--name-only', base, '--', 'src']).trim();
if (changedSource || untracked.some(file => file.startsWith('src/'))) {
  throw new Error('Template synchronization changed src. Restore the original project files before continuing.');
}
if (git(['ls-files', '--unmerged']).trim()) {
  throw new Error('The template update contains unresolved merge conflicts. No update will be pushed.');
}

const changedFiles = new Set([
  ...git(['diff', '--name-only', '--diff-filter=ACMRT', '-z', base]).split('\0').filter(Boolean),
  ...untracked,
]);
for (const file of changedFiles) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
  const content = fs.readFileSync(file);
  if (content.includes(0)) continue;
  if (/^(?:<{7}(?: |$)|>{7}(?: |$))/m.test(content.toString('utf8'))) {
    throw new Error(`The template update contains conflict markers in ${file}. No update will be pushed.`);
  }
}

const changed = Boolean(git(['status', '--porcelain']).trim());
if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
}
console.log(changed ? 'Template update checked; src is preserved and the update is ready for review.' : 'The template is already up to date.');
