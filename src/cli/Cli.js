'use strict';

const fs = require('fs');
const path = require('path');
const { createApp } = require('../index');
const Printer = require('./Printer');
const InitCommand = require('./commands/InitCommand');
const GenerateCommand = require('./commands/GenerateCommand');
const CheckCommand = require('./commands/CheckCommand');
const DetectCommand = require('./commands/DetectCommand');
const ImportCommand = require('./commands/ImportCommand');

const { ARCHETYPES } = require('../support/archetypeFilter');

const BOOL_FLAGS = { '--dry-run': 'dryRun', '-n': 'dryRun', '--yes': 'yes', '-y': 'yes', '--all': 'all', '--force': 'force', '--ignore-ai-policy': 'ignoreAiPolicy' };

/** Parse argv strictly — unknown options are an error, not silently ignored. */
function parseArgs(argv) {
  const args = { _: [], tools: null, dryRun: false, yes: false, all: false, force: false, ignoreAiPolicy: false, archetype: null, cwd: process.cwd() };
  for (const a of argv) {
    if (a === '-h' || a === '--help') { args._.push('help'); continue; }
    if (Object.prototype.hasOwnProperty.call(BOOL_FLAGS, a)) { args[BOOL_FLAGS[a]] = true; continue; }
    if (a.startsWith('--archetype=')) {
      const v = a.slice(12).trim();
      if (!ARCHETYPES.includes(v)) throw new Error(`--archetype must be one of: ${ARCHETYPES.join(', ')}`);
      args.archetype = v; continue;
    }
    if (a.startsWith('--tools=')) { args.tools = a.slice(8).split(',').map((s) => s.trim()).filter(Boolean); continue; }
    if (a.startsWith('--cwd=')) { args.cwd = path.resolve(a.slice(6)); continue; }
    if (a.startsWith('-')) throw new Error(`unknown option: ${a}`);
    args._.push(a);
  }
  return args;
}

const NEEDS_CWD = new Set(['init', 'import', 'generate', 'check', 'detect']);

/** The CLI controller: parses args and dispatches to a command. */
class Cli {
  constructor(app = createApp(), printer = new Printer()) {
    this.app = app;
    this.printer = printer;
  }

  commandFor(name) {
    switch (name) {
      case 'init': return new InitCommand(this.app, this.printer);
      case 'import': return new ImportCommand(this.app, this.printer);
      case 'generate': case 'gen': return new GenerateCommand(this.app, this.printer);
      case 'check': return new CheckCommand(this.app, this.printer);
      case 'detect': return new DetectCommand(this.app, this.printer);
      default: return null;
    }
  }

  fail(message) {
    this.printer.error(message);
    process.exit(1);
  }

  run(argv) {
    let args;
    try { args = parseArgs(argv); } catch (e) { this.printer.error('Error: ' + e.message); this.printer.help(); process.exit(1); return; }

    const name = args._[0];
    if (!name || name === 'help') return this.printer.help();

    const command = this.commandFor(name);
    if (!command) { this.printer.error(`Unknown command: ${name}`); this.printer.help(); process.exit(1); return; }

    if (NEEDS_CWD.has(name)) {
      let isDir = false;
      try { isDir = fs.statSync(args.cwd).isDirectory(); } catch { isDir = false; }
      if (!isDir) return this.fail(`--cwd is not an existing directory: ${args.cwd}`);
    }

    try {
      return command.run(args);
    } catch (e) {
      this.printer.error('Error: ' + (e && e.message ? e.message : String(e)));
      process.exit(1);
    }
  }
}

module.exports = { Cli, parseArgs };
