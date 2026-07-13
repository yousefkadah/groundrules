'use strict';

const path = require('path');
const { SECTION_ORDER } = require('../config/sections');
const { exists, write, copyDir } = require('../support/fs');

/** Writes a CanonicalSource into the project's .ai/ directory (the editable source). */
class CanonicalWriter {
  write(cwd, canonical, plan) {
    const aiDir = path.join(cwd, '.ai');

    for (const { key } of SECTION_ORDER) {
      if (!canonical.sections[key]) continue;
      const target = path.join(aiDir, `${key}.md`);
      plan.push({ path: path.relative(cwd, target), action: exists(target) ? 'overwrite' : 'create' });
      if (!plan.dryRun) write(target, canonical.sections[key].trim() + '\n');
    }

    for (const skill of canonical.skills) {
      const dst = path.join(aiDir, 'skills', skill.name);
      plan.push({ path: path.relative(cwd, path.join(dst, 'SKILL.md')), action: exists(dst) ? 'overwrite' : 'create' });
      if (!plan.dryRun) copyDir(skill.srcDir, dst);
    }

    if (!plan.dryRun) {
      const manifest = { tool: 'groundrules', packs: canonical.appliedPacks.map((p) => p.id) };
      write(path.join(aiDir, '.groundrules.json'), JSON.stringify(manifest, null, 2) + '\n');
    }
  }
}

module.exports = CanonicalWriter;
