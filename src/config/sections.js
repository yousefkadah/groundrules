'use strict';

const Section = require('../models/Section');

/** The canonical, ordered set of sections composed into every adapter. */
const SECTION_ORDER = [
  new Section('context', 'Project context'),
  new Section('coding-standards', 'Coding standards'),
  new Section('testing-policy', 'Testing policy'),
  new Section('security-policy', 'Security policy (agent guardrails)'),
  new Section('code-review', 'Code review checklist'),
  new Section('pr-policy', 'Pull requests & commits'),
  new Section('release-policy', 'Release & deploy'),
];

module.exports = { SECTION_ORDER };
