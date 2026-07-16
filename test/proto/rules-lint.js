'use strict';
/**
 * PROTOTYPE — not shipped, not wired into the CLI.
 *
 * Research spike for the "rules rot" hypothesis: can a DETERMINISTIC reader (no
 * LLM) catch false claims in a repo's agent-rules file at a low enough
 * false-positive rate to be a CI gate?
 *
 * The bar is PRECISION, not recall: a gate that cries wolf gets turned off, so
 * every rule here must be one we'd be willing to fail a PR on. That means only
 * UNAMBIGUOUS claims are judged — see checkPaths for why `dir/file.ext` counts
 * and `testify/assert` / `root.go` do not.
 *
 * Pure core (`lintEvidence`) takes injected evidence so it can run against a
 * real checkout OR against data fetched from the API. `lint(dir)` is the fs adapter.
 *
 * Usage: node test/proto/rules-lint.js <repo-dir>
 */
const fs = require('fs');
const path = require('path');

const RULES_FILES = ['AGENTS.md', 'CLAUDE.md', '.cursorrules', 'GEMINI.md', '.github/copilot-instructions.md'];

/** Inline backticked spans. */
const ticks = (text) => [...text.matchAll(/`([^`\n]{2,120})`/g)].map((m) => m[1].trim());

/** Command lines inside fenced code blocks — where setup/test commands actually live. */
const fenced = (text) => {
  const out = [];
  for (const m of text.matchAll(/```[a-zA-Z]*\n([\s\S]*?)```/g)) {
    for (const line of m[1].split('\n')) {
      const t = line.trim().replace(/^\$\s*/, '');
      if (t && !t.startsWith('#') && t.length < 160) out.push(t);
    }
  }
  return out;
};

/**
 * A claim about THIS repo's tree must look like `dir/file.ext`.
 * Requiring BOTH a slash and an extension is what makes this precise:
 *  - `testify/assert`, `lorisleiva/laravel-actions` → import path / package name (no ext)
 *  - `root.go`, `shared.php` → a filename mention, not a path claim (no slash)
 * Without this rule the false-positive rate was ~85%; with it, it was 0 across
 * the pilot repos.
 */
// Real files that git never sees, or that only exist after a build. The tree
// can't prove these absent, so we must not claim they are.
const UNTRACKED = /(^|\/)(\.env|node_modules|dist|build|out|target|runtime|coverage|\.next|vendor)(\/|$)/;

function checkPaths(spans, exists, existsSuffix) {
  const out = [];
  for (const s of new Set(spans)) {
    if (/\s|^https?:|\*|\$|<|>|\{|\}|~|\||@|,/.test(s)) continue;
    // `[Feature]`, `[EventNameHere]` are doc placeholders — and a Next.js `[param]`
    // segment is lexically identical, so neither can be judged. Skip both.
    if (/[\[\]()]/.test(s)) continue;
    if (UNTRACKED.test(s)) continue;
    if (!/\//.test(s)) continue;
    if (!/\.(md|mdx|json|ya?ml|toml|lock|go|rs|py|ts|tsx|js|jsx|vue|php|rb|cs|sln|csproj|sh|txt|env)$/.test(s)) continue;
    if (/^(npm|yarn|pnpm|go|cargo|dotnet|php|python|pip|uv|bundle|make|git|docker)\b/.test(s)) continue;
    const rel = s.replace(/^\.\//, '').replace(/\/$/, '');
    if (!rel || rel.startsWith('/') || rel.includes('..') || rel.startsWith('.git/')) continue;
    if (exists(rel)) continue;
    // A monorepo's rules often cite paths relative to a sub-package
    // (`config/locales/en.yml` -> `core/config/locales/en.yml`). That's a real
    // file addressed from a different root, not rot.
    if (existsSuffix && existsSuffix(rel)) continue;
    out.push({ kind: 'nonexistent-path', claim: s, evidence: `no such path in the repo: ${rel}` });
  }
  return out;
}

/** `npm run X` must be a real package.json script. */
function checkNpmScripts(spans, pkg) {
  if (!pkg || !pkg.scripts) return [];
  const out = [];
  for (const s of new Set(spans)) {
    const m = s.match(/^(?:npm run|yarn run|pnpm run)\s+([a-zA-Z0-9:_-]+)$/);
    if (!m) continue;
    if (!(m[1] in pkg.scripts)) {
      out.push({ kind: 'missing-script', claim: s, evidence: `package.json has no "${m[1]}" script (has: ${Object.keys(pkg.scripts).slice(0, 8).join(', ')})` });
    }
  }
  return out;
}

/** `pip install -e '.[extra]'` must match a real optional-dependency extra. */
function checkPyExtras(spans, toml) {
  if (!toml) return [];
  const out = [];
  for (const s of new Set(spans)) {
    const m = s.match(/pip install\s+(?:-e\s+)?['"]?\.\[([a-zA-Z0-9_,-]+)\]/);
    if (!m) continue;
    for (const extra of m[1].split(',').map((x) => x.trim())) {
      const section = toml.includes('[project.optional-dependencies]');
      const declared = new RegExp(`^\\s*${extra}\\s*=`, 'm').test(toml);
      if (!section || !declared) out.push({ kind: 'stale-command', claim: s, evidence: `pyproject.toml declares no optional-dependencies extra "${extra}"` });
    }
  }
  return out;
}

/** `make X` must be a real Makefile target. */
function checkMakeTargets(spans, makefile) {
  if (!makefile) return [];
  const out = [];
  for (const s of new Set(spans)) {
    const m = s.match(/^make\s+([a-zA-Z0-9_-]+)$/);
    if (!m) continue;
    if (!new RegExp(`^${m[1]}\\s*:`, 'm').test(makefile)) out.push({ kind: 'stale-command', claim: s, evidence: `Makefile has no "${m[1]}" target` });
  }
  return out;
}

/** Pure core: evidence in, findings out. */
function lintEvidence({ text, exists, existsSuffix, pkg, toml, makefile }) {
  if (!text || !text.trim()) return { rules_found: false, checked: 0, findings: [] };
  const spans = ticks(text);
  const cmds = fenced(text);
  const all = spans.concat(cmds);
  const findings = [
    ...checkPaths(spans, exists, existsSuffix),
    ...checkNpmScripts(all, pkg),
    ...checkPyExtras(all, toml),
    ...checkMakeTargets(all, makefile),
  ];
  return { rules_found: true, checked: all.length, findings };
}

// ---- fs adapter -------------------------------------------------------------
const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } };

function lint(repo) {
  let text = '';
  for (const f of RULES_FILES) {
    const t = read(path.join(repo, f));
    if (t) text += `\n<<<${f}>>>\n` + t;
  }
  const cursorDir = path.join(repo, '.cursor', 'rules');
  if (fs.existsSync(cursorDir)) {
    for (const f of fs.readdirSync(cursorDir)) {
      if (f.endsWith('.mdc')) text += `\n<<<.cursor/rules/${f}>>>\n` + read(path.join(cursorDir, f));
    }
  }
  let pkg = null; try { pkg = JSON.parse(read(path.join(repo, 'package.json'))); } catch { /* none */ }
  return lintEvidence({
    text,
    exists: (rel) => fs.existsSync(path.join(repo, rel)),
    existsSuffix: () => false,
    pkg,
    toml: read(path.join(repo, 'pyproject.toml')),
    makefile: read(path.join(repo, 'Makefile')),
  });
}

if (require.main === module) {
  const repo = process.argv[2];
  if (!repo) { console.error('usage: node rules-lint.js <repo-dir>'); process.exit(2); }
  console.log(JSON.stringify(lint(repo), null, 2));
}

module.exports = { lint, lintEvidence, RULES_FILES };
