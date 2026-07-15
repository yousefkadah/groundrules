<img src="assets/logo.svg" width="76" align="left" alt="Groundrules logo" />

# Groundrules

**One source of truth for AI coding agents.** Detect your stack, scaffold engineering standards +
skills, and generate every tool's rules file — `AGENTS.md`, `CLAUDE.md`, Cursor, Copilot, Gemini — from
one place, kept in sync.

<p>
  <a href="https://www.npmjs.com/package/@yousefkadah/groundrules"><img src="https://img.shields.io/npm/v/@yousefkadah/groundrules?color=4f46e5&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@yousefkadah/groundrules"><img src="https://img.shields.io/npm/dt/@yousefkadah/groundrules?color=4f46e5&label=downloads" alt="npm total downloads"></a>
  <a href="https://github.com/yousefkadah/groundrules/actions/workflows/ci.yml"><img src="https://github.com/yousefkadah/groundrules/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/npm/l/@yousefkadah/groundrules?color=4f46e5" alt="license"></a>
  <img src="https://img.shields.io/node/v/@yousefkadah/groundrules" alt="node version">
</p>

<p align="center">
  <img src="assets/hero.svg" alt="Groundrules: detect your stack → compose one .ai/ source (core + stack packs) → generate every agent's rules file, in sync" width="960">
</p>

> Works for **any** project. If it detects your stack (Laravel, Vue/Inertia, Node/TS, Python, Go, Rails,
> Rust, .NET), it layers in that stack's rules and recommends its tooling. If it doesn't, you still get
> the universal, security-first core.

---

## Why

Every coding agent reads a different file — `CLAUDE.md`, `AGENTS.md`, `.cursor/rules/*.mdc`,
`.github/copilot-instructions.md`, `GEMINI.md`. Maintaining them by hand means drift and duplication.
Groundrules keeps **one canonical source** (`.ai/`) and generates the rest, so your standards are written
once and every agent obeys the same rules.

