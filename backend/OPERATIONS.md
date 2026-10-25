# Home server operations

Run the API on an always-on device connected to the home Wi-Fi. Set `DB_PATH` and `BACKUP_DIR` to separate persistent directories outside the deployed build. Give the service account exclusive read/write access. Set `HOST=0.0.0.0`, `APP_URL`, `INSTALL_BASE_URL`, and `APK_DIRECTORY` to the local HTTPS address and persistent APK directory. Use a local reverse proxy with a trusted household certificate for HTTPS. The Android app bundles the public home CA for the exact home hostname; a phone browser may need that CA installed separately to open the installation page. Keep the service off the public internet.

The supplied `compose.yaml` runs Caddy on port 443 with a local CA, keeps database, APK, backup, and CA volumes across restarts, and uses `restart: unless-stopped`. Point `budget.home.arpa` to the server's LAN address in your router's local DNS, or change the hostname in `Caddyfile`. Export Caddy's public root certificate (`docker compose exec -T caddy cat /data/caddy/pki/authorities/local/root.crt > budget-root.crt`), compare its fingerprint, and bundle it using the exact-host configuration in [HTTPS.md](HTTPS.md). The existing Android app trusts its bundled CA for `budget.home.arpa`; pairing does not depend on user-installed certificates. Phone browsers have their own trust settings for the installation page. Create `.env.production` with a stable `APP_KEY`, `APP_URL=https://budget.home.arpa`, `INSTALL_BASE_URL=https://budget.home.arpa`, `HOUSEHOLD_TIME_ZONE=America/Toronto`, and `LOG_LEVEL=info`. Run `docker compose up -d --build`; the API container runs migrations before serving requests.

Initialize the household once from inside the API container because `/api/v1/bootstrap` accepts loopback traffic only. Replace the example cent amounts and reminder hour with the household's opening balances and chosen time before running this command; save the returned pairing code for the first phone.

```sh
docker compose exec budget node -e 'fetch("http://127.0.0.1:3333/api/v1/bootstrap", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({openingSpendableCents:100000, openingSavingsCents:0, reminderTime:"09:00"})}).then(async response => { console.log(response.status, await response.text()) })'
```

See [HTTPS.md](HTTPS.md) for the certificate and Android trust steps.

For the existing Mac host, install Docker Desktop and enable **Start Docker Desktop when you sign in**. Keep the Mac awake while serving the household; system sleep stops the API and backups. Configure macOS Energy settings to prevent automatic sleep while plugged in, and ensure the Mac signs in after reboot if Docker Desktop requires a signed-in session. The container restart policy starts the services when Docker Desktop resumes. Verify this with a real Mac reboot and an HTTPS request from an Android phone. An actual power-loss recovery has not been verified by this repository.

## Daily backup

The SQLite backup API creates a consistent snapshot even while the API is running. Thirty dated backups are retained by default; set `BACKUP_RETENTION_DAYS` in `.env.production` to change this.

With Docker Compose, the `backups` service checks each minute and creates one snapshot after 03:00 in `HOUSEHOLD_TIME_ZONE`; if Docker Desktop resumes after that hour, it catches up once. It retains 30 dated backups by default. Inspect `docker compose logs backups` and confirm a dated file with `docker compose exec backups ls /backups`. No host cron setup is needed.

Also copy encrypted exports to a separate physical device. A backup stored only on the home server will be lost with that server.

```sh
read -s BACKUP_PASSPHRASE
export BACKUP_PASSPHRASE
docker compose exec -T -e BACKUP_PASSPHRASE backups node scripts/maintenance.mjs export /backups/budget-YYYY-MM-DD.sqlite3 /backups/budget-YYYY-MM-DD.enc
docker compose cp backups:/backups/budget-YYYY-MM-DD.enc /Volumes/ExternalDrive/budget-YYYY-MM-DD.enc
unset BACKUP_PASSPHRASE
```

Store the passphrase separately from the backup. The export uses scrypt and AES-256-GCM; the decrypt command rejects a wrong passphrase or altered file.

## Restore

Stop the API and backup worker. Keep a copy of the current database. Decrypt an export to a new path, run `PRAGMA integrity_check`, and replace `DB_PATH`. Never restore over a running SQLite connection.

