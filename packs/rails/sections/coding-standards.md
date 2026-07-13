- Follow the repo's **RuboCop** config; run it before finishing. Match the app's structure — service
  objects / interactors / concerns as the repo already uses them; don't impose a different architecture.
- **Strong Parameters** for all mass assignment (`params.require(...).permit(...)`) — never `permit!`.
  Authorize with the repo's tool (Pundit/CanCanCan) at every action.
- No N+1 — use `includes`/`preload`; the repo may enforce this with Bullet. Prefer scopes over raw
  `where` scattered across the app.
- Secrets via Rails **credentials** or ENV — never committed. Money via a money gem or integer cents.
- Keep migrations reversible and reviewed (see the `add-database-change` skill); use `strong_migrations`
  patterns if present.
