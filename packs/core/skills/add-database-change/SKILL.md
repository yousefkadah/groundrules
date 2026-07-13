---
name: add-database-change
description: Use when adding or changing a database migration or schema — new tables/columns, indexes, foreign keys, or a data backfill. Covers portable, production-safe, zero-downtime schema change and reversible, tested migrations.
---

# Add a database change

Schema changes are the easiest way to cause an outage or data loss. Be conservative.

## Portability & correctness
- [ ] Use the framework's schema builder (not raw engine-specific SQL) so it works on every engine the
      project supports — SQLite/MySQL/PostgreSQL differ on enums, JSON, and altering columns. If CI runs
      multiple engines, the migration must pass on all of them.
- [ ] The schema builder does **not** guarantee a lock-free change: adding an index / FK / `NOT NULL` /
      default can **rewrite or lock a large table**. Assess the **production engine's** locking and use
      an online strategy (concurrent index, batched change, or a tool like pt-osc/gh-ost) where a
      table rewrite would cause downtime.
- [ ] Add the right **indexes and foreign keys**; name constraints explicitly. Choose column types and
      sizes deliberately (money, ids, timestamps with timezone semantics).
- [ ] Provide a real **`down()`** (or document why it's irreversible). Prefer reversible changes.

## Zero-downtime (expand → migrate → contract)
- [ ] **Expand:** add new nullable columns/tables first; deploy code that writes both old and new.
- [ ] **Backfill:** in a **chunked, resumable, idempotent** job — never one unbounded `UPDATE` that locks
      the table. Throttle to avoid replica lag.
- [ ] **Contract:** only after the backfill and new code are fully deployed, drop/rename the old column
      in a later migration. Never rename-in-place a column other running code still reads.

## Safety
- [ ] Wrap multi-statement data changes in a transaction where the engine supports it.
- [ ] Destructive migrations (drop column/table, type narrowing) require explicit human approval and a
      backup/rollback note. Never run them against real data on your own initiative.

## Test
- [ ] Add a migration/feature test that runs the migration and asserts the resulting schema/behavior.
      Verify both `up()` and `down()`. Paste the command + output.
