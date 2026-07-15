- **pytest** — run the narrowest: `pytest -q path::test_name`, and paste command + output. Use the repo's
  actual runner (`pytest`, `python -m pytest`, `uv run pytest`, or `tox` — match what CI does).
- Use fixtures for data, not hand-built objects. (Django: `pytest-django` + factory-boy/model_bakery if the
  repo uses them; confirm tests target a **disposable test DB** before any migrate/flush.)
- Cover happy path + a failure path. For **CLI/library** code, test the public API and commands
  (e.g. Click's `CliRunner`) and any plugin hooks. For **web apps**, assert **tenant/object isolation**
  where relevant (one user must not reach another's rows).
- **Web-app only — Django transaction semantics:** a plain `TestCase` wraps each test in a transaction, so
  it hides `transaction.on_commit` callbacks and `select_for_update`. Use `TransactionTestCase` /
  `transaction=True` and `captureOnCommitCallbacks(execute=True)` to test commit and locking behavior.
- Mock the network and external services; don't hit real third parties in unit tests.
