- Run `dotnet test` (narrowest: `dotnet test --filter "FullyQualifiedName~Name"`). Paste command + output.
- Use the repo's framework (**xUnit / NUnit / MSTest** — match neighbors). Mock external services behind
  interfaces (Moq/NSubstitute); no real network or filesystem in unit tests.
- Cover the happy path **and** a failure path; for async code assert on awaited results, not `.Result`.
