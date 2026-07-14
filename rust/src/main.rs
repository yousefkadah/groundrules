//! groundrules — one source of truth for AI coding agents (node-free binary).
//!
//! The content packs (packs/) are embedded into the binary at compile time via
//! include_dir, so this is a self-contained executable: no Node, no network.
//! Mirrors the JS engine's behavior byte-for-byte (create-only .ai/, managed-block
//! adapters, always-on + path-scoped rules, rule import, symlink-safe atomic
//! writes, deterministic ordering).

use include_dir::{include_dir, Dir, DirEntry};
use std::collections::HashSet;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

static PACKS: Dir = include_dir!("$CARGO_MANIFEST_DIR/../packs");

const MARK_START: &str = "<!-- groundrules:managed:start -->";
const MARK_END: &str = "<!-- groundrules:managed:end -->";
const HEADER_NOTE: &str = "<!-- Managed by groundrules. Edit files in .ai/, then run `groundrules generate`. The block between the markers below is overwritten on every run — put your own notes outside it. -->";
const CANON_COMMENT: &str = "<!-- This is the canonical set of instructions for AI coding agents on this repo. Source: .ai/ (edit there, then `groundrules generate`). -->";
const BANNER: &str = "> ⚠ **UNCONFIGURED** — `.ai/context.md` still contains «placeholders». Run the `bootstrap` skill so an agent fills in this project’s real context, architecture, and commands. Until then, treat the stack-specific guidance below as generic defaults, not verified facts.";
const DESC_ALWAYS: &str = "Project engineering standards, security guardrails, and skills for AI agents (always applied) — managed by groundrules.";
// Prefix of collect_import's banner (must stay in sync with the JS BodyBuilder).
const IMPORT_CONTEXT_MARKER: &str = "> ⓘ Imported from";
const IMPORT_CONTEXT_POINTER: &str = "> **Project context** was imported from your existing agent rules and isn't reorganized yet — the full text is in `AGENTS.md`. Run the `bootstrap` skill to sort it into the right sections (then it loads everywhere).";
// Only lift a raw import off the always-on surface once it's big enough to be bloat.
const IMPORT_ALWAYS_MAX_LINES: usize = 50;
const IMPORT_SENTENCE: &str = "This project uses [`AGENTS.md`](AGENTS.md) as the single source of truth for AI agent rules.";
const IMPORT_INNER: &str = "This project uses [`AGENTS.md`](AGENTS.md) as the single source of truth for AI agent rules.\n\n@AGENTS.md";

/// (key, title)
const SECTIONS: &[(&str, &str)] = &[
    ("context", "Project context"),
    ("coding-standards", "Coding standards"),
    ("testing-policy", "Testing policy"),
    ("security-policy", "Security policy (agent guardrails)"),
    ("code-review", "Code review checklist"),
    ("pr-policy", "Pull requests & commits"),
    ("release-policy", "Release & deploy"),
];

/// (id, path, kind, default)  kind = inline | import | mdc
const ADAPTERS: &[(&str, &str, &str, bool)] = &[
    ("agents", "AGENTS.md", "inline", true),
    ("claude", "CLAUDE.md", "import", true),
    ("cursor", ".cursor/rules/groundrules.mdc", "mdc", true),
    ("copilot", ".github/copilot-instructions.md", "inline", true),
    ("gemini", "GEMINI.md", "inline", true),
    ("windsurf", ".windsurf/rules/groundrules.md", "inline", false),
];

// ----------------------------- packs (embedded) -----------------------------

fn pack_exists(id: &str) -> bool {
    PACKS.get_dir(id).is_some()
}

fn pack_file(rel: &str) -> Option<&'static str> {
    PACKS.get_file(rel).and_then(|f| f.contents_utf8())
}

fn pack_section(id: &str, key: &str) -> Option<String> {
    pack_file(&format!("{}/sections/{}.md", id, key)).map(|s| s.trim().to_string())
}

fn pack_meta(id: &str) -> serde_json::Value {
    pack_file(&format!("{}/pack.json", id))
        .and_then(|s| serde_json::from_str(s).ok())
        .unwrap_or_else(|| serde_json::json!({}))
}

fn pack_name(id: &str) -> String {
    pack_meta(id)
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or(id)
        .to_string()
}

fn pack_globs(id: &str) -> Vec<String> {
    pack_meta(id)
        .get("globs")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|g| g.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default()
}

fn pack_skill_names(id: &str) -> Vec<String> {
    let mut names = Vec::new();
    if let Some(dir) = PACKS.get_dir(&format!("{}/skills", id)) {
        for d in dir.dirs() {
            if let Some(name) = d.path().file_name().map(|n| n.to_string_lossy().to_string()) {
                if PACKS.get_file(&format!("{}/skills/{}/SKILL.md", id, name)).is_some() {
                    names.push(name);
                }
            }
        }
    }
    names.sort();
    names
}

// ------------------------------- detection ----------------------------------

