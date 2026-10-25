# Household budget tasks

This checklist tracks implementation of the agreed design in [PLAN.md](PLAN.md). Complete backend access control before exposing budget data to phones. A task is complete only when its acceptance check passes.

**API status:** B7–B10 are complete. All 42 registered routes use AdonisJS controller actions, with VineJS validation, response serializers, revision protection, and versioned OpenAPI documentation served at `/docs` and `/openapi/v1.json`. Remaining backend checks require the actual Android phones and a physical Mac restart; Android software implementation is complete; physical acceptance checks remain open below.

**Implementation workflow:** use TDD for API and Android behavior: write a failing HTTP test, implement the controller/validator behavior, then refactor while keeping the test green. Reuse existing service and functional tests during extraction. Update each checkbox immediately after its acceptance check passes, with verification evidence; leave unfinished work unchecked.

## Backend — AdonisJS, TypeScript, SQLite

### B0. Foundation

- [x] Scaffold AdonisJS API and SQLite migrations.
- [x] Remove public signup and login routes; add a health endpoint.
- [x] Remove unused starter account and token code, tables, and dependencies.
- [x] Add configuration for persistent database path, household time zone, and local server address.
- [x] Complete API contracts and error responses for Android sync, verified by B9 documentation and B10 contract checks.

**Acceptance:** a clean install migrates an empty database, builds, and serves the health endpoint.

### B1. Household setup and device access

- [x] Create one household with CAD, time zone, reminder hour, and opening spendable/savings balances.
- [x] Generate a short-lived, single-use pairing QR payload.
- [x] Pair a phone and issue a unique credential stored only as a verifier on the server.
- [x] Require device authentication on every household API route.
- [x] List, rename, and revoke paired devices; reset pairing access after a lost phone.
- [ ] Protect pairing and credential traffic with HTTPS on the home network.

**Acceptance:** a paired phone can call a protected route; an unpaired or revoked phone cannot; an expired or reused pairing code fails.

### B2. Ledger and balances

- [x] Create, edit, and delete categories and ledger entries with integer CAD cents.
- [x] Support income, expenses, additive category adjustments, opening balance adjustments, and manual savings transfers.
- [x] Calculate spendable, savings, and combined balances from accepted entries.
- [x] Calculate the current month's actual money left and preserve editable prior months.
- [x] Record the device and revision for every accepted change.

**Acceptance:** transfers preserve the combined total; edits and deletions recalculate balances; two phones see the same accepted totals.

### B3. Monthly planning

- [x] Store category estimates and optional monthly savings target.
- [x] Calculate planned money left from expected income, bills, estimates, and savings target.
- [x] Carry categories and accepted estimates into each new month without copying actual spending.
- [x] Suggest the median actual category spending from up to five previous completed months, with sample count; apply only after acceptance.

**Acceptance:** planned and actual figures remain distinct, and suggestions never silently overwrite estimates.

### B4. Recurring income and bills

- [x] Support daily, weekly, every two weeks, twice monthly, monthly, yearly, and every N days/weeks/months schedules.
- [x] Generate expected occurrences without duplicates across month boundaries.
- [x] Confirm an occurrence with optional actual date and amount; link it to exactly one ledger entry and allow correction after confirmation.
- [x] Keep overdue income unconfirmed until someone confirms it.
- [x] Automatically confirm overdue bills/subscriptions two days after due date and mark their entries for review.
- [x] Return upcoming, due, overdue, and confirmed occurrences for phone reminders.

**Acceptance:** recurrence and confirmation rules work across short months, year changes, and edited rules.

### B5. Offline sync and conflicts

- [x] Accept idempotent phone operations with stable IDs and base revisions.
- [x] Send changes and deletion tombstones since a phone's sync cursor.
- [x] Store concurrent edits as conflicts instead of silently overwriting either version.
- [x] Resolve conflicts and keep a change history with device and time across ledger, recurring items, and monthly estimates.
- [x] Reject queued operations from a revoked phone.

**Acceptance:** two phones can edit offline, reconnect in either order, and review any conflicting edit without losing data.

### B6. Local distribution and recovery

