# Household budget

Android household budget app with a local AdonisJS API. See [PLAN.md](PLAN.md) for the agreed behavior and delivery sequence.

## Backend development

The API lives in `backend/` and requires Node.js 24 or newer and npm 11 or newer.

```sh
cd backend
npm ci
node ace migration:run
npm run dev
```

The health endpoint is `GET http://localhost:3333/api/v1/health` and returns `{"data":{"status":"ok"}}`. Browse the complete API at `http://localhost:3333/docs`, or download its OpenAPI specification at `/openapi/v1.json`.

Run `npm run test:coverage` in `backend/` to measure coverage, including untested source files. See [backend/COVERAGE.md](backend/COVERAGE.md) for the measured results and scope; the browsable report is generated in `backend/coverage/index.html`.

The backend includes household setup and pairing, ledger and balances, monthly plans, recurrence, offline sync, and local Android distribution. See [backend/API.md](backend/API.md) for wire conventions and a setup walkthrough, and [backend/API_COVERAGE.md](backend/API_COVERAGE.md) for the mapping from Android actions to endpoints. Keep the API on the home network only after device authentication and local HTTPS are configured.

SQLite uses `backend/tmp/db.sqlite3` during development. Production requires `DB_PATH` to be an absolute path on persistent storage; create its parent directory before migrating. Keep the database and daily backups outside the deployed build directory. `HOUSEHOLD_TIME_ZONE` is an IANA name such as `America/Toronto`.

Set `HOST` to the home server's LAN address, `PORT` to its listening port, and `APP_URL` to the address phones should use. `HOST=localhost` remains the development default. The server and phones use the household time zone for calendar dates and reminders, even when a phone travels.

See [backend/OPERATIONS.md](backend/OPERATIONS.md) for Docker Desktop setup, daily backups, encrypted export, and restore on the household Mac. [TASKS.md](TASKS.md) tracks remaining host and Android work.

## Android development

The Android starter project lives in [`mobile/`](mobile/). See [`mobile/README.md`](mobile/README.md) for build instructions and access to the backend OpenAPI contract. Implementation remains tracked in [TASKS.md](TASKS.md).

## Web development

The online desktop-browser client lives in [`frontend/`](frontend/README.md). It uses TanStack Start, Tailwind CSS and the existing Adonis API. API route/request/response types are generated directly from Adonis with Tuyau (`npm run api:generate` in `frontend/`). See the frontend README for pairing, development, checks and the opt-in Docker deployment; Android and backend-only operation remain available.
