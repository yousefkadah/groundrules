- **Type hints** on public functions; run the project's type checker (mypy/pyright) as part of "done".
- Format + lint with the repo's tools (ruff / black / isort); run them before finishing.
- No bare `except:` — catch specific exceptions; never silently swallow.
- Work inside the project's tooling (`uv` / `pip` / `poetry` — match the repo). **Apps** pin dependencies
  (lockfile); **libraries** declare compatible version *ranges* — don't unilaterally pin a library's deps.
- **Match the project type — grep the manifest/entry points first, don't assume a web framework:**
  - **CLI / library** (`[project.scripts]` / `console_scripts`, a public package API, Click/argparse/Typer,
    plugin hooks like Pluggy or setuptools entry points): keep a **stable public API** (SemVer), avoid
    side effects at import time, and don't introduce web/DB/tenant machinery the project doesn't have.
  - **Web app / API service** (Django / DRF / FastAPI / Flask): the web rules below apply.
- **Web-app only — layering:** keep business logic out of views (services/managers); use the ORM safely
  (no raw SQL with string interpolation). FastAPI/Flask: validate with Pydantic/schemas at the boundary.
- **Web-app only — authorization & isolation:** scope the queryset to the actor **before** the lookup
  (e.g. `get_object_or_404(request.user.things, pk=…)`), enforce object-level permissions, and **derive
  the owner/tenant server-side** — never trust a client-supplied owner/tenant field.
- **Web-app only — explicit fields, no over-posting:** ModelForm / DRF serializers must list `fields`
  (allow-list); **never `fields = "__all__"`**, and never write unchecked `request.data` straight to a model.
- **Web-app only — production settings hardening:** `DEBUG = False`, a real `ALLOWED_HOSTS`, `SECURE_*`
  cookies + HSTS + SSL redirect, and CSRF on — all env-driven; no hard-coded secrets in `settings.py`.
