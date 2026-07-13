**The rule: every behavioral change ships with a test** — new or updated — and the affected tests are
run and shown to pass before the change is considered done. The stack pack below names the exact test
runner and command.

- Cover the **happy path and at least one failure path** (invalid input, timeout, unauthorized).
- Test against **realistic data / fixtures**, not hand-typed samples — especially for parsing,
  serialization, money, and anything crossing a boundary.
- Prove **isolation** where it matters (multi-tenant, multi-user): actor A must not read or mutate
  actor B's data.
- Run the **narrowest** command that proves the change, not the whole suite, and **paste the command +
  its output** as evidence. "Tests pass" without output is not acceptable.
- Never delete or skip a test to make a change go green — fix the change or surface the conflict.

### Node / TypeScript specifics

- Use the project's runner (Vitest or Jest). Run the narrowest: `npm test -- <pattern>` (or
  `pnpm test <pattern>`), and paste the command + output.
- Colocate tests (`*.test.ts`) or follow the repo's existing convention.
- Prefer testing behavior through the public API over asserting on internals. Mock the network, not your
  own modules.
- Type-check as part of "done" (`tsc --noEmit` or the build) — a green test with a type error is not done.
