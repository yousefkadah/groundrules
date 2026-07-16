'use strict';

const { paint } = require('../support/ansi');

const HELP = `${paint('bold', 'groundrules')} — one source of truth for AI coding agents

${paint('bold', 'Usage')}
  groundrules <command> [options]

${paint('bold', 'Commands')}
  init        Detect the stack, scaffold .ai/ (core + stack packs) and generate every agent's rules file
  import      Adopt existing rules (CLAUDE.md/.cursorrules/Copilot/Gemini…) into .ai/, then generate
  generate    Re-generate all adapters from .ai/ (idempotent; only managed blocks change)
  check       Fail (exit 1) if any adapter is out of sync with .ai/  — use in CI
  detect      Print what would be detected, without writing anything

${paint('bold', 'Options')}
  --dry-run, -n     Show what would change, write nothing
  --force           Overwrite existing .ai/ files (init is create-only by default)
  --ignore-ai-policy  Proceed even if the repo forbids AI contributions
  --archetype=T     Declare the project type: web-app, cli, library (default: keep every rule)
  --tools=a,b       Limit adapters (agents,claude,cursor,copilot,gemini,windsurf)
  --all             Include non-default adapters (e.g. windsurf)
  --cwd=PATH        Run against another directory
  -y, --yes         Assume yes (non-interactive)

${paint('bold', 'Examples')}
  npx @yousefkadah/groundrules init
  npx @yousefkadah/groundrules import   ${paint('dim', '# already have a CLAUDE.md? adopt it')}
  groundrules init --dry-run
  groundrules generate
  groundrules check           ${paint('dim', '# in CI, gate on drift')}`;

/** Owns all human-facing terminal output. */
class Printer {
  /* eslint-disable no-console */
  plan(plan) {
    const icon = { create: paint('green', '  +'), overwrite: paint('yellow', '  ~'), update: paint('yellow', '  ~'), unchanged: paint('dim', '  ='), kept: paint('dim', '  ·'), skipped: paint('yellow', '  ⚠'), symlink: paint('dim', '  ·') };
    const suffix = { unchanged: paint('dim', ' (unchanged)'), kept: paint('dim', ' (kept — --force to overwrite)'), skipped: paint('yellow', ' (skipped — repo AI policy)'), symlink: paint('dim', ' (skipped — symlink, left as-is)') };
    for (const p of plan) console.log(`${icon[p.action] || '  ?'} ${p.path}${suffix[p.action] || ''}`);
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

  /** One line explaining the DECLARED project type and what it means for the rules. */
  archetypeLine(a) {
    const note = a === 'unknown'
      ? 'keeping every rule — declare with --archetype=cli|library|web-app'
      : a === 'web-app'
        ? 'web-app rules apply'
        : 'skipping web-app rules (tenancy, over-exposure, uploads, deploys)';
    return `  project type: ${paint('cyan', a)} ${paint('dim', '— ' + note)}`;
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
    console.log(this.archetypeLine(canonical.archetype));
    console.log(`  packs applied: ${canonical.appliedPacks.map((p) => paint('cyan', p.name)).join(' → ')}`);
  }

  importHeader(d, canonical, found) {
    console.log(paint('bold', '\ngroundrules import'));
    console.log(`  imported rules from: ${found.labels.map((l) => paint('cyan', l)).join(', ')}`);
    console.log(`  detected: ${d.stacks.length ? d.stacks.map((s) => paint('cyan', s)).join(' + ') : paint('dim', 'no known stack')} ${paint('dim', '[' + (d.signals.join(', ') || 'universal core only') + ']')}`);
    console.log(this.archetypeLine(canonical.archetype));
    console.log(`  packs applied: ${canonical.appliedPacks.map((p) => paint('cyan', p.name)).join(' → ')}`);
    console.log(`  ${paint('dim', 'your existing rules seed .ai/context.md — the bootstrap skill then sorts them into the right sections')}`);
  }

  importNothing() {
    console.log(paint('yellow', '\nNo existing agent rules found to import.'));
    console.log(paint('dim', '  Looked for CLAUDE.md, AGENTS.md, .cursorrules, .cursor/rules/*.mdc, .github/copilot-instructions.md, GEMINI.md, .windsurf/rules/*.'));
    console.log(`  Run ${paint('green', 'groundrules init')} to scaffold from scratch instead.`);
  }

  importContextKept() {
    console.log('\n' + paint('yellow', '⚠ .ai/context.md already exists — your imported rules were NOT applied to it.'));
    console.log(paint('dim', '  Re-run `groundrules import --force` to replace it, or merge the imported rules in by hand.'));
  }

  importSuperseded(files) {
    console.log('\n' + paint('dim', `Note: ${files.join(', ')} is legacy — its rules now live in .ai/ and are re-emitted to the modern paths. Safe to delete once you've confirmed the new files.`));
  }

  importNext(dryRun) {
    console.log('\n' + paint('bold', 'Next:'));
    console.log('  1. Open your coding agent (Claude Code / Codex / opencode) in this repo.');
    console.log(`  2. Run the ${paint('cyan', 'bootstrap')} skill — it splits your imported rules into the right ${paint('cyan', '.ai/')} sections and fills any gaps.`);
    console.log(`  3. Edit ${paint('cyan', '.ai/')}, then ${paint('green', 'groundrules generate')} to re-sync every agent's rules file.`);
    if (dryRun) console.log('\n' + paint('yellow', 'Dry run — nothing was written. Re-run without --dry-run to apply.'));
  }

  wroteHeader(dryRun) { console.log('\n' + paint('bold', dryRun ? 'Would write:' : 'Wrote:')); }
  regenerateHeader(dryRun) { console.log(paint('bold', dryRun ? 'Would regenerate:' : 'Regenerated adapters from .ai/:')); }

  placeholderWarning() {
    console.log('\n' + paint('yellow', "⚠ .ai/context.md has «placeholders» — run the bootstrap skill in your agent to fill this project's real context before relying on the rules."));
  }
  placeholderWarningShort() { console.log(paint('yellow', '⚠ .ai/context.md still has «placeholders» — run the bootstrap skill to fill them.')); }

  /** Refuse BEFORE writing anything — a warning after the fact is not a guard. */
  aiPolicyRefusal(files) {
    console.log('\n' + paint('yellow', `⚠ This repo restricts AI contributions (see ${files.join(', ')}).`));
    console.log(paint('dim', '  Groundrules writes AI-agent rules files; committing them would itself be an AI-generated contribution.'));
    console.log(paint('bold', '  Nothing was written.'));
    console.log(`  If it's your repo, or you're setting this up locally for a human to review, re-run with ${paint('green', '--ignore-ai-policy')}.`);
  }

  aiPolicyWarning(files, skipped) {
    console.log('\n' + paint('yellow', '⚠ This repo appears to restrict AI contributions' + (files && files.length ? ` (see ${files.join(', ')})` : '') + '.'));
    if (skipped && skipped.length) console.log(paint('yellow', `  Left untouched (its file forbids AI): ${skipped.join(', ')}`));
    console.log(paint('dim', "  Respect the repo's policy — prepare local changes for a human to review; don't open PRs/comments as if a person authored them."));
  }

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
