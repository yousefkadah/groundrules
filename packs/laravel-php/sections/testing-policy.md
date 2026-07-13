- **Pest** is the runner. Create tests with `php artisan make:test --pest {Name}` (`--unit` for unit).
  Most tests are feature tests.
- Run the narrowest: `php artisan test --compact --filter={Name}` (or by file). Paste command + output.
- Use model **factories** and their states for data; `fake()` for fauxdata. Don't hand-build models.
- For parsers / fixed-width / XML / CSV: assert byte- or schema-exact output against a **real fixture**;
  test malformed input and edge cases (encoding, check digits, empty sections).
