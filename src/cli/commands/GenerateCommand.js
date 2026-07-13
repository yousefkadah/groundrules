'use strict';

const path = require('path');
const { exists } = require('../../support/fs');

/** `groundrules generate` — re-emit adapters from .ai/. */
class GenerateCommand {
  constructor(app, printer) {
    this.app = app;
    this.printer = printer;
  }

  run(args) {
    if (!exists(path.join(args.cwd, '.ai'))) {
      this.printer.error('No .ai/ found. Run `groundrules init` first.');
      process.exit(1);
    }
    const plan = this.app.generator.generate(args.cwd, { dryRun: args.dryRun, tools: args.tools, all: args.all });
    this.printer.regenerateHeader(args.dryRun);
    this.printer.plan(plan);
    const skipped = plan.filter((p) => p.action === 'skipped').map((p) => p.path);
    if (skipped.length) this.printer.aiPolicyWarning([], skipped);
    if (this.app.bodyBuilder.hasPlaceholders(args.cwd)) this.printer.placeholderWarningShort();
  }
}

module.exports = GenerateCommand;
