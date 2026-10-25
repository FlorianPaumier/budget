import { routes } from '../../../backend/.adonisjs/client/registry/index'
import type { Registry } from '../../../backend/.adonisjs/client/registry/schema'
type Intersect<Union> = (
  Union extends unknown ? (value: Union) => void : never
) extends (value: infer Value) => void
  ? Value
  : never
type WithoutParams<Value, Params> = Value extends unknown
  ? Omit<Value, keyof Params>
  : never
type RequiredIfPresent<Key extends string, Value> =
  Record<string, never> extends Value
    ? { [Property in Key]?: Value }
    : { [Property in Key]: Value }
// Tuyau scans separate validateUsing calls as a union; these controllers require every validator.
// shortcut: intersect independent validators, revisit if controllers introduce alternative request-body unions.
export type EndpointArgs<Name extends keyof Registry> = RequiredIfPresent<
  'body',
  Intersect<
    WithoutParams<
      Registry[Name]['types']['body'],
      Registry[Name]['types']['params']
    >
  >
> &
  RequiredIfPresent<'params', Registry[Name]['types']['params']> &
  RequiredIfPresent<
    'query',
    Intersect<
      WithoutParams<
        Registry[Name]['types']['query'],
        Registry[Name]['types']['params']
      >
    >
  >
export function endpoint<Name extends keyof Registry>(
  name: Name,
  args: EndpointArgs<Name>,
) {
  const route = routes[name]
  let path: string = route.pattern
  for (const [key, value] of Object.entries(args.params || {}))
    path = path.replace(`:${key}`, encodeURIComponent(String(value)))
  if (path.includes(':')) throw new Error('Missing route parameter')
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(args.query || {}))
    if (value !== undefined) query.set(key, String(value))
  return {
    path: path.replace(/^\/api\/v1/, '') + (query.size ? `?${query}` : ''),
    options: {
      method: route.methods[0],
      ...(args.body ? { body: JSON.stringify(args.body) } : {}),
    },
  }
}
