- Run `go test ./...` (add `-race` for concurrency); for the narrowest, `go test -run TestName ./<real/pkg>/...`
  — use the repo's **actual** package path, don't assume `./pkg/...`. Paste command + output.
- Prefer **table-driven tests**; use subtests (`t.Run`) for cases.
- **CLIs / commands:** build a fresh command, set its args, capture stdout/stderr, and assert the output,
  exit / usage / error behavior, and **exact help + completion output**; cover relevant OS / build-tag variants.
- Keep tests hermetic — no real network; use `httptest` for HTTP. Cover the error paths, not just success.
