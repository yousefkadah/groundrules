'use strict';

/** `groundrules init` — detect, compose .ai/, generate adapters. */
class InitCommand {
  constructor(app, printer) {
    this.app = app;
    this.printer = printer;
  }

  run(args) {
    const { resolveArchetype } = require('../../support/archetypeFilter');
    const { detectRepoAiPolicy } = require('../../support/aiPolicy');

    // BEFORE anything is written: if the repo forbids AI contributions, refuse.
    // (Warning after the files are already on disk would not be a guard.)
    const repoPolicy = detectRepoAiPolicy(args.cwd);
    if (repoPolicy.length && !args.ignoreAiPolicy) {
      this.printer.aiPolicyRefusal(repoPolicy);
      process.exit(1);
    }

    const detection = this.app.detection.detect(args.cwd);
    const archetype = resolveArchetype(args.cwd, args.archetype);
    const canonical = this.app.composition.compose(['core', ...detection.stacks], archetype);
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
    const skippedPaths = plan.filter((p) => p.action === 'skipped').map((p) => p.path);
    if (repoPolicy.length || skippedPaths.length) this.printer.aiPolicyWarning(repoPolicy, skippedPaths);
    if (this.app.bodyBuilder.hasPlaceholders(args.cwd)) this.printer.placeholderWarning();
    this.printer.nextSteps(args.dryRun);
  }
}

module.exports = InitCommand;
