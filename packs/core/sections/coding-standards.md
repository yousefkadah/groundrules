These principles are stack-agnostic. Language- and framework-specific rules are added below by the
active stack pack — those win on any concrete detail (commands, idioms, file layout).

- **Match the neighbors.** Before writing a file, read a sibling in the same area and mirror its
  structure, naming, and idioms. This beats every generic rule below when they conflict — **except**
  the security, isolation, validation, and data-correctness rules, which always outrank a
  neighboring pattern (never copy a legacy insecure or unsafe one).
- **Reuse before creating.** Look for an existing function/component/helper before adding one.
- **Small, reviewable changes.** One concern per change. If the task sprawls, stop and propose a plan.
- **Descriptive names.** `isEligibleForRefund`, not `check()`. Names say what, not how.
- **Contracts at the edges.** Put explicit types on public functions and on data crossing a boundary
  (I/O, storage, third-party).
<!-- groundrules:only web-app -->
- **Never serialize internal models wholesale.** Map data crossing an API/UI boundary to
  DTOs/resources with **allow-listed fields**.
<!-- groundrules:end -->
- **Handle the unhappy path.** Nulls, empties, timeouts, and permission denials are part of the feature.
- **Comment the why, not the what.** Only annotate genuinely non-obvious logic.
- **Keep diffs tight.** No drive-by reformatting. Run the project's formatter/linter before finishing.
- **Reference code as `path/to/file:line`** so humans can click straight to it.

**Data correctness** — for code that actually handles this data (skip what doesn't apply — a library or
CLI may need none of it):
- **Money:** use the repo's money representation — a money library or integer minor units — **never
  floats**; keep currency explicit and round only at boundaries.
- **Dates & time:** store instants in **UTC**, keep the user's timezone for display, model date-only
  values separately, and test DST boundaries.
- **Retries:** make externally-visible effects **idempotent** so a retry can't double-charge or
  double-send.
<!-- groundrules:only web-app -->
- **Multi-step writes:** wrap related writes in a **transaction** and lean on DB constraints
  (unique/FK). Keep transactions **short and DB-only** — no remote calls or slow work while a lock is
  held; dispatch side effects **after commit**.
- **User-facing text:** route through the repo's **i18n** layer (translation keys, pluralization) and
  keep it RTL-safe.
<!-- groundrules:end -->
- **Generators:** prefer the framework's generators, then **move the output to match the repo's layout**
  (module/domain/namespace) if it differs from the framework default — match the neighboring file.
