- Follow the repo's **RuboCop** config; run it before finishing. Match the app's structure — service
  objects / interactors / concerns as the repo already uses them; don't impose a different architecture.
- **Strong Parameters** for all mass assignment (`params.require(...).permit(...)`) — never `permit!`.
- **Authorization + tenant isolation:** authorize with the repo's tool (**Pundit** / CanCanCan) at every
  action, **and** load account/tenant-owned records through the current scope (e.g. `Current.account.things`
  or an already-authorized parent) **before** the policy check — a top-level `Model.find(params[:id])` is
  a cross-account IDOR. Add cross-account request specs.
- No N+1 — use `includes`/`preload` (Bullet may enforce this). Prefer scopes over scattered raw `where`.
- **Real-time:** ActionCable subscriptions must authenticate and verify account membership; derive stream
  names server-side; keep every broadcast / Redis key tenant-scoped.
- Secrets via Rails **credentials** or ENV — never committed. Money via a money gem or integer cents.
- Migrations reversible and reviewed (see `add-database-change`); use `strong_migrations` patterns if
  present. Background work via **ApplicationJob** / Sidekiq (see `run-background-job`).
