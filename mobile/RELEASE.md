# Signed household releases

The current home release is **0.1.6 / version code 7**. Use a full JDK 21 and Android SDK 36.

## Keys

Signing material lives outside this checkout in `~/.config/household-budget/signing/`, with directory mode 700 and private-file mode 600:

- `release.p12`: Android APK signing key, alias `budget`.
- `release.properties`: local Gradle signing settings (`storeFile`, `storePassword`, `keyAlias`, `keyPassword`).
- `update-ed25519.pem`: Ed25519 private key for backend update metadata.

Gradle loads `release.properties` from that directory, or from `BUDGET_SIGNING_PROPERTIES`. Missing signing settings produce an unsigned release; never publish that file. Keep the same APK key and metadata key for future releases. Store an encrypted backup of these private files outside the Mac. The repository contains only the public metadata key, `app/src/main/res/raw/update_public_key.der`.

For a new household installation, generate a PKCS12 RSA signing key using JDK `keytool -genkeypair` (alias `budget`, RSA 3072, validity 10000), and an Ed25519 metadata key using `openssl genpkey -algorithm ED25519`. Enter passwords locally; never commit them. Export the metadata public key with:

```sh
openssl pkey -in /private/path/update-ed25519.pem -pubout -outform DER \
  -out app/src/main/res/raw/update_public_key.der
```

Replacing keys changes the trust relationship; existing installations need the original keys for normal upgrades.

## Build and verify

From `mobile/`:

```sh
./gradlew :app:testDebugUnitTest :app:assembleRelease :app:lintDebug
"$ANDROID_SDK_ROOT/build-tools/36.0.0/apksigner" verify --print-certs \
  app/build/outputs/apk/release/app-release.apk
```

The release certificate SHA-256 is `fc93e2cb1a026ffb08665b05824b7b101015d73af41096c629ed77fcb1cfdd14`. The signed APK is `app/build/outputs/apk/release/app-release.apk`. Debug builds use a different certificate; install the signed household release for household use.

Increase both the version name and integer version code for each publication. Defaults are in `app/build.gradle.kts`; reproducible overrides are `-PversionName=0.1.4 -PversionCode=5`.

## Publish to the home server

From the repository root, after the backend production build exists:

```sh
node backend/scripts/maintenance.mjs publish-apk \
  mobile/app/build/outputs/apk/release/app-release.apk /private/staging-directory \
  0.1.4 5 /private/path/update-ed25519.pem
```

Copy staging `budget.apk` and `version.json` into the running backend's `/apk` volume. The configured home origin is `https://192.168.40.71`; `INSTALL_BASE_URL` can override it in Docker Compose.

- Installation page: `https://192.168.40.71/install`.
- APK: `https://192.168.40.71/install/budget.apk`.
- Signed metadata: `https://192.168.40.71/install/version.json`.

The installation QR contains only the APK URL. Create a separate single-use pairing QR inside the app after installation. On actual phones, verify installation, the requested Android install permission, a later signed upgrade, HTTPS trust, and retained local data.

## In-app updates

Settings → Check for update fetches metadata from the paired HTTPS origin. Every check validates the metadata schema and Ed25519 signature before reporting that the app is current. Same-version checks do not download an APK. A newer APK becomes installable only after Ed25519 signature, advancing version code, and SHA-256 verification. Redirects and cleartext origins are rejected; response sizes are bounded. Missing publication, network errors, and invalid metadata/APKs show an unavailable message.

Verified APKs are kept in the private update cache and shared with Android's installer using a narrow FileProvider URI. Android may require allowing installation for Budget; return and tap Install again afterward. Actual installer behavior remains a physical-phone acceptance check.

## UI redesign publication — 2026-10-06

Version 0.1.4 / code 5 is published in the home APK volume. The HTTPS installation page reports 0.1.4; the served APK manifest reports code 5. The downloaded APK hash and signed metadata were verified against the application’s embedded Ed25519 public key, and the APK retains the household signing certificate. The previous publication is retained outside the repository for rollback.

## Local candidate — 2026-10-10

Version **0.1.5 / code 6** contains the French daily-use redesign. The signed APK is `app/build/outputs/apk/release/app-release.apk`; the certificate SHA-256 remains `fc93e2cb1a026ffb08665b05824b7b101015d73af41096c629ed77fcb1cfdd14`. It installs over the existing application without clearing its data. This candidate has **not been published to the installation QR endpoint**: the home server was unreachable during this session. The last verified published release remains 0.1.4 / code 5.

## Drawer candidate — 2026-10-10

The current local APK is **0.1.6 / code 7**. Add and Edit use an expanded bottom drawer and preserve the page underneath. All 157 tests pass; debug/release builds and lint pass. The signed release retains the household certificate and installs over 0.1.5. QR publication remains outstanding; the last verified server publication is 0.1.4 / code 5.

## QR publication — 2026-10-10

Version **0.1.6 / code 7** is now published to the home APK volume and served by `https://192.168.40.71/install`. The installation QR was decoded and points to `/install/budget.apk`. The downloaded APK manifest, unchanged household certificate, SHA-256 and Ed25519 metadata signature were verified. APK SHA-256: `20a6a44c508050d20c2795d28b7045687219dbe425cb36fa686d9d5e7d143bc7`.

The stopped Compose services were restarted using their existing image and persistent volumes. The existing CA fingerprint matches the bundled Android root. Caddy renewed its expired intermediate and leaf certificates; a restart completed valid TLS renewal. HTTPS health and all installation downloads succeed with the bundled CA. A snapshot of the previous APK publication and stopped database was retained outside the repository in the private household releases directory. Physical-phone installer acceptance remains open.
