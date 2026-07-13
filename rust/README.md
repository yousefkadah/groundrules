# groundrules — Rust binary

A **node-free, single-binary** build of [Groundrules](https://github.com/yousefkadah/groundrules). The
content packs (`../packs`) are embedded at compile time via `include_dir`, so the binary needs no Node,
no network, and no files beside it.

## Install (Homebrew)

```bash
brew install yousefkadah/tap/groundrules
```

## Build from source

```bash
cargo build --release
./target/release/groundrules --help
```

## Usage

Identical to the npm CLI:

```bash
groundrules init        # detect stack, scaffold .ai/, generate adapters
groundrules generate    # re-sync adapters from .ai/
groundrules check       # CI drift gate (exit 1 on drift)
groundrules detect      # print detection only
```

Flags: `--dry-run`, `--force`, `--tools=a,b`, `--all`, `--cwd=PATH`.

## Relationship to the npm package

The JavaScript package (`@yousefkadah/groundrules`) is the **reference implementation** and the source of
truth for the `packs/`. This crate embeds the same packs and mirrors the engine's behavior (create-only
`.ai/`, managed-block adapters, symlink-safe atomic writes, deterministic ordering). Behavior parity is
covered by the JS smoke suite; keep the two in step when changing engine logic.
