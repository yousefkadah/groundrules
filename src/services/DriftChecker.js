'use strict';

const path = require('path');
const { exists, read } = require('../support/fs');
const strategies = require('../strategies');

/** The CI drift gate: reports adapters out of sync with .ai/. */
class DriftChecker {
  constructor(bodyBuilder, adapterGenerator) {
    this.bodyBuilder = bodyBuilder;
    this.generator = adapterGenerator;
  }

  check(cwd, opts = {}) {
    const body = this.bodyBuilder.build(cwd);
    const drift = [];
    for (const adapter of this.generator.selectAdapters(opts.tools, opts.all)) {
      const target = path.join(cwd, adapter.path);
      if (!exists(target)) { drift.push({ path: adapter.path, reason: 'missing' }); continue; }
      if (!strategies[adapter.kind].isInSync(read(target), body)) {
        drift.push({ path: adapter.path, reason: 'out of date' });
      }
    }
    return drift;
  }
}

module.exports = DriftChecker;
