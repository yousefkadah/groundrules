- New PHP files: follow the repo's conventions — `declare(strict_types=1)`, typed params + return types,
  and constructor promotion **where the codebase already uses them** (match neighbors). Don't
  unilaterally flip a style the repo hasn't adopted.
- **Validate + authorize through the layer the repo already uses.** Form Requests + Policies in many
  apps; a **Service/Action layer** (validation rules + an owner/permission check inside the class) in
  others. Grep for `extends FormRequest`, `Policy`, and `app/**/Services|Actions` and follow the
  dominant pattern — do **not** introduce Form Requests/Policies into a service-layer codebase. **Always
  allow-list input** (explicit fields): in Form Request codebases use `$request->validated()`, in
  service-layer codebases validate inside the service. **Never** pass `$request->all()` into
  `create`/`update`/`fill`; respect `$fillable`/`$guarded`.
- No N+1 — eager-load. **Queue** slow/external work when semantics allow (see the `run-background-job`
  skill): idempotent handlers, dispatch `afterCommit`, bounded retries, failed-job handling.
- **Scope tenant/owner isolation _everywhere_, not just queries** — cache keys, search-index (Scout)
  payloads, queued-job payloads, notifications, exports, signed URLs, and shared Inertia props must all
  carry the account/owner scope. Authorize the **owning parent** for nested resources (IDOR). Add
  cross-tenant tests at each boundary.
- Prefer named routes + the `route()` helper. **If Laravel Boost (or another docs/MCP tool) is
  available**, use it for version-aware framework facts; otherwise verify against `composer.lock` /
  `vendor` — don't guess.
- **Config-cache safety:** call `env()` **only** inside `config/*` files; read config at runtime via
  `config()`; verify with cached config (`php artisan config:cache`) when you change config.
- Money as integer minor units or the repo's money type, never floats.
- Prefer `php artisan make:*` generators, then **move the output to the repo's layout** (domain/module
  namespace) if it differs from the framework default — match the neighbor.
- **"Done" = the repo's full static gate**, not just the formatter: `vendor/bin/pint` **plus** any
  configured Larastan/PHPStan (`phpstan.neon`) and Psalm (`psalm.xml`), and the frontend `lint`/`build`
  if assets changed. Check `composer.json` scripts / CI. Never silence findings with `@phpstan-ignore`
  or baseline edits just to go green.
