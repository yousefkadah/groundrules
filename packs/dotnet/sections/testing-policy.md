- Run `dotnet test` (narrowest: `dotnet test --filter "FullyQualifiedName~Name"`); use the repo's
  framework (**xUnit / NUnit / MSTest** — match neighbors). Paste command + output.
- **"Done" = the repo's full gate**, not one `dotnet test`: build/test across the **supported target
  frameworks (TFMs)**, run analyzers, update the **public-API baseline** (`PublicAPI.Unshipped.txt`) for
  API changes, and run AOT/trimming + package validation and the repo's build script
  (`build.ps1`/`build.sh`) when relevant.
- Mock external services behind interfaces (Moq/NSubstitute); no real network or filesystem in unit tests.
- **Property-based testing** (FsCheck, with shrinking + a replayable seed) is endorsed for invariants,
  alongside deterministic boundary cases. For async, assert on awaited results, not `.Result`.
