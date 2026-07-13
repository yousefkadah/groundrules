- `gofmt`/`goimports` clean; pass `go vet` and the repo's linter (golangci-lint) before finishing.
- Handle every error explicitly; wrap with context (`fmt.Errorf("doing X: %w", err)`) — but **preserve
  sentinel errors** so `errors.Is`/`errors.As` consumers keep working; don't wrap in a way that breaks the contract.
- `context.Context` is the **first** parameter for anything I/O-bound or cancellable; don't store it in structs.
- Accept interfaces, return concrete types; keep interfaces small and defined by the consumer.
- Guard shared state (mutex/channels); run `go test -race` on concurrent code. No naked returns in long functions.
- **The public API is the contract:** for a library/CLI, preserve exported identifiers, sentinel errors,
  command names, **flags, help text, and shell completions** across changes. Stay compatible with the
  `go.mod` version and the **lowest Go version CI builds**.
- **Commands (Cobra-style):** take `cmd.Context()`, write to the command's configured out/err writers (not
  `os.Stdout` / `fmt.Print`), and **return errors** — don't `os.Exit`/`panic` from library code.
- **Semantic import versioning:** a v2+ release needs the `/vN` suffix in the module path and imports;
  otherwise keep v1 compatible and deprecate before removing.
- **CLI safety:** quote/escape generated shell completions, don't emit raw terminal control sequences into
  untrusted output, and be careful with subprocess arguments and generated-file paths (traversal/symlinks).
