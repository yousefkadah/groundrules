'use strict';

/**
 * Base class for a stack detector (strategy pattern). A detector inspects the
 * project root and returns `{ signal }` if its stack is present, else `null`.
 */
class StackDetector {
  /** The pack id this detector maps to (e.g. 'laravel-php'). */
  get id() { throw new Error('StackDetector.id not implemented'); }

  /** @returns {{signal: string}|null} */
  // eslint-disable-next-line no-unused-vars
  detect(cwd) { return null; }
}

module.exports = StackDetector;