/// Returns (stacks as (id, signal), existing agent files).
fn detect(cwd: &Path) -> (Vec<(String, String)>, Vec<String>) {
    let has = |name: &str| cwd.join(name).exists();
    let read = |name: &str| fs::read_to_string(cwd.join(name)).ok();
    let mut stacks: Vec<(String, String)> = Vec::new();

    let composer = read("composer.json");
    let has_artisan = has("artisan");
    if (composer.is_some() || has_artisan)
        && (has_artisan || composer.as_deref().map_or(false, |c| c.contains("laravel/framework")))
    {
        let sig = if has_artisan { "artisan" } else { "composer.json:laravel/framework" };
        stacks.push(("laravel-php".to_string(), sig.to_string()));
    }

    if let Some(pkg) = read("package.json") {
        let has_ts = has("tsconfig.json") || pkg.contains("\"typescript\"") || pkg.contains("\"@types/node\"");
        let has_vue = pkg.contains("\"vue\"") || pkg.contains("@inertiajs/vue3") || pkg.contains("\"nuxt\"");
        if has_ts {
            stacks.push(("node-ts".to_string(), "tsconfig/typescript".to_string()));
        }
        if has_vue {
            stacks.push(("vue".to_string(), "package.json:vue".to_string()));
        }
    }

    if has("manage.py") || has("pyproject.toml") || has("requirements.txt") {
        let sig = if has("manage.py") {
            "manage.py (django)"
        } else if has("pyproject.toml") {
            "pyproject.toml"
        } else {
            "requirements.txt"
        };
        stacks.push(("python".to_string(), sig.to_string()));
    }
    if has("go.mod") {
        stacks.push(("go".to_string(), "go.mod".to_string()));
    }
    if has("bin/rails") || has("config/application.rb") {
        stacks.push(("rails".to_string(), "rails".to_string()));
    }
    if has("Cargo.toml") {
        stacks.push(("rust".to_string(), "Cargo.toml".to_string()));
    }
    let is_dotnet = has("global.json")
        || fs::read_dir(cwd)
            .map(|rd| {
                rd.filter_map(|e| e.ok()).any(|e| {
                    let n = e.file_name();
                    let n = n.to_string_lossy();
                    n.ends_with(".sln") || n.ends_with(".csproj")
                })
            })
            .unwrap_or(false);
    if is_dotnet {
        stacks.push(("dotnet".to_string(), ".NET project".to_string()));
    }

    stacks.retain(|(id, _)| pack_exists(id));

    let mut existing = Vec::new();
    for (label, p) in [
        ("CLAUDE.md", "CLAUDE.md"),
        ("AGENTS.md", "AGENTS.md"),
        ("Cursor", ".cursor"),
        ("Copilot", ".github/copilot-instructions.md"),
        ("Gemini", "GEMINI.md"),
        (".claude/", ".claude"),
    ] {
        if cwd.join(p).exists() {
            existing.push(label.to_string());
        }
    }
    (stacks, existing)
}

// ------------------------------- composition --------------------------------

struct Composed {
    sections: Vec<(String, String)>,
    /// (name, owner_pack_id)
    skills: Vec<(String, String)>,
    recommends: Vec<serde_json::Value>,
    /// (id, display name)
    applied: Vec<(String, String)>,
}

fn compose(stack_ids: &[String]) -> Composed {
    let mut applied_ids: Vec<String> = vec!["core".to_string()];
    for id in stack_ids {
        if id != "core" {
            applied_ids.push(id.clone());
        }
    }

    let mut sections = Vec::new();
    for (key, _title) in SECTIONS {
        let mut out = pack_section("core", key).unwrap_or_default();
        for id in stack_ids {
            if id == "core" {
                continue;
            }
            if let Some(sec) = pack_section(id, key) {
                if !out.is_empty() {
                    out = out.trim_end().to_string();
                    out.push_str("\n\n");
                }
                out.push_str(&format!("### {} specifics\n\n{}", pack_name(id), sec));
            }
        }
        let out = out.trim().to_string();
        if !out.is_empty() {
            sections.push((key.to_string(), out));
        }
    }

    let mut order: Vec<String> = Vec::new();
    let mut owner: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    for id in &applied_ids {
        for name in pack_skill_names(id) {
            if !owner.contains_key(&name) {
                order.push(name.clone());
            }
            owner.insert(name.clone(), id.clone());
        }
    }
    let skills: Vec<(String, String)> = order
        .into_iter()
        .map(|n| {
            let o = owner.get(&n).cloned().unwrap_or_default();
            (n, o)
        })
        .collect();

    let mut recommends = Vec::new();
    for id in &applied_ids {
        if let Some(arr) = pack_meta(id).get("recommends").and_then(|v| v.as_array()) {
            for r in arr {
                let mut r = r.clone();
                if let Some(obj) = r.as_object_mut() {
                    obj.insert("pack".to_string(), serde_json::json!(pack_name(id)));
                }
                recommends.push(r);
            }
        }
    }

    let applied = applied_ids.iter().map(|id| (id.clone(), pack_name(id))).collect();
    Composed { sections, skills, recommends, applied }
}

// ------------------------------- fs helpers ---------------------------------

fn safe_write(path: &Path, content: &str) {
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(meta) = fs::symlink_metadata(path) {
        if meta.file_type().is_symlink() {
            eprintln!("refusing to write through a symlink: {}", path.display());
            return;
        }
    }
    let tmp = path.with_file_name(format!(
        ".gr-tmp-{}-{}",
        std::process::id(),
        path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default()
    ));
    if fs::write(&tmp, content).is_ok() {
        let _ = fs::rename(&tmp, path);
    }
}

fn list_files(dir: &Path) -> Vec<String> {
    let mut names = Vec::new();
    if let Ok(rd) = fs::read_dir(dir) {
        for e in rd.filter_map(|e| e.ok()) {
            names.push(e.file_name().to_string_lossy().to_string());
        }
    }
    names.sort();
    names
}

fn copy_embedded_dir(src: &Dir, dst: &Path) {
    let _ = fs::create_dir_all(dst);
    for entry in src.entries() {
        match entry {
            DirEntry::File(f) => {
                if let Some(name) = f.path().file_name() {
                    if let Some(text) = f.contents_utf8() {
                        safe_write(&dst.join(name), text);
                    }
                }
            }
            DirEntry::Dir(d) => {
                if let Some(name) = d.path().file_name() {
                    copy_embedded_dir(d, &dst.join(name));
                }
            }
        }
    }
}

