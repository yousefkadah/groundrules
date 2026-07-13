'use strict';

const path = require('path');
const { exists, read } = require('../support/fs');
const { hasAiOptOut, stripManaged } = require('../support/aiPolicy');

/** The CI drift gate: reports adapters out of sync with .ai/. */
class DriftChecker {
  constructor(bodyBuilder, adapterGenerator) {
    this.bodyBuilder = bodyBuilder;
    this.generator = adapterGenerator;
  }

  check(cwd, opts = {}) {
    const drift = [];
    for (const target of this.generator.targets(cwd, opts)) {
      const abs = path.join(cwd, target.path);
      if (!exists(abs)) { drift.push({ path: target.path, reason: 'missing' }); continue; }
      const content = read(abs);
      if (hasAiOptOut(stripManaged(content))) continue; // repo's file forbids AI — we don't manage it
      if (target.render(content) !== content) {
        drift.push({ path: target.path, reason: 'out of date' });
      }
    }
    return drift;
  }
}

module.exports = DriftChecker;
