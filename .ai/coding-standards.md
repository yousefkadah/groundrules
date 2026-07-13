These principles are stack-agnostic. Language- and framework-specific rules are added below by the
active stack pack — those win on any concrete detail (commands, idioms, file layout).

- **Match the neighbors.** Before writing a file, read a sibling in the same area and mirror its
  structure, naming, and idioms. Consistency beats personal preference.
- **Reuse before creating.** Look for an existing function/component/helper before adding one.
- **Small, reviewable changes.** One concern per change. If the task sprawls, stop and propose a plan
  before continuing.
- **Descriptive names.** `isEligibleForRefund`, not `check()`. Names should say what, not how.
- **Types and contracts at the edges.** Prefer explicit types/interfaces on public functions and data
  crossing a boundary (HTTP, DB, queue, third-party).
- **Handle the unhappy path.** Nulls, empties, timeouts, and permission denials are part of the
  feature, not an afterthought.
- **Comment the why, not the what.** Only annotate genuinely non-obvious logic.
- **Keep diffs tight.** No drive-by reformatting of lines you didn't change. Run the project's
  formatter/linter before finishing.
- **Reference code as `path/to/file:line`** so humans can click straight to it.

### Node / TypeScript specifics

- **TypeScript strict** (`strict: true`); no `any` — use `unknown` + narrowing. Prefer explicit return
  types on exported functions.
- Named exports over default exports; keep modules focused.
- `async/await` with real error handling — no floating promises, no swallowed rejections.
- Validate external data at the boundary (e.g. `zod`/`valibot`) before trusting its shape.
- Follow the repo's ESLint + Prettier config; run the lint/format script before finishing. Don't
  reformat unrelated lines.
- React: components do one thing; keep effects minimal and dependency arrays correct; no secrets in
  client code.
