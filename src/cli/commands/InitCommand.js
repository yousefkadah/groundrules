'use strict';

/** `groundrules init` — detect, compose .ai/, generate adapters. */
class InitCommand {
  constructor(app, printer) {
    this.app = app;
    this.printer = printer;
  }

  run(args) {
    const detection = this.app.detection.detect(args.cwd);
    const canonical = this.app.composition.compose(['core', ...detection.stacks]);
    this.printer.initHeader(detection, canonical);

    const plan = [];
    plan.dryRun = args.dryRun;
    plan.force = args.force;
    this.app.writer.write(args.cwd, canonical, plan);
    for (const entry of this.app.generator.generate(args.cwd, { dryRun: args.dryRun, tools: args.tools, all: args.all })) {
      plan.push(entry);
    }

    this.printer.wroteHeader(args.dryRun);
    this.printer.plan(plan);
    this.printer.recommends(canonical.recommends);
    const { detectRepoAiPolicy } = require('../../support/aiPolicy');
    const skippedPaths = plan.filter((p) => p.action === 'skipped').map((p) => p.path);
    const policyFiles = detectRepoAiPolicy(args.cwd);
    if (policyFiles.length || skippedPaths.length) this.printer.aiPolicyWarning(policyFiles, skippedPaths);
    if (this.app.bodyBuilder.hasPlaceholders(args.cwd)) this.printer.placeholderWarning();
    this.printer.nextSteps(args.dryRun);
  }
}

module.exports = InitCommand;
