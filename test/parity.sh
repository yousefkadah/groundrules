#!/usr/bin/env bash
#
# JS <-> Rust byte-parity gate.
#
# Groundrules ships two engines: the npx Node CLI (the reference) and a node-free
# Rust binary (brew). They MUST produce byte-identical output for init/import/
# generate, or `groundrules check` would disagree between npx and brew users and
# the drift gate would flap. This script builds both, runs them across a fixture
# matrix, and fails on any difference. Run locally: `bash test/parity.sh`.
#
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE_BIN="$ROOT/bin/groundrules.js"
RUST_BIN="$ROOT/rust/target/release/groundrules"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
fail=0

echo "==> building rust release binary"
( cd "$ROOT/rust" && cargo build --release --quiet ) || { echo "cargo build failed"; exit 1; }

node_run() { node "$NODE_BIN" "$@"; }
rust_run() { "$RUST_BIN" "$@"; }

# compare NAME CMD SETUP [FLAGS...] — seed a node dir and a rust dir identically,
# run <cmd> in each, and diff every generated file.
compare() {
  local name="$1" cmd="$2" setup="$3"; shift 3
  local nd="$WORK/$name-n" rd="$WORK/$name-r"
  mkdir -p "$nd" "$rd"
  ( cd "$nd" && eval "$setup" ); ( cd "$rd" && eval "$setup" )
  node_run "$@" "$cmd" --cwd="$nd" >/dev/null 2>&1
  rust_run "$@" "$cmd" --cwd="$rd" >/dev/null 2>&1
  if diff -r "$nd" "$rd" >/dev/null 2>&1; then
    echo "  ok   $name"
  else
    echo "  FAIL $name"; diff -r "$nd" "$rd" 2>&1 | sed "s#$WORK/##g" | head -25; fail=1
  fi
}

# cross-check: the Rust binary checks a NODE-generated repo (and vice-versa) —
# both must report in-sync. This is the real npx-dev / brew-CI scenario.
cross_check() {
  local name="$1"
  local nd="$WORK/$name-n" rd="$WORK/$name-r" a b
  rust_run check --cwd="$nd" >/dev/null 2>&1 && a=sync || a=drift
  node_run check --cwd="$rd" >/dev/null 2>&1 && b=sync || b=drift
  if [ "$a" = sync ] && [ "$b" = sync ]; then
    echo "  ok   cross-check $name"
  else
    echo "  FAIL cross-check $name (rust-on-node=$a, node-on-rust=$b)"; fail=1
  fi
}

# optout_agree LABEL STRING — both engines must AGREE whether STRING is an
# AI-opt-out (drives the drift-gate skip). Made stale so the exit codes differ
# only if the detectors disagree.
optout_agree() {
  local label="$1" str="$2"
  local nd="$WORK/oo-$label-n" rd="$WORK/oo-$label-r" ne re
  mkdir -p "$nd" "$rd"
  printf 'module x\n' > "$nd/go.mod"; printf 'module x\n' > "$rd/go.mod"
  node_run --tools=agents init --cwd="$nd" >/dev/null 2>&1
  rust_run --tools=agents init --cwd="$rd" >/dev/null 2>&1
  printf '\n- extra rule\n' >> "$nd/.ai/coding-standards.md"; printf '\n<!-- %s -->\n' "$str" >> "$nd/AGENTS.md"
  printf '\n- extra rule\n' >> "$rd/.ai/coding-standards.md"; printf '\n<!-- %s -->\n' "$str" >> "$rd/AGENTS.md"
  node_run --tools=agents check --cwd="$nd" >/dev/null 2>&1; ne=$?
  rust_run --tools=agents check --cwd="$rd" >/dev/null 2>&1; re=$?
  if [ "$ne" = "$re" ]; then echo "  ok   opt-out agree ($label)"; else echo "  FAIL opt-out disagree ($label): node=$ne rust=$re"; fail=1; fi
}