fn copy_disk_dir(src: &Path, dst: &Path) {
    let _ = fs::create_dir_all(dst);
    if let Ok(rd) = fs::read_dir(src) {
        for e in rd.filter_map(|e| e.ok()) {
            if e.file_type().map(|t| t.is_symlink()).unwrap_or(false) {
                continue;
            }
            let p = e.path();
            let target = dst.join(e.file_name());
            if p.is_dir() {
                copy_disk_dir(&p, &target);
            } else if p.is_file() {
                if let Ok(c) = fs::read_to_string(&p) {
                    safe_write(&target, &c);
                }
            }
        }
    }
}

// ---------------------------- managed blocks --------------------------------

fn wrap_managed(inner: &str) -> String {
    format!("{}\n{}\n{}", MARK_START, inner.trim(), MARK_END)
}

fn upsert_managed(existing: &str, inner: &str) -> String {
    let block = wrap_managed(inner);
    // Mirror the JS regex `MARK_START[\s\S]*?MARK_END`: both markers must be present,
    // then replace the FIRST END that follows START. If an END only precedes START
    // (no END after it), JS's .replace is a no-op — match that exactly.
    if existing.contains(MARK_START) && existing.contains(MARK_END) {
        let s = existing.find(MARK_START).unwrap();
        if let Some(rel) = existing[s..].find(MARK_END) {
            let end = s + rel + MARK_END.len();
            return format!("{}{}{}", &existing[..s], block, &existing[end..]);
        }
        return existing.to_string();
    }
    if !existing.trim().is_empty() {
        return format!("{}\n\n{}\n", existing.trim_end(), block);
    }
    format!("{}\n\n{}\n", HEADER_NOTE, block)
}

fn cursor_mdc(body: &str, always: bool, globs: &[String], desc: &str) -> String {
    let globs_line = if globs.is_empty() {
        "globs:".to_string()
    } else {
        format!("globs: {}", globs.join(","))
    };
    let frontmatter = format!(
        "---\ndescription: {}\n{}\nalwaysApply: {}\n---",
        desc,
        globs_line,
        if always { "true" } else { "false" }
    );
    format!("{}\n\n{}\n\n{}\n", frontmatter, HEADER_NOTE, wrap_managed(body))
}

fn copilot_scoped(body: &str, apply_to: &str) -> String {
    let frontmatter = format!("---\napplyTo: \"{}\"\n---", apply_to);
    format!("{}\n\n{}\n\n{}\n", frontmatter, HEADER_NOTE, wrap_managed(body))
}

// ---------------------------- AI-policy guard -------------------------------

/// Does this text declare an anti-AI / no-LLM contribution policy? Line-scoped
/// substring rule — kept BYTE-IDENTICAL to the JS `hasAiOptOut` (aiPolicy.js):
/// same AI-term list, same negation list, same ordering, so the two engines
/// agree on every input (a divergence would flip the drift gate npx-vs-brew).
fn has_ai_opt_out(text: &str) -> bool {
    let ai_terms = ["ai-generated", "ai generated", "ai contribution", "llm", " ai "];
    let neg_terms = [
        "not accepted", "not allowed", "not permitted", "not welcome",
        "forbidden", "prohibited", "banned", "disallow", "rejected",
        "do not use", "don't use", "do not submit", "don't submit",
    ];
    for raw in text.split('\n') {
        let l = raw.trim_end_matches('\r').to_lowercase();
        if l.contains("no ai") || l.contains("no llm") {
            return true;
        }
        let ai = l.starts_with("ai ") || ai_terms.iter().any(|t| l.contains(t));
        if ai && neg_terms.iter().any(|n| l.contains(n)) {
            return true;
        }
    }
    false
}

/// Remove our managed block so we don't match on Groundrules' own wording.
fn strip_managed(text: &str) -> String {
    if let (Some(s), Some(e)) = (text.find(MARK_START), text.find(MARK_END)) {
        if e >= s {
            let end = e + MARK_END.len();
            return format!("{}{}", &text[..s], &text[end..]);
        }
    }
    text.to_string()
}

fn detect_repo_ai_policy(cwd: &Path) -> Vec<String> {
    ["AI_POLICY.md", "AI_POLICY", "AI_POLICY.txt", "CONTRIBUTING.md", ".github/CONTRIBUTING.md", "docs/AI_POLICY.md"]
        .iter()
        .filter(|f| fs::read_to_string(cwd.join(f)).map_or(false, |c| has_ai_opt_out(&c)))
        .map(|f| f.to_string())
        .collect()
}

// ------------------------------- body / build -------------------------------

fn has_placeholders(cwd: &Path) -> bool {
    for (key, _) in SECTIONS {
        if let Ok(c) = fs::read_to_string(cwd.join(".ai").join(format!("{}.md", key))) {
            if c.contains('\u{ab}') {
                return true;
            }
        }
    }
    false
}

fn frontmatter(md: &str) -> (String, String) {
    let text = md.strip_prefix('\u{feff}').unwrap_or(md);
    if !text.starts_with("---") {
        return (String::new(), String::new());
    }
    let (mut name, mut desc) = (String::new(), String::new());
    let mut started = false;
    for line in text.lines() {
        let l = line.trim_end_matches('\r');
        if l == "---" {
            if !started {
                started = true;
                continue;
            }
            break;
        }
        if started {
            if let Some(v) = l.strip_prefix("name:") {
                name = v.trim().trim_matches('"').trim_matches('\'').to_string();
            } else if let Some(v) = l.strip_prefix("description:") {
                desc = v.trim().trim_matches('"').trim_matches('\'').to_string();
            }
        }
    }
    (name, desc)
}

/// Body after a leading `--- … ---` frontmatter block (or the whole text if none).
fn strip_frontmatter(md: &str) -> String {
    let text = md.strip_prefix('\u{feff}').unwrap_or(md);
    if !text.starts_with("---") {
        return text.to_string();
    }
    let nl = match text.find('\n') {
        Some(i) => i,
        None => return text.to_string(),
    };
    if text[..nl].trim_end_matches('\r') != "---" {
        return text.to_string();
    }
    let after_open = &text[nl + 1..];
    if let Some(rel) = after_open.find("\n---") {
        // Mirror the JS regex `\n---\r?\n?`: consume exactly the 3 closing dashes plus
        // an optional single CR/LF; any extra chars on the close line fall into the body.
        let mut body = &after_open[rel + 4..]; // skip "\n---" (4 ASCII bytes, boundary-safe)
        if let Some(b) = body.strip_prefix('\r') { body = b; }
        if let Some(b) = body.strip_prefix('\n') { body = b; }
        return body.to_string();
    }
    text.to_string()
}

