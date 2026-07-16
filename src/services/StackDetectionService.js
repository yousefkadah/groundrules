'use strict';

const path = require('path');
const detectors = require('../detectors');
const DetectionResult = require('../models/DetectionResult');
const { detectArchetype } = require('../detectors/archetype');
const { exists } = require('../support/fs');

const AGENT_MARKERS = [
  ['CLAUDE.md', 'CLAUDE.md'],
  ['AGENTS.md', 'AGENTS.md'],
  ['Cursor', '.cursor'],
  ['Copilot', '.github/copilot-instructions.md'],
  ['Gemini', 'GEMINI.md'],
  ['.claude/', '.claude'],
];

/** Runs every detector, keeping only stacks that have a pack shipped. */
class StackDetectionService {
  constructor(packRepository, detectorList = detectors) {
    this.packs = packRepository;
    this.detectors = detectorList;
  }

  detect(cwd) {
    const stacks = [];
    const signals = [];
    for (const detector of this.detectors) {
      const result = detector.detect(cwd);
      if (result && this.packs.has(detector.id)) {
        stacks.push(detector.id);
        signals.push(result.signal);
      }
    }
    const existingAgents = AGENT_MARKERS
      .filter(([, p]) => exists(path.join(cwd, p)))
      .map(([label]) => label);
    return new DetectionResult({ stacks, signals, existingAgents, archetype: detectArchetype(cwd) });
  }
}

module.exports = StackDetectionService;
