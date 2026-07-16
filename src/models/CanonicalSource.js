'use strict';

/** The composed canonical source (core + packs) before it is written to .ai/. */
class CanonicalSource {
  constructor({ sections = {}, skills = [], recommends = [], appliedPacks = [], archetype = 'unknown' } = {}) {
    this.sections = sections;
    this.skills = skills;
    this.recommends = recommends;
    this.appliedPacks = appliedPacks;
    this.archetype = archetype; // declared project type, recorded in the manifest
  }
}

module.exports = CanonicalSource;
