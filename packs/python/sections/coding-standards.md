- **Type hints** on public functions; run the project's type checker (mypy/pyright) as part of "done".
- Format + lint with the repo's tools (ruff / black / isort); run them before finishing.
- No bare `except:` — catch specific exceptions; never silently swallow.
- Prefer standard-library and well-maintained deps; pin versions; work inside the project's virtualenv.
- Django: keep business logic out of views (services/managers); use the ORM safely (no raw SQL with
  string interpolation). FastAPI: validate with Pydantic models at the boundary.
