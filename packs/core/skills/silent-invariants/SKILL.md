---
name: silent-invariants
description: Add (and later refresh) a short `## Silent invariants` section in the project's agent rules — the rules whose violation compiles, lints, and passes the whole test suite. Run it after context.md is filled in; it assumes an oriented agent, and it is meant to be RE-RUN as the codebase is hardened. Padding this section is a failure state.
---

# Silent invariants

Most rules an agent needs are already enforced: the compiler rejects it, the linter flags it, a test
goes red. Writing those down is waste — the machine already says it, louder and sooner.

What no machine says is the rule whose violation **compiles, type-checks, lints, and passes the full
suite**, and is wrong anyway. Those are worth their tokens, and nothing else in this file is.

## Re-run this; it is not a one-shot

This skill compounds. Run it, let the team fix or document what it surfaces, then run it again — the
admission test (below) will now DROP everything that was fixed, because the fix added the enforcement
or the test that rule 1 and rule 2 look for, and it will surface the next layer instead of repeating
itself. Before writing anything on a re-run, read the existing `## Silent invariants` section and the
rest of the agent rules, and treat each prior item as a candidate to discard: open the code and check
whether a guard, a global scope, a constraint, or a test now catches it. Report what you discarded and
why — a shrinking or turning-over section across runs is the signal that the loop is working. This is
also how the tool improves the agent: what it writes here is what every future session reads first.

Produce **15–25 lines / 5–7 invariants**. Deliver them as a `## Silent invariants` section appended
to the project's existing agent-rules file (`.ai/context.md`, or the repo's `AGENTS.md`). This is a
**read-only scan that proposes an edit** — never auto-commit; the human reviews.

## 1. The admission test — every line passes all four

1. **Violating it passes every mechanical check.** Compiler, linter, type checker, CI job, existing
   test — if any of them catch it, DROP IT. The reader does not need prose for what the build says.
2. **No automatic enforcement exists.** Search for and rule out: row-level security, an ORM global or
   default scope, query middleware, a mandatory wrapper every caller goes through, a framework
   guarantee, a failing CI gate. Say what you searched.
   **Enforcement means something that FAILS the build or the suite. It does NOT mean:**
   - a safe **default** ("the allowlist defaults to `[id]`, so it fails closed") — a default is the
     state *before* someone edits it, and editing it is exactly the silent act you are documenting;
   - an **advisory** report — a PR comment, an annotation, a posted diff, a job set to
     `continue-on-error`. Nobody is blocked, so the violation still ships green.
3. **It is a prohibition or an obligation, not a description.** "This project uses Postgres" is a
   fact for the README. "Never fetch X by id alone" is an invariant.
4. **It is specific to THIS repo** — names the real column, function, module, or config key. If the
   sentence would be equally true of another project, it is a platitude. DROP IT.

## 2. Sweep these five surfaces FIRST

The highest-value invariants have **no in-tree caller**, which is exactly why no test can exercise
them and why reading the source alone misses them. Check each and report what you found, even if the
answer is "none":

- [ ] **(a) Public API / ABI consumed outside the repo** — plugin interfaces, exported types, anything
      a third party compiles or links against. Breaking it breaks someone who is not in this tree.
- [ ] **(b) On-disk and wire formats read by a DIFFERENT VERSION** — persisted state, upgrade paths,
      mixed-version clusters, rolling deploys. The other reader is a past or future build, so no
      current test covers the pair.
- [ ] **(c) Config schemas a user already has on disk** — a field rename silently ignores their setting.
- [ ] **(d) Files a bot or codegen round-trips** — locale/translation files, generated clients, schema
      dumps. A hand edit is silently reverted on the next sync and nothing fails.
- [ ] **(e) Concurrency and ordering** — is a handler/module/service a **single shared instance**, so
      per-request state on the receiver races? Must two writes land in one transaction or does a crash
      between them corrupt state? Index alignment when results return from a parallel fan-out. These
      are silent because the race detector only catches what the tests exercise, and suites are
      usually serial — so a real race ships green.

**Multi-runtime repos** (server + web + mobile + worker, or several language roots): run the full
sweep **once per runtime** and say which you swept. Covering only the server implies the others have
no invariants, which is false and is itself a misleading claim.

## 3. Write each one in this shape

    - **<short name>.** <rule, imperative>. <WHY THE GAP GETS WRITTEN — the trap that makes a
      competent developer miss it>. <what to do instead, naming the real symbol>.

The middle clause is the value. "Always scope queries" is useless. "Single-record fetches are
protected by a policy check, so it is natural to assume list endpoints are too — they are not" is the
product.

## 4. Hard constraints

- **Never name a symbol you did not read.** If you cannot point to the function, type, key or file you
  opened, **delete the clause** — do not invent a plausible name to satisfy the format. A rule without
  its mechanism is weaker but honest; a rule with a fabricated mechanism is a hallucination wearing a
  citation.
- **No line numbers, no file counts, no version stamps, no dates.** These are decay pointers: they
  become confidently-wrong instructions the moment code moves. Name files and symbols, never positions.
- **No CI-state assertions** ("this job is set to `continue-on-error`") and **no unverifiable
  absolutes** ("no test covers this"). You have not read every test. State what the mechanism does not
  cover, not that nothing does.
- **No empty sections.** Never write "N/A — no database here". Omit the topic.
- **Do not pad.** If only two candidates survive, ship two. Rank by blast radius (data exposure > data
  corruption > correctness > operability) and cut the tail. Expect to discard most candidates —
  two-thirds is normal, and discarding well is the point.
- **The sweep log and discards do NOT go in the file.** Put them in the PR description. Methodology is
  read once; loaded on every agent turn it is pure cost and invites re-litigating settled ground.
- **Open with one line saying it is a starting set, not a survey.** Implying completeness is itself a
  false claim.
- If nothing qualifies, say **"No silent invariants found."** and stop. That is a real result and far
  better than filler.

## 5. Before proposing the edit

- [ ] Would every line still be true after a refactor that moves code around?
- [ ] Could the maintainer paste this in without deleting branding, hedges, or apologies?
- [ ] Is every claim traced to a line you actually read?
- [ ] **Does anything in the host file contradict a bullet?** Say so explicitly and propose deleting
      the stale sentence — a descriptive file that is wrong about a hazard is worse than silent.
- [ ] Within 25 lines?

Then remind the human to run `groundrules generate` so every adapter picks it up.
