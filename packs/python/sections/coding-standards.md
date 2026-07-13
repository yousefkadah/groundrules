- **Type hints** on public functions; run the project's type checker (mypy/pyright) as part of "done".
- Format + lint with the repo's tools (ruff / black / isort); run them before finishing.
- No bare `except:` — catch specific exceptions; never silently swallow.
- Prefer standard-library and well-maintained deps; pin versions; work inside the project's virtualenv.
- Django: keep business logic out of views (services/managers); use the ORM safely (no raw SQL with
  string interpolation). FastAPI: validate with Pydantic models at the boundary.
- **Django authorization & isolation:** scope the queryset to the actor **before** the lookup
  (e.g. `get_object_or_404(request.user.things, pk=…)`), enforce object-level permissions, and **derive
  the owner/tenant server-side** — never trust a client-supplied owner/tenant field.
- **Explicit fields — no over-posting:** ModelForm / DRF serializers must list `fields` (allow-list);
  **never `fields = "__all__"`**, and never write unchecked `request.data` / `request.POST` straight to a model.
- **Production settings hardening:** `DEBUG = False`, a real `ALLOWED_HOSTS`, `SECURE_*` cookies + HSTS +
  SSL redirect, and CSRF protection on — all env-driven; no hard-coded secrets in `settings.py`.
