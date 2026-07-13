'use strict';

const AdapterStrategy = require('./AdapterStrategy');
const { upsertManaged } = require('../support/managedBlock');

/** Inlines the full composed body inside a managed block (AGENTS.md, Copilot, Gemini…). */
class InlineAdapterStrategy extends AdapterStrategy {
  render(body, existing) {
    return upsertManaged(existing, body);
  }
}

module.exports = InlineAdapterStrategy;
