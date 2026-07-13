- **Never commit to the default branch.** Branch first (`feat/…`, `fix/…`).
- **One logical change per branch/PR.** Keep it reviewable.
- **Commit/push only when asked.** Don't push on your own initiative.
- Follow the repo's existing commit convention (check `git log`). If it uses Conventional Commits
  (`feat(scope): …`), match it.
- Fill in the PR template completely, including the **test command + output** as evidence and a link to
  the issue/spec.
- Before opening a PR: tests pass (with evidence), formatter/linter clean, no secrets in the diff,
  self-reviewed against the checklist above.