It's not "another rules generator" — it's a **curated, security-first standards library** that happens
to ship with a generator. The value is the content in `packs/`, authored to staff-engineer quality and
**stress-tested on real code** (see [Battle-tested](#battle-tested)).

## Quick start

```bash
# from your project root
npx @yousefkadah/groundrules init
```

Prefer a **node-free single binary**? `brew install yousefkadah/tap/groundrules` (a standalone Rust
build — no Node required). See [`rust/`](rust/).

It detects your stack, writes `.ai/` + every agent's adapter, and prints stack recommendations. Then
point your coding agent at the repo and run the **`bootstrap`** skill — it scans your codebase and fills
in `.ai/context.md` + drafts project-specific skills. Edit `.ai/`, run `groundrules generate`, and every
adapter re-syncs.

**Already have a `CLAUDE.md` / `.cursorrules` / Copilot instructions?** Don't start over —
`groundrules import` reads your existing agent rules into `.ai/`, layers the curated security-first packs
on top, and generates every adapter. Your rules migrate in; the drift gate keeps them honest from then on.

> The CLI is dumb and deterministic; **your agent supplies the intelligence** (the `bootstrap` scan), so
> Groundrules never needs an API key of its own.

## Commands

| Command | Does |
|---|---|
| `groundrules init` | Detect stack, scaffold `.ai/` (core + packs), generate all adapters, print recommendations |
| `groundrules import` | **Adopt existing rules** — pull `CLAUDE.md`/`.cursorrules`/Copilot/Gemini/Windsurf into `.ai/`, then generate |
| `groundrules generate` | Re-generate every adapter from `.ai/` (idempotent; only managed blocks change) |
| `groundrules check` | Exit 1 if any adapter is out of sync with `.ai/` — a **CI drift gate** |
| `groundrules detect` | Print what would be detected, write nothing |

Flags: `--dry-run`, `--force`, `--tools=agents,claude,cursor,copilot,gemini`, `--all`, `--cwd=PATH`.

## What it writes

```
.ai/                                  # ← the canonical source you edit
  context · coding-standards · testing-policy · security-policy · code-review · pr-policy · release-policy
  skills/{bootstrap,scaffold-project,security-review,add-integration,write-tests,add-database-change,run-background-job}/SKILL.md
AGENTS.md                             # canonical rollup, full body (the cross-tool standard)   ┐
CLAUDE.md                             # @imports AGENTS.md                                      │
GEMINI.md                             # full body                                              │ generated,
.cursor/rules/groundrules.mdc         # always-on rule (alwaysApply:true)                       │ inside managed
.cursor/rules/groundrules-<stack>.mdc # path-scoped rule (globs:) per detected stack            │ markers — your
.github/copilot-instructions.md       # always-on, repo-wide                                    │ own edits
.github/instructions/groundrules-<stack>.instructions.md  # path-scoped (applyTo:) per stack    │ outside them
.claude/skills/*                      # skills copied for lazy-loading                          │ survive
.github/pull_request_template.md                                                               ┘
```

## Always-on security + path-scoped stack rules

A security-first library is only useful if its rules actually load. Groundrules projects the same `.ai/`
source into two tiers for the tools that support scoping:

- **Always-on** (`.cursor/rules/groundrules.mdc` with `alwaysApply:true`; `.github/copilot-instructions.md`
  repo-wide) — the universal rules **including the security guardrails** load every session, never skipped.
- **Path-scoped** (`.cursor/rules/groundrules-<stack>.mdc` with `globs:`; `.github/instructions/*.instructions.md`
  with `applyTo:`) — each stack's specifics auto-attach only when you edit files that stack governs
  (`**/*.php`, `**/*.vue`, `**/*.py`, …), so the right idioms surface without bloating every prompt.

`AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` carry the **full** body inline (those tools don't do path
globs). Every file lives inside managed markers and is drift-gated by `check`.

## How composition works

Content lives in `packs/`. **Core** (universal principles) is applied first; each detected **stack pack**
adds only stack-specific detail (commands, idioms, deps) under each section. One rule decides placement:
*names a command / extension / framework API → pack; states a principle → core.*

| Pack | Fires on | Adds |
|---|---|---|
| `core` | always | security-first guardrails · testing discipline · code-review · PR hygiene · 6 skills |
| `laravel-php` | `artisan` / `laravel/framework` | Pest·PHPUnit detection, service-vs-FormRequest validation, `queue:restart`, phpstan/psalm gate — **recommends Laravel Boost** |
| `vue` | `vue` / `@inertiajs/vue3` | Vue/Inertia conventions, a11y, SSR/hydration (no TypeScript assumed) |
| `node-ts` | `tsconfig` / `typescript` | TS-strict, vitest/jest |
| `python` | `pyproject` / `manage.py` | type hints · ruff · pytest (Django/FastAPI aware) |
| `go` | `go.mod` | gofmt · error wrapping · `go test -race` |
| `rails` | `bin/rails` | RuboCop · strong params · RSpec/Minitest |
| `rust` | `Cargo.toml` | rustfmt · clippy · `Result`/`?` |
| `dotnet` | `*.csproj` / `*.sln` | nullable refs · async-all-the-way · `dotnet test` |

Adding a pack = a folder with `pack.json` + `sections/*.md` (+ optional `skills/`). Contributions welcome.

## Battle-tested

The packs aren't hand-waved. Groundrules was run on a real, production-scale Laravel + Vue app
([Monica](https://github.com/monicahq/monica)) and the generated guidance was audited by **OpenAI Codex**
*and* an independent Opus operator, over three rounds — feeding every finding back into the packs until
Codex reported **no critical or high issues remaining**. That loop caught and fixed things a generic
template ships wrong: Pest-vs-PHPUnit detection, validation that fits a service-layer app, tenant
isolation beyond queries, an instruction-trust hierarchy, webhook/OAuth hardening, and more.

## CI drift gate

Keep every agent's rules file honest — copy [`examples/groundrules-check.yml`](examples/groundrules-check.yml)
into your repo's `.github/workflows/` to fail a PR when `.ai/` changed but the adapters weren't regenerated:

```yaml
- run: npx @yousefkadah/groundrules check
```

## Rides the ecosystem — doesn't fight it

- **`AGENTS.md`** is the convergence standard (read by Codex, Cursor, Copilot, Windsurf, Gemini, Zed,
  Junie, Aider… and Claude Code). Groundrules makes it the canonical file and adapts the rest.
- **Laravel Boost** stays the authority on Laravel *facts* — the Laravel pack recommends it and defers to it.
- **Skills** use the open [`SKILL.md`](https://agentskills.io) standard.

## Roadmap

- ✅ **Node-free single binary** via `brew` (Rust port; byte-identical output to `npx`, drift-gated across both).
- ✅ **Rule import** — adopt an existing `CLAUDE.md`/`.cursorrules`/Copilot/Gemini setup.
- ✅ **Always-on + path-scoped rules** (Cursor `globs`/`alwaysApply`, Copilot `applyTo`).
- A thin `groundrules.json` config file (pin targets, stack overrides, opt-outs) — flag-only today.
- More stack packs and long-tail adapters (Windsurf shipping; Cline/Junie/Aider ride the `AGENTS.md` standard) — contributions welcome.

## Architecture

Groundrules is a small, layered codebase (zero runtime dependencies) — not one big file:

```
src/
├── cli/            controller + commands (init · generate · check · detect) + Printer
├── services/       orchestration: detection · composition · writer · body · generator · drift
├── detectors/      one StackDetector strategy per stack (Laravel, Vue, Python, Go, …)
├── strategies/     adapter render strategies (inline · @import · Cursor .mdc)
├── models/         Pack · Skill · Section · Adapter · DetectionResult · CanonicalSource
├── config/         section order + adapter registry (data, not code)
└── support/        fs · ansi · frontmatter · managed-block helpers
```

The content packs in `packs/` are the product; the engine above is deliberately thin and testable
(`node test/smoke.js`).

## Status

Working MVP — the Node engine (detect · compose · generate · check) is smoke-tested and CI-gated. The Node
CLI and the Rust binary are held to **byte-identical output** by a CI parity gate (`test/parity.sh` builds
both and diffs them across a stack + import matrix), so `check` can never disagree between npx and brew;
the Rust engine also has its own `cargo test` unit suite. The npm package is scoped
(`@yousefkadah/groundrules`) because the bare name was taken; the CLI command is still `groundrules`.

## License

MIT © 2026 Yousef Kadah.
