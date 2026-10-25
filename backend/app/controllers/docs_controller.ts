import type { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'
import { readFile } from 'node:fs/promises'

type Schema = Record<string, any>
type Operation = {
  summary?: string
  description?: string
  security?: unknown[]
  parameters?: Array<{ name: string; in: string; required?: boolean; schema: Schema }>
  requestBody?: { content: Record<string, { schema: Schema; example?: unknown }> }
  responses: Record<
    string,
    { description: string; content?: Record<string, { schema: Schema; example?: unknown }> }
  >
}
type OpenApi = {
  info: { title: string; version: string }
  components: { schemas: Record<string, Schema> }
  paths: Record<string, Record<string, Operation>>
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!
  )
}

async function specification(): Promise<string> {
  return readFile(app.makePath('openapi/v1.json'), 'utf8')
}

function expandSchema(schema: Schema, spec: OpenApi, depth = 0): Schema {
  if (depth > 4) return schema
  if (schema.$ref)
    return expandSchema(
      spec.components.schemas[String(schema.$ref).split('/').at(-1)!],
      spec,
      depth + 1
    )
  if (Array.isArray(schema))
    return schema.map((item) => expandSchema(item, spec, depth + 1)) as unknown as Schema
  if (!schema || typeof schema !== 'object') return schema
  return Object.fromEntries(
    Object.entries(schema).map(([key, value]) => [
      key,
      value && typeof value === 'object' ? expandSchema(value as Schema, spec, depth + 1) : value,
    ])
  )
}

function schemaBlock(title: string, schema: Schema, spec: OpenApi, example?: unknown): string {
  return `<h3>${escapeHtml(title)}</h3><pre>${escapeHtml(JSON.stringify(expandSchema(schema, spec), null, 2))}</pre>${example === undefined ? '' : `<h4>Example</h4><pre>${escapeHtml(JSON.stringify(example, null, 2))}</pre>`}`
}

export default class DocsController {
  async spec({ response }: HttpContext) {
    response.header('Content-Type', 'application/json; charset=utf-8')
    response.header('Content-Disposition', 'attachment; filename="budget-openapi-v1.json"')
    return response.send(await specification())
  }

  async index({ response }: HttpContext) {
    const spec = JSON.parse(await specification()) as OpenApi
    const sections = Object.entries(spec.paths)
      .flatMap(([path, operations]) =>
        Object.entries(operations)
          .filter(([method]) => ['get', 'post', 'put', 'patch', 'delete'].includes(method))
          .map(([method, operation]) => {
            const auth =
              operation.security?.length === 0
                ? 'Public'
                : 'Authorization: Bearer &lt;device credential&gt;'
            const params =
              operation.parameters
                ?.map(
                  (parameter) =>
                    `<li><code>${escapeHtml(parameter.name)}</code> in ${escapeHtml(parameter.in)}${parameter.required ? ' (required)' : ''}: <code>${escapeHtml(JSON.stringify(parameter.schema))}</code></li>`
                )
                .join('') ?? ''
            const body = operation.requestBody
              ? Object.entries(operation.requestBody.content)
                  .map(([media, value]) =>
                    schemaBlock(`Request body (${media})`, value.schema, spec, value.example)
                  )
                  .join('')
              : ''
            const responses = Object.entries(operation.responses)
              .map(
                ([status, value]) =>
                  `<li><strong>${escapeHtml(status)}</strong> ${escapeHtml(value.description)}${
                    value.content
                      ? Object.entries(value.content)
                          .map(([media, content]) =>
                            schemaBlock(
                              `Response (${media})`,
                              content.schema,
                              spec,
                              content.example
                            )
                          )
                          .join('')
                      : ''
                  }</li>`
              )
              .join('')
            return `<details><summary><strong>${escapeHtml(method.toUpperCase())}</strong> <code>${escapeHtml(path)}</code> — ${escapeHtml(operation.summary ?? '')}</summary><p>${escapeHtml(operation.description ?? '')}</p><p>${auth}</p>${params ? `<h3>Parameters</h3><ul>${params}</ul>` : ''}${body}<h3>Response statuses</h3><ul>${responses}</ul></details>`
          })
      )
      .join('\n')
    response.header('Content-Type', 'text/html; charset=utf-8')
    return response.send(
      `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(spec.info.title)} API</title><style>body{font:16px system-ui;max-width:900px;margin:2rem auto;padding:0 1rem}details{padding:.7rem;border-bottom:1px solid #ddd}summary{cursor:pointer}code{white-space:nowrap}</style><h1>${escapeHtml(spec.info.title)} API</h1><p>Version ${escapeHtml(spec.info.version)} · <a href="/openapi/v1.json">Download OpenAPI 3.1 specification</a></p>${sections}</html>`
    )
  }
}
