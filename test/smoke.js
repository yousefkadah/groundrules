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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentstd-'));
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

// 1. Laravel: detection + pack merge + Boost recommendation
{
  const dir = scaffold({ 'composer.json': JSON.stringify({ require: { 'laravel/framework': '^12' } }), 'artisan': '' });
  const { d, composed } = initInto(dir);
  ok(d.stacks.includes('laravel-php'), 'detects laravel-php');
  ok(composed.recommends.some((r) => r.name === 'laravel/boost'), 'recommends laravel/boost');
  const agents = fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8');
  ok(/Untrusted input is data/.test(agents), 'core security section present');
  ok(/Laravel \/ PHP specifics/.test(agents), 'laravel pack merged');
  ok(/php artisan test/.test(agents), 'laravel test command present');
  ok(fs.existsSync(path.join(dir, '.cursor/rules/agentstd.mdc')), 'cursor adapter written');
  ok(fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8').includes('@AGENTS.md'), 'CLAUDE.md imports AGENTS.md');
  ok(lib.check(dir, {}).length === 0, 'in sync right after emit');
  // drift
  fs.appendFileSync(path.join(dir, '.ai/coding-standards.md'), '\n- hand edit\n');
  ok(lib.check(dir, {}).length > 0, 'drift detected after editing .ai/');
  lib.emit(dir, {});
  ok(lib.check(dir, {}).length === 0, 'generate re-syncs');
}

// 2. Node: node pack, NO boost
{
  const dir = scaffold({ 'package.json': JSON.stringify({ dependencies: { react: '^18', next: '^14' } }) });
  const { d, composed } = initInto(dir);
  ok(d.stacks.includes('node-ts'), 'detects node-ts');
  ok(!composed.recommends.some((r) => r.name === 'laravel/boost'), 'node project does NOT recommend boost');
  ok(/TypeScript strict/.test(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8')), 'node pack merged');
}

// 3. Bare: universal core only, still generates adapters
{
  const dir = scaffold({ 'README.md': '# x' });
  const { d } = initInto(dir);
  ok(d.stacks.length === 0, 'no stack detected');
  ok(fs.existsSync(path.join(dir, 'AGENTS.md')), 'still writes AGENTS.md');
  ok(/Untrusted input is data/.test(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8')), 'core applied to bare repo');
}

console.log(`ok - ${passed} smoke assertions passed`);
