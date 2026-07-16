# Measurement scripts (research spike — never shipped in the CLI)

These are the scripts behind [`../../STUDY.md`](../../STUDY.md). They are kept as the record of a
negative result, not as product code.

| script | what it measures |
| --- | --- |
| `rules-lint.js` | the deterministic rot linter. Pure core (`lintEvidence`) + fs adapter. **Capped at 65% precision** — see STUDY.md H3 for why that is structural, not tunable. |
| `rot-study.js` | runs the linter across many repos via the GitHub API (no cloning). |

Two traps worth preserving, since both produced confident wrong answers:

1. **`rot-study.js` reads the git tree, which cannot see gitignored or generated files.** Absence in
   the tree is not absence on disk.
2. Any scan that classifies rules files must read the **git file mode**, not the blob contents. A
   symlink's blob holds its *target path* (spree's `AGENTS.md` is 9 bytes: `"CLAUDE.md"`), so
   content-comparison silently reports symlinked repos as "divergent documents".
