- `declare(strict_types=1)` in every new PHP file; typed params + return types; constructor property
  promotion; curly braces on all control structures.
- Use `php artisan make:*` generators — don't hand-roll files the framework scaffolds.
- Validate in **Form Requests**; authorize in **Policies**. No inline `$request->validate()` for
  non-trivial rules.
- Never introduce an N+1 — eager-load. Push slow/external work to **queued jobs**.
- Prefer named routes + the `route()` helper. For framework facts (APIs, signatures, schema) consult
  **Laravel Boost** (`search-docs`, `database-schema`, `list-routes`) rather than guessing.
- Money as integer minor units, never floats. Multi-tenant apps: **scope every query** — a cross-tenant
  read/write is a security bug.
- Run `vendor/bin/pint --dirty` before finishing.
