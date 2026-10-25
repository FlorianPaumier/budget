import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { randomBytes } from 'node:crypto'
import { request } from 'node:https'
import { toJSON } from 'seroval'

const suffix = randomBytes(5).toString('hex')
const network = `budget-web-check-${suffix}`
const names = ['api', 'web', 'proxy'].map((name) => `${network}-${name}`)
const temporary = mkdtempSync(join(tmpdir(), 'budget-web-tls-'))
const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
const wait = (ms) => new Promise((done) => setTimeout(done, ms))
const image = process.env.FRONTEND_IMAGE || 'budget-frontend:verification'
const secret = randomBytes(48).toString('base64url')
const stub = `require('node:http').createServer((req,res)=>{res.setHeader('Content-Type','application/json');if(req.url==='/api/v1/pair'){res.end(JSON.stringify({data:{credential:'synthetic-credential-for-deployment-check-only',deviceId:'64269ad3-a91e-4525-82e6-0af2d7ee7c23',householdId:'8d8158aa-42ca-493e-a019-7289c2e07152'}}));return}if(req.url.startsWith('/install')){res.statusCode=404;res.end(JSON.stringify({code:'APK_NOT_PUBLISHED'}));return}res.end(JSON.stringify({backend:true,path:req.url}))}).listen(3333,'0.0.0.0')`
try {
  docker('network', 'create', network)
  docker(
    'run',
    '-d',
    '--name',
    names[0],
    '--network',
    network,
    '--network-alias',
    'budget',
    image,
    'node',
    '-e',
    stub,
  )
  docker(
    'run',
    '-d',
    '--name',
    names[2],
    '--network',
    network,
    '-p',
    '127.0.0.1::443',
    '-v',
    `${resolve('../backend/Caddyfile.frontend')}:/etc/caddy/Caddyfile:ro`,
    'caddy:2',
  )
  const port = Number(docker('port', names[2], '443/tcp').split(':').at(-1))
  const origin = `https://budget.home.arpa:${port}`
  docker(
    'run',
    '-d',
    '--name',
    names[1],
    '--network',
    network,
    '--network-alias',
    'frontend',
    '-e',
    `SESSION_SECRET=${secret}`,
    '-e',
    `WEB_ORIGIN=${origin}`,
    '-e',
    'BUDGET_API_URL=http://budget:3333',
    image,
  )
  let ca
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      docker(
        'cp',
        `${names[2]}:/data/caddy/pki/authorities/local/root.crt`,
        join(temporary, 'root.crt'),
      )
      ca = readFileSync(join(temporary, 'root.crt'))
      break
    } catch {
      await wait(250)
    }
  }
  assert.ok(ca, 'Caddy generated a local root CA')
  function call(path, options = {}) {
    return new Promise((done, fail) => {
      const req = request(
        {
          hostname: '127.0.0.1',
          port,
          servername: 'budget.home.arpa',
          path,
          ca,
          method: options.method || 'GET',
          headers: { Host: `budget.home.arpa:${port}`, ...options.headers },
          timeout: 5000,
        },
        (res) => {
          let text = ''
          res.on('data', (part) => (text += part))
          res.on('end', () =>
            done({ status: res.statusCode, headers: res.headers, text }),
          )
        },
      )
      req.on('error', fail)
      req.on('timeout', () => req.destroy(new Error('TLS request timed out')))
      req.end(options.body)
    })
  }
  let page
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      page = await call('/pair')
      if (page.status === 200) break
    } catch {
      /* Container cleanup is best effort after failed startup. */
    }
    await wait(250)
  }
  assert.equal(page.status, 200)
  assert.match(page.text, /Associer ce navigateur/)
  assert.equal(page.headers['cache-control'], 'no-store')
  const policy = page.headers['content-security-policy']
  assert.ok(!policy.includes('unsafe-eval'))
  assert.ok(!policy.includes("script-src 'self' 'unsafe-inline'"))
  const nonce = policy.match(/'nonce-([^']+)'/)[1]
  for (const tag of page.text.match(/<script[^>]*>/g) || [])
    assert.ok(
      tag.includes(`nonce="${nonce}"`),
      'All scripts receive the CSP nonce',
    )
  for (const path of ['/api/v1/health', '/docs', '/openapi/v1.json'])
    assert.equal(JSON.parse((await call(path)).text).backend, true)
  for (const path of [
    '/install',
    '/install/budget.apk',
    '/install/version.json',
  ]) {
    const response = await call(path)
    assert.equal(response.status, 404)
    assert.equal(JSON.parse(response.text).code, 'APK_NOT_PUBLISHED')
  }
  assert.equal(JSON.parse((await call('/healthz')).text).status, 'ok')
  const ssr = readFileSync('.output/server/_ssr/ssr.mjs', 'utf8')
  const functionId = ssr.match(
    /"([a-f0-9]{64})": \{\s*functionName: "pair_createServerFn_handler"/,
  )[1]
  const body = JSON.stringify(
    toJSON({
      data: { pairingCode: 'x'.repeat(43), label: 'TLS verification' },
    }),
  )
  const headers = {
    'Content-Type': 'application/json',
    'x-tsr-serverFn': 'true',
    Origin: origin,
  }
  const paired = await call(`/_serverFn/${functionId}`, {
    method: 'POST',
    headers,
    body,
  })
  assert.equal(paired.status, 200)
  assert.ok(!paired.text.includes('synthetic-credential'))
  const cookie = paired.headers['set-cookie'].find((value) =>
    value.startsWith('__Host-budget-session='),
  )
  assert.match(cookie, /HttpOnly/i)
  assert.match(cookie, /Secure/i)
  assert.match(cookie, /SameSite=Lax/i)
  assert.match(cookie, /Path=\//i)
  const rejected = await call(`/_serverFn/${functionId}`, {
    method: 'POST',
    headers: { ...headers, Origin: 'https://evil.example' },
    body,
  })
  assert.equal(rejected.status, 403)
  for (const file of readdirSync('.output/public/assets').filter((file) =>
    file.endsWith('.js'),
  )) {
    const asset = readFileSync(`.output/public/assets/${file}`, 'utf8')
    assert.ok(
      !/SESSION_SECRET|BUDGET_API_URL/.test(asset),
      'Server configuration stays out of browser assets',
    )
  }
  console.log(
    'Production deployment passed: trusted Caddy TLS, routing, secure session, CSRF, CSP, client-bundle boundary.',
  )
} finally {
  for (const name of names)
    try {
      docker('rm', '-f', name)
    } catch {
      /* Container cleanup is best effort after failed startup. */
    }
  try {
    docker('network', 'rm', network)
  } catch {
    /* Container cleanup is best effort after failed startup. */
  }
  rmSync(temporary, { recursive: true, force: true })
}