- [x] Serve a home Wi-Fi install page, APK download, and installation QR code separately from pairing.
- [x] Provide signed APK version metadata for app updates.
- [x] Make daily SQLite backups to persistent storage with documented retention and restore steps.
- [x] Offer encrypted backup export to a separate device or location.
- [ ] Package the API for the chosen always-on home device and verify restart after power loss.

**Acceptance:** install, restore, and server restart can be performed using the written instructions.

### B7. Controllers and route wiring

- [x] Create `HealthController` for the public health endpoint.
- [x] Create `HouseholdsController` for loopback-only initialization and authenticated household settings reads.
- [x] Create `PairingController` for phone pairing, pairing code creation, and invalidation.
- [x] Create `DevicesController` for listing, renaming, and revoking phones.
- [x] Create `CategoriesController` for category listing, creation, editing, and deletion.
- [x] Create `EntriesController` for ledger listing, creation, editing, deletion, and entry history.
- [x] Create `BalancesController` for account balances and monthly actuals.
- [x] Create `MonthlyPlansController` for estimates, savings targets, planned balances, and median suggestions.
- [x] Create `RecurringRulesController` for existing recurring rule creation and editing.
- [x] Create `OccurrencesController` for date-range listing, confirmation, and correction.
- [x] Create `SyncController` for operation push, change feed, conflict listing, and conflict resolution.
- [x] Create `DistributionController` for the install page, signed version metadata, and APK download.
- [x] Replace inline callbacks with controller actions; keep financial calculations and mutations in services, and preserve device authentication and household scoping.

**Acceptance:** Adonis lists every route with its controller action; existing HTTP tests pass through those actions, including protected and public routes. No route callback contains business logic.

### B8. Complete the HTTP interface and validation

- [x] Audit every Android action in A0–A4 against available endpoints; record missing endpoints and their exact method, path, authentication, and payload before implementing them.
- [x] Add authenticated household settings editing for the shared reminder hour, with revision protection; preserve CAD and the agreed household time zone.
- [x] Add recurring rule list, detail, and delete endpoints; deletion must preserve confirmed history and publish sync tombstones.
- [x] Add ledger entry detail access and define history responses with device, time, and enough change information for the app's entry history view.
- [x] Ensure recurring rule, occurrence, monthly estimate, and monthly savings target reads expose stable IDs and revisions needed for subsequent edits and offline sync.
- [x] Add reusable request validators for body, path, and query values: UUIDs, CAD cents, dates, month ranges, schedules, revisions, sync operations, and cursor limits.
- [x] Require the expected revision on updates and deletions, including monthly estimate and savings target edits; return a conflict for stale edits.
- [x] Define and apply response serializers with consistent camelCase fields and explicit success envelopes; avoid exposing database rows or credential verifiers.
- [x] Apply consistent JSON errors and HTTP statuses for validation, missing records, stale revisions, authentication, and server failures.
- [x] Verify conflict resolution for every supported sync entity, including deletion conflicts and monthly savings targets; make the accepted edit and conflict resolution atomic.
- [x] Preserve loopback-only initialization, single-use pairing, revocation checks, and household ownership checks on every added action.

**Acceptance:** each required app action has a documented, callable HTTP endpoint. Valid requests succeed, invalid requests fail predictably, and stale or unauthorized requests cannot change data.

### B9. Complete API documentation

- [x] Create a versioned OpenAPI specification for all API and distribution routes, including bearer device authentication and public or loopback-only exceptions.
- [x] Document exact request and response schemas, required and nullable fields, enums, defaults, revisions, dates, currency units, and HTTP status codes for every endpoint.
- [x] Include working request and response examples for setup, pairing, categories, ledger entries, balances, monthly planning, recurring items, sync, conflicts, and APK metadata.
- [x] Document each sync entity's wire name, create/update/delete support, stable ID rules, idempotency, pagination, tombstones, and conflict resolution behavior.
- [x] Document planned versus actual balances, savings transfers, estimate suggestions and acceptance, recurrence edits, auto-confirmation warnings, and correction after confirmation.
- [x] Document distribution routes outside `/api/v1`, APK metadata signature verification, and behavior when no APK is published.
- [x] Update `backend/API.md` to match the specification and implemented serializers; explicitly mark any unavailable endpoint.
- [x] Provide a browsable API documentation page and a downloadable specification on the private backend, with secrets excluded from examples.
- [x] Add a reproducible curl walkthrough from Mac startup and bootstrap through pairing and an authenticated budget request, including local HTTPS certificate trust.

