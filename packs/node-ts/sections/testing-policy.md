- **Discover the test command from `package.json` scripts** — the repo may use **Bun / Deno / Node**, not
  npm + Vitest. Run the repo's runner; if it targets multiple runtimes (Node/Bun/Deno/edge), run the affected ones.
- Run the narrowest test matching the repo's convention; paste command + output. Colocate tests
  (`*.test.ts`) or follow the repo's layout.
- Prefer testing behavior through the public API over asserting on internals. Mock the network, not your
  own modules.
- **Type tests for public generic APIs** (positive + negative — e.g. `expectTypeOf` / `tsd`): runtime
  assertions alone don't protect type inference. Type-check as part of "done" (`tsc --noEmit` or the build).
