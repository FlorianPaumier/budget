process.env.NODE_ENV ??= 'production'
const { SESSION_SECRET, WEB_ORIGIN, BUDGET_API_URL } = process.env
if (!SESSION_SECRET || SESSION_SECRET.length < 32)
  throw new Error('SESSION_SECRET must contain at least 32 characters')
for (const [name, value] of Object.entries({ WEB_ORIGIN, BUDGET_API_URL })) {
  const url = new URL(value)
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.origin !== value
  )
    throw new Error(`Invalid ${name}`)
}
if (process.env.NODE_ENV === 'production' && !WEB_ORIGIN.startsWith('https://'))
  throw new Error('Production requires HTTPS')