**Acceptance:** a developer can call every endpoint using the documentation alone; documented bodies, status codes, and authentication match actual HTTP responses.

### B10. API acceptance and documentation checks

- [x] Add HTTP tests for new endpoints and uncovered controller actions using test-first implementation.
- [x] Cover unauthenticated and revoked requests, invalid payloads, missing records, stale revisions, and household scoping across endpoint groups.
- [x] Validate the OpenAPI specification and check that its method/path inventory matches registered routes.
- [x] Check representative successful and failed HTTP responses against the documented schemas, including sync conflict payloads and distribution metadata.
- [x] Run the full backend tests, TypeScript checks, and production build after controller extraction and interface completion.
- [x] Verify the production container starts, migrates, and serves controller-backed health and authenticated budget calls; record remaining Android HTTPS and Mac restart checks separately.
- [x] Update this file with completed API tasks and verification results so subsequent work resumes from the remaining unchecked items.

**Acceptance:** the implemented controller interface and documentation pass the checks above, with any device-dependent verification explicitly left open.

### Backend verification — 2026-10-05

- Coverage improved with 38 additional tests: **141/141 pass**. Overall lines **94.29%**, branches **96.04%**, functions **95.65%**; application source (`app/`) lines **99.81%**, branches **97.01%**, functions **98.19%**. Controllers have 100% line/function coverage; migrations have 100% across all metrics. `npm run test:coverage` enforces 94% lines/statements and 95% branches/functions. Scope and remaining gaps are recorded in [backend/COVERAGE.md](backend/COVERAGE.md).
- Full backend suite: **141/141 tests passed**, including controller requests, auth/revocation for every protected route, revision conflicts, invalid inputs, recurrence category ownership, atomic conflict resolution, OpenAPI validation, route inventory, and representative response schemas.
- `npm run lint`, `npm run typecheck`, and `npm run build` passed with Node 24.21.0.
- Production Docker image built successfully. An isolated empty database migrated; health, bootstrap, pairing, category creation, ledger entry creation, balances, anonymous request rejection, `/docs`, and `/openapi/v1.json` passed through the production server.
- Restarting the production container preserved the paired credential and accepted balances. The temporary verification container was removed afterward.
- **Still open:** verify Android certificate trust and pairing over the actual home Wi-Fi (B1); verify the household Mac returns after physical restart/power loss with persistent data and backups (B6). Container restart verification does not complete those checks.

## Android app — Kotlin, Jetpack Compose

Use [PLAN.md](PLAN.md) for product behavior, [backend/API_COVERAGE.md](backend/API_COVERAGE.md) for action-to-route mapping, and [backend/openapi/v1.json](backend/openapi/v1.json) for exact wire schemas. Complete each checkbox only after its behavior is demonstrated; keep phone-only checks open until tested on hardware.

**Implementation progress — 2026-10-06:** The remaining software flows are integrated: QR/manual pairing, categories and suggestions, recurring rules/occurrences, cached reminders and permission controls, history/devices, conflict refresh, persisted revocation pause, and verified signed updates. Three specialized subagents used TDD; the coordinator integrated and verified their work. Physical-device acceptance remains open below.

### A0. Foundation and pairing

