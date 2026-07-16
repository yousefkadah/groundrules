#!/usr/bin/env bash
# PROTOTYPE study runner — measures the rules-lint precision across many real repos
# WITHOUT cloning: it fetches each repo's rules files + full git tree via the API,
# materialises a skeleton (empty files at every real path + the real manifests),
# and runs the linter against it. Path/extra/script checks only need the tree +
# manifests, so the skeleton is faithful for those rules.
#
# Usage: bash test/proto/rot-study.sh <repos-file>
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LINT="$ROOT/test/proto/rules-lint.js"
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT

RULES=(AGENTS.md CLAUDE.md .cursorrules GEMINI.md .github/copilot-instructions.md)
MANIFESTS=(package.json pyproject.toml Makefile)

while read -r repo; do
  [ -z "$repo" ] && continue
  d="$WORK/$(echo "$repo" | tr '/' '_')"; mkdir -p "$d"

  # 1) rules files (skip the repo entirely if it has none)
  got_rules=0
  for f in "${RULES[@]}"; do
    mkdir -p "$d/$(dirname "$f")"
    if curl -sfL "https://raw.githubusercontent.com/$repo/HEAD/$f" -o "$d/$f" 2>/dev/null && [ -s "$d/$f" ]; then got_rules=1; else rm -f "$d/$f"; fi
  done
  if [ "$got_rules" = 0 ]; then echo "{\"repo\":\"$repo\",\"skip\":\"no rules file\"}"; continue; fi

  # 2) real manifests (needed by the script/extra checks)
  for f in "${MANIFESTS[@]}"; do
    curl -sfL "https://raw.githubusercontent.com/$repo/HEAD/$f" -o "$d/$f" 2>/dev/null || rm -f "$d/$f"
  done

  # 3) skeleton of every real path in the tree, so path-existence is faithful
  gh api "repos/$repo/git/trees/HEAD?recursive=1" --jq '.tree[] | select(.type=="blob") | .path' 2>/dev/null \
    | head -12000 | while IFS= read -r p; do
        case "$p" in */*) mkdir -p "$d/$(dirname "$p")" 2>/dev/null;; esac
        [ -e "$d/$p" ] || : > "$d/$p" 2>/dev/null
      done
  gh api "repos/$repo/git/trees/HEAD?recursive=1" --jq '.tree[] | select(.type=="tree") | .path' 2>/dev/null \
    | head -4000 | while IFS= read -r p; do mkdir -p "$d/$p" 2>/dev/null; done

  # 4) restore the real rules + manifests (the skeleton pass may have blanked them)
  for f in "${RULES[@]}" "${MANIFESTS[@]}"; do
    [ -e "$d/$f" ] && [ ! -s "$d/$f" ] && curl -sfL "https://raw.githubusercontent.com/$repo/HEAD/$f" -o "$d/$f" 2>/dev/null
  done

  node "$LINT" "$d" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print(json.dumps({'repo': '$repo', 'checked': d['checked'], 'findings': d['findings']}))
"
  rm -rf "$d"
done < "$1"
