'use strict';

const path = require('path');
const { exists, isSymlink, read, listFiles } = require('../support/fs');
const { HEADER_NOTE } = require('../support/managedBlock');
const { stripManaged } = require('../support/aiPolicy');
const { parseFrontmatter } = require('../support/frontmatter');

const CANON_COMMENT = '<!-- This is the canonical set of instructions for AI coding agents on this repo. Source: .ai/ (edit there, then `groundrules generate`). -->';
const IMPORT_SENTENCE = 'This project uses [`AGENTS.md`](AGENTS.md) as the single source of truth for AI agent rules.';

/** Lines that are Groundrules plumbing, not human rules — dropped on import. */
function isPlumbingLine(line) {
  const t = line.trim();
  return t === HEADER_NOTE || t === CANON_COMMENT || t === IMPORT_SENTENCE || t === '@AGENTS.md' || t.startsWith('@import ');
}

/** Extract the human-authored rules from one agent file (drop frontmatter, our managed block, and @imports). */
function extract(content) {
  const { body } = parseFrontmatter(stripManaged(content));
  // Split on /\r?\n/ (not '\n') so a CRLF-authored source strips the same way as
  // Rust's str::lines() — otherwise the two ports seed a byte-different .ai/context.md.
  return body.split(/\r?\n/).filter((l) => !isPlumbingLine(l)).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

const isOurs = (name) => name === 'groundrules.md' || name.startsWith('groundrules.') || name.startsWith('groundrules-');

/**
 * Reads the agent rules a repo already has (CLAUDE.md, .cursorrules, Copilot,
 * Cursor/Copilot rule dirs, Gemini, Windsurf) so a team can adopt Groundrules
 * without hand-migrating. The extracted prose seeds `.ai/context.md`; the
 * `bootstrap` skill then reorganizes it into the right sections.
 */
class ImportService {
  /** @returns {{file:string,target:boolean}[]} candidate source files, in priority order. */
  candidates(cwd) {
    const list = [
      { file: 'AGENTS.md', target: true },
      { file: 'CLAUDE.md', target: true },
      { file: '.cursorrules', target: false, legacy: true },
    ];
    for (const f of listFiles(path.join(cwd, '.cursor', 'rules'))) {
      if (f.endsWith('.mdc') && !isOurs(f)) list.push({ file: `.cursor/rules/${f}`, target: false });
    }
    list.push({ file: '.github/copilot-instructions.md', target: true });
    for (const f of listFiles(path.join(cwd, '.github', 'instructions'))) {
      if (f.endsWith('.md') && !isOurs(f)) list.push({ file: `.github/instructions/${f}`, target: false });
    }
    list.push({ file: 'GEMINI.md', target: true });
    for (const f of listFiles(path.join(cwd, '.windsurf', 'rules'))) {
      if (f.endsWith('.md') && !isOurs(f)) list.push({ file: `.windsurf/rules/${f}`, target: false });
    }
    return list;
  }

  /**
   * @returns {{imported:boolean, body?:string, labels?:string[],
   *   consumedTargets?:Set<string>, superseded?:string[]}}
   */
  collect(cwd) {
    const seen = new Set();
    const blocks = [];
    const labels = [];
    const consumedTargets = new Set();
    const superseded = [];

    for (const cand of this.candidates(cwd)) {
      const abs = path.join(cwd, cand.file);
      // Skip symlinks — never slurp a file that points outside the repo (e.g. to
      // secrets) into the committed .ai/. Mirrors the write-path symlink guard.
      if (!exists(abs) || isSymlink(abs)) continue;
      const text = extract(read(abs));
      if (!text) continue;
      const norm = text.replace(/\s+/g, ' ').trim();
      if (seen.has(norm)) continue; // e.g. CLAUDE.md that only @imports AGENTS.md, or duplicate copies
      seen.add(norm);
      blocks.push(`### From \`${cand.file}\`\n\n${text}`);
      labels.push(cand.file);
      if (cand.target) consumedTargets.add(cand.file);
      if (cand.legacy) superseded.push(cand.file);
    }

    if (!blocks.length) return { imported: false };

    const banner = `> ⓘ Imported from ${labels.map((l) => '`' + l + '`').join(', ')} when adopting groundrules. This is a raw starting point — run the **bootstrap** skill so an agent splits it into the right \`.ai/\` sections (coding-standards / security-policy / testing-policy) and drops anything stale.`;
    const body = [banner, '', blocks.join('\n\n')].join('\n').trim() + '\n';
    return { imported: true, body, labels, consumedTargets, superseded };
  }
}

module.exports = ImportService;