fn collapse_blank(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut nl = 0;
    for ch in s.chars() {
        if ch == '\n' {
            nl += 1;
            if nl <= 2 {
                out.push(ch);
            }
        } else {
            nl = 0;
            out.push(ch);
        }
    }
    out
}

fn disk_skill_names(cwd: &Path) -> Vec<String> {
    let mut names = Vec::new();
    if let Ok(rd) = fs::read_dir(cwd.join(".ai").join("skills")) {
        for e in rd.filter_map(|e| e.ok()) {
            if e.path().is_dir() {
                names.push(e.file_name().to_string_lossy().to_string());
            }
        }
    }
    names.sort();
    names
}

/// Split a composed section into (core head, per-pack tails) on the
/// `### <PackName> specifics` markers. Mirrors src/support/sectionSplit.js.
fn split_section(text: &str, pack_names: &[String]) -> (String, Vec<(String, String)>) {
    let mut marks: Vec<(usize, usize, usize, String)> = Vec::new(); // (idx, nl_width, marker_len, name)
    for name in pack_names {
        let marker = format!("### {} specifics", name);
        let needle = format!("\n{}", marker);
        if let Some(idx) = text.find(&needle) {
            marks.push((idx, 1, marker.len(), name.clone()));
        } else if text.starts_with(&marker) {
            marks.push((0, 0, marker.len(), name.clone())); // marker at start-of-string (empty core head)
        }
    }
    marks.sort_by_key(|m| m.0);
    if marks.is_empty() {
        return (text.trim().to_string(), Vec::new());
    }
    let head = text[..marks[0].0].trim().to_string();
    let mut tails = Vec::new();
    for i in 0..marks.len() {
        let start = marks[i].0 + marks[i].1 + marks[i].2; // past "\n### <name> specifics"
        let end = if i + 1 < marks.len() { marks[i + 1].0 } else { text.len() };
        tails.push((marks[i].3.clone(), text[start..end].trim().to_string()));
    }
    (head, tails)
}

/// Applied stack packs from the .ai/ manifest: (id, display name, globs).
fn applied_packs(cwd: &Path) -> Vec<(String, String, Vec<String>)> {
    let manifest = fs::read_to_string(cwd.join(".ai").join(".groundrules.json"))
        .ok()
        .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
        .unwrap_or_else(|| serde_json::json!({}));
    let mut out = Vec::new();
    if let Some(ids) = manifest.get("packs").and_then(|v| v.as_array()) {
        for id in ids.iter().filter_map(|v| v.as_str()) {
            if id == "core" || !pack_exists(id) {
                continue;
            }
            out.push((id.to_string(), pack_name(id), pack_globs(id)));
        }
    }
    out
}

/// Ordered (title, trimmed text) for the section files that exist.
fn read_sections(cwd: &Path) -> Vec<(String, String)> {
    let ai = cwd.join(".ai");
    let mut out = Vec::new();
    for (key, title) in SECTIONS {
        if let Ok(c) = fs::read_to_string(ai.join(format!("{}.md", key))) {
            out.push((title.to_string(), c.trim().to_string()));
        }
    }
    out
}

fn skills_index_lines(cwd: &Path) -> Vec<String> {
    let names = disk_skill_names(cwd);
    if names.is_empty() {
        return Vec::new();
    }
    let ai = cwd.join(".ai");
    let mut lines = vec![
        "## Skills".to_string(),
        String::new(),
        "Load the matching skill when a task fits its description (full text in `.ai/skills/<name>/SKILL.md`, also copied to `.claude/skills/`).".to_string(),
        String::new(),
    ];
    for name in &names {
        if let Ok(c) = fs::read_to_string(ai.join("skills").join(name).join("SKILL.md")) {
            let (n, d) = frontmatter(&c);
            lines.push(format!("- **{}** — {}", if n.is_empty() { name.clone() } else { n }, d));
        }
    }
    lines.push(String::new());
    lines
}

/// Shared assembler for the main (always/full) bodies. Mirrors BodyBuilder._assembleMain.
fn assemble_main(cwd: &Path, section_texts: &[(String, String)]) -> String {
    let mut parts: Vec<String> = vec![CANON_COMMENT.to_string(), String::new()];
    if has_placeholders(cwd) {
        parts.push(BANNER.to_string());
        parts.push(String::new());
    }
    for (title, text) in section_texts {
        parts.push(format!("## {}", title));
        parts.push(String::new());
        parts.push(text.trim().to_string());
        parts.push(String::new());
    }
    for line in skills_index_lines(cwd) {
        parts.push(line);
    }
    let joined = parts.join("\n");
    format!("{}\n", collapse_blank(&joined).trim())
}

/// FULL body: every section verbatim (core + stack specifics inline).
fn build_body(cwd: &Path) -> String {
    assemble_main(cwd, &read_sections(cwd))
}

