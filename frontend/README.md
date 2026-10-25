# Foyer web

Online household budget client: TanStack Start, React, TypeScript, TanStack Query and Tailwind CSS v4. French interface, CAD cents, household calendar dates. Runs beside the existing AdonisJS API; no separate financial database or offline queue.

## Develop

Use Node **24.15+** (Node 24 LTS recommended) and npm 11+. Install backend dependencies first, because the generated client types refer to the backend validators and controllers.

```sh
cd backend
npm ci
npm run api:generate
npm run dev
```

In another terminal, from the workspace root:

```sh
cd frontend
npm ci
cp .env.example .env
```

Generate a private `SESSION_SECRET` with `openssl rand -base64 48` and put it in `.env`. Never commit it. Keep `BUDGET_API_URL=http://127.0.0.1:3333` and `WEB_ORIGIN=http://localhost:3000` for development.

```sh
npm run dev
```

Open **http://localhost:3000**. From an already associated Android device, generate a pairing code and enter it here within five minutes. Household bootstrap remains an operator action. The browser has its own revocable device credential.

If no associated device is available, run `docker compose exec budget node build/ace.js pairing:code` from `backend/` on the server (or `node ace.js pairing:code` for a non-Docker backend). Paste the resulting single-use code into the browser within five minutes. This uses the existing household without resetting its data. The pairing page includes these instructions under **Aucun appareil déjà associé ?**.

The development default `http://127.0.0.1:3333` requires an API listening on that host port. The Docker backend does not expose it. For the home Docker setup, use the frontend Compose override below and open **https://192.168.40.71**; the frontend connects to Adonis over Docker's private network.

To develop locally against the home Docker backend instead, set `BUDGET_API_URL=https://192.168.40.71` and `NODE_EXTRA_CA_CERTS=../mobile/app/src/main/res/raw/budget_home_root.pem` in `frontend/.env`, then restart `npm run dev`. The development launcher loads the environment before starting Vite's Node process so the bundled public CA is trusted from startup. Keep `WEB_ORIGIN=http://localhost:3000` and open that exact address.

## Ownership

- `src/routes/`: typed URLs, validated search parameters, authentication gate and prefetch.
- `src/features/`: screens, explicit server functions, query definitions and feature calculations.
- `src/server/`: fixed-origin API transport, request/session security and generated route adapter. Server-only modules are protected by Start's import checking.
- `src/lib/`: exact money/date helpers, API boundary schemas and safe error presentation.
- `src/components/`: shared shell, month selector behavior, request states and form feedback. No global state store or repository layer.
- `src/styles/app.css`: Tailwind v4 theme tokens, local Manrope font, responsive light/dark UI.

Adonis owns balances, plans, recurrence, validation and history. The browser changes accepted financial totals only after a successful API response. Normal edits carry the revision observed when the form opened. A stale write shows a conflict; reviewing a newer version is explicit. A lost write response is uncertain: refresh and explicitly review server data before submitting again. Open financial/category/reminder drafts retain their original revision across refreshes and deletions. Editing and navigation are blocked while a save is pending. Unsaved navigation requires confirmation.

The session is sealed in an HTTP-only cookie, with a fixed seven-day expiry. Production requires HTTPS and a strong runtime secret. Credentials are never placed in localStorage, query data or browser-readable cookies. Queries are request-scoped during SSR and keyed by household/month in the browser. Revocation clears protected caches; the server validates device access on API calls. Logout clears the local session even if remote revocation fails and then explains the remaining device access.

### API types come from Adonis

```sh
npm run api:generate
npm run api:check
```

These run **`node ace codegen`**, using the backend's existing Tuyau hook. The generated registry supplies route names, HTTP methods, parameters, request bodies, queries and controller response types. There is no separate hand-maintained frontend DTO model or OpenAPI client copy. `api:check` compares the existing registry with fresh generation without requiring Git.

Small Zod decoders validate actual network data and are checked against the generated response types. Existing backend serializers contain broad `any` fields; decoders keep the frontend's consumed values narrow and reject malformed JSON at runtime. The route adapter normalizes Tuyau's inference for controllers that execute several independent validators. Its limit is documented in `src/server/endpoint.ts`; alternative request-body unions need review before introducing them.

Generated registry files currently live outside `frontend/`. Keep backend sources/dependencies beside the frontend for development and typechecks. Docker builds copy only the generated runtime route registry into their build context, never backend credentials or database files.

## Checks

```sh
npm run api:check
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium firefox
npm run test:e2e
WEB_BROWSER=firefox npm run test:e2e
```

On Windows PowerShell, set `$env:WEB_BROWSER='firefox'` before the last command, then remove it afterward. Chromium is the default. Safari/WebKit is not yet a supported/tested target.

Browser tests require free loopback ports **3000 and 4333**. They create a disposable database under the OS temp directory, bootstrap only that database, start real Adonis plus the built Start server, and remove their data/processes afterward. They refuse occupied ports and never use the development or production household database. Their seven-day cookie uses the development name because the local test server uses HTTP. The separate deployment check verifies production cookies and TLS.

With Docker available, build and check the production package from the workspace root:

```sh
docker build -f frontend/Dockerfile -t budget-frontend:verification .
cd frontend
npm run test:deployment
```

The deployment check creates a private temporary network and containers, trusts only the temporary Caddy root CA for its HTTPS requests, and removes its resources. It tests production routing/session/CSP/CSRF with a synthetic upstream; real financial semantics are covered by the Adonis browser suite. It does not deploy to the household server.

## Production and rollback

See `../backend/OPERATIONS.md`, section **Optional web frontend**. The existing backend-only Compose file remains usable. Frontend deployment is explicitly enabled through `compose.frontend.yaml`.

No CI provider/repository has been invented: the workspace root currently has no Git metadata. Run the gates above before releases; wire them into the actual repository's CI once its ownership is decided.

Nitro's current official Vite adapter is a prerelease, pinned exactly in `package.json` and locked with the rest of the toolchain. Review its release notes and rerun all gates before upgrading it. Browser data is an in-memory cache; unsaved drafts do not survive a browser crash, session expiry or household switch. There is no automatic mutation retry, background queue, QR scanner, desktop wrapper, or web notification scheduler.
