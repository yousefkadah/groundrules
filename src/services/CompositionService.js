'use strict';

const { SECTION_ORDER } = require('../config/sections');
const CanonicalSource = require('../models/CanonicalSource');

/**
 * Composes the core pack + detected stack packs into a CanonicalSource.
 * Per section: core first, then each pack appends its stack-specific block.
 * Skills merge by name (a pack skill overrides a core skill of the same name).
 */
class CompositionService {
  constructor(packRepository) {
    this.packs = packRepository;
  }

  compose(packIds) {
    const core = this.packs.load('core');
    if (!core) throw new Error('core pack missing');
    const extras = packIds.filter((id) => id !== 'core').map((id) => this.packs.load(id)).filter(Boolean);
    const applied = [core, ...extras];

    const sections = {};
    for (const { key } of SECTION_ORDER) {
      let out = core.sections[key] || '';
      for (const pack of extras) {
        if (pack.sections[key]) {
          out = out.replace(/\s*$/, '') + `\n\n### ${pack.name} specifics\n\n` + pack.sections[key];
        }
      }
      if (out.trim()) sections[key] = out.trim();
    }

    const skillMap = new Map();
    for (const pack of applied) for (const skill of pack.skills) skillMap.set(skill.name, skill);

    const recommends = [];
    for (const pack of applied) for (const rec of pack.recommends) recommends.push({ ...rec, pack: pack.name });

    return new CanonicalSource({
      sections,
      skills: [...skillMap.values()],
      recommends,
      appliedPacks: applied.map((p) => ({ id: p.id, name: p.name })),
    });
  }
}

module.exports = CompositionService;
