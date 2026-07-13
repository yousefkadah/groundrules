'use strict';

/**
 * Split a composed section into its core "head" and per-pack "tails", using the
 * deterministic `### <PackName> specifics` markers that CompositionService emits
 * when it merges a stack pack into a section. This lets `generate` project the
 * universal rules into always-on adapters and each stack's rules into
 * path-scoped ones, without re-running composition.
 *
 * Pure string ops (no regex) so the Rust port produces byte-identical output.
 *
 * @param {string} text  the section file's content
 * @param {string[]} packNames  display names of applied stack packs
 * @returns {{ head: string, tails: Record<string,string> }}
 */
function splitSection(text, packNames) {
  const marks = [];
  for (const name of packNames) {
    const marker = `### ${name} specifics`;
    let idx = text.indexOf(`\n${marker}`);
    let nl = 1; // width of the leading "\n" before the marker
    if (idx === -1 && text.startsWith(marker)) { idx = 0; nl = 0; } // marker at start-of-string (empty core head)
    if (idx !== -1) marks.push({ name, idx, len: marker.length, nl });
  }
  marks.sort((a, b) => a.idx - b.idx);
  if (!marks.length) return { head: text.trim(), tails: {} };
  const head = text.slice(0, marks[0].idx).trim();
  const tails = {};
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].idx + marks[i].nl + marks[i].len; // past "\n### <name> specifics"
    const end = i + 1 < marks.length ? marks[i + 1].idx : text.length;
    tails[marks[i].name] = text.slice(start, end).trim();
  }
  return { head, tails };
}

module.exports = { splitSection };
