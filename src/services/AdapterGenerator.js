'use strict';

const path = require('path');
const { ADAPTERS } = require('../config/adapters');
const strat = require('../strategies');
const { exists, read, write, listDirs, copyDir } = require('../support/fs');
const { hasAiOptOut, stripManaged } = require('../support/aiPolicy');

const DESC_ALWAYS = 'Project engineering standards, security guardrails, and skills for AI agents (always applied) — managed by groundrules.';

/** Emits every selected adapter from .ai/, plus copies skills and the PR template. */
class AdapterGenerator {
  constructor(bodyBuilder, packsDir) {
    this.bodyBuilder = bodyBuilder;
    this.packsDir = packsDir;
  }

  // Presence-based (not length-based): an explicit empty `--tools=` selects nothing,
  // matching the Rust port (Some([]) → none); an absent flag (null) selects defaults.
  selectAdapters(tools, all) {
    return ADAPTERS.filter((a) => (tools ? tools.includes(a.id) : (a.default || all)));
  }

  toolSelected(id, isDefault, tools, all) {
    return tools ? tools.includes(id) : (isDefault || all);
  }

  /**
   * The concrete set of files to emit: `{ path, toolId, render(existing) }`.
   * Cursor + Copilot get an always-on "main" body plus one path-scoped file per
   * applied stack; every other tool gets the full body. Both `generate` and
   * `check` build from this list, so they can never diverge.
   */
  targets(cwd, opts = {}) {
    const full = this.bodyBuilder.build(cwd);
    const always = this.bodyBuilder.buildAlways(cwd);
    const packs = this.bodyBuilder.appliedPacks(cwd).filter((p) => p.globs && p.globs.length);
    const out = [];

    for (const a of this.selectAdapters(opts.tools, opts.all)) {
      if (a.id === 'claude') out.push({ path: a.path, toolId: a.id, render: (e) => strat.importRef(e) });
      else if (a.id === 'cursor') out.push({ path: a.path, toolId: a.id, render: () => strat.cursorMdc(always, { alwaysApply: true, globs: [], description: DESC_ALWAYS }) });
      else if (a.id === 'copilot') out.push({ path: a.path, toolId: a.id, render: (e) => strat.inline(always, e) });
      else out.push({ path: a.path, toolId: a.id, render: (e) => strat.inline(full, e) });
    }

    const cursorOn = this.toolSelected('cursor', true, opts.tools, opts.all);
    const copilotOn = this.toolSelected('copilot', true, opts.tools, opts.all);
    if (cursorOn || copilotOn) {
      for (const p of packs) {
        const body = this.bodyBuilder.buildPack(cwd, p.id);
        if (!body) continue;
        if (cursorOn) {
          out.push({
            path: `.cursor/rules/groundrules-${p.id}.mdc`, toolId: 'cursor',
            render: () => strat.cursorMdc(body, { alwaysApply: false, globs: p.globs, description: `${p.name} stack rules (auto-attached to matching files) — managed by groundrules.` }),
          });
        }
        if (copilotOn) {
          out.push({
            path: `.github/instructions/groundrules-${p.id}.instructions.md`, toolId: 'copilot',
            render: () => strat.copilotScoped(body, { applyTo: p.globs.join(',') }),
          });
        }
      }
    }
    return out;
  }

  /**
   * @param {object} opts
   * @param {Set<string>} [opts.freshPaths] paths to render as if newly created
   *   (used by `import`, so migrated prose isn't re-appended below its own block).
   */
  generate(cwd, opts = {}) {
    const plan = [];
    plan.dryRun = !!opts.dryRun;
    const fresh = opts.freshPaths || new Set();

    for (const target of this.targets(cwd, opts)) {
      const abs = path.join(cwd, target.path);
      const onDisk = exists(abs) ? read(abs) : '';
      if (onDisk && hasAiOptOut(stripManaged(onDisk))) { plan.push({ path: target.path, action: 'skipped' }); continue; }
      const existing = fresh.has(target.path) ? '' : onDisk;
      const next = target.render(existing);
      const action = !onDisk ? 'create' : (onDisk === next ? 'unchanged' : 'update');
      plan.push({ path: target.path, action });
      if (!plan.dryRun && onDisk !== next) write(abs, next);
    }

    const aiSkills = path.join(cwd, '.ai', 'skills');
    for (const name of listDirs(aiSkills)) {
      const dst = path.join(cwd, '.claude', 'skills', name);
      plan.push({ path: path.join('.claude/skills', name) + '/', action: exists(dst) ? 'overwrite' : 'create' });
      if (!plan.dryRun) copyDir(path.join(aiSkills, name), dst);
    }

    const prSrc = path.join(this.packsDir, 'core', 'templates', 'pull_request_template.md');
    const prDst = path.join(cwd, '.github', 'pull_request_template.md');
    if (exists(prSrc) && !exists(prDst)) {
      plan.push({ path: '.github/pull_request_template.md', action: 'create' });
      if (!plan.dryRun) write(prDst, read(prSrc));
    }

    return plan;
  }
}

module.exports = AdapterGenerator;
