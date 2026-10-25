import type { Registry } from '../../../backend/.adonisjs/client/registry/schema'
export type ApiBody<Name extends keyof Registry> =
  Registry[Name]['types']['body']
export type ApiData<Name extends keyof Registry> =
  Registry[Name]['types']['response'] extends { data: infer Data } ? Data : null
