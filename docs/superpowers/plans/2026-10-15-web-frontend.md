# Web Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execute sequentially; this plan does not authorize parallel agents.

**Goal:** Rebuild the Android budget experience for a desktop browser using TanStack Start and Tailwind CSS, with production-quality boundaries and online-only writes.

**Architecture:** A separate `frontend/` application runs beside AdonisJS. Browser → same-origin TanStack Start server functions → existing AdonisJS API. AdonisJS owns authentication credentials, revisions, financial rules, database writes, recurrence, and history; Start adapts these for a browser and owns the sealed web session.

**Tech Stack:** React, strict TypeScript, TanStack Start/Router, TanStack Query, Tailwind CSS v4 with its Vite plugin, Zod for server-function input validation, generated OpenAPI TypeScript definitions, Vitest, React Testing Library, and Playwright. Use npm and Node 24, matching the backend runtime floor. Resolve compatible stable package versions together when scaffolding and commit the lockfile; do not copy guessed versions from this plan.

**Spec:** The user requirements and scope below are the self-contained specification. Existing behavior references: `backend/API.md`, `backend/API_COVERAGE.md`, `backend/openapi/v1.json`, `mobile/UI_REDESIGN.md`.

## Requirements and constraints

- New sibling project named `frontend/`; no backend rewrite or monorepo migration.
- TanStack Start and Tailwind CSS are required learning goals.
- Desktop browser on the server PC is the primary target; narrow layouts remain usable.
- French UI, fr-CA formatting, CAD, household time zone, light/dark/system appearance.
- Online-only: no IndexedDB, service worker, sync queue, persistent query cache, or offline mutation replay.
- Preserve mobile financial meaning; copy workflows, adapt their layout to a desktop browser.
- Production quality means a repeatable build, secure trust boundaries, accessible UI, useful tests, and maintainable ownership. It does not require enterprise infrastructure.
- No desktop wrapper, notifications, Android updater, public hosting, SSO, roles, Redis, global state library, generic repositories, or homemade component framework.
- Bootstrap stays an operator action. The frontend pairs into an existing household with a single-use code; it must never proxy loopback-only bootstrap.
- Plan only in this change. Do not create placeholder application code or modify the running deployment.

## What exists and what must change

| Area | Existing evidence | Planned impact |
| --- | --- | --- |
| API contract | `backend/openapi/v1.json`, `backend/API.md` | Generate frontend types from the local spec; preserve endpoint compatibility. |
| Authentication | `backend/app/middleware/device_auth_middleware.ts`, `backend/app/services/household_access.ts` | Reuse pair/device credentials; no new backend login system. |
| Browser access | `backend/config/cors.ts` denies production cross-origin access | Server-to-server API calls avoid widening CORS. |
| Deployment | `backend/compose.yaml`, `backend/Caddyfile` currently send every request to Adonis | Add frontend service and route web requests without disturbing API, docs, or APK installation. |
| Transactions | `backend/app/services/ledger.ts`, `ledger_queries.ts` | Use direct revision-based routes; month-filtered reads; recurring entries edited through occurrences. |
| UI semantics | `mobile/UI_REDESIGN.md` | Preserve accepted vs planned figures, category adjustments, date cutoffs, French copy. |
| Documentation | root `README.md`, `TASKS.md`, backend operations docs | Add web commands, delivery checklist, deployment and rollback instructions. |
| Tests and fixtures | Separate Android/backend suites | Add isolated web fixtures and frontend tests. Existing Android/API callers must continue working. |

The workspace root is not currently a Git repository. Establish the intended Git/CI home before creating workflows or commits; do not silently initialize a repository or move existing projects. Until then, CI requirements are enforced by local scripts.

## Architecture decisions

### Server boundary and sessions

Use Start's normal server runtime, not SPA-only mode. Pairing calls the fixed server-configured `BUDGET_API_URL`; never accept a backend origin from a form, query string, or forwarded header. Restrict outbound operations to explicit feature functions and known API paths. Do not build a browser-accessible arbitrary proxy.

