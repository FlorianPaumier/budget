# Android action to backend API coverage

All `/api/v1` paths below use the household HTTPS origin. `Bearer` means `Authorization: Bearer <paired-phone credential>`. JSON amounts are CAD cents. The authoritative schemas are in [OpenAPI v1](openapi/v1.json); [API.md](API.md) explains the workflow.

| Android action | Method and path | Access and payload |
| --- | --- | --- |
| A0 server discovery/manual address | `GET /api/v1/health` | Public; confirms the configured origin. Discovery and saved address are Android features. |
| A0 first household setup | `POST /api/v1/bootstrap` | Mac loopback only; `openingSpendableCents`, `openingSavingsCents`, `reminderTime`. Returns first pairing code. |
| A0 QR pairing | `POST /api/v1/pair` | Public with single-use `pairingCode`, `label`; returns a per-phone credential. QR display/scanning and secure key storage are Android features. |
| A0 revoked access | Any Bearer route, e.g. `GET /api/v1/household` | Revoked credential returns `401`; app clears or blocks access locally. |
| A1 current-month plan and actuals | `GET /api/v1/months/{month}/plan`; `GET /api/v1/months/{month}/actuals?today=YYYY-MM-DD` | Bearer; month is `YYYY-MM`. Current-month selection and display are Android features. |
| A1 balances | `GET /api/v1/balances?asOf=YYYY-MM-DD` | Bearer; returns spendable, savings, combined actual balances. |
| A1 quick entry | `POST /api/v1/entries` | Bearer; `kind`, `entryDate`, `amountCents`, optional `categoryId`, `account`, `note`. `savings_transfer` records manual movement. |
| A1 entry corrections/history | `GET/PATCH/DELETE /api/v1/entries/{id}`; `GET /api/v1/entries/{id}/history` | Bearer; edit/delete requires `revision`; history gives actor and before/after. |
| A1 categories | `GET/POST /api/v1/categories`; `PATCH/DELETE /api/v1/categories/{id}` | Bearer; create `name`; edit `revision` and `name`/`active`; delete `revision`. |
| A1 estimates | `PUT /api/v1/months/{month}/estimates/{categoryId}` | Bearer; `amountCents`, `revision` (0 to create), optional stable `id` and `operationId`. Read IDs/revisions in the month plan. |
| A1 savings target | `PUT /api/v1/months/{month}/savings-target` | Bearer; nullable `amountCents`, `revision`, optional stable IDs. Read in month plan. |
| A1 median suggestion | `GET /api/v1/months/{month}/suggestions/{categoryId}` | Bearer; explicit acceptance uses estimate PUT. |
| A1 past months | Same month routes with another `{month}`; `GET /api/v1/entries` | Bearer; navigation and caching are Android features. |
| A2 rule editor | `GET/POST /api/v1/recurring-rules`; `GET/PATCH/DELETE /api/v1/recurring-rules/{id}` | Bearer; create has `kind`, `name`, `amountCents`, `frequency`, `interval`, `startsOn`; edit/delete has `revision` and a date range where required. Shortcut selection is Android UI. |
| A2 occurrence states | `GET /api/v1/occurrences?from=YYYY-MM-DD&through=YYYY-MM-DD` | Bearer; includes IDs, revisions, expected/actual values, status and `needsReview`. |
| A2 confirmation/correction | `POST /api/v1/occurrences/{id}/confirm` | Bearer; `revision`, optional `actualDate`, `actualAmountCents`. |
| A2 shared reminder hour | `GET/PATCH /api/v1/household` | Bearer; PATCH has `reminderTime`, `revision`. Android schedules previous-day/due-day notifications using cached occurrences and household time zone, including offline; canceling pending notifications is Android behavior. |
| A3 offline queue and push | `POST /api/v1/sync/push` | Bearer; `operations` array with stable operation/entity UUIDs, entity type/action/base revision/value. Queue and retry are stored in Room. |
| A3 change feed | `GET /api/v1/sync/changes?cursor=0&limit=100` | Bearer; Android applies a page transactionally, then persists `nextCursor`. |
| A3 conflict review | `GET /api/v1/sync/conflicts`; `POST /api/v1/sync/conflicts/{id}/resolve` | Bearer; resolution body `choice: server|proposed`. UI shows both versions. |
| A3 entry history | `GET /api/v1/entries/{id}/history` | Bearer; device label, timestamp, before/after values. |
| A3 device controls and pairing QR | `GET /api/v1/devices`; `PATCH/DELETE /api/v1/devices/{id}`; `POST/DELETE /api/v1/pairing-codes` | Bearer; rename body `label`; pairing code creation returns code for QR display. Device commands need home API connectivity because they are not sync entities. |
| A4 install and update | `GET /install`; `GET /install/budget.apk`; `GET /install/version.json` | Public on home Wi-Fi; metadata is signed, Android verifies signature and APK hash. Release signing and publishing are operator tasks. |

The backend has no push notification endpoint: Android schedules local notifications from cached data. APK metadata contains no phone credential. The install QR and pairing QR have different purposes.
