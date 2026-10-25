# Physical acceptance record

Status: **not run**. Automated tests do not complete these checks. Use two actual Android phones on the household Wi-Fi and a signed household release.

## Record the environment

| Item | Result |
| --- | --- |
| Date and tester | Pending |
| Phone A model / Android version | Pending |
| Phone B model / Android version | Pending |
| Installed version name / code | Pending |
| Home server Mac / macOS version | Pending |
| Home DNS resolves `budget.home.arpa` on both phones | Pending |

Record pass/fail, observed values, and screenshots where useful. Exclude pairing codes, QR secrets, credentials, and private keys from the record.

## Installation and access

1. Open `https://budget.home.arpa/install` in a phone browser. Browser trust is separate from the app's bundled CA; follow [HTTPS.md](../backend/HTTPS.md) to compare the public CA fingerprint.
2. Scan the installation QR and install the signed APK with Android's requested install permission. Confirm the QR opens an APK URL.
3. Pair phone A using the separate pairing code. Create a short-lived pairing QR in Household and scan it with phone B; also exercise manual pairing.
4. Restart each app and reboot each phone. Confirm pairing persists and protected budget data loads over the exact home HTTPS hostname.
5. Check expired, reused, and invalid pairing codes show readable failures. Confirm an HTTP origin cannot pair.

## Budgeting, recurrence, and offline recovery

1. On A, create a category, income, expense, category adjustment, savings transfer, monthly estimate, and savings target. Record accepted totals; refresh B and compare.
2. Edit and delete entries; edit a past month, clear an optional note/category where supported, and inspect history with device labels and before/after values.
3. Create recurrence rules covering all frequencies, including month-end and leap-year dates. Compare previews and generated occurrences; confirm with corrected date/amount, then correct again. Inspect automatically confirmed review warnings and resulting entry history.
4. Disconnect both phones from the home network. Queue edits, close/reopen the apps, and confirm pending edits persist while accepted totals remain clearly labeled. Reconnect in A-then-B order, then repeat in B-then-A order. Confirm no duplicates and equal accepted totals.
5. For category, ledger entry, estimate, plan, rule, occurrence, and household reminder time, make competing offline edits on both phones. Review server/proposed values and resolve using each choice. Include a deletion proposal where supported and a newer-server conflict while the review screen is open.

## Reminders and revocation

1. Grant notification and exact-alarm permissions. Set the household hour and prepare previous-day and due-day occurrences. Disconnect the home network; record expected and actual notification times in the household time zone.
2. Repeat with the phone locked and under its normal battery restrictions. Deny each permission separately, confirm the warning, then grant it through Settings and return to Budget.
3. Confirm, delete, or disable a rule/occurrence and verify its notification is canceled. Change the reminder hour, reboot the phone, and verify restored timing. A queued schedule edit should pause that rule's old reminders until regeneration.
4. On B, queue an offline edit. On A, revoke B. Reconnect B and confirm it shows revocation, preserves its queue, and stops reminders and background pushes. Pair it again and confirm the new pairing can sync.

## Upgrade and server recovery

1. Install an older signed release, retain cached data and pending edits, then publish a higher code with the same keys using [RELEASE.md](RELEASE.md). Check for an update, allow Android installation, and verify the upgrade preserves pairing and local data. A same-version check should avoid downloading an APK; unavailable or invalid updates must not offer installation.
2. Record a known accepted entry and balances. Follow [OPERATIONS.md](../backend/OPERATIONS.md) for backup export and restore, retaining the pre-restore database. Run the documented migration and `reset-sync` steps before reconnecting phones. Confirm HTTPS health, paired access, balances, and phone convergence after restore. Verify a transaction accepted after the backup disappears from both phones, and offline queued proposals retain their values and reach conflict review.
3. At a planned maintenance time, physically restart the Mac and verify Docker, API, backups, and persistent data return. Record a separate power-loss recovery check if performed.

## Results

| Area | Pass/fail and evidence |
| --- | --- |
| Installation QR and signed installation | Pending |
| HTTPS / scanner / credential persistence | Pending |
| Budgeting / history / recurrence | Pending |
| Offline restart / convergence / all entity conflicts | Pending |
| Reminder timing / permissions / reboot | Pending |
| Revocation and re-pairing | Pending |
| Signed upgrade and retained data | Pending |
| Backup restore / Mac restart / power loss | Pending |

Update the corresponding unchecked items in [TASKS.md](../TASKS.md) only after recording passing results here.
