/**
 * Lê o usuário da sessão Supabase gravada no cookie, sem chamar o Auth.
 * O access token continua sendo validado pelo PostgREST em cada query.
 * Só consideramos a sessão "fresca" se o JWT expira daqui a mais de 90s;
 * perto do vencimento o caller deve chamar getUser() para renovar.
 */

const FRESH_SKEW_SEC = 90;
const BASE64_PREFIX = 'base64-';

export type FreshSessionUser = {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
  aud?: string;
  role?: string;
};

type CookieLike = { name: string; value: string };

function decodeBase64Url(input: string): string {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function storageKeyFromUrl(supabaseUrl: string): string | null {
  try {
    const ref = new URL(supabaseUrl).hostname.split('.')[0];
    return ref ? `sb-${ref}-auth-token` : null;
  } catch {
    return null;
  }
}

function readAuthCookieRaw(cookies: CookieLike[], key: string): string | null {
  const exact = cookies.find((cookie) => cookie.name === key);
  if (exact?.value) return exact.value;
  const parts: string[] = [];
  for (let i = 0; i < 8; i += 1) {
    const chunk = cookies.find((cookie) => cookie.name === `${key}.${i}`);
    if (!chunk?.value) break;
    parts.push(chunk.value);
  }
  return parts.length > 0 ? parts.join('') : null;
}

function decodeJwtPayload(accessToken: string): { sub: string; exp: number; email?: string } | null {
  const part = accessToken.split('.')[1];
  if (!part) return null;
  try {
    const payload = JSON.parse(decodeBase64Url(part)) as { sub?: unknown; exp?: unknown; email?: unknown };
    if (typeof payload.sub !== 'string' || !payload.sub) return null;
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) return null;
    return {
      sub: payload.sub,
      exp: payload.exp,
      email: typeof payload.email === 'string' ? payload.email : undefined,
    };
  } catch {
    return null;
  }
}

/** Usuário da sessão local, ou null se o cookie não existe / está perto de expirar. */
export function readFreshSessionUser(cookies: CookieLike[], supabaseUrl: string): FreshSessionUser | null {
  const key = storageKeyFromUrl(supabaseUrl);
  if (!key) return null;
  const raw = readAuthCookieRaw(cookies, key);
  if (!raw) return null;

  let decoded = raw;
  if (raw.startsWith(BASE64_PREFIX)) {
    try {
      decoded = decodeBase64Url(raw.slice(BASE64_PREFIX.length));
    } catch {
      return null;
    }
  }

  type StoredSession = {
    access_token?: string;
    user?: FreshSessionUser & { id?: string };
  };
  let session: StoredSession | null = null;
  try {
    session = JSON.parse(decoded) as StoredSession;
  } catch {
    return null;
  }

  const accessToken = session?.access_token;
  if (!accessToken) return null;
  const claims = decodeJwtPayload(accessToken);
  if (!claims) return null;

  const now = Math.floor(Date.now() / 1000);
  if (claims.exp <= now + FRESH_SKEW_SEC) return null;

  const stored = session?.user;
  if (stored && stored.id === claims.sub) {
    return {
      ...stored,
      id: claims.sub,
      email: stored.email ?? claims.email ?? null,
    };
  }

  return { id: claims.sub, email: claims.email ?? null, aud: 'authenticated' };
}
