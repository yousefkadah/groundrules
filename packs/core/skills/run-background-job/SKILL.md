---
name: run-background-job
description: Use when adding or changing a queued job, listener, or scheduled task — reminders, notifications, webhooks, emails, exports, search indexing. Covers idempotency, dispatch-after-commit, locking, retries/timeouts, failed-job recovery, and tenant re-authorization.
---

# Add / change a background job

Queued work runs later, on another worker, possibly more than once. Design for that.

## Dispatch
- [ ] Dispatch **after the DB transaction commits** (`afterCommit`) so the job never runs before its data exists.
- [ ] Pass **ids, not whole models**; re-load inside the job. Keep payloads small and non-secret.

## Execute safely
- [ ] Make the handler **idempotent** — running it twice must not double-charge, double-send, or
      duplicate rows (guard with a unique key or a processed marker).
- [ ] Prevent overlap where it matters (a lock / "without overlapping"). Set a sensible **timeout** and
      **bounded retries with backoff**; decide what a final failure does.
- [ ] **Re-establish tenant/user context inside the job** — don't assume the dispatcher's scope carries
      over. Re-authorize.
- [ ] Handle **permanent failure** (`failed()` / dead-letter) so a bad job doesn't vanish silently.

## Test
- [ ] Test **dispatch** (fake the queue/bus; assert pushed with the right payload and `afterCommit`)
      **and** the **handler** separately (run it, assert effects, then assert idempotency on a second
      run). Paste command + output.
