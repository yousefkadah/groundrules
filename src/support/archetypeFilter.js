'use strict';

/**
 * Archetype gating for pack content.
 *
 * Pack sections can fence content that only applies to certain project types:
 *
 *   <!-- groundrules:only web-app -->
 *   - **Authorization & isolation:** derive the tenant server-side …
 *   <!-- groundrules:end -->
 *
 * At compose time the fenced block is kept or dropped based on the detected
 * archetype, and the marker lines never reach `.ai/`. FAIL-SAFE: an `unknown`
 * archetype keeps everything — we only ever drop content when we're confident
 * the project type doesn't need it.
 *
 * Pure line ops (no regex) so the Rust port decides identically.
 */

const OPEN = '<!-- groundrules:only ';
const CLOSE = '<!-- groundrules:end -->';

/** Does a block fenced for `list` apply to `archetype`? */
function blockApplies(list, archetype) {
  if (!archetype || archetype === 'unknown') return true; // fail-safe: keep it
  return list.includes(archetype);
}

/** Drop fenced blocks that don't apply, and remove the marker lines. */
function stripArchetypeBlocks(text, archetype) {
  if (!text) return text;
  const out = [];
  let skipping = false;
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (t.startsWith(OPEN) && t.endsWith('-->')) {
      const list = t.slice(OPEN.length, t.length - 3).split(',').map((s) => s.trim()).filter(Boolean);
      skipping = !blockApplies(list, archetype);
      continue;
    }
    if (t === CLOSE) { skipping = false; continue; }
    if (!skipping) out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Does a skill apply? Skills opt into archetypes via frontmatter
 * (`archetypes: web-app`); a skill without the field always applies.
 */
function skillApplies(archetypesField, archetype) {
  if (!archetypesField) return true;
  const list = String(archetypesField).split(',').map((s) => s.trim()).filter(Boolean);
  if (!list.length) return true;
  return blockApplies(list, archetype);
}

module.exports = { stripArchetypeBlocks, skillApplies, blockApplies };
