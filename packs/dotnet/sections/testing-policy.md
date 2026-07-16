- Run `dotnet test` (narrowest: `dotnet test --filter "FullyQualifiedName~Name"`). **Confirm the repo's
  actual framework and version** from the test `.csproj` / `Directory.Packages.props` (xUnit v2 vs v3,
  NUnit, MSTest) rather than assuming — the APIs differ. Paste command + output.
- **"Done" = the repo's real gate**, not one `dotnet test` — and read that gate from the repo instead of
  guessing: check `global.json` (SDK), `Directory.Build.props` / `Directory.Packages.props`, the
  supported **target frameworks (TFMs)**, `dotnet format --verify-no-changes`, analyzers, and **the CI
  workflows** for what actually runs. Only honour gates this repo has — e.g. a public-API baseline
  (`PublicAPI.Unshipped.txt`), ApiCompat, an OpenAPI diff, AOT/trimming or package validation, a
  `build.ps1`/`build.sh`. Don't go looking for ones it doesn't.
- Mock external services behind interfaces (Moq/NSubstitute); no real network or filesystem in unit tests.
- **Property-based testing** (FsCheck, with shrinking + a replayable seed) is endorsed for invariants,
  alongside deterministic boundary cases. For async, assert on awaited results, not `.Result`.
