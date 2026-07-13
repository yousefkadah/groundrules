'use strict';

const path = require('path');
const { exists, listDirs } = require('../support/fs');
const Pack = require('../models/Pack');

/** Loads Pack models from the packs/ directory. */
class PackRepository {
  constructor(packsDir) {
    this.packsDir = packsDir;
  }

  has(id) { return exists(path.join(this.packsDir, id)); }

  load(id) { return Pack.load(id, this.packsDir); }

  ids() { return listDirs(this.packsDir); }
}

module.exports = PackRepository;
