- Respect the project's versioning scheme (SemVer unless the repo says otherwise). A breaking change is
  a major bump and a changelog entry.
- **If the repo automates releases** (semantic-release, changesets, commit-derived versions), do **not**
  hand-edit version numbers or changelogs — let the workflow derive them from commits.
- Don't ship a migration/backfill without noting ordering and rollback. Prefer **expand-contract**;
  make backfills chunked and resumable. *(Skip if the project has no database.)*
<!-- groundrules:only web-app -->
- Note any **post-deploy step** the change requires (cache/queue restart, asset rebuild, config
  reload). The stack pack below lists the concrete commands for this project.
<!-- groundrules:end -->
- **Get explicit, environment-scoped approval before actually running a release, publish, or deploy
  against a shared/production target** — otherwise just report the exact command for a human to run.
  Naming the command is fine; executing it against real infra is not yours to decide.
