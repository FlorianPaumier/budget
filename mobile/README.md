# Household Budget Android

## Build and test

Open `mobile/` in Android Studio. Command-line builds require **JDK 21** and Android SDK 36; set `JAVA_HOME` to a full JDK installation and set `sdk.dir` in the ignored `local.properties` file.

```sh
./gradlew :app:testDebugUnitTest
./gradlew :app:assembleDebug :app:assembleRelease :app:lintDebug
```

The debug APK is `app/build/outputs/apk/debug/app-debug.apk`. Release builds use external signing settings and produce `app/build/outputs/apk/release/app-release.apk` on this Mac. See `RELEASE.md` for keys, versioning, verification, and home publication. Package: `com.household.budget`; min SDK 26, compile/target SDK 36.

## Implemented flows

First launch opens HTTPS server setup and manual pairing. Paired screens read household data and accepted month figures from Room; connection errors keep cached data and queued edits. A per-household database isolates data when pairing with another household. The application graph owns repositories and schedules constrained WorkManager sync. Entries and plan edits are queued with stable operation IDs and base revisions before a network request. Pending edits do not change accepted server balances. Sync pulls before pushing, reconciles conflicts resolved on other phones, and resumes dependent edits against the accepted revision. A restored server generation rebuilds accepted caches while preserving queued proposals for review; follow the required `reset-sync` step in `../backend/OPERATIONS.md`.

Tests cover Compose interactions, exact CAD parsing, household calendar dates, TLS rejection, authenticated API behavior, Room migration, sync retries/conflicts/tombstones/pagination, background work constraints, reminder planning/scheduling, and signed update verification. TDD means observing a failing behavior test before implementing each change; only the coordinating agent runs Gradle when agents share this checkout.

The app now includes recurring-item controls and previews, occurrence correction, cached reminders with permission/reboot handling, household device/category controls, cached median suggestions and history, camera QR pairing, and verified update installation. Physical phone acceptance remains open in `../TASKS.md`; emulator results are in [EMULATOR.md](EMULATOR.md). Use [ACCEPTANCE.md](ACCEPTANCE.md) to run and record the two-phone checks. Google QR scanning may download its scanner module on first use; manual pairing is always available.

Reminders use exact alarms at the household hour, with separate Android notification and exact-alarm permissions. Confirmation, rule deletion, and revocation cancel reminders. Queued recurrence schedule edits pause reminders for that rule until server regeneration; other cached reminders continue offline. Phone power restrictions and actual firing times still require hardware verification.

## API and certificates

The backend API definition is `../backend/openapi/v1.json`. Every build copies it to `app/src/main/assets/backend-openapi-v1.json`; run `./gradlew :app:syncBackendOpenApi` to refresh directly. Read `../backend/API_COVERAGE.md` for action-to-route mapping and `../backend/API.md` for sync behavior.

The exact `192.168.40.71` IP address and legacy `budget.home.arpa` hostname trusts the bundled **public** home Caddy root certificate (`app/src/main/res/raw/budget_home_root.pem`). Other HTTPS hosts use system trust. Follow `../backend/HTTPS.md` for home DNS and certificate setup. Replacing the Caddy CA requires updating the bundled public root and rebuilding; never embed its private key. Hardware HTTPS acceptance is still required.

Room schema snapshots live in `app/schemas/`. Version 2 adds cached month snapshots; version 3 adds household-scoped history, suggestion, and last-sync documents; migration tests retain version-1 household and pending-operation data. Keep explicit migrations and test upgrades when changing the schema.

## UI redesign

The financial experience now includes themed Home / Transactions / Budget / Insights / Profile navigation, a shared swipeable month selector, accepted-data charts, transaction filters and category budget progress. See [UI_REDESIGN.md](UI_REDESIGN.md) for component ownership, financial semantics and validation limits.
