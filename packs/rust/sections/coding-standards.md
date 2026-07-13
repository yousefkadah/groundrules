- `cargo fmt` clean and **`cargo clippy`** with the repo's lint level (many crates `deny(warnings)`);
  fix lints, don't `allow` them away.
- Propagate errors with `Result` + `?` and a real error type (`thiserror`/`anyhow` as the crate uses).
  **No `unwrap()`/`expect()` in library code** on fallible paths — reserve them for tests/`main` with a
  clear message.
- Respect ownership/borrowing; avoid needless `clone()`. Keep `unsafe` out unless justified and
  documented with its invariants. Honor the crate's `edition` and feature flags.
- Public items get doc comments; keep modules small and the API surface intentional.
