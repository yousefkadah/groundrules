- Run `go test ./...` (add `-race` for concurrency); for the narrowest, `go test -run TestName ./pkg/...`.
  Paste command + output.
- Prefer **table-driven tests**; use subtests (`t.Run`) for cases.
- Keep tests hermetic — no real network; use `httptest` for HTTP. Cover the error paths, not just success.
