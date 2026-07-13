- **TypeScript strict** (`strict: true`); no `any` — use `unknown` + narrowing. Prefer explicit return
  types on exported functions.
- Named exports over default exports; keep modules focused.
- `async/await` with real error handling — no floating promises, no swallowed rejections.
- Validate external data at the boundary (e.g. `zod`/`valibot`) before trusting its shape.
- Follow the repo's ESLint + Prettier config; run the lint/format script before finishing. Don't
  reformat unrelated lines.
- React: components do one thing; keep effects minimal and dependency arrays correct; no secrets in
  client code.
