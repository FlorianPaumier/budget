# Household budget app — build plan

## Goal

An Android app for one household to plan the current month, enter actual income and spending, and see spendable and savings balances. Household members share the same data through an API hosted on an always-on device on home Wi-Fi. Phones remain usable offline.

## Agreed behavior

- Currency: CAD. Dates and a shared reminder hour use the household time zone (initially America/Toronto).
- Two balances: spendable and savings, plus a combined total. Setup records both opening balances. A manual savings transfer moves money between balances without counting as income or spending. Income and expenses always enter or leave spendable balance first.
- The month view shows (1) planned spendable money left after expected income, scheduled bills, category estimates, and an optional savings target, and (2) money left today based on opening balance and actual confirmed entries. The display must identify expected and actual figures distinctly.
- Spending can be entered as individual purchases or a category adjustment/total entry; entries add together. Categories have editable monthly estimates. For the next month, propose the median of actual spending from the previous five completed months with recorded data; show the sample count and require acceptance before changing the estimate.
- Recurring income and bills use shortcuts for daily, weekly, every two weeks, twice monthly, monthly, yearly, and every N days/weeks/months. Future occurrences are expected until confirmed. Confirmation may change date or amount. Income remains expected and overdue until confirmed. Bills and subscriptions that are still unconfirmed two days after their due date become actual at the expected amount and date, labeled as automatically confirmed for review on the entry. Past months remain editable.
- Everyone sees and can edit the same budget. A per-entry change history records who changed it and when. Conflicting offline edits require review rather than silently overwriting either version.
- Every paired phone receives a local notification at the household-wide hour on the day before and the day of an expected occurrence. Confirming an occurrence cancels its pending reminders. Cached schedules allow notifications while the API is unavailable.
- An installation QR code opens a download page hosted on the home server. A separate short-lived pairing QR code grants a phone its own revocable credential. A paired phone can revoke a lost phone and reset pairing. The backend makes daily backups.

## Proposed architecture

- **Android:** Kotlin and Jetpack Compose; local Room database as the offline source for UI and notification schedules; WorkManager for sync; Android notification scheduling suited to the required hour.
- **Home server:** AdonisJS 7 with TypeScript, Lucid migrations, and SQLite, hosted on the always-on home device. It serves an install page and APK and exposes pairing, sync, budget, device, and backup endpoints on the local network.
- **Identity:** each phone has a generated device key/credential stored in Android secure storage. Pairing is one-time and short-lived. API requests authenticate the device. Revocation prevents later sync from that phone. Keep the install link and pairing token separate; downloading the APK grants no budget access.
- **Sync:** every record has a stable ID, revision, modification time, and tombstone for deletion. A phone queues offline mutations with a unique operation ID. The server applies each operation once. If its base revision is stale, it retains both candidate edits in a conflict record for household review. Balance changes derive from accepted ledger entries, never from client-supplied totals.
- **Backups:** daily SQLite snapshots on the server, retained on a configurable schedule. Include a documented restore path and an encrypted export option so a failed server disk does not destroy the only copy.

## Core data model

| Entity | Essential fields |
| --- | --- |
| Household | ID, currency, time zone, reminder hour, optional monthly savings target |
| Device | ID, label, credential hash/public key, paired time, revoked time |
| Category | ID, name, active state |
| Monthly estimate | month, category ID, amount, accepted proposal source |
| Recurring rule | ID, kind (income/bill/subscription), source/payee, category, amount, schedule, start/end dates, active state |
| Occurrence | ID, rule ID, expected date/amount, status, actual date/amount, confirmation method, review flag |
| Ledger entry | ID, date, amount, kind (income/expense/category adjustment/savings transfer/opening adjustment), category, note, origin occurrence |
| Change event | actor device, entity, before/after revision, time |
| Sync conflict | entity, server version, proposed version, status, resolution |

Money is stored as integer cents. An occurrence creates at most one ledger entry. Editing a confirmed occurrence updates its linked ledger entry. Savings transfers create one balanced movement, not two independent income/expense entries.

## Delivery sequence

1. **Backend foundation:** schema, ledger calculations, recurrence generation, device pairing/revocation, local API, and backup/restore command. Verify month boundaries, biweekly schedules, and automatic confirmation rules.
2. **Android foundation:** setup/pairing, local database, sync queue, offline edits, conflict review, and the two-balance month dashboard.
3. **Budget workflows:** recurring rules, confirmation, expenses/category adjustments, monthly estimates, five-month median proposals, savings transfers, and history.
4. **Reminders and distribution:** offline notifications, notification cancellation, local install page and QR codes, signed APK delivery, and update path.
5. **Household acceptance:** test with two Android phones, disconnect the API, edit on both, reconnect, review conflicts, restore a backup, and revoke one phone.

## Decisions to make during implementation

- Choose the actual home device and backend runtime based on what it can run reliably.
- Choose backup destination and retention; a backup only on the same disk does not cover disk failure.
- Choose a reliable Android notification mechanism for the exact shared hour and handle notification permissions and device power management.
- Decide whether the install page should be reachable only on home Wi-Fi or also through a private network connection. Budget sync itself remains local/offline as agreed.
