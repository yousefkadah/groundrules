'use strict';

const path = require('path');
const { exists, read } = require('../support/fs');
const { parseFrontmatter } = require('../support/frontmatter');

/** A reusable SKILL.md workflow living in a pack (or in .ai/skills). */
class Skill {
  constructor(name, srcDir) {
    this.name = name;
    this.srcDir = srcDir;
  }

  get skillFile() {
    return path.join(this.srcDir, 'SKILL.md');
  }

  /** Frontmatter (name, description) parsed from the SKILL.md, or {}. */
  meta() {
    if (!exists(this.skillFile)) return {};
    return parseFrontmatter(read(this.skillFile)).data;
  }
}

module.exports = Skill;
