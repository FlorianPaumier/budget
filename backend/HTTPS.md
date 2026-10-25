# Current home connection by IP

The current LAN origin is `https://192.168.40.71`. No local DNS entry is needed. Reserve this IP for the Mac in DHCP settings; changing it requires updating Caddy, Compose, the Android pairing default and network security configuration, and rebuilding the APK.

Caddy issues an IP certificate using the existing internal CA. `default_sni 192.168.40.71` handles clients that omit SNI for IP connections. Android trusts the bundled public root only for this IP and the legacy `budget.home.arpa` hostname; normal certificate verification and cleartext rejection remain enabled.

The installation page is `https://192.168.40.71/install`. Browsers need to trust the existing home CA separately. The APK can instead be transferred by USB without changing browser trust. The Android app already contains the public CA certificate.

Verify with:

```sh
curl --cacert mobile/app/src/main/res/raw/budget_home_root.pem https://192.168.40.71/api/v1/health
```

Phone installation, pairing, and sync still require hardware verification.

# Legacy home hostname setup

The production API address is `https://budget.home.arpa`. Configure the home router or local DNS server so `budget.home.arpa` resolves to the home server's LAN address on every household phone. Use that hostname in `APP_URL` and pairing QR codes; an IP address will not match Caddy's certificate.

`compose.yaml` publishes only Caddy's TCP port 443. AdonisJS listens on port 3333 inside the Compose network, with no host port mapping. Caddy terminates TLS using its internal CA and proxies to the API over that private Docker network. Keep Docker's published port 443 reachable only on the home network through the host firewall and router settings.

Set `APP_URL=https://budget.home.arpa` in `backend/.env.production` before starting Compose. Production configuration rejects an HTTP `APP_URL`. After `docker compose up -d --build` has started Caddy, export its public root certificate on the server:

```sh
cd backend
docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt ./budget-home-root.crt
openssl x509 -in budget-home-root.crt -noout -fingerprint -sha256
curl --cacert budget-home-root.crt https://budget.home.arpa/api/v1/health
```

The `curl` request should return `{"data":{"status":"ok"}}`. Check that it fails without the trusted root certificate on a device that has not been configured to trust it. The CA **private key** remains in the persistent `caddy_data` volume and must not be copied to a phone.

## Android app certificate trust

Package the exported `root.crt` as `app/src/main/res/raw/budget_home_root.pem` in the private Android build. Trust that root only for `budget.home.arpa` using `app/src/main/res/xml/network_security_config.xml`:

```xml
<network-security-config>
  <base-config cleartextTrafficPermitted="false" />
  <domain-config cleartextTrafficPermitted="false">
    <domain>budget.home.arpa</domain>
    <trust-anchors>
      <certificates src="@raw/budget_home_root" />
    </trust-anchors>
  </domain-config>
</network-security-config>
```

Reference that file from `<application android:networkSecurityConfig="@xml/network_security_config">` in the Android manifest. The app should use the exact HTTPS hostname for installation updates, pairing, and API requests. A phone away from home keeps edits offline until it can reach that hostname again.

Transfer the root certificate from the server to the Android build by a trusted local method and compare its SHA-256 fingerprint at the server before packaging. Do not fetch the root certificate from an unauthenticated web page. Keep the `caddy_data` volume through server rebuilds; replacing the CA requires updating the Android app's bundled certificate.

## Deployment verification

Before calling home-network HTTPS complete, verify all of the following on the actual home server and an Android phone on home Wi-Fi:

1. `docker compose config --format json` shows a published port only for `caddy` (TCP 443); `budget` has no published host port.
2. The `curl --cacert` health request above succeeds with a valid certificate for `budget.home.arpa`, while the same request without the trusted root fails certificate verification.
3. The Android app, using its bundled root and the exact hostname, can pair and call a protected endpoint. An HTTP URL and a certificate for another hostname must fail.
4. The router and host firewall expose TCP 443 only to the intended home network; port 3333 is not reachable from another LAN device.
