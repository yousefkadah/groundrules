'use strict';

/** The outcome of detection: which packs apply, why, and what kind of project this is. */
class DetectionResult {
  constructor({ stacks = [], signals = [], existingAgents = [], archetype = 'unknown' } = {}) {
    this.stacks = stacks;
    this.signals = signals;
    this.existingAgents = existingAgents;
    this.archetype = archetype; // web-app | cli | library | unknown
  }
}

module.exports = DetectionResult;
