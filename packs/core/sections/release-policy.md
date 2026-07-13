- Respect the project's versioning scheme (SemVer unless the repo says otherwise). A breaking change is
  a major bump and a changelog entry.
- **If the repo automates releases** (semantic-release, changesets, commit-derived versions), do **not**
  hand-edit version numbers or changelogs — let the workflow derive them from commits.
- Don't ship a migration/backfill without noting ordering and rollback. Prefer **expand-contract**;
  make backfills chunked and resumable.
- Note any **post-deploy step** the change requires (cache/queue restart, asset rebuild, config
  reload). The stack pack below lists the concrete commands for this project.
- **Get explicit, environment-scoped approval before actually running a deploy, release, migration, or
  worker restart against a shared/production environment** — otherwise just report the exact command for
  a human to run. Naming the command is fine; executing it against real infra is not yours to decide.
