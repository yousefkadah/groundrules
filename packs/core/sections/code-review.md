Before proposing a change, run yourself through this. Humans use the same list to review.

**Correctness**
- Does it do exactly what was asked — no more, no less?
- Happy path *and* failure paths (nulls, empties, timeouts, permission denials)?
- Any accidental network/DB calls in a loop? Anything unbounded that should be paginated/chunked?
- Concurrency/ordering assumptions actually hold? Externally-visible effects idempotent?
<!-- groundrules:only web-app -->
- Multi-step writes wrapped in a transaction?
<!-- groundrules:end -->

**Fit**
- Matches sibling files' structure, naming, and idioms? Reuses existing helpers instead of duplicating?
- Follows the coding standards above (core + stack pack), and didn't override "match the neighbors"?

**Safety**
- No secrets, keys, tokens, or PII in the diff — and no secret-bearing files opened unnecessarily?
- No new side-effectful behavior that runs without an explicit trigger/approval?
- Inputs validated at the boundary?
<!-- groundrules:only web-app -->
- No whole-model over-exposure; user uploads constrained?
<!-- groundrules:end -->
- Destructive operations gated and reversible where possible?

**Compatibility & privacy**
- Public API/contract changes backward-compatible or versioned?
<!-- groundrules:only web-app -->
- DB / event / queue contract changes safe under a rolling deploy (producer/consumer skew)?
  Migrations expand-contract, not destructive-in-place?
<!-- groundrules:end -->
- PII minimized and redacted in logs/exports; retention respected?

**Tests**
- New/updated tests cover the change, including a failure case? They actually run and pass (evidence)?

**Hygiene**
- Diff is tight — no unrelated reformatting? Config/docs updated if required?
- If a project rule or workflow changed, `.ai/` (or a skill) updated to match?

If any item can't be checked, say so explicitly rather than leaving it silently unchecked.
