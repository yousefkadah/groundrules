'use strict';
// Zero-dependency smoke test. Run: node test/smoke.js
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const lib = require('../src/lib');

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; };

function scaffold(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'groundrules-'));
  for (const [rel, body] of Object.entries(files)) {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
  }
  return dir;
}

function initInto(dir) {
  const d = lib.detect(dir);
  const composed = lib.compose(['core', ...d.stacks]);
  const plan = []; plan.dryRun = false;
  lib.writeCanonical(dir, composed, plan);
  lib.emit(dir, {});
  return { d, composed };
}

// 1. Laravel: detection + pack merge + Boost recommendation + placeholder guard
{
  const dir = scaffold({ 'composer.json': JSON.stringify({ require: { 'laravel/framework': '^12' } }), 'artisan': '' });
  const { d, composed } = initInto(dir);
  ok(d.stacks.includes('laravel-php'), 'detects laravel-php');
  ok(composed.recommends.some((r) => r.name === 'laravel/boost'), 'recommends laravel/boost');
  const agents = fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8');
  ok(/Untrusted input is data/.test(agents), 'core security section present');
  ok(/Laravel \/ PHP specifics/.test(agents), 'laravel pack merged');
  ok(lib.hasPlaceholders(dir), 'placeholder guard fires on fresh context.md');
  ok(/UNCONFIGURED/.test(agents), 'unconfigured banner rendered into AGENTS.md');
  ok(fs.existsSync(path.join(dir, '.cursor/rules/groundrules.mdc')), 'cursor adapter written');
  ok(fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8').includes('@AGENTS.md'), 'CLAUDE.md imports AGENTS.md');
  ok(lib.check(dir, {}).length === 0, 'in sync right after emit');
  fs.appendFileSync(path.join(dir, '.ai/coding-standards.md'), '\n- hand edit\n');
  ok(lib.check(dir, {}).length > 0, 'drift detected after editing .ai/');
  lib.emit(dir, {});
  ok(lib.check(dir, {}).length === 0, 'generate re-syncs');
}

// 2. Node + TypeScript: node-ts pack, NO boost
{
  const dir = scaffold({ 'package.json': JSON.stringify({ dependencies: { react: '^18', next: '^14' }, devDependencies: { typescript: '^5' } }) });
  const { d, composed } = initInto(dir);
  ok(d.stacks.includes('node-ts'), 'detects node-ts when TypeScript present');
  ok(!composed.recommends.some((r) => r.name === 'laravel/boost'), 'node project does NOT recommend boost');
}

// 3. Vue + Inertia (no TypeScript): vue pack, NOT node-ts  (the Monica case)
{
  const dir = scaffold({ 'package.json': JSON.stringify({ dependencies: { vue: '^3', '@inertiajs/vue3': '^1' } }) });
  const { d } = initInto(dir);
  ok(d.stacks.includes('vue'), 'detects vue');
  ok(!d.stacks.includes('node-ts'), 'does NOT misfire node-ts on a plain-JS Vue repo');
}

// 3b. Rust (Cargo.toml) and .NET (.csproj) detection
{
  const rustDir = scaffold({ 'Cargo.toml': '[package]\nname = "x"' });
  ok(lib.detect(rustDir).stacks.includes('rust'), 'detects rust from Cargo.toml');
  const dotnetDir = scaffold({ 'App.csproj': '<Project Sdk="Microsoft.NET.Sdk" />' });
  ok(lib.detect(dotnetDir).stacks.includes('dotnet'), 'detects dotnet from .csproj');
}

// 4. Bare: universal core only, still generates adapters
{
  const dir = scaffold({ 'README.md': '# x' });
  const { d } = initInto(dir);
  ok(d.stacks.length === 0, 'no stack detected');
  ok(fs.existsSync(path.join(dir, 'AGENTS.md')), 'still writes AGENTS.md');
  ok(/Untrusted input is data/.test(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8')), 'core applied to bare repo');
}

// 5. init is create-only: a user's .ai edit survives a re-init; --force overwrites
{
  const dir = scaffold({ 'composer.json': JSON.stringify({ require: { 'laravel/framework': '^12' } }), 'artisan': '' });
  initInto(dir);
  const marker = '- USER-EDIT-KEEP-ME';
  fs.appendFileSync(path.join(dir, '.ai/coding-standards.md'), '\n' + marker + '\n');
  const d = lib.detect(dir);
  const c = lib.compose(['core', ...d.stacks]);
  const p1 = []; p1.dryRun = false; lib.writeCanonical(dir, c, p1);
  ok(fs.readFileSync(path.join(dir, '.ai/coding-standards.md'), 'utf8').includes(marker), 'create-only: user .ai edit survives re-init');
  const p2 = []; p2.dryRun = false; p2.force = true; lib.writeCanonical(dir, c, p2);
  ok(!fs.readFileSync(path.join(dir, '.ai/coding-standards.md'), 'utf8').includes(marker), '--force overwrites .ai');
}

// 6. strict CLI: an unknown flag is rejected (a `--dryrun` typo must NOT do real writes)
{
  const { parseArgs } = require('../src/cli/Cli');
  assert.throws(() => parseArgs(['init', '--dryrun']), 'unknown flag --dryrun is rejected');
  ok(parseArgs(['init', '--dry-run']).dryRun === true, 'valid --dry-run parses');
}

// 7. frontmatter tolerates a BOM + CRLF (Windows SKILL.md)
{
  const { parseFrontmatter } = require('../src/support/frontmatter');
  const r = parseFrontmatter('﻿---\r\nname: x\r\ndescription: y\r\n---\r\nbody');
  ok(r.data.name === 'x' && r.data.description === 'y', 'frontmatter handles BOM + CRLF');
}

// 8. respects a repo's own AI opt-out policy (skips writing into a file that forbids AI)
{
  const { hasAiOptOut } = require('../src/support/aiPolicy');
  ok(hasAiOptOut('No AI-generated pull requests are accepted.'), 'detects an AI opt-out sentence');
  ok(!hasAiOptOut('We use Laravel and write good tests.'), 'no false positive on normal text');
  const dir = scaffold({
    'composer.json': JSON.stringify({ require: { 'laravel/framework': '^12' } }),
    'artisan': '',
    'CONTRIBUTING.md': 'No AI-generated contributions are accepted in this project.',
    'AGENTS.md': '# Notes\n\nNo AI contributions, please.\n',
  });
  ok(lib.detectRepoAiPolicy(dir).includes('CONTRIBUTING.md'), 'detects repo AI policy in CONTRIBUTING.md');
  const d = lib.detect(dir);
  const c = lib.compose(['core', ...d.stacks]);
  const p = []; p.dryRun = false; lib.writeCanonical(dir, c, p);
  const emitPlan = lib.emit(dir, {});
  ok(emitPlan.some((e) => e.path === 'AGENTS.md' && e.action === 'skipped'), 'skips the repo\'s anti-AI AGENTS.md');
  ok(!fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8').includes('groundrules:managed'), 'does not inject a managed block into it');
  ok(lib.check(dir, {}).every((x) => x.path !== 'AGENTS.md'), 'check does not flag the untouched anti-AI file');
}

// 9. Scoped + always-on rules: multi-stack (Laravel + Vue) projects to always/scoped files
{
  const dir = scaffold({
    'composer.json': JSON.stringify({ require: { 'laravel/framework': '^12' } }),
    'artisan': '',
    'package.json': JSON.stringify({ dependencies: { vue: '^3', '@inertiajs/vue3': '^1' } }),
  });
  initInto(dir);
  const cursorMain = fs.readFileSync(path.join(dir, '.cursor/rules/groundrules.mdc'), 'utf8');
  ok(/alwaysApply: true/.test(cursorMain), 'cursor main rule is alwaysApply:true (guaranteed load)');
  ok(!/### Laravel \/ PHP specifics/.test(cursorMain), 'always body strips stack specifics out of the main rule');
  const laravelMdc = fs.readFileSync(path.join(dir, '.cursor/rules/groundrules-laravel-php.mdc'), 'utf8');
  ok(/globs: \*\*\/\*\.php,artisan,\*\*\/\*\.blade\.php/.test(laravelMdc), 'laravel scoped rule carries its globs');
  ok(/alwaysApply: false/.test(laravelMdc), 'scoped rule is auto-attached (alwaysApply:false)');
  const vueInstr = fs.readFileSync(path.join(dir, '.github/instructions/groundrules-vue.instructions.md'), 'utf8');
  ok(/applyTo: "\*\*\/\*\.vue"/.test(vueInstr), 'copilot vue instructions carry applyTo');
  const agents = fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8');
  ok(/### Laravel \/ PHP specifics/.test(agents), 'AGENTS.md keeps the FULL body (stack specifics inline)');
  ok(lib.check(dir, {}).length === 0, 'scoped + always adapters are in sync right after emit');
}

// 9a. editing a stack section re-syncs its scoped rule (laravel-only for an unambiguous target)
{
  const dir = scaffold({ 'composer.json': JSON.stringify({ require: { 'laravel/framework': '^12' } }), 'artisan': '' });
  initInto(dir);
  ok(lib.check(dir, {}).length === 0, 'laravel-only scoped rules in sync after emit');
  const cs = path.join(dir, '.ai/coding-standards.md');
  fs.writeFileSync(cs, fs.readFileSync(cs, 'utf8') + '\n- EXTRA-LARAVEL-RULE\n'); // lands in the laravel tail
  ok(lib.check(dir, {}).some((d) => d.path.includes('groundrules-laravel-php.mdc')), 'editing the laravel section drifts its scoped rule');
  lib.emit(dir, {});
  ok(fs.readFileSync(path.join(dir, '.cursor/rules/groundrules-laravel-php.mdc'), 'utf8').includes('EXTRA-LARAVEL-RULE'), 'scoped rule picks up the .ai edit on generate');
}

// 9b. Bare repo: always body == full body, and NO scoped files are emitted
{
  const dir = scaffold({ 'README.md': '# x' });
  initInto(dir);
  ok(!fs.existsSync(path.join(dir, '.cursor/rules/groundrules-core.mdc')), 'no scoped files without a stack');
  ok(/alwaysApply: true/.test(fs.readFileSync(path.join(dir, '.cursor/rules/groundrules.mdc'), 'utf8')), 'cursor main still always-on on a bare repo');
  ok(lib.check(dir, {}).length === 0, 'bare repo in sync');
}

// 9c. --tools selection excludes the scoped files of unselected tools
{
  const dir = scaffold({ 'go.mod': 'module x\n' });
  const d = lib.detect(dir); const c = lib.compose(['core', ...d.stacks]);
  const p = []; p.dryRun = false; lib.writeCanonical(dir, c, p);
  lib.emit(dir, { tools: ['agents'] });
  ok(fs.existsSync(path.join(dir, 'AGENTS.md')), '--tools=agents writes AGENTS.md');
  ok(!fs.existsSync(path.join(dir, '.cursor/rules/groundrules-go.mdc')), '--tools=agents does NOT emit cursor scoped files');
  ok(!fs.existsSync(path.join(dir, '.github/instructions/groundrules-go.instructions.md')), '--tools=agents does NOT emit copilot scoped files');
}

// 10. Import: adopt an existing CLAUDE.md + .cursorrules without duplicating them
{
  const dir = scaffold({
    'composer.json': JSON.stringify({ require: { 'laravel/framework': '^12' } }),
    'artisan': '',
    'CLAUDE.md': '# House rules\n\n- Money is stored in agorot (integer), never floats.\n',
    '.cursorrules': 'Prefer Tailwind utility classes.\n',
  });
  const found = lib.importRules(dir);
  ok(found.imported === true, 'import finds existing agent rules');
  ok(/agorot/.test(found.body) && /Tailwind/.test(found.body), 'imported body merges CLAUDE.md + .cursorrules');
  ok(found.consumedTargets.has('CLAUDE.md'), 'CLAUDE.md flagged as a consumed target (rendered fresh)');
  // replicate the ImportCommand flow
  const d = lib.detect(dir); const c = lib.compose(['core', ...d.stacks]);
  c.sections.context = found.body;
  const p = []; p.dryRun = false; lib.writeCanonical(dir, c, p);
  lib.emit(dir, { freshPaths: found.consumedTargets });
  ok(!fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8').includes('agorot'), 'CLAUDE.md is NOT duplicated (its rules moved into .ai/)');
  ok(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8').includes('agorot'), 'imported rules flow into AGENTS.md via .ai/context.md');
  ok(lib.check(dir, {}).length === 0, 'in sync immediately after import');
}

// 10b. Import de-dupes a CLAUDE.md that only @imports AGENTS.md (nothing to import from it)
{
  const dir = scaffold({ 'AGENTS.md': '# Team rules\n\n- Rule A\n', 'CLAUDE.md': '@AGENTS.md\n' });
  const found = lib.importRules(dir);
  ok(found.imported === true, 'imports the real AGENTS.md content');
  ok(found.labels.includes('AGENTS.md') && !found.labels.includes('CLAUDE.md'), 'the @import-only CLAUDE.md contributes nothing');
  ok((found.body.match(/Rule A/g) || []).length === 1, 'no double-counting of the shared content');
}

// 11. section splitter: core head vs per-pack tail
{
  const { splitSection } = require('../src/support/sectionSplit');
  const text = 'core rule one\n\n### Laravel / PHP specifics\n\nlaravel rule\n\n### Vue / Inertia specifics\n\nvue rule';
  const r = splitSection(text, ['Laravel / PHP', 'Vue / Inertia']);
  ok(r.head === 'core rule one', 'split extracts the core head');
  ok(r.tails['Laravel / PHP'] === 'laravel rule', 'split extracts the laravel tail');
  ok(r.tails['Vue / Inertia'] === 'vue rule', 'split extracts the vue tail');
  ok(splitSection('just core', ['Laravel / PHP']).head === 'just core', 'split with no marker returns whole as head');
}

// 12. AI opt-out detector — unified line-scoped rule (kept byte-identical to the Rust port)
{
  const { hasAiOptOut } = require('../src/support/aiPolicy');
  const optOut = [
    'No AI-generated pull requests are accepted.',
    'Do not use AI or LLM tools in this repository.',   // reviewer case: JS used to say yes, Rust no
    'AI-generated code is not accepted.',
    'LLM output is prohibited here.',
    "Please don't submit AI-generated code.",
    'No LLM contributions.',
    'AI contributions are not welcome.',
  ];
  for (const s of optOut) ok(hasAiOptOut(s), `opt-out detected: ${s}`);
  const fine = [
    'We use AI to assist development.',
    'This will not run without AI keys configured.',    // reviewer case: JS used to say no, Rust yes
    'AI-assisted contributions are welcome.',
    'We use Laravel and write good tests.',
    'The AI revolution is not stopping.',
  ];
  for (const s of fine) ok(!hasAiOptOut(s), `no false positive: ${s}`);
}

// 13. splitSection handles a marker at start-of-string (empty core head)
{
  const { splitSection } = require('../src/support/sectionSplit');
  const r = splitSection('### Go specifics\n\ngo rule', ['Go']);
  ok(r.head === '', 'start-of-string marker yields empty head');
  ok(r.tails['Go'] === 'go rule', 'start-of-string marker routes tail to the pack');
}

// 14. frontmatter value normalization: trim + strip surrounding quote runs (matches Rust)
{
  const { parseFrontmatter } = require('../src/support/frontmatter');
  const r = parseFrontmatter('---\nname: "widget"  \ndescription: \'does stuff\'\n---\nbody');
  ok(r.data.name === 'widget', 'strips quotes + trailing whitespace from name');
  ok(r.data.description === 'does stuff', 'strips single quotes from description');
}

// 15. import skips symlinked sources (never slurp a file pointing outside the repo)
{
  const dir = scaffold({ 'composer.json': JSON.stringify({ require: { 'laravel/framework': '^12' } }), 'artisan': '' });
  const secret = scaffold({ 'secret.md': 'SUPER SECRET API KEY sk-live-xyz' });
  fs.symlinkSync(path.join(secret, 'secret.md'), path.join(dir, 'CLAUDE.md'));
  const found = lib.importRules(dir);
  ok(!found.imported || !JSON.stringify(found).includes('SUPER SECRET'), 'symlinked CLAUDE.md is not imported');
}

// 16. import is CRLF-safe: a Windows-authored source yields LF-only .ai/context.md
{
  const dir = scaffold({ 'CLAUDE.md': '# Rules\r\n\r\nUse tabs.\r\nWrite tests.\r\n' });
  const found = lib.importRules(dir);
  ok(found.imported === true, 'imports a CRLF source');
  ok(!found.body.includes('\r'), 'CRLF stripped to LF in the imported body (Rust-parity)');
}

// 17. import block-dedup: a big multi-line block shared across two sources appears once
{
  const shared = '## Shared\n\n- rule line one that is shared across both files\n- rule line two also shared here\n- rule line three shared as well';
  const dir = scaffold({
    'AGENTS.md': '# Agents\n\n' + shared + '\n\n- agents-only unique line for context',
    'CLAUDE.md': '# Claude\n\n' + shared + '\n\n- claude-only unique line for context',
  });
  const found = lib.importRules(dir);
  ok(found.imported === true, 'imports both sources');
  const n = (found.body.match(/rule line two also shared here/g) || []).length;
  ok(n === 1, `shared multi-line block de-duplicated (appears ${n}x, want 1)`);
  ok(/agents-only unique/.test(found.body) && /claude-only unique/.test(found.body), 'unique single-line content from both sources kept');
}

function importInto(dir) {
  const found = lib.importRules(dir);
  const d = lib.detect(dir); const c = lib.compose(['core', ...d.stacks]);
  c.sections.context = found.body;
  const p = []; p.dryRun = false; lib.writeCanonical(dir, c, p);
  lib.emit(dir, { freshPaths: found.consumedTargets });
  return {
    agents: fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8'),
    cursorMain: fs.readFileSync(path.join(dir, '.cursor/rules/groundrules.mdc'), 'utf8'),
  };
}

// 18. lean import (Option C): a LARGE raw import is lifted off the always-on rule,
//     but stays in the full-body adapters (AGENTS.md)
{
  const big = Array.from({ length: 70 }, (_, i) => `- imported rule number ${i} carrying real project detail`).join('\n');
  const dir = scaffold({
    'composer.json': JSON.stringify({ require: { 'laravel/framework': '^12' } }), 'artisan': '',
    'CLAUDE.md': '# House\n\nUNIQUE-IMPORT-MARKER-ZZZ\n\n' + big + '\n',
  });
  const { agents, cursorMain } = importInto(dir);
  ok(agents.includes('UNIQUE-IMPORT-MARKER-ZZZ'), 'full body (AGENTS.md) keeps the large imported context');
  ok(!cursorMain.includes('UNIQUE-IMPORT-MARKER-ZZZ'), 'always-on rule does NOT force-load a large raw import');
  ok(/bootstrap/.test(cursorMain) && /Project context/.test(cursorMain), 'always-on rule points to bootstrap for context');
  ok(lib.check(dir, {}).length === 0, 'lean-import adapters are in sync');
}

// 18b. a SMALL import stays inline in the always-on rule (no bloat to avoid — the llm/Skyvern case)
{
  const dir = scaffold({
    'composer.json': JSON.stringify({ require: { 'laravel/framework': '^12' } }), 'artisan': '',
    'CLAUDE.md': '# Dev setup\n\nSMALL-IMPORT-MARKER-QQQ: run `pytest` before pushing; format with ruff.\n',
  });
  const { cursorMain } = importInto(dir);
  ok(cursorMain.includes('SMALL-IMPORT-MARKER-QQQ'), 'a small imported context stays inline in the always-on rule');
}

// 19. symlinked adapter target (CLAUDE.md -> AGENTS.md, the zod pattern): skipped, not clobbered, not drift
{
  const dir = scaffold({ 'go.mod': 'module x\n', 'AGENTS.md': '# existing\n' });
  fs.symlinkSync('AGENTS.md', path.join(dir, 'CLAUDE.md')); // CLAUDE.md -> AGENTS.md
  const d = lib.detect(dir); const c = lib.compose(['core', ...d.stacks]);
  const p = []; p.dryRun = false; lib.writeCanonical(dir, c, p);
  const plan = lib.emit(dir, {}); // must NOT throw on the symlinked target
  ok(plan.some((e) => e.path === 'CLAUDE.md' && e.action === 'symlink'), 'symlinked CLAUDE.md is skipped, not written');
  ok(fs.lstatSync(path.join(dir, 'CLAUDE.md')).isSymbolicLink(), 'CLAUDE.md is still a symlink (not clobbered through)');
  ok(lib.check(dir, {}).every((x) => x.path !== 'CLAUDE.md'), 'check does not flag the symlinked target as perpetual drift');
}

// 20. archetype detection — what KIND of project is this?
{
  const { detectArchetype } = require('../src/detectors/archetype');
  ok(detectArchetype(scaffold({ 'artisan': '', 'composer.json': '{}' })) === 'web-app', 'detects a web app (artisan)');
  ok(detectArchetype(scaffold({ 'package.json': JSON.stringify({ dependencies: { express: '^4' } }) })) === 'web-app', 'detects a web app (express)');
  ok(detectArchetype(scaffold({ 'package.json': JSON.stringify({ bin: { foo: 'c.js' } }) })) === 'cli', 'detects a CLI (package.json bin)');
  ok(detectArchetype(scaffold({ 'pyproject.toml': '[project.scripts]\nx = "m:c"\n' })) === 'cli', 'detects a CLI (python scripts)');
  ok(detectArchetype(scaffold({ 'go.mod': 'module x\nrequire github.com/spf13/cobra v1\n' })) === 'cli', 'detects a CLI (go + cobra)');
  ok(detectArchetype(scaffold({ 'package.json': JSON.stringify({ exports: './i.js' }) })) === 'library', 'detects a library (exports, no bin)');
  ok(detectArchetype(scaffold({ 'README.md': '# x' })) === 'unknown', 'unclassifiable → unknown');
  // a web framework outranks a bin (a Laravel app with artisan is still a web app)
  ok(detectArchetype(scaffold({ 'artisan': '', 'composer.json': '{}', 'package.json': JSON.stringify({ bin: { x: 'c.js' } }) })) === 'web-app', 'web signal outranks a CLI signal');
}

// 20a. FAIL-SAFE regressions: ambiguous signals must never classify a web app as cli/library.
//      Each of these was a confirmed critical — a real web app silently losing its security rules.
{
  const { detectArchetype } = require('../src/detectors/archetype');
  // `npm init -y` emits "main": "index.js" — that is a default, not a library signal.
  ok(detectArchetype(scaffold({ 'package.json': JSON.stringify({ name: 'x', main: 'index.js' }), 'server.js': 'require("node:http")' })) === 'unknown',
    'npm-init default main + node:http server → unknown, NOT library');
  // an unlisted framework must fall through to the fail-safe, not to `library`
  ok(detectArchetype(scaffold({ 'package.json': JSON.stringify({ main: 'i.js', dependencies: { pg: '^8', 'drizzle-orm': '^0.3' } }) })) === 'unknown',
    'db-backed app on an unlisted framework → unknown, NOT library');
  // private packages can't be published, so they are never a library
  ok(detectArchetype(scaffold({ 'package.json': JSON.stringify({ private: true, exports: './i.js' }) })) === 'unknown',
    'private:true → unknown, never library');
  // `cmd/` is the STANDARD Go service layout, not a CLI signal
  ok(detectArchetype(scaffold({ 'go.mod': 'module x\nrequire github.com/jackc/pgx/v5 v5\n', 'cmd/api/main.go': 'package main' })) === 'unknown',
    'Go service at cmd/api/main.go → unknown, NOT cli');
  // every Rust binary has main.rs / [[bin]] — including servers
  ok(detectArchetype(scaffold({ 'Cargo.toml': '[package]\nname="x"\n[[bin]]\nname="s"\n', 'src/main.rs': 'fn main(){}' })) === 'unknown',
    'Rust bin target alone → unknown, NOT cli');
  // PEP-621 [project] is not a library signal
  ok(detectArchetype(scaffold({ 'pyproject.toml': '[project]\nname = "svc"\n' })) === 'unknown',
    'PEP-621 [project] alone → unknown, NOT library');
  // positive CLI evidence still classifies
  ok(detectArchetype(scaffold({ 'Cargo.toml': '[package]\nname="x"\nclap = "4"\n' })) === 'cli', 'Rust + clap → cli');
  ok(detectArchetype(scaffold({ 'go.mod': 'module x\nrequire github.com/spf13/cobra v1\n' })) === 'cli', 'Go + cobra → cli');
  // widened web lists catch more real frameworks
  ok(detectArchetype(scaffold({ 'package.json': JSON.stringify({ dependencies: { hono: '^4' } }) })) === 'web-app', 'hono → web-app');
  ok(detectArchetype(scaffold({ 'pyproject.toml': 'litestar = "*"' })) === 'web-app', 'litestar → web-app');
}

// 20b. archetype gating: web-only rules + skills are dropped for a CLI, kept when unknown
{
  const txt = (c) => Object.values(c.sections).join('\n');
  const web = lib.compose(['core'], 'web-app');
  const cli = lib.compose(['core'], 'cli');
  const unknown = lib.compose(['core'], 'unknown');
  ok(/DTOs\/resources/.test(txt(web)), 'web-app keeps the over-exposure rule');
  ok(!/DTOs\/resources/.test(txt(cli)), 'cli drops the over-exposure rule');
  ok(/DTOs\/resources/.test(txt(unknown)), 'unknown keeps everything (fail-safe)');
  ok(!txt(cli).includes('groundrules:only'), 'gating markers never leak into .ai/');
  // skills are NOT archetype-gated: their descriptions self-gate, and the web/CLI axis is wrong
  // for them (a CLI can own a database or a queue).
  ok(cli.skills.some((s) => s.name === 'add-database-change'), 'a CLI keeps the database skill (it may own a DB)');
  ok(cli.skills.some((s) => s.name === 'bootstrap'), 'universal skills survive gating');
  // DB/migration rules are NOT web-gated either — a CLI can own a datastore
  ok(/wrap related writes in a \*\*transaction\*\*/.test(txt(cli)), 'cli keeps the transaction rule (may own a DB)');
  ok(/disposable/.test(txt(cli)), 'cli keeps the disposable-test-DB guard');
}

// 20c. archetypeFilter unit
{
  const { stripArchetypeBlocks, skillApplies } = require('../src/support/archetypeFilter');
  const t = 'keep\n<!-- groundrules:only web-app -->\nweb only\n<!-- groundrules:end -->\ntail';
  ok(stripArchetypeBlocks(t, 'web-app') === 'keep\nweb only\ntail', 'keeps a matching block, drops the markers');
  ok(stripArchetypeBlocks(t, 'cli') === 'keep\ntail', 'drops a non-matching block');
  ok(stripArchetypeBlocks(t, 'unknown') === 'keep\nweb only\ntail', 'unknown keeps everything');
  ok(skillApplies('', 'cli') === true, 'a skill without archetypes always applies');
  ok(skillApplies('web-app', 'cli') === false, 'a web-app skill does not apply to a cli');
  ok(skillApplies('web-app', 'unknown') === true, 'unknown keeps the skill (fail-safe)');
}

console.log(`ok - ${passed} smoke assertions passed`);
