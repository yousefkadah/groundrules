- **Use the repo's runner.** Determine it from the repo's **test command / CI and the dominant sibling
  tests** (package presence is supporting evidence): if it's Pest, write Pest; otherwise write
  **class-based PHPUnit** tests (`extends Tests\TestCase`, `use RefreshDatabase`/`DatabaseTransactions`)
  — match the sibling test's base class and method naming.
  `php artisan test --filter={Name}` works for both; raw PHPUnit is `vendor/bin/phpunit --filter={Name}`.
  Scaffold with `php artisan make:test` and match neighbors.
- **Fake the outside world:** `Http::fake()` (and prevent stray requests), plus `Mail::fake()`,
  `Notification::fake()`, `Bus::fake()`, `Queue::fake()`, `Event::fake()`, `Storage::fake()` as
  applicable. No real network, mail, or disk writes in tests.
- Use model **factories** and their states; `fake()` for fauxdata. Don't hand-build models.
- For parsers / fixed-width / XML / CSV: assert byte- or schema-exact output against a **sanitized**
  fixture; test malformed input and edge cases (encoding, check digits, empty sections).
