'use strict';

const path = require('path');
const { exists, read } = require('./fs');
const { MARK_START, MARK_END } = require('./managedBlock');

// Heuristics for a repo declaring that AI/LLM-generated changes aren't accepted.
const PATTERNS = [
  /\bno\s+(ai|llm)\b/i,
  /\b(ai|llm|ai[- ]generated|machine[- ]generated)[^.\n]{0,60}\b(not\s+(accepted|allowed|welcome|permitted)|forbidden|prohibited|banned|disallow)/i,
  /\bdo not\b[^.\n]{0,40}\b(use\s+ai|ai\b|llm)\b/i,
  /\b(ai|llm)[- ]generated\s+(code|content|contributions?|pull\s?requests?|prs?)[^.\n]{0,40}\b(not|never|forbidden|prohibited|won'?t)/i,
];

/** Does this text declare an anti-AI/no-LLM contribution policy? */
function hasAiOptOut(text) {
  if (!text) return false;
  return PATTERNS.some((re) => re.test(text));
}

/** Remove our managed block so we don't match on Groundrules' own wording. */
function stripManaged(text) {
  if (!text) return '';
  const s = text.indexOf(MARK_START);
  const e = text.indexOf(MARK_END);
  if (s !== -1 && e !== -1 && e > s) return text.slice(0, s) + text.slice(e + MARK_END.length);
  return text;
}

const POLICY_FILES = ['AI_POLICY.md', 'AI_POLICY', 'AI_POLICY.txt', 'CONTRIBUTING.md', '.github/CONTRIBUTING.md', 'docs/AI_POLICY.md'];

/** Repo-level policy files (not the files we generate) that opt out of AI contributions. */
function detectRepoAiPolicy(cwd) {
  const hits = [];
  for (const rel of POLICY_FILES) {
    const p = path.join(cwd, rel);
    if (exists(p) && hasAiOptOut(read(p))) hits.push(rel);
  }
  return hits;
}

module.exports = { hasAiOptOut, stripManaged, detectRepoAiPolicy };
