'use strict';

const { SECTION_ORDER } = require('../config/sections');
const CanonicalSource = require('../models/CanonicalSource');
const { stripArchetypeBlocks, skillApplies } = require('../support/archetypeFilter');

/**
 * Composes the core pack + detected stack packs into a CanonicalSource.
 * Per section: core first, then each pack appends its stack-specific block.
 * Skills merge by name (a pack skill overrides a core skill of the same name).
 *
 * `archetype` gates content that doesn't apply to the project type (a CLI has no
 * tenants/migrations/uploads/deploys). It is baked in here, at compose time, so
 * `.ai/` only ever contains applicable rules and generate/check stay untouched.
 * An `unknown` archetype keeps everything.
 */
class CompositionService {
  constructor(packRepository) {
    this.packs = packRepository;
  }

  compose(packIds, archetype = 'unknown') {
    const core = this.packs.load('core');
    if (!core) throw new Error('core pack missing');
    const extras = packIds.filter((id) => id !== 'core').map((id) => this.packs.load(id)).filter(Boolean);
    const applied = [core, ...extras];

    const sections = {};
    for (const { key } of SECTION_ORDER) {
      let out = stripArchetypeBlocks(core.sections[key] || '', archetype);
      for (const pack of extras) {
        const packSection = stripArchetypeBlocks(pack.sections[key] || '', archetype);
        if (packSection) {
          out = out.replace(/\s*$/, '') + `\n\n### ${pack.name} specifics\n\n` + packSection;
        }
      }
      if (out.trim()) sections[key] = out.trim();
    }

    const skillMap = new Map();
    for (const pack of applied) {
      for (const skill of pack.skills) {
        if (!skillApplies(skill.meta().archetypes, archetype)) continue;
        skillMap.set(skill.name, skill);
      }
    }

    const recommends = [];
    for (const pack of applied) for (const rec of pack.recommends) recommends.push({ ...rec, pack: pack.name });

    return new CanonicalSource({
      sections,
      skills: [...skillMap.values()],
      recommends,
      appliedPacks: applied.map((p) => ({ id: p.id, name: p.name })),
      archetype,
    });
  }
}

module.exports = CompositionService;
