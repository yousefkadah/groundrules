---
name: bootstrap
description: Use ONCE right after running `groundrules init` (or when onboarding an agent to an unfamiliar repo). Scans the codebase and fills in .ai/context.md, replaces the «placeholders», records real cross-cutting rules, and drafts project-specific skills. Shipping placeholder text is a failure state.
---

# Bootstrap this project's AI guidance

`groundrules init` scaffolds `.ai/` from stack packs, but `context.md` and some rules ship as
`«placeholders»`. **Filling them is the highest-value step** — until it's done, every generated adapter
tells agents "«One paragraph — what this project does»", which is worse than nothing. Do this as a
**read-only scan that proposes edits** — never auto-commit; the human reviews. Then remind them to run
`groundrules generate`.

## 1. Scan (read-only)
- [ ] Confirm the stack from the project's manifests (`composer.json` / `package.json` / `pyproject.toml`
      / `go.mod` / `Cargo.toml` / `Gemfile` / `*.csproj`) and `.ai/.groundrules.json`. Note framework(s),
      the real **test runner**, build tooling, and the **lint / type / static gate** from the project's
      own scripts and CI — don't assume a PHP/JS toolchain.
- [ ] **Reconcile the repo's own convention docs** — `README`, `CONTRIBUTING`, `docs/`, ADRs,
      `.github/*instructions*`, `.cursor/rules`, existing `CLAUDE.md`/`AGENTS.md`. Reuse the repo's own
      architecture terms; don't re-derive them.
- [ ] Map the layout: where code, tests, and config live; entry points; how the app is run and tested.
- [ ] Identify cross-cutting rules from the code: multi-tenancy/isolation, money/units, auth, i18n.
- [ ] List existing third-party integrations (SDKs, webhooks, API clients, file formats).

## 2. Fill the canonical source (`.ai/`)
- [ ] `.ai/context.md` — what the project is, who uses it, top priorities, domain vocabulary, the real
      run/test/build commands, and where to look first.
- [ ] Replace **every** `«placeholder»`. If you can't determine something, leave a clearly marked
      `«TODO: confirm …»` rather than guessing. Correct any stack rule that doesn't match this repo.

## 3. Draft project-specific skills
- [ ] For each recurring workflow visible in the repo, draft `.ai/skills/<name>/SKILL.md` using the
      existing skills as templates. For each existing integration, follow `add-integration`.

## 4. Hand back
- [ ] Present filled files + drafted skills as a **diff for review**. No invented facts. No
      secret/key/token/`.env` value (see `.ai/security-policy.md`).
- [ ] Tell the human to run `groundrules generate` so all adapters update.

> The kit gives the structure; your agent supplies the project knowledge. Leaving placeholders in is a
> failed bootstrap.
