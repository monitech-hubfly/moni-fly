/** Rate limit simples em memória (por IP) para endpoints públicos. */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

export function checkIpRateLimit(opts: {
  key: string
  limit: number
  windowMs: number
}): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now()
  const cur = buckets.get(opts.key)
  if (!cur || now >= cur.resetAt) {
    buckets.set(opts.key, { count: 1, resetAt: now + opts.windowMs })
    return { ok: true }
  }
  if (cur.count >= opts.limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((cur.resetAt - now) / 1000)) }
  }
  cur.count += 1
  return { ok: true }
}

export function clientIpFromRequest(req: Request): string {
  const xf = req.headers.get('x-forwarded-for')
  if (xf) return xf.split(',')[0]?.trim() || 'unknown'
  const real = req.headers.get('x-real-ip')
  if (real) return real.trim()
  return 'unknown'
}
