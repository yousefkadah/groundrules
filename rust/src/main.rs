//! groundrules — one source of truth for AI coding agents (node-free binary).
//!
//! The content packs (packs/) are embedded into the binary at compile time via
//! include_dir, so this is a self-contained executable: no Node, no network.
//! Mirrors the JS engine's behavior (create-only .ai/, managed-block adapters,
//! symlink-safe atomic writes, deterministic ordering).

use include_dir::{include_dir, Dir, DirEntry};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

static PACKS: Dir = include_dir!("$CARGO_MANIFEST_DIR/../packs");

const MARK_START: &str = "<!-- groundrules:managed:start -->";
const MARK_END: &str = "<!-- groundrules:managed:end -->";
const HEADER_NOTE: &str = "<!-- Managed by groundrules. Edit files in .ai/, then run `groundrules generate`. The block between the markers below is overwritten on every run — put your own notes outside it. -->";
const BANNER: &str = "> \u{26a0} **UNCONFIGURED** — `.ai/context.md` still contains \u{ab}placeholders\u{bb}. Run the `bootstrap` skill so an agent fills in this project\u{2019}s real context, architecture, and commands. Until then, treat the stack-specific guidance below as generic defaults, not verified facts.";

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
    if let (Some(s), Some(e)) = (existing.find(MARK_START), existing.find(MARK_END)) {
        if e >= s {
            let end = e + MARK_END.len();
            return format!("{}{}{}", &existing[..s], block, &existing[end..]);
        }
    }
    if !existing.trim().is_empty() {
        return format!("{}\n\n{}\n", existing.trim_end(), block);
    }
    format!("{}\n\n{}\n", HEADER_NOTE, block)
}

fn render_adapter(kind: &str, body: &str, existing: &str) -> String {
    match kind {
        "import" => upsert_managed(
            existing,
            "This project uses [`AGENTS.md`](AGENTS.md) as the single source of truth for AI agent rules.\n\n@AGENTS.md",
        ),
        "mdc" => {
            let frontmatter = "---\ndescription: Project engineering standards, security guardrails, and skills for AI agents (managed by groundrules).\nglobs:\nalwaysApply: false\n---";
            format!("{}\n\n{}\n\n{}\n", frontmatter, HEADER_NOTE, wrap_managed(body))
        }
        _ => upsert_managed(existing, body),
    }
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

fn build_body(cwd: &Path) -> String {
    let ai = cwd.join(".ai");
    let mut parts: Vec<String> = vec![
        "<!-- This is the canonical set of instructions for AI coding agents on this repo. Source: .ai/ (edit there, then `groundrules generate`). -->".to_string(),
    ];
    if has_placeholders(cwd) {
        parts.push(BANNER.to_string());
    }
    for (key, title) in SECTIONS {
        if let Ok(c) = fs::read_to_string(ai.join(format!("{}.md", key))) {
            parts.push(format!("## {}\n\n{}", title, c.trim()));
        }
    }
    let names = disk_skill_names(cwd);
    if !names.is_empty() {
        let mut idx = String::from("## Skills\n\nLoad the matching skill when a task fits its description (full text in `.ai/skills/<name>/SKILL.md`, also copied to `.claude/skills/`).\n");
        for name in &names {
            if let Ok(c) = fs::read_to_string(ai.join("skills").join(name).join("SKILL.md")) {
                let (n, d) = frontmatter(&c);
                idx.push_str(&format!("\n- **{}** — {}", if n.is_empty() { name.clone() } else { n }, d));
            }
        }
        parts.push(idx);
    }
    let joined = parts.join("\n\n");
    format!("{}\n", collapse_blank(&joined).trim())
}

// ------------------------------- commands -----------------------------------

fn adapter_selected(id: &str, is_default: bool, all: bool, tools: &Option<Vec<String>>) -> bool {
    match tools {
        Some(t) => t.iter().any(|x| x == id),
        None => is_default || all,
    }
}

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

fn generate(cwd: &Path, all: bool, tools: &Option<Vec<String>>, dry: bool) {
    let body = build_body(cwd);
    for (id, rel, kind, is_default) in ADAPTERS {
        if !adapter_selected(id, *is_default, all, tools) {
            continue;
        }
        let target = cwd.join(rel);
        let existing = fs::read_to_string(&target).unwrap_or_default();
        let next = render_adapter(kind, &body, &existing);
        let action = if existing.is_empty() {
            "+"
        } else if existing == next {
            "="
        } else {
            "~"
        };
        println!("  {} {}", action, rel);
        if !dry && existing != next {
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
    let body = build_body(cwd);
    let mut drift: Vec<(String, String)> = Vec::new();
    for (id, rel, kind, is_default) in ADAPTERS {
        if !adapter_selected(id, *is_default, all, tools) {
            continue;
        }
        let target = cwd.join(rel);
        if !target.exists() {
            drift.push((rel.to_string(), "missing".to_string()));
            continue;
        }
        let content = fs::read_to_string(&target).unwrap_or_default();
        if render_adapter(kind, &body, &content) != content {
            drift.push((rel.to_string(), "out of date".to_string()));
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
    generate(cwd, all, tools, dry);
    if !c.recommends.is_empty() {
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

fn print_help() {
    println!(
        "groundrules — one source of truth for AI coding agents\n\nUsage\n  groundrules <command> [options]\n\nCommands\n  init        Detect the stack, scaffold .ai/ and generate every agent's rules file\n  generate    Re-generate all adapters from .ai/ (idempotent)\n  check       Fail (exit 1) if any adapter is out of sync with .ai/\n  detect      Print what would be detected, without writing anything\n\nOptions\n  --dry-run, -n     Show what would change, write nothing\n  --force           Overwrite existing .ai/ files (init is create-only by default)\n  --tools=a,b       Limit adapters (agents,claude,cursor,copilot,gemini,windsurf)\n  --all             Include non-default adapters (e.g. windsurf)\n  --cwd=PATH        Run against another directory"
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
        "generate" | "gen" => {
            if !cwd.join(".ai").is_dir() {
                eprintln!("No .ai/ found. Run `groundrules init` first.");
                std::process::exit(1);
            }
            println!("{}", if dry { "Would regenerate:" } else { "Regenerated adapters from .ai/:" });
            generate(&cwd, all, &tools, dry);
        }
        "check" => std::process::exit(check(&cwd, all, &tools)),
        other => {
            eprintln!("Unknown command: {}", other);
            print_help();
            std::process::exit(1);
        }
    }
}
