'use strict';

const path = require('path');
const { exists, readJsonSafe } = require('../support/fs');
const StackDetector = require('./StackDetector');

class NodeTsDetector extends StackDetector {
  get id() { return 'node-ts'; }

  detect(cwd) {
    const pkg = readJsonSafe(path.join(cwd, 'package.json'));
    if (!pkg) return null;
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const hasTs = exists(path.join(cwd, 'tsconfig.json')) || !!deps.typescript || !!deps['@types/node'];
    if (!hasTs) return null;
    const signal = deps.next ? 'package.json:next+ts' : (deps.react ? 'package.json:react+ts' : 'tsconfig/typescript');
    return { signal };
  }
}

module.exports = NodeTsDetector;
