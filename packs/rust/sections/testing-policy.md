- Run `cargo test` (narrowest: `cargo test <name>`); add `--all-features`/workspace flags the repo uses.
  Paste command + output.
- **"Done" includes `cargo fmt --check` and `cargo clippy`** — a green test with clippy warnings isn't done.
- Unit tests in-module under `#[cfg(test)]`; integration tests in `tests/`. Keep tests hermetic — no real
  network (use a mock server); cover the error paths, not just `Ok`.
