'use strict';

const path = require('path');
const { ADAPTERS } = require('../config/adapters');
const Adapter = require('../models/Adapter');
const strategies = require('../strategies');
const { exists, read, write, listDirs, copyDir } = require('../support/fs');

/** Emits every selected adapter from .ai/, plus copies skills and the PR template. */
class AdapterGenerator {
  constructor(bodyBuilder, packsDir) {
    this.bodyBuilder = bodyBuilder;
    this.packsDir = packsDir;
  }

  selectAdapters(tools, all) {
    return ADAPTERS
      .map((a) => new Adapter(a))
      .filter((a) => ((tools && tools.length) ? tools.includes(a.id) : (a.default || all)));
  }

  generate(cwd, opts = {}) {
    const plan = [];
    plan.dryRun = !!opts.dryRun;
    const body = this.bodyBuilder.build(cwd);

    for (const adapter of this.selectAdapters(opts.tools, opts.all)) {
      const target = path.join(cwd, adapter.path);
      const existing = exists(target) ? read(target) : '';
      const next = strategies[adapter.kind].render(body, existing);
      const action = !existing ? 'create' : (existing === next ? 'unchanged' : 'update');
      plan.push({ path: adapter.path, action });
      if (!plan.dryRun && action !== 'unchanged') write(target, next);
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
