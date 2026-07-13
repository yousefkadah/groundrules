'use strict';

const fs = require('fs');
const path = require('path');
const { exists, read, readJsonSafe, listDirs } = require('../support/fs');
const Skill = require('./Skill');

/** A content pack: its metadata, per-section markdown, and skills. */
class Pack {
  constructor(id, dir) {
    this.id = id;
    this.dir = dir;
    this.meta = { id };
    this.sections = {};
    this.skills = [];
  }

  static load(id, packsDir) {
    const dir = path.join(packsDir, id);
    if (!exists(dir)) return null;
    const pack = new Pack(id, dir);
    pack.meta = readJsonSafe(path.join(dir, 'pack.json')) || { id };
    const secDir = path.join(dir, 'sections');
    if (exists(secDir)) {
      for (const f of fs.readdirSync(secDir)) {
        if (f.endsWith('.md')) pack.sections[f.replace(/\.md$/, '')] = read(path.join(secDir, f)).trim();
      }
    }
    const skillsDir = path.join(dir, 'skills');
    for (const name of listDirs(skillsDir)) {
      if (exists(path.join(skillsDir, name, 'SKILL.md'))) pack.skills.push(new Skill(name, path.join(skillsDir, name)));
    }
    return pack;
  }

  get name() { return this.meta.name || this.id; }
  get recommends() { return this.meta.recommends || []; }
}

module.exports = Pack;