- [x] Create a buildable Kotlin/Compose Android project with debug and signed release variants, an application dependency graph, tab/screen navigation, and repeatable JDK 21 build instructions.
- [x] Define Room tables and migrations for the cached household, categories, entries, plans, rules, occurrences, devices, sync cursor, pending operations, and conflicts; keep UI reads on local data.
- [x] Provide first-run server setup prefilled with `https://budget.home.arpa`, a manual HTTPS hostname override, health check, and clear errors for DNS, network, and certificate failures. Local DNS is the discovery path; no network scan is required.
- [x] Configure HTTPS certificate trust for the exact home hostname as documented in [backend/HTTPS.md](backend/HTTPS.md); reject HTTP and mismatched certificates.
- [x] Enter a pairing code or paste its QR payload, pair with a device label, and store credentials using Android Keystore encryption; API and Compose tests cover manual pairing and errors.
- [x] Add camera QR scanning with Google Play services, validated payloads, and manual-code fallback.
- [ ] Verify scanning and credential persistence on an actual phone.
- [x] Add an authenticated API client with documented request/response models, bearer credential handling, timeouts, and error mapping; never log credentials or pairing codes.
- [x] Show connected, offline, syncing, pending, and error states; on revoked access, block protected actions and explain how to pair again without discarding local data silently.

**Acceptance:** an actual phone on home Wi-Fi pairs over trusted HTTPS, reads a protected route, rejects untrusted/HTTP origins, and loses server access after revocation.

### A1. Budget entry and month view

- [x] Build a month selector and local-data dashboard that labels planned money left and actual money left today separately, alongside spendable, savings, and combined balances; use household dates and integer CAD cents.
- [x] Add create, edit, and delete flows for income, purchases, additive category adjustments, and manual savings transfers, including field validation and revision-aware corrections.
- [x] Add revision-aware monthly estimate editing and optional savings target editing/clearing through the durable operation queue.
- [x] Add category create/edit/archive or delete controls.
- [x] Show entries for the selected month with detail and correction controls; allow past-month navigation and editing.
- [x] Show each category's five-month median suggestion and sample count; require an explicit accept or edited amount before updating an estimate.
- [x] Verify offline screens use cached data and clearly distinguish pending local edits from accepted server balances.

**Acceptance:** a household member can enter and correct a full month, inspect planned versus actual figures, and edit a past month entirely in the app; reconnecting produces the same accepted totals on both phones.

### A2. Recurring items and reminders

- [x] Build recurring rule list, create, edit, and delete flows with daily, weekly, every two weeks, twice monthly, monthly, yearly, and every-N shortcuts; preview the resulting schedule and validate short-month dates.
- [x] Cache and show expected, due, overdue, confirmed, and automatically confirmed occurrences, including the review flag and links to resulting ledger entries.
- [x] Confirm an occurrence with optional corrected date and amount; allow later correction and display the backend's `needsReview` warning on automatically confirmed items.
- [x] Add shared reminder-hour editing and reschedule cached reminders when the hour, time zone, rule, or occurrence changes.
- [x] Implement previous-day and due-day local notifications from Room data at the household time-zone hour; request notification permission and choose/document an Android scheduling strategy that meets the hour requirement under device power restrictions.
- [x] Cancel or update pending notifications after confirmation, correction, deletion, sync changes, and revocation; keep reminders available while the server is offline.

**Acceptance:** on a phone, reminders fire on the previous and due days at the chosen household hour while offline; confirmation cancels them, and date/time-zone or reminder-hour changes reschedule them correctly.

### A3. Offline sync and household controls

- [x] Persist each supported offline mutation with a stable entity ID, operation ID, base revision, and dependency order; keep pending edits across app restarts.
- [x] Implement a single-flight WorkManager sync: push queued operations, handle accepted/duplicate/conflict/rejected outcomes individually, pull all change pages, apply each page and cursor atomically in Room, and apply deletion tombstones.
- [x] Retry transient network failures with backoff; pause for authentication failures, surface permanent validation failures, and avoid replaying accepted operations after a crash or retry.
- [x] Present cached server and proposed conflict versions, including deletion proposals, and resolve with either choice.
- [x] Refresh conflict details automatically after a newer-server `409`, preserving local proposals.
- [ ] Verify every entity's conflict flow on two actual phones.
- [x] Show sync progress, pending count, last successful sync, and actionable error details without presenting local pending balances as server-confirmed.
- [x] Show entry change history with device label, timestamp, and before/after values.
- [x] Add paired-device list, rename/revoke controls, and creation/invalidation of a short-lived pairing QR; require connectivity for these direct API actions.

