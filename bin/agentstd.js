#!/usr/bin/env node
'use strict';
/* eslint-disable no-console */
const path = require('path');
const lib = require('../src/lib');
const { paint } = lib;

function parseArgs(argv) {
  const args = { _: [], tools: null, dryRun: false, yes: false, all: false, cwd: process.cwd() };
  for (const a of argv) {
    if (a === '--dry-run' || a === '-n') args.dryRun = true;
    else if (a === '--yes' || a === '-y') args.yes = true;
    else if (a === '--all') args.all = true;
    else if (a.startsWith('--tools=')) args.tools = a.slice(8).split(',').map((s) => s.trim()).filter(Boolean);
    else if (a.startsWith('--cwd=')) args.cwd = path.resolve(a.slice(6));
    else if (!a.startsWith('-')) args._.push(a);
  }
  return args;
}

function printPlan(plan) {
  const icon = { create: paint('green', '  +'), overwrite: paint('yellow', '  ~'), update: paint('yellow', '  ~'), unchanged: paint('dim', '  =') };
  for (const p of plan) console.log(`${icon[p.action] || '  ?'} ${p.path}${p.action === 'unchanged' ? paint('dim', ' (unchanged)') : ''}`);
}

function printRecommends(recommends) {
  if (!recommends.length) return;
  console.log('\n' + paint('bold', 'Recommended for your stack:'));
  for (const r of recommends) {
    console.log(`  ${paint('cyan', '●')} ${paint('bold', r.name)} ${paint('dim', '(' + r.pack + ')')}`);
    if (r.why) console.log(`    ${paint('dim', r.why)}`);
    if (r.install) console.log(`    ${paint('green', '$ ' + r.install)}`);
  }
}

function cmdDetect(args) {
  const d = lib.detect(args.cwd);
  console.log(paint('bold', 'Stack detection'));
  console.log(`  packs:   ${d.stacks.length ? d.stacks.map((s) => paint('cyan', s)).join(', ') : paint('dim', 'none (universal core only)')}`);
  console.log(`  signals: ${d.signals.length ? d.signals.join(', ') : paint('dim', 'none')}`);
  console.log(`  agents already present: ${d.existingAgents.length ? d.existingAgents.join(', ') : paint('dim', 'none')}`);
}

function cmdInit(args) {
  const d = lib.detect(args.cwd);
  console.log(paint('bold', '\nagentstd init'));
  console.log(`  detected: ${d.stacks.length ? d.stacks.map((s) => paint('cyan', s)).join(' + ') : paint('dim', 'no known stack')} ${paint('dim', '[' + (d.signals.join(', ') || 'universal core only') + ']')}`);
  if (d.existingAgents.length) console.log(`  ${paint('dim', 'existing agent files: ' + d.existingAgents.join(', ') + ' (preserved — only managed blocks are touched)')}`);

  const composed = lib.compose(['core', ...d.stacks]);
  console.log(`  packs applied: ${composed.appliedPacks.map((p) => paint('cyan', p.name)).join(' → ')}`);

  const plan = []; plan.dryRun = args.dryRun;
  lib.writeCanonical(args.cwd, composed, plan);
  const emitPlan = lib.emit(args.cwd, { dryRun: args.dryRun, tools: args.tools, all: args.all });
  for (const e of emitPlan) plan.push(e);

  console.log('\n' + paint('bold', args.dryRun ? 'Would write:' : 'Wrote:'));
  printPlan(plan);
  printRecommends(composed.recommends);

  console.log('\n' + paint('bold', 'Next:'));
  console.log(`  1. Open your coding agent (Claude Code / Codex / opencode) in this repo.`);
  console.log(`  2. Run the ${paint('cyan', 'bootstrap')} skill — it scans the project and fills in ${paint('cyan', '.ai/')} + drafts skills.`);
  console.log(`  3. Edit ${paint('cyan', '.ai/')}, then ${paint('green', 'agentstd generate')} to re-sync every agent's rules file.`);
  if (args.dryRun) console.log('\n' + paint('yellow', 'Dry run — nothing was written. Re-run without --dry-run to apply.'));
}

function cmdGenerate(args) {
  if (!lib.exists(path.join(args.cwd, '.ai'))) {
    console.error(paint('red', 'No .ai/ found. Run `agentstd init` first.'));
    process.exit(1);
  }
  const plan = lib.emit(args.cwd, { dryRun: args.dryRun, tools: args.tools, all: args.all });
  console.log(paint('bold', args.dryRun ? 'Would regenerate:' : 'Regenerated adapters from .ai/:'));
  printPlan(plan);
}

function cmdCheck(args) {
  const drift = lib.check(args.cwd, { tools: args.tools, all: args.all });
  if (!drift.length) { console.log(paint('green', '✓ adapters are in sync with .ai/')); return; }
  console.log(paint('red', '✗ adapters are out of date — run `agentstd generate`:'));
  for (const d of drift) console.log(`  ${paint('red', '•')} ${d.path} ${paint('dim', '(' + d.reason + ')')}`);
  process.exit(1);
}

const HELP = `${paint('bold', 'agentstd')} — one source of truth for AI coding agents

${paint('bold', 'Usage')}
  agentstd <command> [options]

${paint('bold', 'Commands')}
  init        Detect the stack, scaffold .ai/ (core + stack packs) and generate every agent's rules file
  generate    Re-generate all adapters from .ai/ (idempotent; only managed blocks change)
  check       Fail (exit 1) if any adapter is out of sync with .ai/  — use in CI
  detect      Print what would be detected, without writing anything

${paint('bold', 'Options')}
  --dry-run, -n     Show what would change, write nothing
  --tools=a,b       Limit adapters (agents,claude,cursor,copilot,gemini,windsurf)
  --all             Include non-default adapters (e.g. windsurf)
  --cwd=PATH        Run against another directory
  -y, --yes         Assume yes (non-interactive)

${paint('bold', 'Examples')}
  npx agentstd init
  agentstd init --dry-run
  agentstd generate
  agentstd check           ${paint('dim', '# in CI, gate on drift')}`;

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  try {
    switch (cmd) {
      case 'init': return cmdInit(args);
      case 'generate': case 'gen': return cmdGenerate(args);
      case 'check': return cmdCheck(args);
      case 'detect': return cmdDetect(args);
      case undefined: case 'help': case '--help': case '-h': return console.log(HELP);
      default:
        console.error(paint('red', `Unknown command: ${cmd}`));
        console.log(HELP); process.exit(1);
    }
  } catch (e) {
    console.error(paint('red', 'Error: ') + (e && e.message ? e.message : String(e)));
    process.exit(1);
  }
}

main();
