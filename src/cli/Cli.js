'use strict';

const path = require('path');
const { createApp } = require('../index');
const Printer = require('./Printer');
const InitCommand = require('./commands/InitCommand');
const GenerateCommand = require('./commands/GenerateCommand');
const CheckCommand = require('./commands/CheckCommand');
const DetectCommand = require('./commands/DetectCommand');

/** Parse argv into an options object. */
function parseArgs(argv) {
  const args = { _: [], tools: null, dryRun: false, yes: false, all: false, cwd: process.cwd() };
  for (const a of argv) {
    if (a === '--dry-run' || a === '-n') args.dryRun = true;
    else if (a === '--yes' || a === '-y') args.yes = true;
    else if (a === '--all') args.all = true;
    else if (a.startsWith('--tools=')) args.tools = a.slice(8).split(',').map((s) => s.trim()).filter(Boolean);
    else if (a.startsWith('--cwd=')) args.cwd = path.resolve(a.slice(6));
    else if (!a.startsWith('-')) args._.push(a);
  }
  return args;
}

/** The CLI controller: parses args and dispatches to a command. */
class Cli {
  constructor(app = createApp(), printer = new Printer()) {
    this.app = app;
    this.printer = printer;
  }

  commandFor(name) {
    switch (name) {
      case 'init': return new InitCommand(this.app, this.printer);
      case 'generate': case 'gen': return new GenerateCommand(this.app, this.printer);
      case 'check': return new CheckCommand(this.app, this.printer);
      case 'detect': return new DetectCommand(this.app, this.printer);
      default: return null;
    }
  }

  run(argv) {
    const args = parseArgs(argv);
    const name = args._[0];
    if (!name || name === 'help' || name === '--help' || name === '-h') return this.printer.help();
    try {
      const command = this.commandFor(name);
      if (!command) {
        this.printer.error(`Unknown command: ${name}`);
        this.printer.help();
        process.exit(1);
        return undefined;
      }
      return command.run(args);
    } catch (e) {
      this.printer.error('Error: ' + (e && e.message ? e.message : String(e)));
      return process.exit(1);
    }
  }
}

module.exports = { Cli, parseArgs };