Use the framework's sealed/encrypted session cookie containing `credential`, `deviceId`, and `householdId`. This is cookie-backed session storage, not a new server-side session database. The credential remains absent from JavaScript-readable storage and serialized page/query data. Use a production `__Host-` cookie, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, no Domain, and an absolute seven-day lifetime without silent extension. Local HTTP development uses a distinct non-`__Host-` cookie with Secure disabled only in development. Require a strong session secret of at least 32 characters and validate configuration at startup.

Use official Start CSRF protection for server functions plus strict configured full-origin validation on state-changing requests; test cross-origin and missing-origin rejection. Only POST functions mutate. Production must validate the public origin behind Caddy without trusting arbitrary forwarding headers. Pairing is also protected and rate-limited at the public web entry point using a small bounded single-process limiter, with fake-clock tests; no new rate-limit service.

On upstream 401, clear the session and all protected browser queries, then show pairing. Clear cache on logout or household change. Logout first attempts to revoke the current device; always clear the local session, and report if remote revocation failed. An expired session can leave an old device record; allow removal in device settings. Cookie expiry alone does not revoke a stolen bearer token. Do not claim otherwise.

Protected HTML and server-function responses use `Cache-Control: no-store`; credentials, pairing codes, cookies, notes, and amounts never enter logs. Do not install analytics. Same-machine access is not a substitute for these boundaries.

### Data and state

- Generated types derive from `backend/openapi/v1.json` using `openapi-typescript`. Never import Adonis models or database code into the frontend.
- A small server-only fetch helper handles fixed base URL, bearer header, timeout, safe JSON parsing, empty 204, and typed error mapping. Reject redirects so credentials cannot follow an unexpected upstream destination.
- Define input schemas per operation; reject malformed IDs, invalid dates/months, unsafe cents, and invalid revisions before forwarding. Adonis remains the final validator of business rules.
- Generated TypeScript is not runtime response validation. Validate the response shapes consumed by each feature at the server boundary with small Zod schemas; malformed upstream data becomes a safe unavailable-state error.
- One QueryClient per SSR request and one per mounted browser app. Never a process-global authenticated cache. Route loaders prefetch through shared query options; components use those same keys rather than duplicate fetches.
- Keys start with household ID and include month/date/filter dependencies. Month, search, category, and kind filters live in validated URL search parameters. Form drafts are local React state. No Redux/Zustand.
- Reads retry transient failures at most once, never authorization or validation failures. Mutations do not retry automatically or replay on reconnect. Disable Query's offline mutation pausing (`networkMode: 'always'` for mutations) and return a visible failure immediately if the server is unavailable.
- No optimistic financial totals. Invalidate affected queries after success: entry changes affect entries, history, balances, actuals, plans and suggestions; recurrence changes also affect rules/occurrences; category changes affect labels and category plans.
- Focus/reconnect refetch and a visible refresh action are sufficient initially. No polling or WebSockets. Mark old displayed data as stale after failed refresh and keep the last-updated time visible.
- Keep user drafts after 422, 409, and network errors. A 409 offers the latest server version for review; it never resubmits automatically with a fresh revision. If the record was deleted, offer cancel or copy the draft, not resurrection.
- A lost response after POST may mean a successful write. Show an uncertain outcome, refetch affected data, and require review before another submission. Direct entry creation currently has no idempotency key; frontend button disabling cannot guarantee exactly-once writes.

### Money and dates

Transport/store money as safe integer cents; parse input strings digit by digit, not `parseFloat(value) * 100`. Accept a decimal dot or comma, reject mixed separators, exponent notation, extra precision, unsafe integers, and negatives where the entry kind forbids them. Transfers and balance adjustments support their existing signed semantics. Format display using Intl fr-CA CAD; floats are permitted only for chart geometry.

