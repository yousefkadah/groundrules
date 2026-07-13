- Enable/honor **nullable reference types**; don't suppress with `!` unless provably safe.
- **Async:** never block on async (`.Result`/`.Wait()` deadlock); flow `CancellationToken`; suffix async
  methods `Async`; use `ValueTask` where the API does. A **library that exposes both sync and async paths
  should keep them separate — don't bridge** (no sync-over-async or async-over-sync).
- **App-only rules** (constructor-DI wiring, thin controllers, request/model validation, FluentValidation)
  apply to **app/host** projects — **not to libraries**; a library shouldn't grow public DI/interface
  surface it doesn't need. Match the project type.
- **Time:** prefer an injected `TimeProvider` (or the repo's clock abstraction) over `DateTime.UtcNow` in
  timing logic, so it's testable with virtual time.
- **`[Obsolete]`:** don't call obsolete APIs in **new** code, but maintaining/testing the supported legacy
  API is fine (scoped suppression).
- **Libraries — thread-safety & hot paths:** make shared state thread-safe; hold no locks across user
  callbacks; be allocation-conscious on hot paths (`ValueTask`, cached/static state); handle disposal and
  races. Add benchmarks for hot-path changes.
- Run `dotnet format`; honor `.editorconfig`/analyzers. Secrets via user-secrets/env/Key Vault — never in
  a committed `appsettings.json`. Dispose `IDisposable` (prefer `using`).
