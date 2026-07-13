- After changing views, translations, or mail/PDF templates, **restart queue workers so they don't
  render stale output**: `php artisan queue:restart` — **or `php artisan horizon:terminate` if the repo
  uses Horizon** (check `composer.json`). If `QUEUE_CONNECTION=sync`, no restart is needed.
- Rebuild the frontend when assets change with the repo's package manager: **`yarn build` / `npm run
  build` / `pnpm build`** (check the lockfile).
- Migrations: note ordering and backfill; prefer expand-contract; test on the engines CI uses
  (SQLite/MySQL/PostgreSQL differ); never run destructive migrations against real data without approval.
