'use strict';

const path = require('path');
const { exists } = require('../../support/fs');

/**
 * `groundrules import` — adopt a repo's existing agent rules. Extract them into
 * `.ai/context.md`, layer the stack packs on top, and generate every adapter.
 * The source files that are also adapter targets are rendered fresh so their
 * migrated prose isn't duplicated below the managed block.
 */
class ImportCommand {
  constructor(app, printer) {
    this.app = app;
    this.printer = printer;
  }

  run(args) {
    const found = this.app.importer.collect(args.cwd);
    if (!found.imported) {
      this.printer.importNothing();
      return;
    }

    const contextExists = exists(path.join(args.cwd, '.ai', 'context.md'));
    const applyImport = !contextExists || args.force;

    const detection = this.app.detection.detect(args.cwd);
    const canonical = this.app.composition.compose(['core', ...detection.stacks]);
    if (applyImport) canonical.sections.context = found.body;

    this.printer.importHeader(detection, canonical, found);

    const plan = [];
    plan.dryRun = args.dryRun;
    plan.force = args.force;
    this.app.writer.write(args.cwd, canonical, plan);

    const genOpts = { dryRun: args.dryRun, tools: args.tools, all: args.all };
    if (applyImport) genOpts.freshPaths = found.consumedTargets;
    for (const entry of this.app.generator.generate(args.cwd, genOpts)) plan.push(entry);

    this.printer.wroteHeader(args.dryRun);
    this.printer.plan(plan);
    this.printer.recommends(canonical.recommends);

    if (!applyImport) this.printer.importContextKept();
    if (found.superseded && found.superseded.length) this.printer.importSuperseded(found.superseded);

    const { detectRepoAiPolicy } = require('../../support/aiPolicy');
    const skippedPaths = plan.filter((p) => p.action === 'skipped').map((p) => p.path);
    const policyFiles = detectRepoAiPolicy(args.cwd);
    if (policyFiles.length || skippedPaths.length) this.printer.aiPolicyWarning(policyFiles, skippedPaths);

    this.printer.importNext(args.dryRun);
  }
}

module.exports = ImportCommand;
