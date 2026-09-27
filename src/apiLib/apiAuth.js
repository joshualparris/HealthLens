import { timingSafeEqual } from 'node:crypto'

export function getBearerToken(req) {
  const auth = req?.headers?.authorization || req?.headers?.Authorization
  if (!auth || typeof auth !== 'string') return null
  const match = auth.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : null
}

export function safeSecretEqual(candidate, expected) {
  const left = Buffer.from(String(candidate || ''))
  const right = Buffer.from(String(expected || ''))
  if (!left.length || left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export function requireBearerSecret(req, res, secret, label = 'server secret') {
  if (!secret) {
    res.status(500).json({ error: `Server misconfigured: missing ${label}` })
    return false
  }
  const token = getBearerToken(req)
  if (!token) {
    res.status(401).json({ error: 'Missing Authorization header' })
    return false
  }
  if (!safeSecretEqual(token, secret)) {
    res.status(403).json({ error: 'Invalid credentials' })
    return false
  }
  return true
}
