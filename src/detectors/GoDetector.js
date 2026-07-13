'use strict';

const path = require('path');
const { exists } = require('../support/fs');
const StackDetector = require('./StackDetector');

class GoDetector extends StackDetector {
  get id() { return 'go'; }

  detect(cwd) {
    return exists(path.join(cwd, 'go.mod')) ? { signal: 'go.mod' } : null;
  }
}

module.exports = GoDetector;
