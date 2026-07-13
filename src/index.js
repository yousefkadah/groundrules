'use strict';

const path = require('path');
const PackRepository = require('./services/PackRepository');
const StackDetectionService = require('./services/StackDetectionService');
const CompositionService = require('./services/CompositionService');
const CanonicalWriter = require('./services/CanonicalWriter');
const BodyBuilder = require('./services/BodyBuilder');
const AdapterGenerator = require('./services/AdapterGenerator');
const DriftChecker = require('./services/DriftChecker');
const ImportService = require('./services/ImportService');
const { SECTION_ORDER } = require('./config/sections');
const { ADAPTERS } = require('./config/adapters');

const PACKS_DIR = path.join(__dirname, '..', 'packs');

/** Wire the services into an application container. Tests can pass a custom packsDir. */
function createApp(packsDir = PACKS_DIR) {
  const packs = new PackRepository(packsDir);
  const detection = new StackDetectionService(packs);
  const composition = new CompositionService(packs);
  const writer = new CanonicalWriter();
  const bodyBuilder = new BodyBuilder(packsDir);
  const generator = new AdapterGenerator(bodyBuilder, packsDir);
  const checker = new DriftChecker(bodyBuilder, generator);
  const importer = new ImportService();
  return { packsDir, packs, detection, composition, writer, bodyBuilder, generator, checker, importer };
}

const defaultApp = createApp();

/** Functional facade over the default app — the stable programmatic API + what tests use. */
module.exports = {
  createApp,
  SECTION_ORDER,
  ADAPTERS,
  detect: (cwd) => defaultApp.detection.detect(cwd),
  compose: (packIds) => defaultApp.composition.compose(packIds),
  writeCanonical: (cwd, canonical, plan) => defaultApp.writer.write(cwd, canonical, plan),
  buildBody: (cwd) => defaultApp.bodyBuilder.build(cwd),
  hasPlaceholders: (cwd) => defaultApp.bodyBuilder.hasPlaceholders(cwd),
  emit: (cwd, opts) => defaultApp.generator.generate(cwd, opts),
  check: (cwd, opts) => defaultApp.checker.check(cwd, opts),
  importRules: (cwd) => defaultApp.importer.collect(cwd),
  detectRepoAiPolicy: (cwd) => require('./support/aiPolicy').detectRepoAiPolicy(cwd),
  hasAiOptOut: (text) => require('./support/aiPolicy').hasAiOptOut(text),
};
