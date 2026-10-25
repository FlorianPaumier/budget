import { isAbsolute } from 'node:path'

export function resolveRuntimeConfig(input: {
  dbPath: string
  timeZone: string
  appUrl?: string
  production?: boolean
}) {
  if (input.production && !input.dbPath) {
    throw new Error('DB_PATH is required in production')
  }
  if (!isAbsolute(input.dbPath)) {
    throw new Error('DB_PATH must be absolute')
  }
  if (input.production && (!input.appUrl || new URL(input.appUrl).protocol !== 'https:')) {
    throw new Error('APP_URL must use HTTPS in production')
  }

  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: input.timeZone })
  } catch {
    throw new Error('invalid household time zone')
  }

  return input
}
