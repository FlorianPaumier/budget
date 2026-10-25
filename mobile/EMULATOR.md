# Android emulator acceptance

This records emulator checks separately from physical acceptance in [ACCEPTANCE.md](ACCEPTANCE.md).

## Environment — 2026-10-06

- AVD: `Medium_Phone_API_36.1`, Android 16, API 36.1, Google Play ARM64 image.
- Signed app: 0.1.2, version code 3; installed successfully through adb.
- Isolated temporary backend database with a test household; production household data is excluded from these checks.
- HTTPS origin: `https://budget.home.arpa:8443`, Caddy with the same bundled home public CA.
- Emulator network uses a local CONNECT tunnel to route that hostname to the test server while preserving Android TLS hostname and certificate validation. This does not verify household DNS or Wi-Fi routing.

## Findings and results

- Signed APK installation and setup screen: **pass**.
- Initial connection check reached HTTPS, but the existing Docker image returned legacy `{"status":"ok"}` instead of the current `{"data":{"status":"ok"}}` contract. This produced “No value for data” in the app. Rebuilding from current source fixed the connection check. The home API and backup containers were then recreated with the rebuilt image; home HTTPS health now returns the current contract. Persistent volumes were retained.
- Connection check with the bundled CA and exact hostname: **pass**, “Home server reachable”.
- Manual pairing and protected API refresh: **pass**, Connected; initial spendable $1,000.00, savings $250.00, combined $1,250.00.
- Android Keystore credential persistence across app force-stop/relaunch: **pass**; the app remains paired. Phone reboot remains untested.
- Offline cached dashboard: **pass**, explicit offline message and accepted balances unchanged.
- Offline income of $12.34: **pass**, one queued edit; force-stop/relaunch preserves that edit.
- Reconnection and sync: **pass**, queue returns to zero; spendable $1,012.34, savings $250.00, combined $1,262.34. The isolated backend contains exactly one accepted income of 1,234 cents.
- Signed same-version update check: **pass**, “This app is up to date.”
- Settings surfaces missing notification/exact-alarm permission controls: **pass** for display; actual permission grant and firing timing remain untested.
- Recurrence, conflicts between two emulators, camera scanner, reboot, notification firing, and Android installer upgrade: **not run in this pass**.

Physical camera scanning, actual home-network access, manufacturer battery restrictions, two physical phones, and Mac power-loss recovery remain open.

## Local test services

The emulator and isolated test services are left running for inspection. The emulator uses global HTTP proxy `10.0.2.2:8899`; the host tunnel accepts only the test HTTPS origin and runs from `~/.cache/budget-emulator/proxy.py`. Stop that Python process when finished. To restore ordinary emulator networking:

```sh
adb -s emulator-5554 shell settings delete global http_proxy
```

Remove only the test containers/network when finished:

```sh
docker rm -f budget-emulator-tls budget-emulator-api
docker network rm budget-emulator
```

The isolated database is temporary and is discarded when its container stops. These commands retain the home server containers and all home persistent volumes.

## UI redesign verification — 2026-10-06

- JDK 21: `:app:assembleDebug :app:assembleRelease :app:testDebugUnitTest :app:lintDebug` **pass**. 150 tests, zero failures/errors. Lint retains non-blocking existing maintenance warnings; no errors.
- Signed release APK: `apksigner verify` **pass**; `adb install -r` **pass** with existing isolated emulator credentials and cached Room data retained.
- Light and Dark theme selection through Profile: **pass**, including status/navigation icon contrast. Screenshots: [light](design/dashboard-light.png), [dark](design/dashboard-dark.png).
- Horizontal swipe across dashboard content: **pass**, October → November. November has no accepted snapshot and shows dashes and “Waiting for local budget data”; a reverse swipe returns to October.
- Cached October balances remain $1,012.34 spendable / $250.00 savings, with accepted income $12.34, while the test backend is unavailable. The offline banner stays readable below the status bar.
- Automated checks cover month-arrow/swipe callbacks, existing navigation/edit flows, transfer exclusion, category-adjustment spending semantics, month isolation, quarter/year boundary and future-date cutoff.
- Populated chart touch interactions, TalkBack, maximum font scaling, tablet/landscape and physical-phone acceptance remain device-review items. The cached emulator fixture has no purchases, so its spending chart uses the empty state.
- No update-server publication or production ledger edits were performed.

## Published redesign upgrade — 2026-10-06

The served home HTTPS APK 0.1.4 / code 5 passed metadata/hash verification and an `adb install -r` upgrade over the installed signed application. This publication makes the existing installation QR and in-app newer-version check serve the redesign. Physical-phone installer confirmation remains to be performed by the user.

## French UX verification — 2026-10-10

Version 0.1.5 / code 6 installed successfully over the existing release using the same household signing certificate. All 154 unit/Compose tests pass; release build and lint pass. Emulator checks cover French UI on an English device, light/dark themes, 360 dp width at 150% font scale, decimal-comma entry, visible save action with keyboard, and retained amount after rotation. No transaction was submitted during manual QA. Physical Samsung checks remain open; exact model is unknown. Screenshots are in design/ux-fr-*.png.

## Add/edit drawers — 2026-10-10

Signed 0.1.6 / code 7 installs over the existing release with retained data. Manual checks: drawer over Home, decimal input, save visible above keyboard, Back prompts before discarding, Continue retains amount, and correction opens with the cached transaction values. No ledger operation was submitted. Screenshots: design/drawer-add.png, drawer-edit.png, drawer-keyboard.png. Automated coverage also checks swipe dismissal, busy dismissal guard, correction save and restoration in the drawer. All 157 tests pass.

Drawer correction also verified at 360 dp / 150% font scale: save remains visible, fields wrap and scroll. Canceling an unchanged correction returns to the Transactions tab. Device density/font settings restored afterward.
