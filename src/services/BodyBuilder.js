'use strict';

const path = require('path');
const { SECTION_ORDER } = require('../config/sections');
const { exists, read, listDirs } = require('../support/fs');
const { parseFrontmatter } = require('../support/frontmatter');

const UNCONFIGURED_BANNER = '> ⚠ **UNCONFIGURED** — `.ai/context.md` still contains «placeholders». Run the `bootstrap` skill so an agent fills in this project’s real context, architecture, and commands. Until then, treat the stack-specific guidance below as generic defaults, not verified facts.';

/** Reads .ai/ and assembles the composed markdown body that adapters share. */
class BodyBuilder {
  hasPlaceholders(cwd) {
    const aiDir = path.join(cwd, '.ai');
    for (const { key } of SECTION_ORDER) {
      const f = path.join(aiDir, `${key}.md`);
      if (exists(f) && read(f).includes('«')) return true;
    }
    return false;
  }

  build(cwd) {
    const aiDir = path.join(cwd, '.ai');
    const parts = ['<!-- This is the canonical set of instructions for AI coding agents on this repo. Source: .ai/ (edit there, then `groundrules generate`). -->', ''];

    if (this.hasPlaceholders(cwd)) parts.push(UNCONFIGURED_BANNER, '');

    for (const { key, title } of SECTION_ORDER) {
      const f = path.join(aiDir, `${key}.md`);
      if (!exists(f)) continue;
      parts.push(`## ${title}`, '', read(f).trim(), '');
    }

    const skillsDir = path.join(aiDir, 'skills');
    const names = listDirs(skillsDir);
    if (names.length) {
      parts.push('## Skills', '', 'Load the matching skill when a task fits its description (full text in `.ai/skills/<name>/SKILL.md`, also copied to `.claude/skills/`).', '');
      for (const name of names) {
        const sf = path.join(skillsDir, name, 'SKILL.md');
        if (!exists(sf)) continue;
        const { data } = parseFrontmatter(read(sf));
        parts.push(`- **${data.name || name}** — ${data.description || ''}`);
      }
      parts.push('');
    }

    return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }
}

module.exports = BodyBuilder;
