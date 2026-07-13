'use strict';

/** `groundrules check` — CI drift gate. */
class CheckCommand {
  constructor(app, printer) {
    this.app = app;
    this.printer = printer;
  }

  run(args) {
    const drift = this.app.checker.check(args.cwd, { tools: args.tools, all: args.all });
    if (!drift.length) {
      this.printer.checkOk();
      return;
    }
    this.printer.checkDrift(drift);
    process.exit(1);
  }
}

module.exports = CheckCommand;
