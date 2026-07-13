'use strict';

const AdapterStrategy = require('./AdapterStrategy');
const { upsertManaged } = require('../support/managedBlock');

/** Points a tool at AGENTS.md via an `@import` (Claude Code), rather than duplicating the body. */
class ImportAdapterStrategy extends AdapterStrategy {
  render(body, existing) {
    const inner = 'This project uses [`AGENTS.md`](AGENTS.md) as the single source of truth for AI agent rules.\n\n@AGENTS.md';
    return upsertManaged(existing, inner);
  }

  isInSync(content) {
    return content.includes('@AGENTS.md');
  }
}

module.exports = ImportAdapterStrategy;
