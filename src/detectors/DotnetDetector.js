'use strict';

const path = require('path');
const { exists, listFiles } = require('../support/fs');
const StackDetector = require('./StackDetector');

class DotnetDetector extends StackDetector {
  get id() { return 'dotnet'; }

  detect(cwd) {
    if (exists(path.join(cwd, 'global.json'))) return { signal: '.NET project' };
    if (listFiles(cwd).some((f) => f.endsWith('.sln') || f.endsWith('.csproj'))) return { signal: '.NET project' };
    return null;
  }
}

module.exports = DotnetDetector;
