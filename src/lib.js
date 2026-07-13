'use strict';
/**
 * groundrules engine — detect, compose, emit.
 * Zero runtime dependencies (Node >= 18).
 *
 * Model:
 *   packs/core           universal, stack-agnostic (always applied first)
 *   packs/<stack>        per-stack addenda (commands / idioms / deps) + specialized skills
 *   -> compose -> writes .ai/ (the editable source of truth) + skills
 *   -> generate -> emits every tool's adapter from .ai/, inside managed markers
 */

const fs = require('fs');
const path = require('path');

const PACKS_DIR = path.join(__dirname, '..', 'packs');

// ---------- tiny ANSI ----------
const C = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m', cyan: '\x1b[36m', red: '\x1b[31m', magenta: '\x1b[35m',
};
const paint = (c, s) => `${C[c] || ''}${s}${C.reset}`;

// ---------- fs helpers ----------
const exists = (p) => { try { fs.accessSync(p); return true; } catch { return false; } };
const read = (p) => fs.readFileSync(p, 'utf8');
const readJsonSafe = (p) => { try { return JSON.parse(read(p)); } catch { return null; } };
const ensureDir = (p) => fs.mkdirSync(p, { recursive: true });
const write = (p, s) => { ensureDir(path.dirname(p)); fs.writeFileSync(p, s); };
const listDirs = (p) => { try { return fs.readdirSync(p, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { return []; } };
const copyDir = (src, dst) => {
  ensureDir(dst);
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name); const d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d); else write(d, read(s));
  }
};

// ---------- managed blocks ----------
const MARK_START = '<!-- groundrules:managed:start -->';
const MARK_END = '<!-- groundrules:managed:end -->';
const HEADER_NOTE = '<!-- Managed by groundrules. Edit files in .ai/, then run `groundrules generate`. The block between the markers below is overwritten on every run — put your own notes outside it. -->';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wrapManaged = (inner) => `${MARK_START}\n${inner.trim()}\n${MARK_END}`;

function upsertManaged(existing, inner) {
  const block = wrapManaged(inner);
  if (existing && existing.includes(MARK_START) && existing.includes(MARK_END)) {
    const re = new RegExp(escapeRe(MARK_START) + '[\\s\\S]*?' + escapeRe(MARK_END));
    return existing.replace(re, block);
  }
  if (existing && existing.trim().length) return existing.replace(/\s*$/, '') + '\n\n' + block + '\n';
  return HEADER_NOTE + '\n\n' + block + '\n';
}
function extractManaged(text) {
  if (!text) return null;
  const re = new RegExp(escapeRe(MARK_START) + '\\n?([\\s\\S]*?)\\n?' + escapeRe(MARK_END));
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

// ---------- frontmatter ----------
function parseFrontmatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: md };
  const data = {};
  for (const line of m[1].split('\n')) {
    const mm = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (mm) data[mm[1]] = mm[2].replace(/^["']|["']$/g, '');
  }
  return { data, body: m[2] };
}

// ---------- canonical sections ----------
const SECTION_ORDER = [
  { key: 'context', title: 'Project context' },
  { key: 'coding-standards', title: 'Coding standards' },
  { key: 'testing-policy', title: 'Testing policy' },
  { key: 'security-policy', title: 'Security policy (agent guardrails)' },
  { key: 'code-review', title: 'Code review checklist' },
  { key: 'pr-policy', title: 'Pull requests & commits' },
  { key: 'release-policy', title: 'Release & deploy' },
];

// ---------- packs ----------
function loadPack(id) {
  const dir = path.join(PACKS_DIR, id);
  if (!exists(dir)) return null;
  const meta = readJsonSafe(path.join(dir, 'pack.json')) || { id };
  const sections = {};
  const secDir = path.join(dir, 'sections');
  if (exists(secDir)) {
    for (const f of fs.readdirSync(secDir)) {
      if (f.endsWith('.md')) sections[f.replace(/\.md$/, '')] = read(path.join(secDir, f)).trim();
    }
  }
  const skills = [];
  const skillsDir = path.join(dir, 'skills');
  for (const name of listDirs(skillsDir)) {
    if (exists(path.join(skillsDir, name, 'SKILL.md'))) skills.push({ name, srcDir: path.join(skillsDir, name) });
  }
  return { id, dir, meta, sections, skills };
}

// ---------- detection ----------
function detect(cwd) {
  const stacks = [];
  const signals = [];
  const composer = readJsonSafe(path.join(cwd, 'composer.json'));
  const hasArtisan = exists(path.join(cwd, 'artisan'));
  if (composer || hasArtisan) {
    const req = composer ? { ...composer.require, ...composer['require-dev'] } : {};
    if (req['laravel/framework'] || hasArtisan) { stacks.push('laravel-php'); signals.push(hasArtisan ? 'artisan' : 'composer.json:laravel/framework'); }
  }
  const pkg = readJsonSafe(path.join(cwd, 'package.json'));
  if (pkg) {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    stacks.push('node-ts');
    if (deps.next) signals.push('package.json:next');
    else if (deps.react) signals.push('package.json:react');
    else signals.push('package.json');
  }
  if (exists(path.join(cwd, 'pyproject.toml')) || exists(path.join(cwd, 'requirements.txt')) || exists(path.join(cwd, 'manage.py'))) {
    stacks.push('python');
    signals.push(exists(path.join(cwd, 'manage.py')) ? 'manage.py (django)' : (exists(path.join(cwd, 'pyproject.toml')) ? 'pyproject.toml' : 'requirements.txt'));
  }
  if (exists(path.join(cwd, 'go.mod'))) { stacks.push('go'); signals.push('go.mod'); }

  // only keep stacks that have a pack shipped
  const available = stacks.filter((id) => exists(path.join(PACKS_DIR, id)));

  const existingAgents = [];
  for (const [label, p] of [
    ['CLAUDE.md', 'CLAUDE.md'], ['AGENTS.md', 'AGENTS.md'], ['Cursor', '.cursor'],
    ['Copilot', '.github/copilot-instructions.md'], ['Gemini', 'GEMINI.md'], ['.claude/', '.claude'],
  ]) if (exists(path.join(cwd, p))) existingAgents.push(label);

  return { stacks: available, rawStacks: stacks, signals, existingAgents };
}

// ---------- compose ----------
function compose(packIds) {
  const core = loadPack('core');
  if (!core) throw new Error('core pack missing');
  const packs = packIds.filter((id) => id !== 'core').map(loadPack).filter(Boolean);
  const applied = [core, ...packs];

  const sections = {};
  for (const { key } of SECTION_ORDER) {
    let out = core.sections[key] || '';
    for (const p of packs) {
      if (p.sections[key]) {
        out = out.replace(/\s*$/, '') + `\n\n### ${p.meta.name || p.id} specifics\n\n` + p.sections[key];
      }
    }
    if (out.trim()) sections[key] = out.trim();
  }

  const skillMap = new Map();
  for (const p of applied) for (const s of p.skills) skillMap.set(s.name, s); // pack overrides core by name
  const skills = [...skillMap.values()];

  const recommends = [];
  for (const p of applied) for (const r of (p.meta.recommends || [])) recommends.push({ ...r, pack: p.meta.name || p.id });

  return { sections, skills, recommends, appliedPacks: applied.map((p) => ({ id: p.id, name: p.meta.name || p.id })), core };
}

// ---------- write canonical .ai/ ----------
function writeCanonical(cwd, composed, plan) {
  const aiDir = path.join(cwd, '.ai');
  for (const { key } of SECTION_ORDER) {
    if (!composed.sections[key]) continue;
    const target = path.join(aiDir, `${key}.md`);
    plan.push({ path: path.relative(cwd, target), action: exists(target) ? 'overwrite' : 'create' });
    if (!plan.dryRun) write(target, composed.sections[key].trim() + '\n');
  }
  for (const s of composed.skills) {
    const dst = path.join(aiDir, 'skills', s.name);
    plan.push({ path: path.relative(cwd, path.join(dst, 'SKILL.md')), action: exists(dst) ? 'overwrite' : 'create' });
    if (!plan.dryRun) copyDir(s.srcDir, dst);
  }
  const manifest = { tool: 'groundrules', packs: composed.appliedPacks.map((p) => p.id) };
  if (!plan.dryRun) write(path.join(aiDir, '.groundrules.json'), JSON.stringify(manifest, null, 2) + '\n');
}

// ---------- build the composed body from .ai/ ----------
function buildBody(cwd) {
  const aiDir = path.join(cwd, '.ai');
  const parts = ['<!-- This is the canonical set of instructions for AI coding agents on this repo. Source: .ai/ (edit there, then `groundrules generate`). -->', ''];
  for (const { key, title } of SECTION_ORDER) {
    const f = path.join(aiDir, `${key}.md`);
    if (!exists(f)) continue;
    parts.push(`## ${title}`, '', read(f).trim(), '');
  }
  // skills index
  const skillsDir = path.join(aiDir, 'skills');
  const skillNames = listDirs(skillsDir);
  if (skillNames.length) {
    parts.push('## Skills', '', 'Load the matching skill when a task fits its description (full text in `.ai/skills/<name>/SKILL.md`, also copied to `.claude/skills/`).', '');
    for (const name of skillNames) {
      const sf = path.join(skillsDir, name, 'SKILL.md');
      if (!exists(sf)) continue;
      const { data } = parseFrontmatter(read(sf));
      parts.push(`- **${data.name || name}** — ${data.description || ''}`);
    }
    parts.push('');
  }
  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

// ---------- adapters ----------
const ADAPTERS = [
  { id: 'agents', path: 'AGENTS.md', kind: 'inline', default: true },
  { id: 'claude', path: 'CLAUDE.md', kind: 'import', default: true },
  { id: 'cursor', path: '.cursor/rules/groundrules.mdc', kind: 'mdc', default: true },
  { id: 'copilot', path: '.github/copilot-instructions.md', kind: 'inline', default: true },
  { id: 'gemini', path: 'GEMINI.md', kind: 'inline', default: true },
  { id: 'windsurf', path: '.windsurf/rules/groundrules.md', kind: 'inline', default: false },
];

const CURSOR_FRONTMATTER = [
  '---',
  'description: Project engineering standards, security guardrails, and skills for AI agents (managed by groundrules).',
  'globs:',
  'alwaysApply: false',
  '---',
].join('\n');

function adapterContent(kind, body, existing) {
  if (kind === 'import') {
    const inner = 'This project uses [`AGENTS.md`](AGENTS.md) as the single source of truth for AI agent rules.\n\n@AGENTS.md';
    return upsertManaged(existing, inner);
  }
  if (kind === 'mdc') {
    return CURSOR_FRONTMATTER + '\n\n' + HEADER_NOTE + '\n\n' + wrapManaged(body) + '\n';
  }
  // inline
  return upsertManaged(existing, body);
}

function selectAdapters(tools, all) {
  return ADAPTERS.filter((a) => {
    if (tools && tools.length) return tools.includes(a.id);
    return a.default || all;
  });
}

function emit(cwd, opts) {
  const plan = []; plan.dryRun = !!opts.dryRun;
  const body = buildBody(cwd);
  const adapters = selectAdapters(opts.tools, opts.all);
  for (const a of adapters) {
    const target = path.join(cwd, a.path);
    const existing = exists(target) ? read(target) : '';
    const next = adapterContent(a.kind, body, existing);
    const action = !existing ? 'create' : (existing === next ? 'unchanged' : 'update');
    plan.push({ path: a.path, action });
    if (!plan.dryRun && action !== 'unchanged') write(target, next);
  }
  // copy skills into .claude/skills
  const aiSkills = path.join(cwd, '.ai', 'skills');
  for (const name of listDirs(aiSkills)) {
    const dst = path.join(cwd, '.claude', 'skills', name);
    plan.push({ path: path.join('.claude/skills', name) + '/', action: exists(dst) ? 'overwrite' : 'create' });
    if (!plan.dryRun) copyDir(path.join(aiSkills, name), dst);
  }
  // PR template (copy from core if the repo doesn't already have one)
  const prSrc = path.join(PACKS_DIR, 'core', 'templates', 'pull_request_template.md');
  const prDst = path.join(cwd, '.github', 'pull_request_template.md');
  if (exists(prSrc) && !exists(prDst)) {
    plan.push({ path: '.github/pull_request_template.md', action: 'create' });
    if (!plan.dryRun) write(prDst, read(prSrc));
  }
  return plan;
}

// ---------- check (CI drift gate) ----------
function check(cwd, opts) {
  const body = buildBody(cwd);
  const drift = [];
  for (const a of selectAdapters(opts.tools, opts.all)) {
    const target = path.join(cwd, a.path);
    if (!exists(target)) { drift.push({ path: a.path, reason: 'missing' }); continue; }
    const cur = read(target);
    if (a.kind === 'mdc') {
      if (extractManaged(cur) !== body.trim()) drift.push({ path: a.path, reason: 'out of date' });
    } else if (a.kind === 'import') {
      if (!(cur.includes('@AGENTS.md'))) drift.push({ path: a.path, reason: 'out of date' });
    } else {
      if (extractManaged(cur) !== body.trim()) drift.push({ path: a.path, reason: 'out of date' });
    }
  }
  return drift;
}

module.exports = {
  C, paint, exists, read, readJsonSafe, ensureDir, write, listDirs, copyDir,
  SECTION_ORDER, ADAPTERS, loadPack, detect, compose, writeCanonical, buildBody, emit, check, selectAdapters,
};
