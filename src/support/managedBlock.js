'use strict';

/**
 * Managed-block markers. Generated content lives between START and END so a
 * user's own edits outside the block survive `groundrules generate`.
 */
const MARK_START = '<!-- groundrules:managed:start -->';
const MARK_END = '<!-- groundrules:managed:end -->';
const HEADER_NOTE = '<!-- Managed by groundrules. Edit files in .ai/, then run `groundrules generate`. The block between the markers below is overwritten on every run — put your own notes outside it. -->';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wrapManaged = (inner) => `${MARK_START}\n${inner.trim()}\n${MARK_END}`;

/** Insert or replace the managed block in `existing`, preserving anything outside it. */
function upsertManaged(existing, inner) {
  const block = wrapManaged(inner);
  if (existing && existing.includes(MARK_START) && existing.includes(MARK_END)) {
    const re = new RegExp(escapeRe(MARK_START) + '[\\s\\S]*?' + escapeRe(MARK_END));
    return existing.replace(re, block);
  }
  if (existing && existing.trim().length) return existing.replace(/\s*$/, '') + '\n\n' + block + '\n';
  return HEADER_NOTE + '\n\n' + block + '\n';
}

/** Return the trimmed inner text of the managed block, or null. */
function extractManaged(text) {
  if (!text) return null;
  const re = new RegExp(escapeRe(MARK_START) + '\\n?([\\s\\S]*?)\\n?' + escapeRe(MARK_END));
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

module.exports = { MARK_START, MARK_END, HEADER_NOTE, wrapManaged, upsertManaged, extractManaged };
