'use strict';

/**
 * Pure render functions — how a composed body becomes a tool's file content.
 * Each is a function of (body, existing, opts) → string, so `generate` (which
 * writes) and `check` (which compares) share exactly one code path and can
 * never disagree about what "in sync" means. Kept regex-free where practical so
 * the Rust port matches byte-for-byte.
 */
const { wrapManaged, upsertManaged, HEADER_NOTE } = require('../support/managedBlock');

/** Inline the body inside a managed block, preserving anything the user wrote outside it. */
const inline = (body, existing) => upsertManaged(existing, body);

/** Point a tool at AGENTS.md via an `@import` (Claude Code) rather than duplicating the body. */
const importRef = (existing) => upsertManaged(existing, 'This project uses [`AGENTS.md`](AGENTS.md) as the single source of truth for AI agent rules.\n\n@AGENTS.md');

/**
 * A Cursor `.mdc` project rule: real frontmatter (description/globs/alwaysApply)
 * plus a managed block. `alwaysApply:true` (globs empty) is the always-on rule;
 * `alwaysApply:false` with globs is an auto-attached, path-scoped rule.
 */
function cursorMdc(body, { alwaysApply, globs = [], description }) {
  const frontmatter = [
    '---',
    `description: ${description}`,
    globs.length ? `globs: ${globs.join(',')}` : 'globs:',
    `alwaysApply: ${alwaysApply ? 'true' : 'false'}`,
    '---',
  ].join('\n');
  return frontmatter + '\n\n' + HEADER_NOTE + '\n\n' + wrapManaged(body) + '\n';
}

/** A GitHub Copilot path-scoped instructions file (`applyTo` frontmatter). */
function copilotScoped(body, { applyTo }) {
  const frontmatter = ['---', `applyTo: "${applyTo}"`, '---'].join('\n');
  return frontmatter + '\n\n' + HEADER_NOTE + '\n\n' + wrapManaged(body) + '\n';
}

module.exports = { inline, importRef, cursorMdc, copilotScoped };
