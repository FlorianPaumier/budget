# Household Budget API v1

The authoritative request and response contract is [openapi/v1.json](openapi/v1.json). A running backend serves the same file at `/openapi/v1.json` and a locally rendered browser view at `/docs`. [API_COVERAGE.md](API_COVERAGE.md) maps Android actions to routes.

## Wire rules

- Production base URL: `https://budget.home.arpa`. API paths start with `/api/v1`. The server is reachable only on home Wi-Fi; phones queue edits while offline.
- JSON fields use `camelCase`. Successful API responses use `{ "data": ... }`. `204` responses have no body. Errors use `{ "code": "...", "message"?: "...", "details"?: [...] }`. Validation errors are `422 VALIDATION_ERROR` and identify fields in `details`. Revoked or absent credentials return `401`.
- Protected requests send `Authorization: Bearer <per-device credential>`. Bootstrap is public only from the server's loopback interface. Pairing is public only with a short-lived single-use code. Health, install, and docs routes are public on the private network.
- Money is signed safe integer CAD cents. Calendar dates are `YYYY-MM-DD` in the household time zone; instants are UTC ISO 8601 timestamps. Month identifiers are `YYYY-MM`. Reminder time is `HH:mm` in the household time zone.
- Stable IDs and sync operation IDs are UUIDs. Revision `0` means a new client-side record; updates and deletes require the last observed positive revision. A stale revision returns `409` on direct routes or a conflict outcome in sync.

## Endpoint groups

| Group | Calls | Notes |
| --- | --- | --- |
| Access | `GET /health`, `POST /bootstrap`, `POST /pair`, `GET/PATCH /household`, `GET /devices`, `PATCH/DELETE /devices/{id}`, `POST/DELETE /pairing-codes` | Bootstrap is loopback-only. Pairing produces one revocable credential per phone. `PATCH /household` changes the shared reminder hour with a revision. |
| Ledger | `GET/POST /categories`, `PATCH/DELETE /categories/{id}`, `GET/POST /entries`, `GET/PATCH/DELETE /entries/{id}`, `GET /entries/{id}/history`, `GET /balances`, `GET /months/{month}/actuals` | Entry history includes device, time, and before/after values. Deletions are soft and appear in sync. |
| Planning | `PUT /months/{month}/estimates/{categoryId}`, `PUT /months/{month}/savings-target`, `GET /months/{month}/plan`, `GET /months/{month}/suggestions/{categoryId}` | Plan includes accepted estimates and optional target with IDs/revisions. Suggestions require explicit acceptance using the estimate PUT. |
| Recurring | `GET/POST /recurring-rules`, `GET/PATCH/DELETE /recurring-rules/{id}`, `GET /occurrences`, `POST /occurrences/{id}/confirm` | Read rule revisions before edits. The occurrence list includes IDs/revisions. Confirmation can correct date and amount. |
| Sync | `POST /sync/push`, `GET /sync/changes`, `GET /sync/conflicts`, `POST /sync/conflicts/{id}/resolve` | See below. |
| Distribution | `GET /install`, `GET /install/budget.apk`, `GET /install/version.json` | Outside `/api/v1`; the install QR is separate from the pairing QR. Missing published APK returns `404`. |
| Documentation | `GET /docs`, `GET /openapi/v1.json` | Served locally without external assets. |

All paths in the table except distribution and docs are relative to `/api/v1`.

## Balances and recurrence

`/balances?asOf=YYYY-MM-DD` returns actual spendable, savings, and combined balances. Income and expenses always enter the spendable account first. A positive `savings_transfer` moves cents from spendable to savings; a negative transfer moves them back without changing the combined total. A `balance_adjustment` corrects the selected account.

`/months/{month}/plan` returns opening spendable money plus expected income, less expected bills/subscriptions, accepted category estimates, and an optional savings target. It includes `estimates` and `savingsTarget` resources with IDs and revisions. `/months/{month}/actuals?today=YYYY-MM-DD` reports confirmed and manually entered activity through the requested day. These figures remain distinct. Suggestions use the median actual category spending in up to five completed calendar months, omit months with no spending, report `sampleCount`, and never change an estimate until accepted.

Recurring rules support daily, weekly, biweekly, twice monthly, monthly, yearly, and every-N intervals through `interval`. Editing a rule regenerates future expected occurrences while preserving confirmed history. Income remains expected until manually confirmed. Bills and subscriptions automatically confirm two days after due date and set `needsReview` on the occurrence; correcting a confirmation changes its linked ledger entry.

## Offline sync contract

`POST /sync/push` accepts 1–100 operations. Each has a stable `operationId`, `entityId`, `entityType`, `action`, `baseRevision`, and a typed `value` for create/update. The same operation ID retried from the same phone returns `duplicate` without another mutation. Reuse from a different phone is rejected. Each operation produces `accepted`, `duplicate`, `conflict`, or `rejected`; one invalid operation does not discard the rest of a valid batch. Invalid batch shape returns `422`.