Keep date-only and month strings intact. Derive today in the household time zone, never with UTC slicing of the browser clock. Current month cuts off at household today, past months at month end; future-month actual activity must not be presented as a forecast. Keep planned remaining money, actual spendable balance, savings account balance, and category remainder distinct. Charts count category adjustments as spending and exclude savings transfers/opening adjustments from income/spending.

### UI and file ownership

Thin routes compose feature screens. Features own API functions, query options, schemas, forms, and tests. Shared code earns its place through actual reuse; no barrel exports, service interfaces, dependency injection container, or speculative `utils.ts`.

```text
frontend/
  package.json, package-lock.json, tsconfig.json, vite.config.ts
  eslint.config.js, .prettierignore, .gitignore, .env.example
  Dockerfile, .dockerignore, README.md
  src/
    start.ts                     # request security middleware
    router.tsx                   # request-scoped router/query setup
    routes/
      __root.tsx                 # document, providers, error boundary
      pair.tsx
      _authenticated.tsx         # session gate, app shell
      _authenticated/index.tsx
      _authenticated/transactions.tsx
      _authenticated/budget.tsx
      _authenticated/insights.tsx
      _authenticated/recurring.tsx
      _authenticated/settings.tsx
    features/
      access/                    # session-facing functions and pairing
      dashboard/                 # overview read composition
      transactions/              # list, editor, history
      budget/                    # estimates, savings target, suggestions
      recurring/                 # rules, occurrences, confirmation
      insights/                  # accepted-data selectors and charts
      settings/                  # household, categories, devices, codes
    components/
      app-shell.tsx, month-selector.tsx
      ui/                        # only primitives actually reused
    lib/
      api.generated.ts           # generated, never edited manually
      money.ts, money.test.ts
      dates.ts, dates.test.ts
    server/
      env.ts, session.ts, api.ts  # server-only; enforced import boundary
    styles/app.css               # Tailwind import and semantic tokens
  tests/
    fixtures/                    # synthetic API-shaped household records
    integration/                 # server boundary, query and UI behavior
    e2e/                         # real isolated Adonis + Start browser flows
```

Paths are the ownership map, not instructions to create empty directories. Split files inside features as work requires. Use the scaffold's supported server-only mechanisms; test the production browser bundle for secret-bearing modules. Keep generated route tree generated.

Tailwind v4 uses `@tailwindcss/vite`, `@import "tailwindcss"`, and CSS theme variables. Reuse ivory/forest, bundled Manrope with license, and semantic surface/text/border/status tokens. Use static class mappings, not interpolated Tailwind class fragments. System/light/dark selection persists only this harmless preference. Apply it before paint without weakening CSP. French copy stays feature-local until multiple locales are requested.

Native controls first. Use an established accessible dialog primitive only when a dialog is needed; do not write focus-trap logic. Desktop uses a sidebar, readable content width, tables where appropriate, and accessible forms. Narrow screens collapse navigation. Every page has loading, empty, unavailable, and retry states. Charts expose the same values in text/table form; color is never the sole signal. Respect reduced motion, keyboard focus, zoom, and contrast.

## Review focus

1. Two simultaneous sessions must never share credentials, SSR state, or cached household data — Task 2 isolation tests.
2. Android changes/deletes a record while a browser draft is open — Task 4 and Task 5 revision/deletion tests.
3. Server accepts a creation but the response is lost — Task 4 uncertain-outcome test, no automatic retry.
4. Browser and household are on different calendar dates — Task 3 and Task 6 time-zone tests.
5. Deployment routing accidentally breaks Android pairing, API docs, or APK installation — Task 8 routing smoke tests.

## Delivery tasks

Every task is a reviewable increment. Write and observe a failing behavior test before adding non-trivial logic, implement the minimum, run the relevant check, and review the diff. No tests for boilerplate merely repeating configuration. Do not commit unless requested; use the existing repository's conventions once its location is established.

### Task 1: Running foundation and visual shell

**Files:** frontend package/config files, `src/router.tsx`, `src/routes/__root.tsx`, `src/styles/app.css`, `src/components/app-shell.tsx`, `frontend/README.md`.