/// ALWAYS body: universal rules only; each globbed pack's specifics are stripped out.
fn build_always(cwd: &Path) -> String {
    let packs = applied_packs(cwd);
    let names: Vec<String> = packs.iter().map(|(_, n, _)| n.clone()).collect();
    let globbed: HashSet<String> = packs.iter().filter(|(_, _, g)| !g.is_empty()).map(|(_, n, _)| n.clone()).collect();
    let section_texts: Vec<(String, String)> = read_sections(cwd)
        .into_iter()
        .map(|(title, text)| {
            let mut out = text.clone();
            if !names.is_empty() {
                let (head, tails) = split_section(&text, &names);
                out = head;
                for (name, tail) in tails {
                    if !globbed.contains(&name) && !tail.is_empty() {
                        out = format!("{}\n\n### {} specifics\n\n{}", out.trim_end(), name, tail);
                    }
                }
            }
            // A LARGE raw import (context.md still carries the banner) → short pointer, not 100s
            // of lines; a small maintainer AGENTS.md stays inline (it's useful, not bloat).
            if title == "Project context"
                && out.contains(IMPORT_CONTEXT_MARKER)
                && out.matches('\n').count() >= IMPORT_ALWAYS_MAX_LINES
            {
                out = IMPORT_CONTEXT_POINTER.to_string();
            }
            (title, out)
        })
        .collect();
    assemble_main(cwd, &section_texts)
}

/// One stack pack's specifics, as a focused path-scoped body — or None if it adds nothing.
fn build_pack(cwd: &Path, pack_id: &str) -> Option<String> {
    let packs = applied_packs(cwd);
    let names: Vec<String> = packs.iter().map(|(_, n, _)| n.clone()).collect();
    let pack = packs.iter().find(|(id, _, _)| id == pack_id)?;
    let pack_display = &pack.1;

    let mut blocks: Vec<String> = Vec::new();
    for (title, text) in read_sections(cwd) {
        let (_, tails) = split_section(&text, &names);
        if let Some((_, tail)) = tails.iter().find(|(n, _)| n == pack_display) {
            if !tail.is_empty() {
                blocks.push(format!("## {}", title));
                blocks.push(String::new());
                blocks.push(tail.trim().to_string());
                blocks.push(String::new());
            }
        }
    }
    if blocks.is_empty() {
        return None;
    }
    let mut all: Vec<String> = vec![
        format!("# {} — stack-specific rules", pack_display),
        String::new(),
        "These auto-attach when you edit files matching this pack’s globs. General standards and skills live in the always-on rule.".to_string(),
        String::new(),
    ];
    all.extend(blocks);
    let joined = all.join("\n");
    Some(format!("{}\n", collapse_blank(&joined).trim()))
}

// ------------------------------- targets ------------------------------------

enum RenderKind {
    ImportRef,
    Inline(String),
    Cursor { body: String, always: bool, globs: Vec<String>, desc: String },
    CopilotScoped { body: String, apply_to: String },
}

struct Target {
    path: String,
    kind: RenderKind,
}

fn adapter_selected(id: &str, is_default: bool, all: bool, tools: &Option<Vec<String>>) -> bool {
    match tools {
        Some(t) => t.iter().any(|x| x == id),
        None => is_default || all,
    }
}

fn render_target(kind: &RenderKind, existing: &str) -> String {
    match kind {
        RenderKind::ImportRef => upsert_managed(existing, IMPORT_INNER),
        RenderKind::Inline(body) => upsert_managed(existing, body),
        RenderKind::Cursor { body, always, globs, desc } => cursor_mdc(body, *always, globs, desc),
        RenderKind::CopilotScoped { body, apply_to } => copilot_scoped(body, apply_to),
    }
}

/// The concrete files to emit — Cursor + Copilot get an always-on main body plus
/// one path-scoped file per applied stack; every other tool gets the full body.
fn build_targets(cwd: &Path, all: bool, tools: &Option<Vec<String>>) -> Vec<Target> {
    let full = build_body(cwd);
    let always = build_always(cwd);
    let mut out: Vec<Target> = Vec::new();

    for (id, rel, _kind, is_default) in ADAPTERS {
        if !adapter_selected(id, *is_default, all, tools) {
            continue;
        }
        let kind = match *id {
            "claude" => RenderKind::ImportRef,
            "cursor" => RenderKind::Cursor { body: always.clone(), always: true, globs: vec![], desc: DESC_ALWAYS.to_string() },
            "copilot" => RenderKind::Inline(always.clone()),
            _ => RenderKind::Inline(full.clone()),
        };
        out.push(Target { path: rel.to_string(), kind });
    }

    let cursor_on = adapter_selected("cursor", true, all, tools);
    let copilot_on = adapter_selected("copilot", true, all, tools);
    if cursor_on || copilot_on {
        for (id, name, globs) in applied_packs(cwd) {
            if globs.is_empty() {
                continue;
            }
            if let Some(body) = build_pack(cwd, &id) {
                if cursor_on {
                    out.push(Target {
                        path: format!(".cursor/rules/groundrules-{}.mdc", id),
                        kind: RenderKind::Cursor {
                            body: body.clone(),
                            always: false,
                            globs: globs.clone(),
                            desc: format!("{} stack rules (auto-attached to matching files) — managed by groundrules.", name),
                        },
                    });
                }
                if copilot_on {
                    out.push(Target {
                        path: format!(".github/instructions/groundrules-{}.instructions.md", id),
                        kind: RenderKind::CopilotScoped { body: body.clone(), apply_to: globs.join(",") },
                    });
                }
            }
        }
    }
    out
}

// ------------------------------- rule import --------------------------------

fn is_plumbing_line(line: &str) -> bool {
    let t = line.trim();
    t == HEADER_NOTE || t == CANON_COMMENT || t == IMPORT_SENTENCE || t == "@AGENTS.md" || t.starts_with("@import ")
}

fn extract_rules(content: &str) -> String {
    let body = strip_frontmatter(&strip_managed(content));
    let kept: Vec<&str> = body.lines().filter(|l| !is_plumbing_line(l)).collect();
    collapse_blank(&kept.join("\n")).trim().to_string()
}

