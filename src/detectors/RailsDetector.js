'use strict';

const path = require('path');
const { exists } = require('../support/fs');
const StackDetector = require('./StackDetector');

class RailsDetector extends StackDetector {
  get id() { return 'rails'; }

  detect(cwd) {
    if (exists(path.join(cwd, 'bin/rails')) || exists(path.join(cwd, 'config/application.rb'))) {
      return { signal: 'rails' };
    }
    return null;
  }
}

module.exports = RailsDetector;