- [ ] Scaffold the current supported React Start application with npm; remove demo routes/assets/dependencies. Enable strict TS and the official Tailwind v4 Vite plugin.
- [ ] Add `dev`, `build`, `start`, `typecheck`, `lint`, `format:check`, `test`, `test:e2e`, and `api:generate` scripts. Make scripts compatible with the chosen deployment adapter rather than assuming an output path.
- [ ] Set up Vitest/Testing Library and Playwright with an isolated test configuration. ESLint enforces hooks, type-only imports, and no client import of `src/server/**`. Avoid style-rule noise.
- [ ] Implement French shell, sidebar, responsive navigation, skip link, error/not-found boundaries, semantic theme variables and licensed local font.
- [ ] Check root route and direct navigation in dev and production builds; keyboard navigation and 200% zoom must work without hidden actions.

**Produces:** runnable shell and repeatable scripts. No live household data yet.

### Task 2: Contract, secure pairing, session and API boundary

**Files:** `src/lib/api.generated.ts`, `src/server/{env,session,api}.ts`, `src/start.ts`, `src/features/access/*`, pair/authenticated routes, `tests/integration/access.test.ts`, `.env.example`.

**Interfaces:** server helper `apiRequest<T>(path, options, responseSchema): Promise<T>` is internal only; feature server functions expose validated serializable input/results, never raw Response or credentials. Session inspection returns only authenticated/device/household metadata. API failures serialize as `{code, status, fieldErrors?, outcomeUncertain?}` with safe French presentation at the UI boundary.

- [ ] Generate types from the local OpenAPI spec. Choose exact request/response types from actual operation definitions; make generation reproducible and verify regeneration creates no diff.
- [ ] Write tests for missing/weak secret, fixed API origin, disallowed redirect, malformed response, timeout, 204, 422 details, and 401 cleanup.
- [ ] Write session tests for valid/expired/used pairing code, tampered and expired cookie, CSRF rejection, throttled pairing, logout and failed remote revocation. Assert no credential in HTML or dehydrated queries.
- [ ] Implement the sealed session, fixed-origin server fetch helper, explicit access server functions and guards. Pass only necessary data across the server boundary.
- [ ] Simulate two simultaneous authenticated SSR requests with different credentials/households and assert disjoint headers and query results. Test cache clearing after logout/re-pairing, including an in-flight old response.
- [ ] Run integration tests and inspect the production client bundle for server env imports/secrets. Pair against an isolated real backend once; never consume production pairing codes in automation.

**Produces:** authenticated shell using the existing API without changing Android authentication.

### Task 3: Exact money, dates, shared month selection and dashboard

**Files:** `src/lib/{money,dates}.ts` and their tests, dashboard feature, month selector, authenticated index route.

**Interfaces:** `parseCadCents(input: string): number` throws on malformed/unsafe input; kind-specific sign/nonzero validation stays with the entry schema. `formatCad(cents: number): string`; `householdToday(now: Date, timeZone: string): string`; validated URL `month` feeds all monthly query options.

- [ ] Pin parsing behavior before implementation:

```ts
it.each([['12,34', 1234], ['12.34', 1234], ['-0,01', -1]])(
  'parses %s exactly', (input, expected) => {
    expect(parseCadCents(input)).toBe(expected)
  },
)
it.each(['1,2.3', '1.234', '1e3', '', '90071992547409.92'])(
  'rejects %s', input => expect(() => parseCadCents(input)).toThrow(),
)
```

- [ ] Test Toronto-vs-UTC midnight, leap February, year transitions, invalid URL month, future month, and safe integer boundaries; implement string-based helpers.
- [ ] Implement household/month/date keyed query options for household, balances, plan, actuals and recent monthly entries. Use loader prefetch and the same options in components.
- [ ] Implement accepted balance, savings and planned remainder cards with distinct labels, recent transactions, last refresh, empty/error/retry states. A late previous-month response must not appear beneath a new month label.
- [ ] Test API-derived totals, month switching under delayed responses, and failed refresh with visibly stale values.

