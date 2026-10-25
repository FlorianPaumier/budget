import '@tanstack/react-start/server-only'
import { readEnv } from './security'
export function getEnv() {
  return readEnv(process.env)
}
