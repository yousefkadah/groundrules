- **TypeScript strict** (`strict: true`); avoid `any` — prefer `unknown` + narrowing, and explicit return
  types on exported functions. Apply "no `any`" as an **internal default**, not an absolute: a public
  type-algebra API may need a documented, localized `any` — cover it with a type test.
- Named exports over default exports for **new** code — but don't rewrite existing public export shapes.
- `async/await` with real error handling — no floating promises, no swallowed rejections.
- Validate external data at the boundary (e.g. `zod`/`valibot`) before trusting its shape.
- Follow the repo's ESLint + Prettier config; run the lint/format script before finishing. Don't reformat
  unrelated lines.
- **Libraries — the public API is a SemVer contract, and that includes the _types_:** inferred/generic
  types and the `exports` map (subpath exports, ESM + CJS `types`). Validate exports before a release
  (`publint`, `@arethetypeswrong/cli`) and add consumer + type tests.
- React: components do one thing; keep effects minimal and dependency arrays correct; no secrets in
  client code.
