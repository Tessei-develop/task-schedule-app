/**
 * Auth helpers for the single-password gate.
 *
 * Uses Web Crypto so it runs in Edge runtime (middleware).
 * Cookies are HMAC-signed and contain an absolute expiry timestamp.
 */

const COOKIE_NAME = 'app_auth'
const MAX_AGE_SEC = 90 * 24 * 60 * 60 // 90 days

const enc = new TextEncoder()

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

function b64urlEncode(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(str: string): Uint8Array {
  const pad = (4 - (str.length % 4)) % 4
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad)
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

/** Constant-time string comparison — protects against timing attacks. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Sign a payload with HMAC-SHA256, returning `payload.signature` (base64url). */
async function sign(payload: string, secret: string): Promise<string> {
  const key = await getKey(secret)
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  return `${payload}.${b64urlEncode(new Uint8Array(sig))}`
}

async function verifySignature(token: string, secret: string): Promise<boolean> {
  const dot = token.lastIndexOf('.')
  if (dot < 0) return false
  const payload = token.slice(0, dot)
  const sigB64 = token.slice(dot + 1)
  try {
    const key = await getKey(secret)
    const sig = b64urlDecode(sigB64)
    // sig.buffer narrows to ArrayBuffer for crypto.subtle.verify's BufferSource type
    return await crypto.subtle.verify('HMAC', key, sig.buffer as ArrayBuffer, enc.encode(payload))
  } catch {
    return false
  }
}

/** Create a session token good for MAX_AGE_SEC seconds. */
export async function createSessionToken(secret: string): Promise<string> {
  const expiresAt = Date.now() + MAX_AGE_SEC * 1000
  return sign(`v1:${expiresAt}`, secret)
}

/** True if the token is signed correctly AND not expired. */
export async function isValidSession(token: string | undefined, secret: string): Promise<boolean> {
  if (!token) return false
  if (!(await verifySignature(token, secret))) return false
  const dot = token.lastIndexOf('.')
  const payload = token.slice(0, dot)
  const m = payload.match(/^v1:(\d+)$/)
  if (!m) return false
  return Date.now() < parseInt(m[1], 10)
}

export const AUTH_COOKIE_NAME = COOKIE_NAME
export const AUTH_MAX_AGE_SEC = MAX_AGE_SEC
