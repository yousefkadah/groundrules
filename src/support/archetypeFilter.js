'use strict';

const path = require('path');
const { readJsonSafe } = require('./fs');

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

const ARCHETYPES = ['web-app', 'cli', 'library', 'unknown'];

/**
 * The archetype is DECLARED, never guessed — `--archetype=`, else the value
 * recorded in `.ai/.groundrules.json` (written by that flag or by the
 * `bootstrap` skill), else `unknown` (which keeps every rule).
 *
 * We deliberately do NOT infer it. Inferring "this is not a web app" from
 * manifests proved unsound: real services ship CLIs (consul, etcd, Kubernetes
 * and Argo CD all depend on cobra while serving authenticated HTTP), and Go's
 * stdlib `net/http` never appears in go.mod at all, so there is no signal to
 * outrank it. A wrong guess silently strips a web app's security rules, so the
 * tool doesn't guess — the human or the agent (which reads the actual code)
 * declares it.
 */
function resolveArchetype(cwd, flag) {
  if (flag && ARCHETYPES.includes(flag)) return flag;
  const manifest = readJsonSafe(path.join(cwd, '.ai', '.groundrules.json'));
  const declared = manifest && manifest.archetype;
  return ARCHETYPES.includes(declared) ? declared : 'unknown';
}

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

module.exports = { stripArchetypeBlocks, skillApplies, blockApplies, resolveArchetype, ARCHETYPES };
