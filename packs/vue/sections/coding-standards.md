- **Match the repo's Vue style** — Options API vs Composition API / `<script setup>` — before writing;
  read a sibling. Use `<script setup>` for **new** components, but edits match the existing component
  unless a migration is explicitly requested.
- Declare **explicit props and emits** via `defineProps`/`defineEmits` (or Options `props`/`emits`) with
  validators; type them **only where neighboring code uses TypeScript**. Never mutate a prop. (Vue prop
  declarations — not React `PropTypes`.)
- **Routing & data — match the app's architecture; don't introduce the other:**
  - **Vue Router SPA** (Vite + a REST/GraphQL API): views + router; data via API modules; shared state in
    **Pinia/Vuex** as the repo uses. Keep secrets/tokens out of client code.
  - **Inertia** (server-driven): pages in the `Pages/` dir; data from server props (`Inertia::render` /
    `usePage()`) — don't re-fetch what the controller already passes.
- Follow the repo's **ESLint + Prettier** config; run its lint script. Use the repo's package manager
  (check `yarn.lock` / `pnpm-lock.yaml` / `package-lock.json` / `bun.lockb`).
- User-facing text goes through the repo's **i18n** layer; keep it **RTL-safe** (logical CSS properties,
  never hard-coded `left`/`right`).
- **Accessibility:** semantic elements + labels, keyboard and focus support with a visible focus ring,
  accessible error messaging, and honor reduced-motion.
- **SSR/hydration (only if the app builds SSR):** touch `window`/`document` only inside client lifecycle
  guards; keep server and client render deterministic; run the full SSR build.
