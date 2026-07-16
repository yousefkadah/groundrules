**The rule: every behavioral change ships with a test** — new or updated — and the affected tests are
run and shown to pass before the change is done. The stack pack below names the exact runner and command.

- Cover the **happy path and at least one failure path** (invalid input, timeout, unauthorized).
- **Isolate tests from the outside world** — fake or stub HTTP, mail, queues, notifications, storage,
  and the clock. A test must never hit the real network or mutate real/shared state.
- Prefer **deterministic factory states and explicit edge values** for the behavior under test. Use
  captured fixtures only at true serialization boundaries, and **sanitize** them (no real PII, secrets,
  or signatures).
<!-- groundrules:only web-app -->
- Prove **isolation** where it matters (multi-tenant, multi-user): actor A must not read or mutate
  actor B's data — assert it at the HTTP and service entry points, not just the model.
- **Before any test that wipes or migrates a database**, confirm you're on a **disposable** database
  (a named test connection or a local/throwaway target) — never a real or shared one.
<!-- groundrules:end -->
- Run the **narrowest** command that proves the change, not the whole suite, and paste the command + a
  **redacted** summary of its output (exit status, failing test names) as evidence — never real
  PII/secrets from the output. "Tests pass" without evidence is not acceptable.
- Never delete or skip a test to make a change go green — fix the change or surface the conflict.