**Produces:** usable read-only overview with correct financial/date semantics.

### Task 4: Transactions end to end

**Files:** transactions feature, transactions route, `tests/integration/transactions.test.tsx`, `tests/e2e/transactions.spec.ts`.

- [ ] Implement month-filtered list, local search/kind/category filters in validated URL state, chronological grouping, detail/history and all five existing manual entry kinds. Preserve recurring-entry restrictions.
- [ ] Build accessible add/edit form with exact decimal parsing, category/account constraints, field errors, pending submit, cancel/discard protection, delete confirmation, and draft retention.
- [ ] Use observed revisions for corrections/deletions. On 409 fetch the latest record for explicit review; on 404 preserve the draft and explain deletion.
- [ ] Invalidate all affected financial queries on success; never change totals before acceptance. Disable double submission and automatic mutation retries.
- [ ] Test 422 field mapping, concurrent Android-style correction, deletion while editing, lost POST response, timeout, and navigation with a dirty draft. Assert the lost-response case sends one POST and displays uncertainty before a manual review.
- [ ] Run real-backend E2E: pair → create expense → see dashboard change → edit → history → delete. Include savings transfer and balance adjustment assertions against API totals.

**Produces:** complete daily ledger workflow, the first useful release candidate.

### Task 5: Budgets and recurring operations

**Files:** budget/recurring features and routes, corresponding integration/E2E tests.

- [ ] Implement estimate edits, nullable savings target, category progress and median suggestion acceptance using returned IDs/revisions (0 only for creation).
- [ ] Test absent target vs zero target, zero estimate, missing suggestion samples, explicit suggestion acceptance, and concurrent estimate conflict.
- [ ] Implement existing recurrence frequencies/intervals, rule editing/deletion, upcoming occurrences, `needsReview`, confirmation and correction through occurrence routes. Read precise date-range requirements from OpenAPI before wiring forms.
- [ ] Keep backend-generated schedules authoritative; do not create a second recurrence engine. Explain that shared reminder time affects Android reminders; the browser does not schedule notifications.
- [ ] Test corrected occurrence → linked ledger/dashboard refresh, stale revision and rule regeneration. Verify confirmed history survives rule edits using isolated backend fixtures.

**Produces:** online planning and recurrence parity without mobile scheduling machinery.

### Task 6: Insights and household administration

**Files:** insights/settings features and routes, corresponding tests.

- [ ] Implement insights from accepted entries only. Fetch each required month explicitly for comparisons; no previous-period chart unless that period was loaded successfully. Keep aggregation pure and check safe integer sums.
- [ ] Test category adjustments as spending, transfers excluded from income/spending, empty months, current-month cutoff and rolling calendar ranges. Provide accessible textual equivalents for charts.
- [ ] Implement categories, device rename/revoke, single-use pairing code display/invalidation, shared reminder-hour edit, logout and appearance. Display code expiry, do not put codes in URLs/logs. QR scanning and rendering are deferred; manual pairing preserves the workflow.
- [ ] Confirm self-revocation clears the session, revoked devices cannot continue via cached screens, and category deactivation does not erase historical labels.

**Produces:** full relevant online functional scope; no offline conflicts console or Android installation UI.

### Task 7: Release gates and accessible behavior

**Files:** frontend test configs/scripts, real browser suites, `frontend/README.md`; CI workflow only in the confirmed owning Git repository.