/// Drop paragraph blocks already emitted by an earlier source. Only MULTI-LINE
/// blocks are de-duplicated (same big Boost/rules block in AGENTS.md + CLAUDE.md
/// shouldn't seed twice); single-line blocks are always kept. Mirrors the JS
/// `dedupeBlocks`: same whitespace-normalized key, same `\n`-membership test.
fn dedup_blocks(text: &str, seen_blocks: &mut HashSet<String>) -> String {
    let mut kept: Vec<&str> = Vec::new();
    for para in text.split("\n\n") {
        let key: String = para.split_whitespace().collect::<Vec<_>>().join(" ");
        let multi = para.contains('\n');
        if multi && !key.is_empty() && seen_blocks.contains(&key) {
            continue;
        }
        kept.push(para);
        if multi && !key.is_empty() {
            seen_blocks.insert(key);
        }
    }
    kept.join("\n\n").trim().to_string()
}

fn is_ours(name: &str) -> bool {
    name == "groundrules.md" || name.starts_with("groundrules.") || name.starts_with("groundrules-")
}

/// Candidate source files in priority order: (rel path, is-adapter-target).
fn import_candidates(cwd: &Path) -> Vec<(String, bool, bool)> {
    // (path, target, legacy)
    let mut list: Vec<(String, bool, bool)> = vec![
        ("AGENTS.md".to_string(), true, false),
        ("CLAUDE.md".to_string(), true, false),
        (".cursorrules".to_string(), false, true),
    ];
    for f in list_files(&cwd.join(".cursor").join("rules")) {
        if f.ends_with(".mdc") && !is_ours(&f) {
            list.push((format!(".cursor/rules/{}", f), false, false));
        }
    }
    list.push((".github/copilot-instructions.md".to_string(), true, false));
    for f in list_files(&cwd.join(".github").join("instructions")) {
        if f.ends_with(".md") && !is_ours(&f) {
            list.push((format!(".github/instructions/{}", f), false, false));
        }
    }
    list.push(("GEMINI.md".to_string(), true, false));
    for f in list_files(&cwd.join(".windsurf").join("rules")) {
        if f.ends_with(".md") && !is_ours(&f) {
            list.push((format!(".windsurf/rules/{}", f), false, false));
        }
    }
    list
}

struct Imported {
    body: String,
    labels: Vec<String>,
    consumed: HashSet<String>,
    superseded: Vec<String>,
}

fn collect_import(cwd: &Path) -> Option<Imported> {
    let mut seen: HashSet<String> = HashSet::new();
    let mut seen_blocks: HashSet<String> = HashSet::new();
    let mut blocks: Vec<String> = Vec::new();
    let mut labels: Vec<String> = Vec::new();
    let mut consumed: HashSet<String> = HashSet::new();
    let mut superseded: Vec<String> = Vec::new();

    for (rel, target, legacy) in import_candidates(cwd) {
        let abs = cwd.join(&rel);
        // Skip symlinks — never slurp a file pointing outside the repo (e.g. secrets)
        // into the committed .ai/. Mirrors the write-path symlink guard.
        if fs::symlink_metadata(&abs).map(|m| m.file_type().is_symlink()).unwrap_or(false) {
            continue;
        }
        let content = match fs::read_to_string(&abs) {
            Ok(c) => c,
            Err(_) => continue,
        };
        let text = extract_rules(&content);
        if text.is_empty() {
            continue;
        }
        let whole: String = text.split_whitespace().collect::<Vec<_>>().join(" ");
        if seen.contains(&whole) {
            continue; // exact full duplicate
        }
        seen.insert(whole);
        let deduped = dedup_blocks(&text, &mut seen_blocks);
        if deduped.is_empty() {
            continue; // contributed nothing beyond an earlier source
        }
        blocks.push(format!("### From `{}`\n\n{}", rel, deduped));
        labels.push(rel.clone());
        if target {
            consumed.insert(rel.clone());
        }
        if legacy {
            superseded.push(rel.clone());
        }
    }

    if blocks.is_empty() {
        return None;
    }
    let labels_md: Vec<String> = labels.iter().map(|l| format!("`{}`", l)).collect();
    let banner = format!(
        "> ⓘ Imported from {} when adopting groundrules. This is a raw starting point — run the **bootstrap** skill so an agent splits it into the right `.ai/` sections (coding-standards / security-policy / testing-policy) and drops anything stale.",
        labels_md.join(", ")
    );
    let body = format!("{}\n\n{}", banner, blocks.join("\n\n")).trim().to_string() + "\n";
    Some(Imported { body, labels, consumed, superseded })
}

// ------------------------------- write / gen --------------------------------

fn write_canonical(cwd: &Path, c: &Composed, force: bool, dry: bool) {
    let ai = cwd.join(".ai");
    for (key, content) in &c.sections {
        let target = ai.join(format!("{}.md", key));
        let present = target.exists();
        if present && !force {
            println!("  \u{b7} .ai/{}.md (kept)", key);
            continue;
        }
        println!("  {} .ai/{}.md", if present { "~" } else { "+" }, key);
        if !dry {
            safe_write(&target, &format!("{}\n", content.trim()));
        }
    }
    for (name, owner) in &c.skills {
        let dst = ai.join("skills").join(name);
        let present = dst.exists();
        if present && !force {
            println!("  \u{b7} .ai/skills/{}/ (kept)", name);
            continue;
        }
        println!("  {} .ai/skills/{}/", if present { "~" } else { "+" }, name);
        if !dry {
            if let Some(dir) = PACKS.get_dir(&format!("{}/skills/{}", owner, name)) {
                copy_embedded_dir(dir, &dst);
            }
        }
    }
    if !dry {
        let manifest = serde_json::json!({
            "tool": "groundrules",
            "packs": c.applied.iter().map(|(id, _)| id.clone()).collect::<Vec<_>>(),
        });
        safe_write(&ai.join(".groundrules.json"), &format!("{}\n", serde_json::to_string_pretty(&manifest).unwrap()));
    }
}