echo "==> init parity across stacks"
compare bare         init "echo '# r' > README.md"
compare laravel      init "printf '{\"require\":{\"laravel/framework\":\"^12\"}}' > composer.json; touch artisan"
compare laravel_vue  init "printf '{\"require\":{\"laravel/framework\":\"^12\"}}' > composer.json; touch artisan; printf '{\"dependencies\":{\"vue\":\"^3\",\"@inertiajs/vue3\":\"^1\"}}' > package.json"
compare python       init "touch manage.py; printf '[tool.ruff]\n' > pyproject.toml"
compare go           init "printf 'module x\n' > go.mod"
compare node_ts      init "printf '{\"devDependencies\":{\"typescript\":\"^5\"}}' > package.json; touch tsconfig.json"
compare rails        init "mkdir -p bin; touch bin/rails"
compare rust_stack   init "printf '[package]\nname=\"x\"\n' > Cargo.toml"
compare dotnet       init "printf '<Project />' > App.csproj"
compare all_adapters init "printf '[package]\nname=\"x\"\n' > Cargo.toml" --all
compare tools_subset init "printf '{\"require\":{\"laravel/framework\":\"^12\"}}' > composer.json; touch artisan" --tools=agents,cursor

echo "==> cross-tool drift check"
cross_check laravel_vue
cross_check go

echo "==> import parity"
compare imp_small init "printf 'module x\n' > go.mod; printf '# House\n\n- Money in agorot.\n' > CLAUDE.md; printf 'Prefer Tailwind.\n' > .cursorrules"
compare imp_large init "printf 'module x\n' > go.mod; { echo '# Big'; seq 1 70 | sed 's/.*/- imported rule & with detail/'; } > CLAUDE.md"
compare imp_crlf  init "printf 'module x\n' > go.mod; printf '# R\r\n\r\nUse tabs.\r\nWrite tests.\r\n' > CLAUDE.md"
compare imp_dedup init "printf 'module x\n' > go.mod; printf '# A\n\n## Shared\n\n- a shared line\n- b shared line\n- c shared line\n\n- uniq A only\n' > AGENTS.md; printf '# C\n\n## Shared\n\n- a shared line\n- b shared line\n- c shared line\n\n- uniq C only\n' > CLAUDE.md"
# import cases run `init` above only to seed; re-run them as imports:
for c in imp_small imp_large imp_crlf imp_dedup; do rm -rf "$WORK/$c-n" "$WORK/$c-r"; done
compare imp_small import "printf 'module x\n' > go.mod; printf '# House\n\n- Money in agorot.\n' > CLAUDE.md; printf 'Prefer Tailwind.\n' > .cursorrules"
compare imp_large import "printf 'module x\n' > go.mod; { echo '# Big'; seq 1 70 | sed 's/.*/- imported rule & with detail/'; } > CLAUDE.md"
compare imp_crlf  import "printf 'module x\n' > go.mod; printf '# R\r\n\r\nUse tabs.\r\nWrite tests.\r\n' > CLAUDE.md"
compare imp_dedup import "printf 'module x\n' > go.mod; printf '# A\n\n## Shared\n\n- a shared line\n- b shared line\n- c shared line\n\n- uniq A only\n' > AGENTS.md; printf '# C\n\n## Shared\n\n- a shared line\n- b shared line\n- c shared line\n\n- uniq C only\n' > CLAUDE.md"
# symlinked adapter target (the zod pattern: CLAUDE.md -> AGENTS.md) — both engines must skip it
compare imp_symlink init "printf 'module x\n' > go.mod; printf '# rules\n\n- do a thing\n' > AGENTS.md; ln -s AGENTS.md CLAUDE.md"

echo "==> archetype gating parity (both engines must classify AND gate identically)"
compare arch_web_node init "printf '{\"dependencies\":{\"express\":\"^4\"}}' > package.json"
compare arch_cli_node init "printf '{\"bin\":{\"x\":\"c.js\"}}' > package.json"
compare arch_library  init "printf '{\"name\":\"lib\",\"exports\":\"./i.js\"}' > package.json"
compare arch_cli_go   init "printf 'module x\nrequire github.com/spf13/cobra v1.8.0\n' > go.mod"
compare arch_cli_py   init "printf '[project.scripts]\nx = \"m:c\"\n' > pyproject.toml"
compare arch_lib_rust init "printf '[package]\nname=\"x\"\n' > Cargo.toml; mkdir -p src; touch src/lib.rs"

echo "==> AI-opt-out detector agreement (drift-gate)"
optout_agree do_not_use  "Do not use AI or LLM tools in this repository."
optout_agree keys_ok     "This will not run without AI keys configured."
optout_agree no_ai_gen   "No AI-generated contributions are accepted."
optout_agree normal      "We use Laravel and write good tests."

echo ""
if [ "$fail" = 0 ]; then echo "PARITY OK — Node and Rust produce byte-identical output"; else echo "PARITY FAILED"; fi
exit "$fail"
