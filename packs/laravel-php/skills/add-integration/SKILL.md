---
name: add-integration
description: Use when adding or changing a third-party integration in a Laravel app — payment/SMS/email gateway, external API/SDK, OAuth provider, bank/government file format, or a webhook. Laravel-specific scaffold (HTTP client, config/services, webhook route, tests) plus a durable integration record.
---

# Add a third-party integration (Laravel)

Follow the core discovery → scaffold → test → record discipline, with these Laravel specifics.

## Config & credentials
- Add keys under `config/services.php` referencing `.env`; keep **sandbox vs prod** separate and labeled.
- Never inline secret values; add empty keys to `.env.example` only. Reference via `config('services.<provider>.<key>')`.

## Scaffold (match the repo's layout)
- Put the **client where the repo already groups services** — match neighbors (e.g. `app/Services/...`,
  `app/Domains/*/Services`, a dedicated integration namespace). Don't hardcode a path the repo doesn't use.
- Use Laravel's `Http` client with an explicit `->timeout()`. **Retry only defined transient failures**
  (timeouts / 5xx / 429) with exponential backoff + jitter — **never blindly retry non-idempotent
  POSTs**; send an **idempotency key** or make the call provably idempotent.
- **Outbound safety:** call only fixed/allow-listed hosts (guard against SSRF), don't follow redirects
  to new hosts, verify TLS, **bound the response size**, redact secrets from logs, honor the provider's
  rate limits, and support credential **rotation** (no single hard-pinned key).
- **DTOs** for request/response (typed; no raw arrays). Map provider errors to your own exception; never
  leak a raw provider error to the UI.
- **Webhooks:** verify the signature against the **raw request body** with a timestamp tolerance (replay
  window), record the provider's event id in a **unique** column to dedupe atomically, narrowly exempt
  the route from CSRF, respond fast, and dispatch a **queued job** for the work.
- **OAuth:** validate `state`, use PKCE, request minimal scopes, and store tokens encrypted.

## Test (use the repo's runner)
- `Http::fake()` with **sanitized/synthetic** fixtures — never raw sandbox payloads that may carry PII,
  credentials, or signatures. Cover happy path, malformed responses, timeouts, signature failures, and
  duplicate webhook delivery. Run the repo's runner (`php artisan test --filter={Provider}`), paste output.

## Record
Write `docs/integrations/{provider}.md`: provider + API/spec version, endpoints & auth, the **config
keys** holding credentials (never the values), sandbox-vs-prod switch, quirks/blockers, a drift-watch
URL (changelog / `releases.atom`), and links to fixtures + tests.

> If you maintain many Laravel integrations (insurance XML, bank files, payment gateways…), a tracker
> that keeps a live record per integration and watches each provider for breaking changes turns this
> checklist into leverage — and can regenerate this skill from its tracked state.
