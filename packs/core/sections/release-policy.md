- Respect the project's versioning scheme (SemVer unless the repo says otherwise). A breaking change is
  a major bump and a changelog entry.
- Don't ship a migration/backfill without noting ordering and rollback.
- Note any **post-deploy step** the change requires (cache/queue restart, asset rebuild, config
  reload). The stack pack below lists the concrete commands for this project.
- If a deploy is irreversible or customer-facing, confirm with a human before triggering it.
