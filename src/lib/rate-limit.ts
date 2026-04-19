/**
 * Simple in-memory rate limiter.
 * Resets per window — not sliding window, but good enough for a personal app.
 * Note: resets on server restart (Vercel cold start). For persistent limits,
 * use an external store (Redis/Upstash). Sufficient to prevent runaway abuse.
 */

interface Entry {
  count: number
  reset: number // Unix ms
}

const store = new Map<string, Entry>()

// Clean up old entries every 10 minutes to avoid memory leak
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (now > entry.reset) store.delete(key)
  }
}, 10 * 60 * 1000)

export interface RateLimitResult {
  ok: boolean
  remaining: number
  resetInMs: number
}

/**
 * @param key      Unique identifier (e.g. IP address + endpoint)
 * @param max      Max requests allowed per window
 * @param windowMs Window size in milliseconds
 */
export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.reset) {
    store.set(key, { count: 1, reset: now + windowMs })
    return { ok: true, remaining: max - 1, resetInMs: windowMs }
  }

  if (entry.count >= max) {
    return { ok: false, remaining: 0, resetInMs: entry.reset - now }
  }

  entry.count++
  return { ok: true, remaining: max - entry.count, resetInMs: entry.reset - now }
}
