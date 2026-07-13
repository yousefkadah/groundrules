---
name: bootstrap
description: Use ONCE right after running `groundrules init` (or when onboarding an agent to an unfamiliar repo). Scans the codebase and fills in .ai/context.md, replaces the «placeholders», records real cross-cutting rules, and drafts project-specific skills — turning the template into a project-aware guide.
---

# Bootstrap this project's AI guidance

`groundrules init` scaffolds `.ai/` from stack packs, but `context.md` and some rules ship as
`«placeholders»`. Your job: read the actual repository and fill them in, so every agent that loads
`.ai/` gets accurate guidance. Do this as a **read-only scan that proposes edits** — never auto-commit;
the human reviews your draft. Then remind them to run `groundrules generate` to re-sync the adapters.

## 1. Scan (read-only)
- [ ] Confirm the stack from manifests and `.ai/.groundrules.json`. Note framework(s), test runner, build tooling.
- [ ] Map the layout: where the main code, tests, and config live; entry points; how the app is run and tested (README, Makefile, package/composer scripts, CI).
- [ ] Identify cross-cutting rules from the code itself: multi-tenancy/isolation, money/units, auth, i18n — anything an agent would get wrong unprompted.
- [ ] List existing third-party integrations (SDKs, webhooks, API clients, file formats).

## 2. Fill the canonical source (`.ai/`)
- [ ] `.ai/context.md` — what the project is, who uses it, top priorities, domain vocabulary.
- [ ] Replace every `«placeholder»` across `.ai/`. If you can't determine something, leave a clearly
      marked `«TODO: confirm …»` rather than guessing.

## 3. Draft project-specific skills
- [ ] For each recurring workflow visible in the repo, draft `.ai/skills/<name>/SKILL.md` using the
      existing skills as templates (sharp `description`, imperative body, concrete paths).
- [ ] For each existing integration, draft a short skill per the `add-integration` playbook.

## 4. Hand back
- [ ] Present the filled files and drafted skills as a **diff for the human to review**.
- [ ] No invented facts. No secret/key/token/`.env` value (see `.ai/security-policy.md`).
- [ ] Tell the human to run `groundrules generate` so AGENTS.md / CLAUDE.md / Cursor / Copilot / Gemini update.

> The kit gives the structure; your agent supplies the project knowledge.
