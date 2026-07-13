- **pytest** (via `pytest-django` for Django). Run the narrowest: `pytest -q path::test_name`, and paste
  command + output. Confirm it targets a **disposable test DB** (test settings) before any migrate/flush.
- Use fixtures (and factory-boy / model_bakery if present) for data — not hand-built objects.
- Cover happy path + a failure path; assert **tenant/object isolation** where relevant (one user must not
  reach another's rows).
- **Django transaction semantics:** a plain `TestCase` wraps each test in a transaction, so it hides
  `transaction.on_commit` callbacks and `select_for_update`. Use `TransactionTestCase` / `transaction=True`
  to test commit and locking behavior, and `captureOnCommitCallbacks(execute=True)` to assert `on_commit` work.
- Mock the network and external services; don't hit real third parties in unit tests.
