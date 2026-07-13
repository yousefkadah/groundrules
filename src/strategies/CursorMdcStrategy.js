'use strict';

const AdapterStrategy = require('./AdapterStrategy');
const { wrapManaged, HEADER_NOTE } = require('../support/managedBlock');

const FRONTMATTER = [
  '---',
  'description: Project engineering standards, security guardrails, and skills for AI agents (managed by groundrules).',
  'globs:',
  'alwaysApply: false',
  '---',
].join('\n');

/**
 * Cursor project rules require real `.mdc` frontmatter (description/globs/
 * alwaysApply), so this is a full-file transform, not a symlink. Defaults to
 * agent-requested (alwaysApply:false) to avoid context bloat.
 */
class CursorMdcStrategy extends AdapterStrategy {
  render(body) {
    return FRONTMATTER + '\n\n' + HEADER_NOTE + '\n\n' + wrapManaged(body) + '\n';
  }
}

module.exports = CursorMdcStrategy;
