Before proposing a change, run yourself through this. Humans use the same list to review.

**Correctness**
- Does it do exactly what was asked — no more, no less?
- Happy path *and* failure paths (nulls, empties, timeouts, permission denials)?
- Any accidental O(n) network/DB calls in a loop? Anything unbounded that should be paginated/chunked?
- Concurrency/ordering assumptions actually hold?

**Fit**
- Matches sibling files' structure, naming, and idioms? Reuses existing helpers instead of duplicating?
- Follows the coding standards above (core + stack pack)?

**Safety**
- No secrets, keys, tokens, or PII in the diff?
- No new side-effectful behavior that runs without an explicit trigger/approval?
- Destructive operations gated and reversible where possible? Inputs validated at the boundary?

**Tests**
- New/updated tests cover the change, including a failure case? They actually run and pass (evidence)?

**Hygiene**
- Diff is tight — no unrelated reformatting? Migrations/config/docs updated if required?
- If a project rule or workflow changed, `.ai/` (or a skill) updated to match?

If any item can't be checked, say so explicitly rather than leaving it silently unchecked.
