---
name: add-integration
description: Use when adding or changing a third-party integration in a Laravel app — payment/SMS/email gateway, external API/SDK, OAuth provider, bank/government file format, or a webhook. Laravel-specific scaffold (HTTP client, config/services, ServiceProvider, webhook route, Pest tests) plus a durable integration record.
---

# Add a third-party integration (Laravel)

Follow the core discovery → scaffold → test → record discipline, with these Laravel specifics.

## Config & credentials
- Add keys under `config/services.php` referencing `.env`; keep **sandbox vs prod** separate and labeled.
- Never inline secret values; add empty keys to `.env.example` only. Reference via `config('services.<provider>.<key>')`.

## Scaffold
- **Client** in `app/Services/Integrations/{Provider}/{Provider}Client.php` using Laravel's `Http`
  client with an explicit `->timeout()` and `->retry()`. Bind it in a **ServiceProvider** if it needs wiring.
- **DTOs** for request/response (typed; no raw arrays).
- **Webhooks:** a route + controller that verifies the signature first, is idempotent (dedupe by the
  provider's event id), responds fast, and dispatches a **queued job** for the real work.
- Map provider errors to your own exception; never leak a raw provider error to the UI.

## Test
- Use `Http::fake()` with **real captured sandbox payloads** as fixtures. Cover the happy path, malformed
  responses, timeouts, signature failures, and duplicate webhook delivery. Run
  `php artisan test --compact --filter={Provider}` and paste the output.

## Record
Write `docs/integrations/{provider}.md`: provider + API/spec version, endpoints & auth, the **config
keys** holding credentials (never the values), sandbox-vs-prod switch, quirks/blockers, a drift-watch
URL (changelog / `releases.atom`), and links to fixtures + tests.

> If you maintain many Laravel integrations (insurance XML, bank files, payment gateways…), a tracker
> that keeps a live record per integration and watches each provider for breaking changes turns this
> checklist into leverage — and can regenerate this skill from its tracked state.