**Acceptance:** two phones can edit offline, restart, reconnect in either order, review a conflict, and converge without losing an accepted edit or duplicating a mutation; a revoked phone cannot push its queue.

### A4. Delivery

- [x] Configure release signing, store signing material outside the repository, build a release APK, and document the reproducible versioning and signing steps.
- [x] Embed the trusted update-metadata public key; verify the Ed25519 metadata signature, version code, and downloaded APK SHA-256 before offering an update.
- [x] Publish the signed APK and metadata to the home HTTPS install service; verify the served APK hash/signature and separate install QR page.
- [ ] Verify installation QR scanning and APK installation on an actual phone.
- [x] Add an in-app update notice and install flow, including unavailable server, missing APK, invalid metadata, and same-version behavior.
- [ ] Run a two-phone acceptance pass on the actual home network: install, HTTPS trust, pairing, budgeting, recurrence, offline reminders, offline edits, sync/conflicts, revocation, update, and server backup restore; record device/Android versions and results.

**Acceptance:** a household member can install and use the app from the QR code without developer tools.

### Android verification — 2026-10-06

- **147/147 tests pass**. `:app:testDebugUnitTest`, `:app:assembleDebug`, `:app:assembleRelease`, and `:app:lintDebug` passed with JDK 21. Non-blocking dependency/style warnings remain.
- TDD failures were observed before implementing recurring previews/validation/editors, offline recurrence queues, reminder cancellation/restoration, malformed QR handling, household/category/history controls, pending category overlays, conflict refresh, persistent revocation pause, cached suggestions, and verified APK download/install UI.
- Specialized follow-up audits fixed stale-pairing authentication failures disabling a new pairing, suggestion refreshes crossing household credentials, unsigned/malformed same-version update metadata reporting current, and confirmation of expected occurrences while their rule has queued edits/deletions. Regression failures were observed before implementation; all pass in the full suite.
- Room version 3 adds household-scoped history/suggestion/last-sync documents; migration tests preserve original version-1 data. Cached views remain available offline.
- Release `0.1.2` (version code 3) uses a signing certificate verified with Android `apksigner`. APK and Ed25519 metadata private keys are outside the repository; the public metadata key is embedded. See [mobile/RELEASE.md](mobile/RELEASE.md).
- Home containers were started, APK/metadata published, and HTTPS downloads verified using the bundled home CA. Metadata signature and downloaded APK SHA-256 match; `/install` serves a separate installation QR. The production compose file now sets the home install origin.
- Android 16 emulator acceptance passed signed APK installation, bundled-CA HTTPS, manual pairing, Keystore persistence across process restart, cached offline dashboard, durable offline income/reconnect with exactly one accepted mutation, and signed same-version update checks. See [mobile/EMULATOR.md](mobile/EMULATOR.md). The pass exposed and corrected a stale home backend image; current home HTTPS health now matches the documented response contract.
- Physical acceptance steps and a device/result record are in [mobile/ACCEPTANCE.md](mobile/ACCEPTANCE.md).
- **Hardware checks remain open:** no physical Android device is connected; emulator checks are recorded separately. Camera scanning, secure-storage persistence, notification/alarm timing and permission behavior under phone power restrictions, signed installation/update, two-phone offline convergence/conflicts/revocation, and physical Mac restart/backup restore require actual devices.
- Reminder schedule edits pause reminders for the edited rule until the server regenerates occurrences. Other cached rules retain reminders offline. Google QR scanning may need its Google Play services module downloaded on first use; manual pairing remains available.

## Build order

1. B7: extract existing HTTP handlers into controllers while preserving tested behavior.
2. B8 and B9: complete missing endpoints and validation alongside their API contracts and examples.
3. B10: verify the complete interface and documentation before Android implementation.
4. B1 HTTPS verification → A0: establish secure phone access.
5. B2 and B3 → A1: deliver manual budgeting and monthly planning.
6. B4 → A2, then B5 → A3: deliver recurrence, reminders, and offline collaboration.
7. B6 and A4: finish distribution, recovery, and testing on the household Mac and phones.

## Home IP access — 2026-10-06

