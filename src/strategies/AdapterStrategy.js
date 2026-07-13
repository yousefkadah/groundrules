'use strict';

/**
 * Base render strategy for a tool adapter. Subclasses decide how the composed
 * `body` becomes the file content.
 */
class AdapterStrategy {
  /** @returns {string} the full file content to write. */
  // eslint-disable-next-line no-unused-vars
  render(body, existing) { throw new Error('AdapterStrategy.render not implemented'); }

  /**
   * Drift is defined uniformly across strategies: a file is in sync iff
   * re-rendering it is a no-op. This guarantees `check` passes exactly when
   * `generate` would change nothing.
   */
  isInSync(content, body) {
    return this.render(body, content) === content;
  }
}

module.exports = AdapterStrategy;