- [ ] Add automated accessibility checks using axe in Playwright plus manual keyboard, focus return, reduced motion, light/dark, 200% zoom and narrow-layout review. Start with Chromium and Firefox; check WebKit before claiming Safari support.
- [ ] Cover security isolation/revocation/CSRF, money/date boundaries, mutation failures and primary journeys rather than snapshotting every component. Use deterministic clock and synthetic records.
- [ ] E2E starts a disposable Adonis database and Start process; bootstrap only that fixture database over loopback and create temporary devices. Refuse the configured production origin/database. Never reset or migrate the live household for tests.
- [ ] Required clean-checkout gate in `frontend/`: `npm ci`, `npm run api:generate`, generated-diff check, `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `npm run test:e2e`.
- [ ] Reject accidental credentials in logs/client assets and external runtime font/CDN dependencies. Add a real CSP compatible with Start's scripts and the theme bootstrap; do not enable unsafe-eval to pass a test.
- [ ] Document supported browsers, known limits and test commands; do not substitute an arbitrary coverage percentage for behavior checks.

**Produces:** reproducible evidence that the frontend is releasable.

### Task 8: Home-server deployment and operations

**Files:** `frontend/Dockerfile`, `.dockerignore`, `.env.example`, `backend/compose.yaml`, `backend/Caddyfile`, `backend/OPERATIONS.md`, root `README.md` and `TASKS.md`.

- [ ] Build a multi-stage Node 24 image for the selected Start adapter, run as non-root, and add a public liveness route that exposes no secrets. Validate runtime env at startup; secrets are runtime-only, never Vite-exposed.
- [ ] Add frontend service on the private Compose network. Set `BUDGET_API_URL=http://budget:3333` internally and `WEB_ORIGIN` to the configured home HTTPS origin. Preserve existing database/APK/backup volumes and backend settings.
- [ ] Caddy routes `/api/*`, `/install`, `/install/*`, `/docs`, `/openapi/v1.json` to Adonis, and remaining web paths to Start. Avoid colliding with Start assets/server-function endpoints. Keep existing private TLS and trust its CA in the server PC browser; never disable certificate verification.
- [ ] Test HTTPS pairing, hard refresh on nested routes, secure cookies, rejected foreign Origin, forwarded-origin behavior, health, API docs and Android install routes. Verify APK-missing behavior still returns its established 404, not the frontend HTML shell.
- [ ] Add redacted request/error logs with request ID, operation, duration and status; no financial payloads. Provide health checks and a restart policy without adding a monitoring platform.
- [ ] Document build/start/update/secret rotation and rollback to the previous frontend image and Caddy config. No backend schema changes are planned. If implementation discovers one is needed, review that scope separately before migration.
- [ ] Record local production-build evidence. Deployment to the running household is a separate action after the concrete diff and checks are reviewable.

**Produces:** documented deployable app alongside the existing household system.

## Learning checkpoints

Build vertical slices so the user can see why each boundary exists: secure pairing, one dashboard read, one expense write, then broader parity. During implementation, offer one focused 5–10-line contribution in a prepared function with tests: a pure category-progress status selector is suitable because the near-limit threshold is a product choice. Explain the tradeoff and prepare its signature/context before asking; do not turn configuration or security into homework. No contribution is needed merely to review this plan.

## Definition of done

- Pairing and online household workflows above work against a disposable real backend.
- No credentials in client data, cross-request leakage, silent overwritten revisions, optimistic financial totals, or automatic replay of uncertain writes.
- French desktop UI is keyboard-accessible with equivalent narrow layouts and clear failure states.
- Generated API contract and production build are reproducible; release gates pass with recorded results.
- Android API/distribution routes and existing household data remain compatible.
- Operations docs cover startup, browser CA trust, session expiry, redacted logs and rollback.

## Sources checked 2026-10-15

- TanStack Start authentication/session guide: https://tanstack.com/start/latest/docs/framework/react/guide/authentication
- TanStack Start middleware/CSRF: https://tanstack.com/start/latest/docs/framework/react/guide/middleware
- Tailwind Vite integration: https://tailwindcss.com/docs/installation/using-vite
- Tailwind CSS theme variables: https://tailwindcss.com/docs/theme

Framework APIs and output paths must be checked against the locked versions at implementation time. No package installation, executable implementation, automated tests or deployment has been performed for this planning-only change.