| Entity wire name | Create | Update | Delete | Value notes |
| --- | :---: | :---: | :---: | --- |
| `category` | Yes | Yes | Yes | `name`, optional `active`. |
| `ledger_entry` | Yes | Yes | Yes | Manual entry fields; recurring entries are changed through occurrences. |
| `recurring_rule` | Yes | Yes | Yes | Same schedule fields as direct rule routes. |
| `occurrence` | No | Yes | No | Confirmation fields `actualDate` and `actualAmountCents`. |
| `monthly_estimate` | Yes | Yes | No | `categoryId`, `month`, `amountCents`. |
| `monthly_plan` | Yes | Yes | No | `month`, nullable `savingsTargetCents`. |
| `household` | No | Yes | No | Shared `reminderTime`; entity ID is the household ID. |

`GET /sync/changes?cursor=0&limit=100` returns up to 500 changes per page, `nextCursor`, and `hasMore`. The default limit is 100. The cursor is opaque to Android even though represented as an integer. Deletion tombstones use `deleted: true` and `value: null`. Apply the complete page to Room in one transaction, then advance the cursor; keep fetching while `hasMore` is true.

A stale offline edit creates a conflict containing the current server snapshot and the phone proposal. `GET /sync/conflicts` lists open conflicts. Resolve each with `POST /sync/conflicts/{id}/resolve` and `{ "choice": "server" }` or `{ "choice": "proposed" }`. Proposed resolution checks the latest server revision again and returns `409` if it changed. A server-deleted record cannot be silently resurrected. A revoked device receives `401` before any queued operation is processed.

## Local APK integrity

`/install/version.json` is the signed metadata object itself, without the API `data` wrapper. It contains `versionName`, integer `versionCode`, SHA-256 `sha256`, and a Base64 Ed25519 `signature`. The app verifies the metadata signature using its embedded public key and verifies the downloaded APK hash before offering an update. Android release signing is separate. `/install` displays the APK download QR; scanning it does not pair a phone. If no APK is published, all three install routes return `404 APK_NOT_PUBLISHED`.

## Mac-to-phone walkthrough

Follow [OPERATIONS.md](OPERATIONS.md) and [HTTPS.md](HTTPS.md) to start Docker Desktop, build containers, configure local DNS, and trust the Caddy root certificate on Android. The following commands run on the Mac. `bootstrap` must be called over loopback; the later calls use the private HTTPS address. Keep the one-time code and credential out of shared logs and shell history.

```sh
cd backend
docker compose up -d --build
docker compose exec budget node build/ace.js migration:run
docker compose exec -T caddy cat /data/caddy/pki/authorities/local/root.crt > budget-root.crt
curl --cacert budget-root.crt https://budget.home.arpa/api/v1/health
```

Run the one-time bootstrap call from inside the API container so it reaches loopback:

```sh
docker compose exec -T budget node -e 'fetch("http://127.0.0.1:3333/api/v1/bootstrap",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({openingSpendableCents:100000,openingSavingsCents:50000,reminderTime:"09:00"})}).then(async r=>console.log(r.status,await r.text()))'
```

Copy `data.pairingCode` from that response into a private local variable. Pair the first phone and save `data.credential` securely on that phone. To exercise the API from the Mac:

```sh
read -s PAIRING_CODE
export PAIRING_CODE
curl --cacert budget-root.crt -sS -H 'Content-Type: application/json' \
  -d "{\"pairingCode\":\"$PAIRING_CODE\",\"label\":\"Kitchen phone\"}" \
  https://budget.home.arpa/api/v1/pair
unset PAIRING_CODE
read -s DEVICE_CREDENTIAL
export DEVICE_CREDENTIAL
curl --cacert budget-root.crt -sS -H "Authorization: Bearer $DEVICE_CREDENTIAL" \
  https://budget.home.arpa/api/v1/household
curl --cacert budget-root.crt -sS -H "Authorization: Bearer $DEVICE_CREDENTIAL" \
  -H 'Content-Type: application/json' -d '{"name":"Food"}' \
  https://budget.home.arpa/api/v1/categories
unset DEVICE_CREDENTIAL
```

The first pairing code is single-use. After one phone is paired, it can request another through `POST /api/v1/pairing-codes` and show that pairing QR to another household phone.

### Sync recovery

Change pages include a `generation` UUID. Store it with the cursor and include it in push batches. A changed generation means the server was restored: clear accepted caches, replay from cursor zero, and retain queued edits for review. Empty change pages are valid when the cursor advances. Storage failures return HTTP 500; retry unchanged operation IDs. Conflict retries remain conflicts, and conflict resolution is idempotent. The open conflict list returns current server candidates; send their `serverRevision` with a proposed choice. Reconcile conflicts missing from the open list, then release dependent edits against the pulled server record.
