- Run `cargo test` with the feature combos the repo uses (build/test **with and without** optional
  features as affected; `--workspace` for multi-crate). Paste command + output.
- **"Done" = the repo's CI gate**, not one green test: `cargo fmt --all --check`, `cargo test`, and — if
  adopted — `cargo clippy` and warning-free `cargo doc`.
- Prefer **table-driven** unit tests in-module (`#[cfg(test)]`). Register integration tests through the
  crate's existing harness (some set `autotests = false`) — don't just drop a file in `tests/`.
- For CLIs, **real isolated temp files + child processes are the point** — assert stdout, stderr, and
  exit status; don't "fake" the filesystem where the behavior *is* the filesystem.
- **Property-based tests** (`proptest`/`quickcheck`, with a replayable seed) are great for invariants,
  alongside deterministic boundary cases.
