'use strict';

const path = require('path');
const { SECTION_ORDER } = require('../config/sections');
const { exists, write, copyDir } = require('../support/fs');

const SAFE_NAME = /^[A-Za-z0-9._-]+$/;

/**
 * Writes a CanonicalSource into the project's .ai/ directory.
 * **Create-only by default** — existing `.ai/*.md` and skills are KEPT (so a
 * user's bootstrap edits survive a re-`init`); pass `plan.force` to overwrite.
 */
class CanonicalWriter {
  write(cwd, canonical, plan) {
    const aiDir = path.join(cwd, '.ai');
    const force = !!plan.force;

    for (const { key } of SECTION_ORDER) {
      if (!canonical.sections[key]) continue;
      const target = path.join(aiDir, `${key}.md`);
      const present = exists(target);
      if (present && !force) { plan.push({ path: path.relative(cwd, target), action: 'kept' }); continue; }
      plan.push({ path: path.relative(cwd, target), action: present ? 'overwrite' : 'create' });
      if (!plan.dryRun) write(target, canonical.sections[key].trim() + '\n');
    }

    for (const skill of canonical.skills) {
      if (!SAFE_NAME.test(skill.name)) throw new Error(`unsafe skill name: ${skill.name}`);
      const dst = path.join(aiDir, 'skills', skill.name);
      const present = exists(dst);
      if (present && !force) { plan.push({ path: path.relative(cwd, path.join(dst, 'SKILL.md')), action: 'kept' }); continue; }
      plan.push({ path: path.relative(cwd, path.join(dst, 'SKILL.md')), action: present ? 'overwrite' : 'create' });
      if (!plan.dryRun) copyDir(skill.srcDir, dst);
    }

    if (!plan.dryRun) {
      // The archetype is recorded so a later `init`/`import` keeps the declared
      // choice, and so the bootstrap skill can set it for the next compose.
      const manifest = { tool: 'groundrules', packs: canonical.appliedPacks.map((p) => p.id), archetype: canonical.archetype || 'unknown' };
      write(path.join(aiDir, '.groundrules.json'), JSON.stringify(manifest, null, 2) + '\n');
    }
  }
}

module.exports = CanonicalWriter;
