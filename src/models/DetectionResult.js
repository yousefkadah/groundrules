'use strict';

/** The outcome of stack detection: which packs apply and why. */
class DetectionResult {
  constructor({ stacks = [], signals = [], existingAgents = [] } = {}) {
    this.stacks = stacks;
    this.signals = signals;
    this.existingAgents = existingAgents;
  }
}

module.exports = DetectionResult;
