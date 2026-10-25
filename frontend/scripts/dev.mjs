import { spawn } from 'node:child_process'

// Node reads NODE_EXTRA_CA_CERTS at startup, before the parent loads .env.
const child = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '3000'],
  { stdio: 'inherit', env: process.env },
)
child.on('error', (error) => {
  console.error(error.message)
  process.exit(1)
})
child.on('exit', (code) => process.exit(code ?? 1))
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => child.kill(signal))