fn generate(cwd: &Path, all: bool, tools: &Option<Vec<String>>, dry: bool, fresh: &HashSet<String>) {
    for t in build_targets(cwd, all, tools) {
        let target = cwd.join(&t.path);
        let disk = fs::read_to_string(&target).unwrap_or_default();
        if !disk.is_empty() && has_ai_opt_out(&strip_managed(&disk)) {
            println!("  \u{26a0} {} (skipped — repo AI policy)", t.path);
            continue;
        }
        let existing = if fresh.contains(&t.path) { String::new() } else { disk.clone() };
        let next = render_target(&t.kind, &existing);
        let action = if disk.is_empty() {
            "+"
        } else if disk == next {
            "="
        } else {
            "~"
        };
        println!("  {} {}", action, t.path);
        if !dry && disk != next {
            safe_write(&target, &next);
        }
    }
    for name in disk_skill_names(cwd) {
        println!("  ~ .claude/skills/{}/", name);
        if !dry {
            copy_disk_dir(&cwd.join(".ai").join("skills").join(&name), &cwd.join(".claude").join("skills").join(&name));
        }
    }
    let pr_dst = cwd.join(".github").join("pull_request_template.md");
    if !pr_dst.exists() {
        if let Some(text) = pack_file("core/templates/pull_request_template.md") {
            println!("  + .github/pull_request_template.md");
            if !dry {
                safe_write(&pr_dst, text);
            }
        }
    }
}

fn check(cwd: &Path, all: bool, tools: &Option<Vec<String>>) -> i32 {
    let mut drift: Vec<(String, String)> = Vec::new();
    for t in build_targets(cwd, all, tools) {
        let target = cwd.join(&t.path);
        if !target.exists() {
            drift.push((t.path.clone(), "missing".to_string()));
            continue;
        }
        let content = fs::read_to_string(&target).unwrap_or_default();
        if has_ai_opt_out(&strip_managed(&content)) {
            continue; // repo's file forbids AI — we don't manage it
        }
        if render_target(&t.kind, &content) != content {
            drift.push((t.path.clone(), "out of date".to_string()));
        }
    }
    if drift.is_empty() {
        println!("\u{2713} adapters are in sync with .ai/");
        0
    } else {
        println!("\u{2717} adapters are out of date — run `groundrules generate`:");
        for (p, r) in &drift {
            println!("  \u{2022} {} ({})", p, r);
        }
        1
    }
}

// ------------------------------- commands -----------------------------------

fn print_recommends(c: &Composed) {
    if c.recommends.is_empty() {
        return;
    }
    println!("\nRecommended for your stack:");
    for r in &c.recommends {
        let name = r.get("name").and_then(|v| v.as_str()).unwrap_or("");
        let pack = r.get("pack").and_then(|v| v.as_str()).unwrap_or("");
        println!("  \u{25cf} {} ({})", name, pack);
        if let Some(why) = r.get("why").and_then(|v| v.as_str()) {
            println!("    {}", why);
        }
        if let Some(inst) = r.get("install").and_then(|v| v.as_str()) {
            println!("    $ {}", inst);
        }
    }
}

fn print_ai_policy(cwd: &Path) {
    let policy = detect_repo_ai_policy(cwd);
    if !policy.is_empty() {
        println!("\n\u{26a0} This repo appears to restrict AI contributions (see {}).", policy.join(", "));
        println!("  Respect the repo's policy — prepare local changes for a human to review; don't open PRs/comments as if a person authored them.");
    }
}

fn cmd_detect(cwd: &Path) {
    let (stacks, existing) = detect(cwd);
    println!("Stack detection");
    let packs: Vec<String> = stacks.iter().map(|(id, _)| id.clone()).collect();
    println!("  packs:   {}", if packs.is_empty() { "none (universal core only)".to_string() } else { packs.join(", ") });
    let sigs: Vec<String> = stacks.iter().map(|(_, s)| s.clone()).collect();
    println!("  signals: {}", if sigs.is_empty() { "none".to_string() } else { sigs.join(", ") });
    println!("  agents already present: {}", if existing.is_empty() { "none".to_string() } else { existing.join(", ") });
}

fn cmd_init(cwd: &Path, all: bool, tools: &Option<Vec<String>>, force: bool, dry: bool) {
    let (stacks, existing) = detect(cwd);
    let ids: Vec<String> = stacks.iter().map(|(id, _)| id.clone()).collect();
    let c = compose(&ids);
    println!("\ngroundrules init");
    let det = if ids.is_empty() { "no known stack".to_string() } else { ids.join(" + ") };
    let sigs: Vec<String> = stacks.iter().map(|(_, s)| s.clone()).collect();
    println!("  detected: {} [{}]", det, if sigs.is_empty() { "universal core only".to_string() } else { sigs.join(", ") });
    if !existing.is_empty() {
        println!("  existing agent files: {} (preserved — only managed blocks are touched)", existing.join(", "));
    }
    println!("  packs applied: {}", c.applied.iter().map(|(_, n)| n.clone()).collect::<Vec<_>>().join(" \u{2192} "));
    println!("\n{}", if dry { "Would write:" } else { "Wrote:" });
    write_canonical(cwd, &c, force, dry);
    generate(cwd, all, tools, dry, &HashSet::new());
    print_recommends(&c);
    print_ai_policy(cwd);
    if has_placeholders(cwd) {
        println!("\n\u{26a0} .ai/context.md has \u{ab}placeholders\u{bb} — run the bootstrap skill in your agent to fill this project's real context.");
    }
    println!("\nNext:");
    println!("  1. Open your coding agent (Claude Code / Codex / opencode) in this repo.");
    println!("  2. Run the bootstrap skill — it scans the project and fills in .ai/ + drafts skills.");
    println!("  3. Edit .ai/, then `groundrules generate` to re-sync every agent's rules file.");
    if dry {
        println!("\nDry run — nothing was written.");
    }
}

