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

// 18. lean import (Option C): raw imported context is NOT force-loaded into the always-on rule,
//     but IS kept in the full-body adapters (AGENTS.md)
{
  const dir = scaffold({
    'composer.json': JSON.stringify({ require: { 'laravel/framework': '^12' } }), 'artisan': '',
    'CLAUDE.md': '# House\n\n- Money is stored in agorot UNIQUE-IMPORT-MARKER-ZZZ.\n- Another long imported rule line that carries real project detail here.\n',
  });
  const found = lib.importRules(dir);
  const d = lib.detect(dir); const c = lib.compose(['core', ...d.stacks]);
  c.sections.context = found.body;
  const p = []; p.dryRun = false; lib.writeCanonical(dir, c, p);
  lib.emit(dir, { freshPaths: found.consumedTargets });
  const agents = fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8');
  const cursorMain = fs.readFileSync(path.join(dir, '.cursor/rules/groundrules.mdc'), 'utf8');
  ok(agents.includes('UNIQUE-IMPORT-MARKER-ZZZ'), 'full body (AGENTS.md) keeps the imported context');
  ok(!cursorMain.includes('UNIQUE-IMPORT-MARKER-ZZZ'), 'always-on rule does NOT force-load raw imported context');
  ok(/bootstrap/.test(cursorMain) && /Project context/.test(cursorMain), 'always-on rule points to bootstrap for context');
  ok(lib.check(dir, {}).length === 0, 'lean-import adapters are in sync');
}

console.log(`ok - ${passed} smoke assertions passed`);
