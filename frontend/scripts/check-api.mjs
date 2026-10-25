import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
const files = ['index.ts', 'schema.d.ts', 'tree.d.ts'].map(
  (file) =>
    new URL(`../../backend/.adonisjs/client/registry/${file}`, import.meta.url),
)
const before = files.map((file) => readFileSync(file, 'utf8'))
execFileSync('npm', ['run', 'api:generate'], { stdio: 'inherit' })
if (files.some((file, index) => readFileSync(file, 'utf8') !== before[index]))
  throw new Error('Adonis API contract drift: review regenerated registry')
