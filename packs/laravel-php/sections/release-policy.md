- After changing views, translations, or mail/PDF templates, **restart queue workers**
  (`php artisan horizon:terminate` — it does not auto-respawn stale workers) or queued jobs render stale output.
- Rebuild the frontend when assets change: `npm run build`.
- Migrations: note ordering and any data backfill; never run destructive migrations without approval.
