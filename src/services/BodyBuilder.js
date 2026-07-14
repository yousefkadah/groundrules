'use strict';

const path = require('path');
const { SECTION_ORDER } = require('../config/sections');
const { exists, read, listDirs, readJsonSafe } = require('../support/fs');
const { parseFrontmatter } = require('../support/frontmatter');
const { splitSection } = require('../support/sectionSplit');

const CANON_COMMENT = '<!-- This is the canonical set of instructions for AI coding agents on this repo. Source: .ai/ (edit there, then `groundrules generate`). -->';
const UNCONFIGURED_BANNER = '> ⚠ **UNCONFIGURED** — `.ai/context.md` still contains «placeholders». Run the `bootstrap` skill so an agent fills in this project’s real context, architecture, and commands. Until then, treat the stack-specific guidance below as generic defaults, not verified facts.';

// Prefix of ImportService's banner (must stay in sync). When context.md still
// carries a raw import, the always-on surface uses a short pointer instead of
// force-loading hundreds of unreconciled lines every session.
const IMPORT_CONTEXT_MARKER = '> ⓘ Imported from';
const IMPORT_CONTEXT_POINTER = "> **Project context** was imported from your existing agent rules and isn't reorganized yet — the full text is in `AGENTS.md`. Run the `bootstrap` skill to sort it into the right sections (then it loads everywhere).";

/**
 * Reads .ai/ and assembles the composed markdown body that adapters share.
 *
 * Three projections of the same source:
 *  - `build`       — the FULL body (core + every stack's specifics inline). Used
 *                    by adapters that have no path-scoping (AGENTS.md, CLAUDE.md,
 *                    GEMINI.md, Windsurf).
 *  - `buildAlways` — the always-on body (universal rules only; stack specifics
 *                    move to scoped files). Used by Cursor's `alwaysApply` rule
 *                    and Copilot's repo-wide instructions.
 *  - `buildPack`   — one stack's specifics, for a path-scoped adapter.
 */
class BodyBuilder {
  constructor(packsDir) {
    this.packsDir = packsDir;
  }

  /** Applied stack packs (from the .ai/ manifest), with display name + globs. */
  appliedPacks(cwd) {
    const manifest = readJsonSafe(path.join(cwd, '.ai', '.groundrules.json')) || {};
    const ids = (manifest.packs || []).filter((id) => id && id !== 'core');
    const out = [];
    for (const id of ids) {
      const meta = this.packsDir ? readJsonSafe(path.join(this.packsDir, id, 'pack.json')) : null;
      if (!meta) continue;
      out.push({ id, name: meta.name || id, globs: Array.isArray(meta.globs) ? meta.globs : [] });
    }
    return out;
  }

  hasPlaceholders(cwd) {
    const aiDir = path.join(cwd, '.ai');
    for (const { key } of SECTION_ORDER) {
      const f = path.join(aiDir, `${key}.md`);
      if (exists(f) && read(f).includes('«')) return true;
    }
    return false;
  }

  /** Ordered [{ key, title, text }] for the section files that exist. */
  sections(cwd) {
    const aiDir = path.join(cwd, '.ai');
    const out = [];
    for (const { key, title } of SECTION_ORDER) {
      const f = path.join(aiDir, `${key}.md`);
      if (exists(f)) out.push({ key, title, text: read(f).trim() });
    }
    return out;
  }

  /** The skills-index lines (present only in the "main" bodies). */
  skillsIndex(cwd) {
    const skillsDir = path.join(cwd, '.ai', 'skills');
    const names = listDirs(skillsDir);
    if (!names.length) return [];
    const lines = ['## Skills', '', 'Load the matching skill when a task fits its description (full text in `.ai/skills/<name>/SKILL.md`, also copied to `.claude/skills/`).', ''];
    for (const name of names) {
      const sf = path.join(skillsDir, name, 'SKILL.md');
      if (!exists(sf)) continue;
      const { data } = parseFrontmatter(read(sf));
      lines.push(`- **${data.name || name}** — ${data.description || ''}`);
    }
    lines.push('');
    return lines;
  }

  /** Shared assembler for the main (always/full) bodies. */
  _assembleMain(cwd, sectionTexts) {
    const parts = [CANON_COMMENT, ''];
    if (this.hasPlaceholders(cwd)) parts.push(UNCONFIGURED_BANNER, '');
    for (const { title, text } of sectionTexts) parts.push(`## ${title}`, '', text.trim(), '');
    for (const line of this.skillsIndex(cwd)) parts.push(line);
    return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  /** FULL body: every section verbatim (core + stack specifics inline). */
  build(cwd) {
    return this._assembleMain(cwd, this.sections(cwd));
  }

  /**
   * ALWAYS body: universal rules only. Each globbed pack's specifics move to
   * scoped files, and a RAW import (context.md still carrying the import banner)
   * is replaced by a short pointer so hundreds of unreconciled lines don't
   * force-load every session — the full text stays in the full-body adapters
   * (AGENTS.md etc.) until `bootstrap` sorts it into real sections.
   */
  buildAlways(cwd) {
    const applied = this.appliedPacks(cwd);
    const names = applied.map((p) => p.name);
    const globbed = new Set(applied.filter((p) => p.globs.length).map((p) => p.name));
    const sectionTexts = this.sections(cwd).map(({ key, title, text }) => {
      let out = text;
      if (names.length) {
        const { head, tails } = splitSection(text, names);
        out = head; // keep any non-scoped pack's tail inline; only globbed packs move to scoped files
        for (const [name, tail] of Object.entries(tails)) {
          if (!globbed.has(name) && tail) out = out.replace(/\s*$/, '') + `\n\n### ${name} specifics\n\n` + tail;
        }
      }
      if (key === 'context' && out.includes(IMPORT_CONTEXT_MARKER)) out = IMPORT_CONTEXT_POINTER;
      return { title, text: out };
    });
    return this._assembleMain(cwd, sectionTexts);
  }

  /** One stack pack's specifics, as a focused path-scoped body — or null if it adds nothing. */
  buildPack(cwd, packId) {
    const applied = this.appliedPacks(cwd);
    const names = applied.map((p) => p.name);
    const pack = applied.find((p) => p.id === packId);
    if (!pack) return null;

    const blocks = [];
    for (const { title, text } of this.sections(cwd)) {
      const { tails } = splitSection(text, names);
      const tail = tails[pack.name];
      if (tail) blocks.push(`## ${title}`, '', tail.trim(), '');
    }
    if (!blocks.length) return null;

    const header = [
      `# ${pack.name} — stack-specific rules`,
      '',
      'These auto-attach when you edit files matching this pack’s globs. General standards and skills live in the always-on rule.',
      '',
    ];
    return (header.concat(blocks).join('\n').replace(/\n{3,}/g, '\n\n').trim()) + '\n';
  }
}

module.exports = BodyBuilder;
