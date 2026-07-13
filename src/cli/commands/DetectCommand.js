'use strict';

/** `groundrules detect` — print detection, write nothing. */
class DetectCommand {
  constructor(app, printer) {
    this.app = app;
    this.printer = printer;
  }

  run(args) {
    this.printer.detection(this.app.detection.detect(args.cwd));
  }
}

module.exports = DetectCommand;
