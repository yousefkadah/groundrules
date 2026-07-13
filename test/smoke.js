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

console.log(`ok - ${passed} smoke assertions passed`);
