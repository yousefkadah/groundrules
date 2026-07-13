'use strict';

const path = require('path');
const { exists } = require('../support/fs');
const StackDetector = require('./StackDetector');

class PythonDetector extends StackDetector {
  get id() { return 'python'; }

  detect(cwd) {
    const hasManage = exists(path.join(cwd, 'manage.py'));
    const hasPyproject = exists(path.join(cwd, 'pyproject.toml'));
    if (!hasManage && !hasPyproject && !exists(path.join(cwd, 'requirements.txt'))) return null;
    return { signal: hasManage ? 'manage.py (django)' : (hasPyproject ? 'pyproject.toml' : 'requirements.txt') };
  }
}

module.exports = PythonDetector;
