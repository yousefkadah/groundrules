'use strict';
/**
 * PROTOTYPE study runner. Measures rules-lint precision across many real repos
 * WITHOUT cloning: fetches each repo's rules files, its full git tree, and its
 * manifests via the GitHub API, then feeds them to the pure linter core.
 *
 * Usage: node test/proto/rot-study.js <repos.txt>
 */
const { execFileSync } = require('child_process');
const { lintEvidence, RULES_FILES } = require('./rules-lint');
const fs = require('fs');

const sh = (cmd, args) => {
  try { return execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch { return ''; }
};
const raw = (repo, f) => sh('curl', ['-sfL', `https://raw.githubusercontent.com/${repo}/HEAD/${f}`]);

function treePaths(repo) {
  const out = sh('gh', ['api', `repos/${repo}/git/trees/HEAD?recursive=1`, '--jq', '.tree[].path']);
  return new Set(out.split('\n').filter(Boolean));
}

/** .cursor/rules/*.mdc are rules too — find them in the tree and fetch them. */
function cursorRuleFiles(paths) {
  return [...paths].filter((p) => p.startsWith('.cursor/rules/') && p.endsWith('.mdc'));
}

function study(repo) {
  const paths = treePaths(repo);
  if (!paths.size) return { repo, skip: 'tree unavailable' };

  let text = '';
  for (const f of RULES_FILES) {
    if (!paths.has(f)) continue;
    const t = raw(repo, f);
    if (t) text += `\n<<<${f}>>>\n` + t;
  }
  for (const f of cursorRuleFiles(paths)) {
    const t = raw(repo, f);
    if (t) text += `\n<<<${f}>>>\n` + t;
  }
  if (!text.trim()) return { repo, skip: 'no rules file' };

  let pkg = null;
  if (paths.has('package.json')) { try { pkg = JSON.parse(raw(repo, 'package.json')); } catch { /* unparseable */ } }

  const res = lintEvidence({
    text,
    exists: (rel) => paths.has(rel) || [...paths].some((p) => p.startsWith(rel + '/')),
    existsSuffix: (rel) => [...paths].some((p) => p.endsWith('/' + rel)),
    pkg,
    toml: paths.has('pyproject.toml') ? raw(repo, 'pyproject.toml') : '',
    makefile: paths.has('Makefile') ? raw(repo, 'Makefile') : '',
  });
  return { repo, checked: res.checked, findings: res.findings, tree_size: paths.size };
}

const repos = fs.readFileSync(process.argv[2], 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
for (const repo of repos) {
  const r = study(repo);
  console.log(JSON.stringify(r));
}
