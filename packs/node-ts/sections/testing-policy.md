- Use the project's runner (Vitest or Jest). Run the narrowest: `npm test -- <pattern>` (or
  `pnpm test <pattern>`), and paste the command + output.
- Colocate tests (`*.test.ts`) or follow the repo's existing convention.
- Prefer testing behavior through the public API over asserting on internals. Mock the network, not your
  own modules.
- Type-check as part of "done" (`tsc --noEmit` or the build) — a green test with a type error is not done.
