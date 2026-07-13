'use strict';

/**
 * The versioned adapter registry. Paths churn (e.g. Cursor moved to
 * .cursor/rules/*.mdc); keeping them here as data means a change is an edit,
 * not a refactor. `kind` selects the render strategy (see src/strategies).
 */
const ADAPTERS = [
  { id: 'agents', path: 'AGENTS.md', kind: 'inline', default: true },
  { id: 'claude', path: 'CLAUDE.md', kind: 'import', default: true },
  { id: 'cursor', path: '.cursor/rules/groundrules.mdc', kind: 'mdc', default: true },
  { id: 'copilot', path: '.github/copilot-instructions.md', kind: 'inline', default: true },
  { id: 'gemini', path: 'GEMINI.md', kind: 'inline', default: true },
  { id: 'windsurf', path: '.windsurf/rules/groundrules.md', kind: 'inline', default: false },
];

module.exports = { ADAPTERS };
