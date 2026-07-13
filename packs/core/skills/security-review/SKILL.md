---
name: security-review
description: Use before merging or when reviewing security — scan a diff (or a file/endpoint) for injection, secret exposure, broken authorization, mass assignment, IDOR, unsafe redirects, over-serialization, SSRF, file-upload, and dependency risk. Reports findings by severity with a concrete failure scenario each.
---

# Security review

Review with an attacker's mindset. Report each finding as **severity → file:line → concrete failure
scenario → fix**. If you find nothing, say so plainly rather than inventing issues.

## Severity rubric
Rate by **exploitability × data/impact**: **CRITICAL** = unauthenticated or trivial path to secrets, PII,
or RCE; **HIGH** = authenticated privilege escalation / cross-tenant data access; **MEDIUM** = needs
unusual conditions or limited impact; **LOW** = defense-in-depth. Prioritize the exploitable over the
theoretical.

## Checklist
**Injection & untrusted input** — user/tool/web input reaching a shell, SQL/ORM raw query, file path,
template, or `eval`; parameterized/escaped/allow-listed? Path traversal on user filenames? **SSRF** on a
user-supplied URL?

**AuthZ / access** — every new endpoint checks authN **and** authZ (not just "logged in")? **IDOR**:
nested resources authorized through the owning parent, and route-model binding scoped? No **mass
assignment** (`$request->all()` → `create/update/fill`, missing `$fillable`/`$guarded`)?

**Secrets** — any key/token/password/PII in the diff, logs, errors, or a URL? Read from config/env, not
hard-coded? Nothing secret sent to a third party / LLM / log?

**Data exposure** — whole models/relations serialized to an API or UI props instead of allow-listed
fields/resources? Unsafe **open redirect**? Signed-URL / expiring-link misuse?

**Files & uploads** — size / MIME / content validated, stored privately, generated filename, authorized
download, path normalized?

**Web** — CSRF protection intact (any exemption narrow, e.g. verified webhooks)? CORS not wildcarded for
credentialed requests? Output encoded for its sink (HTML/JSON/CSV → XSS / CSV-injection)?

**Stored / rich content** — user-authored HTML or Markdown rendered without sanitization (`v-html`, raw
HTML)? Sanitize server-side, allow-list URL schemes (no `javascript:`), and test stored payloads.

**Auth & sessions** — login/reset/verify flows rate-limited and non-enumerable? Token/session expiry,
revocation, and rotation? Session fixation prevented on privilege change? MFA and account-recovery paths
safe? (Check Fortify / Sanctum / Socialite / 2FA / WebAuthn where present.)

**Data handling** — unsafe deserialization of untrusted data? Unbounded input (zip bombs, huge payloads)?

**Dependencies** — new dep real, maintained, correctly spelled (no typosquat), pinned, licensed; install
scripts reviewed?

**Crypto / sessions** — no home-rolled crypto; strong password hashing; secure random for tokens.

## Output
For each: `SEVERITY — path:line — what an attacker does — the fix.`
