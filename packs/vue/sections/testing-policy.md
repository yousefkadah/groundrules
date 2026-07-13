- Use the repo's **JS test runner** (Vitest/Jest) for component/unit tests — run the narrowest
  (`<pkg-manager> test <pattern>`) and paste output. **Every behavioral change gets the narrowest
  relevant test** — don't skip tests.
- Vue Router SPAs typically use **Vitest + @vue/test-utils** (or Testing Library): mount the component,
  assert rendered behavior, and mock the **API layer** (not your own modules).
- Inertia apps often also cover behavior through the **backend feature tests**. Match the repo's
  convention; don't invent a runner it doesn't have.
