'use strict';

/** The composed canonical source (core + packs) before it is written to .ai/. */
class CanonicalSource {
  constructor({ sections = {}, skills = [], recommends = [], appliedPacks = [] } = {}) {
    this.sections = sections;
    this.skills = skills;
    this.recommends = recommends;
    this.appliedPacks = appliedPacks;
  }
}

module.exports = CanonicalSource;
