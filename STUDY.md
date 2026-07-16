# What 45 repositories say about AI agent rules

A negative-result study. Four hypotheses behind this tool, tested against real repositories.
All four died. The measurement scripts are in [`test/proto/`](test/proto).

**Method.** 45 repositories — a hand-picked list plus a set discovered by GitHub code search, so the
sample isn't only repos chosen to prove the point. 34 ship agent rules; 23 keep more than one file.
Classification uses the git **file mode** from the trees API (`120000` = symlink, `100644` = file),
not file contents. Rot findings were adjudicated individually by independent reviewers instructed to
refute rather than confirm.

---

## H1 — "Keeping N rules files in sync is a real chore" · **REFUTED**

How the 23 multi-surface repos actually solve it:

| Method | Repos | Cost |
| --- | ---: | --- |
| `ln -s` symlink | 10 | free |
| Two-line stub pointer | 8 | free |
| Intentionally independent docs | 4 | nothing to sync |
| **Hand-copied — this tool's entire market** | **1** | real |

**78% had already solved it for free.** zod, pydantic-ai, vercel/ai, dify, cal.com, prisma and
nushell all symlink `CLAUDE.md → AGENTS.md`. Discourse symlinks `AGENTS.md`, `CLAUDE.md` **and**
`GEMINI.md` to `AI-AGENTS.md` — one source of truth, many tool files, zero drift, no tool. A symlink
beats a generator here: drift isn't *caught*, it's impossible, because it's the same blob.

> **Measurement trap.** The first scan compared file *contents*. Git stores a symlink as a blob
> holding the target path — spree's `AGENTS.md` is 9 bytes, the string `"CLAUDE.md"`. Ten symlinked
> repos therefore looked like "two divergent documents", which flattered the hypothesis. Caught only
> because a control returned an impossibly clean number. **Read the mode, not the bytes.**

## H2 — "Rules rot is real" · **CONFIRMED**

~10 of 34 repos assert at least one thing that is false at HEAD:

- **coolify** — rules state *"All documentation has been consolidated in `.ai/`"* and route agents to
  11 files there. The directory does not exist.
- **OpenHands** — *"Add the model to the `openhands_models` list (lines 57-66)"*. That file's entire
  directory is gone.
- **cal.com** — cites `packages/features/ee/`. Zero `/ee/` paths in a 10,269-entry tree.
- **simonw/llm** — documented setup is `pip install -e '.[test]'`. There is no `test` extra; the
  command installs nothing and the next documented step fails.

## H3 — "A deterministic checker can gate this in CI" · **REFUTED**

Pilot on 3 hand-picked repos: **13 findings, 13 correct, 0 false positives.**
At 45 repos, hostilely adjudicated: **40 findings, 26 true, 14 false — 65% precision.**
The pilot measured repos chosen *because* they were known-broken.

The 14 false positives are not tunable noise. The one that ends it:

```
vercel/ai · AGENTS.md
  "Do not create flat top-level provider files like `src/stream-text/openai.ts`"

  linter: ✗ nonexistent-path — src/stream-text/openai.ts
```

The file's **absence is the rule being obeyed**. A true claim and an anti-pattern example are
lexically identical; only the English words "Do not" separate them. Same for template placeholders
(`source/type-name.d.ts` is the file you're told to create) and "e.g.". Granting perfect fixes for
the two mechanical error classes (cross-repo section scoping, generated/gitignored output) puts the
ceiling at **~76%** — and that ceiling is overfit to the tuning sample, so held-out data can only be
worse.

**What does work.** One tool in the category proved the mechanism with a clean A/B in one binary:

```
dead path declared in YAML  (sources[].path)  →  check --ci  exit 1
same dead path asserted in prose              →  check --ci  exit 0
```

Machine-declared facts are checkable; prose isn't. But that only helps rules authored in your
structure — every existing prose rules file gets nothing. **24 tools surveyed. None has a working rot
gate.** Every serious attempt landed at 3–65% precision, demoted itself to a non-failing warning, or
ships a ~60% linter as a blocking gate.

## H4 — "Rules bloat is the real pain" · **CONFIRMED, but vendor-owned**

Always-on rules are rent, charged on every agent request. Median ~2,246 tokens (fine); **5 of 34
exceed 10,000 tokens per turn.** spree ships a 49KB `CLAUDE.md` ≈ 12,000 tokens, every request.

But Anthropic's docs already say *"target under 200 lines per CLAUDE.md file. Longer files consume
more context and reduce adherence"*, and `/doctor` ships the remediation. The vendors also document
both free solutions — `ln -s` and `@import`.

A related sub-hypothesis, **structured rules rot less, was refuted**: scoped (`.cursor/rules/*`) and
monolithic repos have an identical **1.06%** rot rate, and the direction reverses between small and
large files — the signature of noise.

## H5 — "The category doesn't support a winner" · **REFUTED**

| Tool | Weekly downloads | Bundled content | Surface types |
| --- | ---: | ---: | ---: |
| [rulesync](https://github.com/dyoshikawa/rulesync) | 196,686 | 0 | 8 |
| [Ruler](https://github.com/intellectronica/ruler) | 43,456 | 0 | 4 |
| **groundrules** | 520 | 9 | 1 |

The winners never competed with `ln -s`. They aimed at surfaces where **the formats diverge** — you
cannot symlink `.mcp.json` to `.codex/config.toml` (JSON vs re-keyed TOML) — and sync MCP configs,
skills trees, subagents, hooks, commands and permissions. This tool synced markdown: the one surface
that was already free. Both winners ship **zero opinions**; `ruler init` writes 261 bytes. This tool
injected ~221 lines into a bare repo and called the content its moat.

## The worked example is this repository

```
AGENTS.md                        15957 bytes   sha=c088cd31080a
GEMINI.md                        15957 bytes   sha=c088cd31080a
.github/copilot-instructions.md  15957 bytes   sha=c088cd31080a
.cursor/rules/groundrules.mdc    16126 bytes   alwaysApply: true
CLAUDE.md                          359 bytes   ← @import stub
```

Three byte-identical files. Cursor and Copilot read `AGENTS.md` natively, so Cursor loads the
canonical file **and** the always-on `.mdc`: **~8,020 always-on tokens to deliver ~4,000 tokens of
unique content** — a 2× duplicate tax, every turn, shipped by the tool meant to help. The only
surface that escapes is `CLAUDE.md`: a 359-byte `@import` stub, i.e. the free pattern the vendor
documents, used here exactly once.

## Lessons

1. **Measure the free alternative first.** One afternoon reading git file modes would have ended this
   project before the first commit. It happened after the CI parity gate.
2. **A hand-picked pilot is not evidence.** 100% precision on 3 chosen repos became 65% on 45.
3. **Prose is not checkable, and no regex fixes that.** Machine-verified rules must be
   machine-declared — a format decision made on day one or never.
4. **Point the thesis at yourself first.** The strongest finding sat in this repo, in three files
   with the same SHA, the whole time.

---

*Every figure was measured directly or re-derived from a primary source. Claims that could not be
verified first-hand were cut — including one that would have supported the conclusion.*
