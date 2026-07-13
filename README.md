# agentstd

**One source of truth for AI coding agents.** Detect your stack, scaffold engineering standards +
skills, and generate every tool's rules file — `AGENTS.md`, `CLAUDE.md`, Cursor, Copilot, Gemini — from
one place, kept in sync.

> Works for **any** project. If it detects your stack (Laravel, Node/TS, Python, Go…), it layers in that
> stack's rules and recommends its tooling. If it doesn't, you still get the universal core.

---

## Why

Every coding agent reads a different file — `CLAUDE.md`, `AGENTS.md`, `.cursor/rules/*.mdc`,
`.github/copilot-instructions.md`, `GEMINI.md`. Maintaining them by hand means drift and duplication.
`agentstd` keeps **one canonical source** (`.ai/`) and generates the rest, so your standards are written
once and every agent obeys the same rules.

It's not "another rules generator" — it's a **curated, security-first standards library** that happens
to ship with a generator. The value is the content in `packs/`, authored to staff-engineer quality.

## Quick start

```bash
# from your project root
npx agentstd init          # (after npm publish) — or, from a clone:
node /path/to/agentstd/bin/agentstd.js init

# it detects your stack, writes .ai/ + every agent's adapter, and prints stack recommendations
```

Then point your coding agent at the repo and run the **`bootstrap`** skill — it scans your codebase and
fills in `.ai/context.md` + drafts project-specific skills. Edit `.ai/`, run `agentstd generate`, and
every adapter re-syncs.

## Commands

| Command | Does |
|---|---|
| `agentstd init` | Detect stack, scaffold `.ai/` (core + packs), generate all adapters, print recommendations |
| `agentstd generate` | Re-generate every adapter from `.ai/` (idempotent; only managed blocks change) |
| `agentstd check` | Exit 1 if any adapter is out of sync with `.ai/` — a **CI drift gate** |
| `agentstd detect` | Print what would be detected, write nothing |

Flags: `--dry-run`, `--tools=agents,claude,cursor,copilot,gemini`, `--all`, `--cwd=PATH`.

## What it writes

```
.ai/                          # ← the canonical source you edit
  context · coding-standards · testing-policy · security-policy · code-review · pr-policy · release-policy
  skills/{bootstrap,security-review,add-integration,write-tests}/SKILL.md
AGENTS.md                     # canonical rollup (the cross-tool standard)   ┐
CLAUDE.md                     # @imports AGENTS.md                           │ generated,
.cursor/rules/agentstd.mdc    # transformed frontmatter                      │ inside managed
.github/copilot-instructions.md                                             │ markers — your
GEMINI.md                                                                    │ own edits outside
.claude/skills/*              # skills copied for lazy-loading                │ them survive
.github/pull_request_template.md                                            ┘
```

## How composition works

Content lives in `packs/`. **Core** (universal principles) is applied first; each detected **stack pack**
adds only stack-specific detail (commands, idioms, deps) under each section. One rule decides placement:
*names a command/extension/framework API → pack; states a principle → core.*

```
packs/core/            security · testing discipline · code-review · PR hygiene · the skills
packs/laravel-php/     php/artisan/Pest/Pint idioms  + recommends laravel/boost
packs/node-ts/         TypeScript strict · vitest/jest
packs/python/          type hints · ruff · pytest
packs/go/              gofmt · error wrapping · go test
```

Adding a pack = a folder with `pack.json` + `sections/*.md` (+ optional `skills/`). Contributions welcome.

## Rides the ecosystem — doesn't fight it

- **`AGENTS.md`** is the convergence standard (read by Codex, Cursor, Copilot, Windsurf, Gemini, Zed,
  Junie, Aider… and Claude Code). agentstd makes it the canonical file and adapts the rest.
- **Laravel Boost** stays the authority on Laravel *facts* — the Laravel pack recommends it and defers to it.
- **Skills** use the open [`SKILL.md`](https://agentskills.io) standard.

## Roadmap

- Distribute as a single Go binary via `brew` / `uvx` / `npx` (engine port; the content packs are the product).
- More stack packs (Rails, Rust, .NET) and a `--all` set of long-tail adapters (Windsurf, Cline, Junie, Aider).
- `agentstd check` GitHub Action.

## Status

MVP — the Node engine is functional (detect · compose · generate · check, all tested). Working name;
may be renamed before a formal launch.

## License

MIT © 2026 Yousef Kadah. The Laravel pack originated in
[`laravel-ai-kit`](https://github.com/yousefkadah/laravel-ai-kit).
