'use strict';

const { paint } = require('../support/ansi');

const HELP = `${paint('bold', 'groundrules')} — one source of truth for AI coding agents

${paint('bold', 'Usage')}
  groundrules <command> [options]

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
  npx @yousefkadah/groundrules init
  groundrules init --dry-run
  groundrules generate
  groundrules check           ${paint('dim', '# in CI, gate on drift')}`;

/** Owns all human-facing terminal output. */
class Printer {
  /* eslint-disable no-console */
  plan(plan) {
    const icon = { create: paint('green', '  +'), overwrite: paint('yellow', '  ~'), update: paint('yellow', '  ~'), unchanged: paint('dim', '  =') };
    for (const p of plan) console.log(`${icon[p.action] || '  ?'} ${p.path}${p.action === 'unchanged' ? paint('dim', ' (unchanged)') : ''}`);
  }

  recommends(list) {
    if (!list.length) return;
    console.log('\n' + paint('bold', 'Recommended for your stack:'));
    for (const r of list) {
      console.log(`  ${paint('cyan', '●')} ${paint('bold', r.name)} ${paint('dim', '(' + r.pack + ')')}`);
      if (r.why) console.log(`    ${paint('dim', r.why)}`);
      if (r.install) console.log(`    ${paint('green', '$ ' + r.install)}`);
    }
  }

  detection(d) {
    console.log(paint('bold', 'Stack detection'));
    console.log(`  packs:   ${d.stacks.length ? d.stacks.map((s) => paint('cyan', s)).join(', ') : paint('dim', 'none (universal core only)')}`);
    console.log(`  signals: ${d.signals.length ? d.signals.join(', ') : paint('dim', 'none')}`);
    console.log(`  agents already present: ${d.existingAgents.length ? d.existingAgents.join(', ') : paint('dim', 'none')}`);
  }

  initHeader(d, canonical) {
    console.log(paint('bold', '\ngroundrules init'));
    console.log(`  detected: ${d.stacks.length ? d.stacks.map((s) => paint('cyan', s)).join(' + ') : paint('dim', 'no known stack')} ${paint('dim', '[' + (d.signals.join(', ') || 'universal core only') + ']')}`);
    if (d.existingAgents.length) console.log(`  ${paint('dim', 'existing agent files: ' + d.existingAgents.join(', ') + ' (preserved — only managed blocks are touched)')}`);
    console.log(`  packs applied: ${canonical.appliedPacks.map((p) => paint('cyan', p.name)).join(' → ')}`);
  }

  wroteHeader(dryRun) { console.log('\n' + paint('bold', dryRun ? 'Would write:' : 'Wrote:')); }
  regenerateHeader(dryRun) { console.log(paint('bold', dryRun ? 'Would regenerate:' : 'Regenerated adapters from .ai/:')); }

  placeholderWarning() {
    console.log('\n' + paint('yellow', "⚠ .ai/context.md has «placeholders» — run the bootstrap skill in your agent to fill this project's real context before relying on the rules."));
  }
  placeholderWarningShort() { console.log(paint('yellow', '⚠ .ai/context.md still has «placeholders» — run the bootstrap skill to fill them.')); }

  nextSteps(dryRun) {
    console.log('\n' + paint('bold', 'Next:'));
    console.log('  1. Open your coding agent (Claude Code / Codex / opencode) in this repo.');
    console.log(`  2. Run the ${paint('cyan', 'bootstrap')} skill — it scans the project and fills in ${paint('cyan', '.ai/')} + drafts skills.`);
    console.log(`  3. Edit ${paint('cyan', '.ai/')}, then ${paint('green', 'groundrules generate')} to re-sync every agent's rules file.`);
    if (dryRun) console.log('\n' + paint('yellow', 'Dry run — nothing was written. Re-run without --dry-run to apply.'));
  }

  checkOk() { console.log(paint('green', '✓ adapters are in sync with .ai/')); }
  checkDrift(drift) {
    console.log(paint('red', '✗ adapters are out of date — run `groundrules generate`:'));
    for (const d of drift) console.log(`  ${paint('red', '•')} ${d.path} ${paint('dim', '(' + d.reason + ')')}`);
  }

  error(msg) { console.error(paint('red', msg)); }
  help() { console.log(HELP); }
  /* eslint-enable no-console */
}

module.exports = Printer;