- Home origin changed to `https://192.168.40.71`; Caddy retains the legacy hostname and uses an IP certificate from the existing CA with an IP default SNI. Compose sets HTTPS API and installation origins.
- Android pairing defaults to the IP and trusts the existing public CA only for that IP and the legacy hostname. Published signed release 0.1.3 / code 4.
- Verified debug/release builds, lint, release signing identity, HTTPS health and installation page, and matching downloaded APK SHA-256. Connections without CA trust are rejected.
- Physical phone installation/pairing/sync remain unverified. Router DHCP reservation and browser CA trust remain device/network setup steps.
- JDK 21 focused pairing UI, API/TLS and update verifier suites: 19 tests passed.

## UI/UX redesign — 2026-10-06

- [x] Central Compose light/dark/system theme and shared financial components.
- [x] Five-tab navigation, shared month arrows/swipes with directional transitions, accepted-data dashboard and explicit missing-data states.
- [x] Transaction search/type/category filters and sorting, decimal entry keyboard and wrapping choices, category budget progress, interactive line/donut insights and rolling periods.
- [x] Debug/release builds, signature verification, 150 unit/Compose tests and lint completed; signed emulator update preserves cache. Light/dark captures and month swipe verified (see `mobile/EMULATOR.md`).
- [ ] Physical-device review of populated charts, TalkBack, large fonts, landscape and tablet layouts.

## French daily-use UX — 2026-10-10

- [x] French UI and CAD/date formatting, Manrope typography, consistent light/dark surfaces.
- [x] Simplified home, transaction details and deletion confirmation, adaptive filters, budget validation and persistent entry drafts.
- [x] 154 tests, signed release build, lint and narrow-screen/large-font emulator checks.
- [ ] Verify on the user’s Samsung phone (model unspecified).
- [x] Publish the newer drawer release 0.1.6 / code 7 to the home QR endpoint (supersedes the 0.1.5 candidate).

## Add/edit bottom drawers — 2026-10-10

- [x] Reuse the transaction form in a bottom drawer over the current page for Add and Edit.
- [x] Protect changed drafts when swiping, pressing Back or canceling; block dismissal while saving.
- [x] 157 tests, debug/release builds, lint and APK signature verification; emulator keyboard/save and discard checks.
- [x] Publish version 0.1.6 / code 7: QR URL decoded, signed metadata/hash/certificate and served APK manifest verified over trusted HTTPS.
- [ ] Verify drawers and installer update on the physical Samsung.

## Web frontend — 2026-10-15

- [x] TanStack Start/Tailwind project, French desktop/narrow layouts and light/dark/system theme.
- [x] Generated Adonis/Tuyau API contract, secure browser pairing and online financial workflows.
- [x] Transactions/history, estimates/targets, recurrence/confirmation, accepted-data analysis, categories/devices/reminder settings.
- [x] Disposable real-Adonis browser test harness and isolated Docker/Caddy production verification.
- [ ] Household-server deployment and acceptance with the existing browser CA trust.
- [ ] Wire local release gates into CI after repository ownership is established.
- [ ] Safari/WebKit acceptance before claiming support.

## Desktop pairing repair — 2026-10-15

- Replaced the unfinished anonymous backend GET `/pair` with the local-only Ace operator command `pairing:code`, reusing existing hashed, five-minute, single-use pairing codes. Added recovery instructions to the frontend pairing page and operator docs.
- Corrected the private local frontend configuration to reach the home HTTPS backend and trust its bundled public CA. The development launcher starts Vite after loading the environment so Node receives certificate trust at startup.
- Built and deployed the existing frontend Compose override with a private runtime session secret. Backend data/CA volumes retained; backup made and prior backend image tagged `budget-backend:before-desktop-pairing-20261015`. HTTPS web, health, docs, OpenAPI and Android installation routes verified.
- Validation: backend lint/typecheck/build, 61 functional tests including 3 operator-pairing regressions; frontend lint/typecheck/build, 40 tests, 2 Chromium end-to-end journeys, and API generation check. Actual desktop browser paired to the existing household at `http://localhost:3000`, dashboard data loaded and session survived refresh. No financial data modified.
- Physical phone checks and browser-specific trust of the local HTTPS CA remain outside this desktop verification.
