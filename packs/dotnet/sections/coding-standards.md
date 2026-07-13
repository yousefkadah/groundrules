- Enable/honor **nullable reference types**; don't suppress warnings with `!` unless provably safe.
- **`async` all the way** — no `.Result`/`.Wait()` (deadlocks); pass `CancellationToken` through; suffix
  async methods `Async`.
- Constructor **dependency injection**; program to interfaces; keep controllers/handlers thin.
- Run `dotnet format` and honor the repo's `.editorconfig`/analyzers before finishing.
- Secrets via **user-secrets**/environment/Key Vault — never in `appsettings.json` committed to the repo.
- Dispose `IDisposable` (prefer `using`); validate input at the boundary (model validation / FluentValidation).
