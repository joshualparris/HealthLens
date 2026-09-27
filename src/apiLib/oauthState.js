import { randomBytes, timingSafeEqual } from 'node:crypto'

const STATE_COOKIE_PREFIX = 'healthlens_oauth_state_'
const INTENT_COOKIE_PREFIX = 'healthlens_oauth_intent_'
const MAX_AGE_SECONDS = 10 * 60

function parseCookies(header = '') {
  return String(header)
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const index = part.indexOf('=')
      if (index > 0) {
        const key = part.slice(0, index)
        const value = part.slice(index + 1)
        acc[key] = decodeURIComponent(value)
      }
      return acc
    }, {})
}

function secureCookie(req) {
  const forwardedProto = req?.headers?.['x-forwarded-proto']
  return String(forwardedProto || '').split(',')[0].trim() === 'https' || process.env.NODE_ENV === 'production'
}

function cookieString(name, value, req, maxAge = MAX_AGE_SECONDS) {
  const attrs = [
    `${name}=${encodeURIComponent(value)}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/api',
    `Max-Age=${maxAge}`,
  ]
  if (secureCookie(req)) attrs.push('Secure')
  return attrs.join('; ')
}

function clearCookieString(name, req) {
  return cookieString(name, '', req, 0)
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''))
  const right = Buffer.from(String(b || ''))
  if (!left.length || left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export function beginOAuthState(provider, req, res, { intent = '' } = {}) {
  const state = randomBytes(32).toString('base64url')
  const stateName = `${STATE_COOKIE_PREFIX}${provider}`
  const intentName = `${INTENT_COOKIE_PREFIX}${provider}`
  const cookies = [cookieString(stateName, state, req)]
  if (intent) cookies.push(cookieString(intentName, intent, req))
  res.setHeader('Set-Cookie', cookies)
  return state
}

export function consumeOAuthState(provider, req, res, receivedState) {
  const stateName = `${STATE_COOKIE_PREFIX}${provider}`
  const intentName = `${INTENT_COOKIE_PREFIX}${provider}`
  const cookies = parseCookies(req?.headers?.cookie || '')
  const expected = cookies[stateName] || ''
  const intent = cookies[intentName] || ''

  res.setHeader('Set-Cookie', [
    clearCookieString(stateName, req),
    clearCookieString(intentName, req),
  ])

  return {
    valid: safeEqual(receivedState, expected),
    intent,
  }
}
