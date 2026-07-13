'use strict';

const path = require('path');
const { exists, read } = require('./fs');
const { MARK_START, MARK_END } = require('./managedBlock');

// A repo declares an anti-AI/no-LLM contribution policy. This is a LINE-SCOPED
// SUBSTRING algorithm (no regex) so the Rust port (has_ai_opt_out) mirrors it
// byte-for-byte — the two engines MUST return the identical boolean on every
// input or the CI drift gate would disagree between npx and brew.
const AI_TERMS = ['ai-generated', 'ai generated', 'ai contribution', 'llm', ' ai '];
const NEG_TERMS = [
  'not accepted', 'not allowed', 'not permitted', 'not welcome',
  'forbidden', 'prohibited', 'banned', 'disallow', 'rejected',
  'do not use', "don't use", 'do not submit', "don't submit",
];

/** Does this text declare an anti-AI/no-LLM contribution policy? */
function hasAiOptOut(text) {
  if (!text) return false;
  for (const raw of text.split(/\r?\n/)) {
    const l = raw.toLowerCase();
    if (l.includes('no ai') || l.includes('no llm')) return true;
    const ai = l.startsWith('ai ') || AI_TERMS.some((t) => l.includes(t));
    if (ai && NEG_TERMS.some((n) => l.includes(n))) return true;
  }
  return false;
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
