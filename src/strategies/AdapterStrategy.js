'use strict';

const { extractManaged } = require('../support/managedBlock');

/**
 * Base render strategy for a tool adapter. Subclasses decide how the composed
 * `body` is turned into the file content, and how drift is detected.
 */
class AdapterStrategy {
  /** @returns {string} the full file content to write. */
  // eslint-disable-next-line no-unused-vars
  render(body, existing) { throw new Error('AdapterStrategy.render not implemented'); }

  /** @returns {boolean} whether the on-disk `content` already matches `body`. */
  isInSync(content, body) {
    return extractManaged(content) === body.trim();
  }
}

module.exports = AdapterStrategy;
