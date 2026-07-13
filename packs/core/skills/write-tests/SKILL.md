---
name: write-tests
description: Use when adding or fixing tests. Covers what to cover (happy + failure paths, isolation), faking external I/O, deterministic factory states, and running the narrowest command with evidence.
---

# Write tests

The stack pack names the exact test runner + command; this is the discipline.

## Cover the right things
- [ ] Happy path **and** at least one failure path (invalid input, timeout, unauthorized).
- [ ] Isolation where it matters: actor A cannot read/mutate actor B's data (assert at the entry point).
- [ ] Boundaries (parsing, serialization, money, file formats): assert on **sanitized** fixtures and on
      malformed input; for fixed-width/XML assert byte/schema-exact output.

## Keep tests honest and hermetic
- [ ] **Fake external I/O** — HTTP, mail, queues, notifications, storage, and the clock. No real network
      or shared-state mutation; block stray requests.
- [ ] Prefer **deterministic factory states and explicit edge values** for the behavior under test —
      not broad random data (flaky). Use the project's factories for **persisted** state; a plain
      constructor/builder is fine for pure-unit behavior on unsaved objects.
- [ ] **Property-based testing** (with shrinking + a replayable seed — FsCheck / proptest / fast-check /
      Hypothesis) is excellent for invariants; use it alongside deterministic boundary examples, not
      unseeded randomness.
- [ ] Before a suite that wipes/migrates the DB, confirm it targets a **disposable** database (testing
      env + test connection), never a real one.
- [ ] One behavior per test; a clear name stating the expectation. Don't assert incidental details.

## Finish
- [ ] Run the **narrowest** command that proves it; paste the command + output as evidence.
- [ ] Never delete or skip an existing test to go green — fix the change or surface the conflict.
