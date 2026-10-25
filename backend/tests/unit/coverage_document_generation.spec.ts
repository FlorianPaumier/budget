import { test } from '@japa/runner'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import SwaggerParser from '@apidevtools/swagger-parser'

const execute = promisify(execFile)

test.group('OpenAPI publication', () => {
  test('generates the shipped contract into an operator-selected output file', async ({
    assert,
  }) => {
    const dir = await mkdtemp(join(tmpdir(), 'budget-openapi-generation-'))
    try {
      const target = join(dir, 'nested', 'v1.json')
      await execute(process.execPath, ['scripts/generate_openapi.mjs', target])
      const generated = JSON.parse(await readFile(target, 'utf8'))
      const shipped = JSON.parse(await readFile(resolve('openapi/v1.json'), 'utf8'))
      assert.deepEqual(generated, shipped)
      await SwaggerParser.validate(generated)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
