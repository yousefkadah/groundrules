---
name: security-review
description: Use before merging or when explicitly reviewing security — scan a diff (or a file/endpoint) for injection, secret exposure, broken authorization, unsafe deserialization, SSRF, and dependency risk. Reports findings by severity with a concrete failure scenario each.
---

# Security review

Review the change with an attacker's mindset. Report each finding as **severity → file:line → concrete
failure scenario → fix**. If you find nothing, say so plainly rather than inventing issues.

## Checklist

**Injection & untrusted input**
- [ ] User/tool/web input reaching a shell, SQL, ORM raw query, file path, template, or `eval`?
      Is it parameterized / escaped / allow-listed?
- [ ] Path traversal on any user-controlled filename?
- [ ] SSRF: does the server fetch a user-supplied URL without an allow-list?

**Secrets**
- [ ] Any key, token, password, connection string, or PII in the diff, logs, error messages, or a URL?
- [ ] Secrets read from config/env (not hard-coded)? Nothing secret sent to a third party/LLM/log?

**AuthN / AuthZ**
- [ ] Every new endpoint/action checks authentication **and** authorization (not just "logged in")?
- [ ] Multi-tenant/multi-user: is the query scoped so one actor can't reach another's records (IDOR)?

**Data handling**
- [ ] Unsafe deserialization of untrusted data? Unbounded input (zip bombs, huge payloads)?
- [ ] Output encoded for its sink (HTML/JSON/CSV) to prevent XSS/CSV injection?

**Dependencies & supply chain**
- [ ] New dependency real, maintained, correctly spelled (no typosquat)? Pinned appropriately?

**Cryptography & sessions**
- [ ] No home-rolled crypto; standard libraries; no weak hashing for passwords; secure random for tokens.

## Output
For each issue: `SEVERITY (critical/high/medium/low) — path:line — what an attacker does — the fix.`
Prioritize the exploitable over the theoretical.
