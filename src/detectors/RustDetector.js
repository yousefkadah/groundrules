'use strict';

const path = require('path');
const { exists } = require('../support/fs');
const StackDetector = require('./StackDetector');

class RustDetector extends StackDetector {
  get id() { return 'rust'; }

  detect(cwd) {
    return exists(path.join(cwd, 'Cargo.toml')) ? { signal: 'Cargo.toml' } : null;
  }
}

module.exports = RustDetector;
