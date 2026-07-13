---
name: write-tests
description: Use when adding or fixing tests. Covers what to cover (happy + failure paths, isolation), using fixtures/factories over hand-typed data, and running the narrowest command with evidence.
---

# Write tests

The stack pack names the exact test runner + command; this is the discipline.

## Cover the right things
- [ ] The happy path **and** at least one failure path (invalid input, timeout, unauthorized).
- [ ] Isolation where it matters: actor A cannot read/mutate actor B's data.
- [ ] Boundaries (parsing, serialization, money, file formats): assert on **real fixtures** and on
      malformed input, not just clean samples.

## Keep tests honest
- [ ] Use the project's factories/fixtures, not hand-built objects.
- [ ] One behavior per test; a clear name that states the expectation.
- [ ] Don't assert on incidental details that make the test brittle.

## Finish
- [ ] Run the **narrowest** command that proves it; paste the command + output as evidence.
- [ ] Never delete or skip an existing test to go green — fix the change or surface the conflict.