fn cmd_import(cwd: &Path, all: bool, tools: &Option<Vec<String>>, force: bool, dry: bool) {
    let found = match collect_import(cwd) {
        Some(f) => f,
        None => {
            println!("\nNo existing agent rules found to import.");
            println!("  Looked for CLAUDE.md, AGENTS.md, .cursorrules, .cursor/rules/*.mdc, .github/copilot-instructions.md, GEMINI.md, .windsurf/rules/*.");
            println!("  Run `groundrules init` to scaffold from scratch instead.");
            return;
        }
    };

    let context_exists = cwd.join(".ai").join("context.md").exists();
    let apply = !context_exists || force;

    let (stacks, _existing) = detect(cwd);
    let ids: Vec<String> = stacks.iter().map(|(id, _)| id.clone()).collect();
    let mut c = compose(&ids);
    if apply {
        if let Some(entry) = c.sections.iter_mut().find(|(k, _)| k == "context") {
            entry.1 = found.body.clone();
        }
    }

    println!("\ngroundrules import");
    println!("  imported rules from: {}", found.labels.join(", "));
    let det = if ids.is_empty() { "no known stack".to_string() } else { ids.join(" + ") };
    let sigs: Vec<String> = stacks.iter().map(|(_, s)| s.clone()).collect();
    println!("  detected: {} [{}]", det, if sigs.is_empty() { "universal core only".to_string() } else { sigs.join(", ") });
    println!("  packs applied: {}", c.applied.iter().map(|(_, n)| n.clone()).collect::<Vec<_>>().join(" \u{2192} "));
    println!("  your existing rules seed .ai/context.md — the bootstrap skill then sorts them into the right sections");

    println!("\n{}", if dry { "Would write:" } else { "Wrote:" });
    write_canonical(cwd, &c, force, dry);
    let fresh: HashSet<String> = if apply { found.consumed.clone() } else { HashSet::new() };
    generate(cwd, all, tools, dry, &fresh);
    print_recommends(&c);

    if !apply {
        println!("\n\u{26a0} .ai/context.md already exists — your imported rules were NOT applied to it.");
        println!("  Re-run `groundrules import --force` to replace it, or merge the imported rules in by hand.");
    }
    if !found.superseded.is_empty() {
        println!("\nNote: {} is legacy — its rules now live in .ai/ and are re-emitted to the modern paths. Safe to delete once you've confirmed the new files.", found.superseded.join(", "));
    }
    print_ai_policy(cwd);

    println!("\nNext:");
    println!("  1. Open your coding agent (Claude Code / Codex / opencode) in this repo.");
    println!("  2. Run the bootstrap skill — it splits your imported rules into the right .ai/ sections and fills any gaps.");
    println!("  3. Edit .ai/, then `groundrules generate` to re-sync every agent's rules file.");
    if dry {
        println!("\nDry run — nothing was written.");
    }
}

fn print_help() {
    println!(
        "groundrules — one source of truth for AI coding agents\n\nUsage\n  groundrules <command> [options]\n\nCommands\n  init        Detect the stack, scaffold .ai/ and generate every agent's rules file\n  import      Adopt existing rules (CLAUDE.md/.cursorrules/Copilot/Gemini…) into .ai/, then generate\n  generate    Re-generate all adapters from .ai/ (idempotent)\n  check       Fail (exit 1) if any adapter is out of sync with .ai/\n  detect      Print what would be detected, without writing anything\n\nOptions\n  --dry-run, -n     Show what would change, write nothing\n  --force           Overwrite existing .ai/ files (init is create-only by default)\n  --tools=a,b       Limit adapters (agents,claude,cursor,copilot,gemini,windsurf)\n  --all             Include non-default adapters (e.g. windsurf)\n  --cwd=PATH        Run against another directory"
    );
}

fn main() {
    let argv: Vec<String> = env::args().skip(1).collect();
    let mut cwd = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let (mut dry, mut all, mut force) = (false, false, false);
    let mut tools: Option<Vec<String>> = None;
    let mut cmd = String::new();

    for a in &argv {
        if a == "-h" || a == "--help" || a == "help" {
            print_help();
            return;
        } else if a == "--dry-run" || a == "-n" {
            dry = true;
        } else if a == "--all" {
            all = true;
        } else if a == "--force" {
            force = true;
        } else if a == "--yes" || a == "-y" {
            // accepted, no-op
        } else if let Some(v) = a.strip_prefix("--cwd=") {
            cwd = PathBuf::from(v);
        } else if let Some(v) = a.strip_prefix("--tools=") {
            tools = Some(v.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect());
        } else if a.starts_with('-') {
            eprintln!("Error: unknown option: {}", a);
            std::process::exit(1);
        } else if cmd.is_empty() {
            cmd = a.clone();
        } else {
            eprintln!("Error: unexpected argument: {}", a);
            std::process::exit(1);
        }
    }

    if cmd.is_empty() {
        print_help();
        return;
    }
    if !cwd.is_dir() {
        eprintln!("--cwd is not an existing directory: {}", cwd.display());
        std::process::exit(1);
    }
    let cwd = cwd.canonicalize().unwrap_or(cwd);

    match cmd.as_str() {
        "detect" => cmd_detect(&cwd),
        "init" => cmd_init(&cwd, all, &tools, force, dry),
        "import" => cmd_import(&cwd, all, &tools, force, dry),
        "generate" | "gen" => {
            if !cwd.join(".ai").is_dir() {
                eprintln!("No .ai/ found. Run `groundrules init` first.");
                std::process::exit(1);
            }
            println!("{}", if dry { "Would regenerate:" } else { "Regenerated adapters from .ai/:" });
            generate(&cwd, all, &tools, dry, &HashSet::new());
        }
        "check" => std::process::exit(check(&cwd, all, &tools)),
        other => {
            eprintln!("Unknown command: {}", other);
            print_help();
            std::process::exit(1);
        }
    }
}