```sh
docker compose cp /Volumes/ExternalDrive/budget-YYYY-MM-DD.enc backups:/backups/budget-YYYY-MM-DD.enc
docker compose stop budget backups
read -s BACKUP_PASSPHRASE
export BACKUP_PASSPHRASE
docker compose run --rm --no-deps -e BACKUP_PASSPHRASE budget node scripts/maintenance.mjs decrypt /backups/budget-YYYY-MM-DD.enc /data/restore.sqlite3
unset BACKUP_PASSPHRASE
docker compose run --rm --no-deps --workdir /app/build budget node -e 'const D=require("better-sqlite3");const d=new D("/data/restore.sqlite3",{readonly:true});const r=d.pragma("integrity_check");d.close();if(r.length!==1||r[0].integrity_check!=="ok")process.exit(1)'
docker compose run --rm --no-deps --entrypoint sh budget -c 'mv /data/budget.sqlite3 /data/budget.before-restore.sqlite3 && mv /data/restore.sqlite3 /data/budget.sqlite3'
docker compose run --rm --no-deps --workdir /app/build budget node ace.js migration:run --force
docker compose run --rm --no-deps budget node scripts/maintenance.mjs reset-sync /data/budget.sqlite3
docker compose up -d
```

Before restarting after **every restore**, migrate an older backup with `docker compose run --rm --no-deps --workdir /app/build budget node ace.js migration:run --force`, then run `reset-sync` as shown above. It checks SQLite integrity and changes the sync generation. Updated phones rebuild accepted caches from cursor zero, preserve queued edits, and require review for edits based on the previous history. Update all phones to the recovery-capable app before restoring; older apps do not recognize generations. Do not clear app storage, because that deletes queued edits.

Confirm `https://budget.home.arpa/api/v1/health`, balances, and device access after restore. The prior database remains as `budget.before-restore.sqlite3` until you remove it deliberately.

An unencrypted daily backup follows the same stopped-server, migration, and `reset-sync` procedure.

## Android release

Sign the APK using the Android release signing key before publishing it. Generate a separate Ed25519 metadata signing key and embed its public key in the Android app's update verifier. Publish the APK with:

```sh
node scripts/maintenance.mjs publish-apk signed-budget.apk /srv/budget/apk 1.2.0 12 /srv/budget/secrets/update-signing-key.pem
```

The local `/install` page shows a download link and QR code; `/install/version.json` contains the version, APK SHA-256 hash, and metadata signature. Installing the app and pairing it are separate steps. The server does not generate or sign the Android APK.

## Optional web frontend

The web client is a separate TanStack Start process. Existing backend-only commands continue to use `compose.yaml`. Enable the web client only when ready; no new database migrations are required.

1. Install frontend dependencies and run the checks in `../frontend/README.md`, including `npm run api:generate` before a Docker build. The backend's generated Tuyau registry is part of the frontend build input.
2. Copy `../frontend/.env.production.example` privately to `.env.frontend.production` beside this Compose file. Generate a strong `SESSION_SECRET` (`openssl rand -base64 48`) and set `WEB_ORIGIN` to the exact browser origin, including scheme and any non-default port. Use the existing private HTTPS IP origin or household hostname consistently; each origin has its own browser cookies.
3. Tag/archive the current frontend image before an update. Build and start with the explicit override:

```sh
docker compose -f compose.yaml -f compose.frontend.yaml build frontend
docker compose -f compose.yaml -f compose.frontend.yaml up -d
```

The frontend reaches Adonis internally at `http://budget:3333`; only Caddy exposes HTTPS. `Caddyfile.frontend` routes `/api/*`, `/docs`, `/openapi/v1.json`, `/install` and `/install/*` to Adonis, and web pages/assets/server functions to Start. The session secret is supplied at runtime, never built into browser assets. A missing/weak secret or non-HTTPS production origin prevents startup. The public `/healthz` reports only process liveness; API connection failures appear in the web UI.

Trust the existing public Caddy root CA in the server PC browser using the same CA described in `HTTPS.md`. Do not disable certificate validation. Generate a code from an already associated device, or run the following locally from `backend/` when no associated device is available:

```sh
docker compose exec budget node build/ace.js pairing:code
```

Open the configured HTTPS origin and paste the code into **Code d’association** within five minutes. It works once, creates a separate browser device, and leaves existing household data intact. Without Docker, run `node ace.js pairing:code` against the intended server configuration. This operator command is not a public HTTP endpoint. Do not bootstrap the existing household again.

After deployment, check browser pairing, a hard refresh on `/transactions`, secure HTTP-only cookies, `/api/v1/health`, `/docs`, the OpenAPI download and the existing Android install page/APK. Web request logs contain only request ID, method, status and duration; do not enable payload, cookie or authorization logging at the proxy.

For rollback, restore the previous tagged frontend image and restart the frontend service, then reload the matching Caddy configuration. To remove web serving entirely, restore the backend-only proxy with `docker compose -f compose.yaml up -d --force-recreate caddy`, then stop the frontend service through the override. Existing household data and backend volumes are unchanged. Do not run `down -v`. Keep `.env.frontend.production` private and backed up; rotating `SESSION_SECRET` invalidates all browser cookies, so browsers must pair again and old device entries can be revoked from another device.

The web app has no offline queue. If saving loses its response, verify the transaction list before trying again; direct API creation has no idempotency key. The browser's appearance preference is the only localStorage item.
