# Android project guidance

This file applies to `mobile/`. The app is a Kotlin, Jetpack Compose, Room, WorkManager Android client for the household AdonisJS API.

## Source of truth

- Product behavior: `../PLAN.md`; completion checks: `../TASKS.md` A0–A4.
- HTTP contract: `../backend/openapi/v1.json`. `../backend/API_COVERAGE.md` maps screens and actions to routes; `../backend/API.md` explains sync semantics.
- `app/src/main/assets/backend-openapi-v1.json` is a build-copied snapshot for local access. Edit the backend spec at its source, then run `./gradlew :app:syncBackendOpenApi`; never hand-edit the snapshot.
- Server fields use camelCase JSON and integer CAD cents. Keep wire DTOs separate from Room entities and UI models. Treat IDs and operation IDs as stable UUIDs, revisions as server-owned, and sync cursors as opaque.

## Architecture and state

- Compose screens render immutable state from ViewModels. Keep network, database, and money calculations out of composables.
- Room is the source for offline UI and cached reminders. Use repositories to coordinate Room and HTTP. Do not make a successful network response the only place a screen can read data.
- Add explicit Room migrations; never use destructive migration for household data. Apply each change-feed page and its cursor in one transaction.
- Persist pending operations before showing an offline edit as queued. Reuse the same operation ID on retries. Serialize pushes per device and process accepted, duplicate, conflict, and rejected results separately.
- Use WorkManager for deferrable sync with connectivity constraints and retry backoff. Choose a separate scheduling mechanism for exact-hour reminders and document its permission/power tradeoffs.
- Use `java.time` with the household IANA time zone for calendar dates and reminders; use integer cents or a dedicated money type, never floating-point money.

## Security and network

- Production API and pairing use HTTPS with the configured home IP (currently `192.168.40.71`) or legacy home hostname. Follow `../backend/HTTPS.md`; reject cleartext and certificate mismatches. Do not bypass TLS checks in debug code that could reach release.
- Store the per-phone credential in Android secure storage. Never put credentials, pairing codes, or private keys in Room, logs, assets, source, or crash reports.
- A `401` from a protected route pauses sync and shows revoked/re-pairing state. Do not erase pending local edits without an explicit user decision.
- Direct device and pairing management calls require connectivity. Verify update metadata signature and APK hash before offering an install.

## Working practice

- Make one task in `../TASKS.md` demonstrably complete at a time and record verification there. Keep hardware-dependent checks open until run on actual phones.
- Use TDD: write one behavior test, observe its expected failure, implement the smallest working change, then refactor while green. During shared agent work, only the coordinating agent runs Gradle.
- Use a full JDK 21 for Gradle and Robolectric; newer host JDKs may break the Android test runner.
- Add focused tests for money/date mapping, Room migrations, sync crash/retry and conflict behavior, and notification scheduling. Avoid tests that only repeat an implementation line.
- Before marking work complete, run `./gradlew :app:assembleDebug` and relevant tests. For release changes, verify the signed APK and two-phone flow.
- Do not invent API fields or routes. Check OpenAPI first; update the backend contract and tests if a real gap is found.
