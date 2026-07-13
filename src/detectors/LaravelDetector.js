'use strict';

const path = require('path');
const { exists, readJsonSafe } = require('../support/fs');
const StackDetector = require('./StackDetector');

class LaravelDetector extends StackDetector {
  get id() { return 'laravel-php'; }

  detect(cwd) {
    const composer = readJsonSafe(path.join(cwd, 'composer.json'));
    const hasArtisan = exists(path.join(cwd, 'artisan'));
    if (!composer && !hasArtisan) return null;
    const req = composer ? { ...composer.require, ...composer['require-dev'] } : {};
    if (req['laravel/framework'] || hasArtisan) {
      return { signal: hasArtisan ? 'artisan' : 'composer.json:laravel/framework' };
    }
    return null;
  }
}

module.exports = LaravelDetector;
