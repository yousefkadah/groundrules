---
name: scaffold-project
description: Use when a repo is missing its supporting files — PR/issue templates, CONTRIBUTING, CODEOWNERS, .editorconfig, a CI workflow, .gitignore, SECURITY.md, CODE_OF_CONDUCT. Creates versions MATCHED to this project (not generic boilerplate), respecting whatever the repo already has and its AI/contribution policy.
---

# Scaffold the project's supporting files

Groundrules ships exactly one safe default (`.github/pull_request_template.md`). This skill helps you
create the *rest* — **tailored to THIS project**, using its real stack and commands, never copy-pasted
boilerplate.

## 1. Inventory what already exists — and never clobber it
- [ ] List the meta files already present: `CONTRIBUTING*`, `CODE_OF_CONDUCT*`, `SECURITY*`, `CODEOWNERS`,
      `.editorconfig`, `.github/ISSUE_TEMPLATE/*`, a PR template, CI workflows, `.gitignore`, existing
      `AGENTS.md`/`CLAUDE.md`, ADRs, and `docs/`.
- [ ] **Respect the repo's AI/contribution policy** first — if `AI_POLICY.md`, `CONTRIBUTING`, or an
      `AGENTS.md` directive restricts AI, **stop and surface it**; don't add files or open anything.
- [ ] For anything that already exists: **reconcile, don't replace** — read it, match its conventions,
      and only extend it if explicitly asked. Propose a diff; never overwrite a maintainer's file.

## 2. Create only the missing ones, matched to this project
Read `.ai/context.md` and neighboring files first, then create what the project actually needs — using
its **real** setup/test/lint/build commands, not a generic guess:
- [ ] **CONTRIBUTING.md** — the project's real clone → setup → run → test → lint → PR flow.
- [ ] **.editorconfig** — indentation / charset / EOL matching the project's **dominant** existing style.
- [ ] **.github/ISSUE_TEMPLATE/** — bug + feature templates that ask for the project's actual repro,
      version, and environment details.
- [ ] **CI workflow** — mirror the project's real gate (the commands from `.ai/testing-policy.md`) for its
      CI provider. Don't invent a pipeline the maintainers didn't ask for.
- [ ] **.gitignore** — add only the missing entries this stack/toolchain needs.
- [ ] **SECURITY.md** / **CODEOWNERS** — only with a real contact / ownership map from the maintainers;
      don't invent a security contact or owners.

## 3. Hand back
- [ ] Present every new or changed file as a **diff for review**. No secrets. Don't commit or open a PR
      unless asked.
- [ ] Prefer **fewer, correct** files over a pile of generic boilerplate — a wrong `CONTRIBUTING` is worse
      than none.
