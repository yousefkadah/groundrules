- `cargo fmt --all` clean; run `cargo clippy` **if the repo uses it** (many do, with `deny(warnings)`) —
  otherwise keep `cargo build`/`cargo doc` warning-free. Don't `allow` lints away.
- Propagate errors with `Result` + `?` and the crate's error type (`thiserror`/`anyhow`, or a hand-rolled
  typed error — **match the crate's existing style**).
- **`unwrap()`/`expect()`:** forbidden on recoverable input/I/O paths; permitted for a **proven internal
  invariant** with a clear message — and document it with a `# Panics` section on public APIs.
- Respect ownership/borrowing; avoid needless `clone()`. Keep `unsafe`/FFI/`mmap` out unless justified,
  with its invariants documented.
- **Compatibility is a contract:** honor the crate's **MSRV** (`rust-version`) and edition; keep the
  public API, CLI flags/output, and exit codes stable; support the crate's platforms/targets and
  **feature flags** (build and test with *and without* optional features).
- **Data & paths:** don't assume UTF-8 — preserve bytes and non-UTF-8 paths (`OsStr`/`Path`/`[u8]`) where
  the crate does.
- **Performance:** keep hot paths allocation-conscious and streaming / bounded-memory; add or adjust
  **benchmarks** for search/parse/IO-hot changes.
- Public items get doc comments; keep the API surface intentional.
