'use server';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/agenda/cleanup-gcal-dup
 * Remove do GCal e do DB as linhas duplicadas com título [HUB-FLY]
 * que o cron reimportou como origem='google_calendar'.
 * Processar 3 por vez — rodar em loop até total=0.
 */
export const dynamic = 'force-dynamic';

type SA = { client_email: string; private_key: string };

function b64u(buf: ArrayBuffer | Uint8Array) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...b)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
}

async function getToken(sa: SA, email: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const h = b64u(new TextEncoder().encode(JSON.stringify({ alg:'RS256', typ:'JWT' })));
  const p = b64u(new TextEncoder().encode(JSON.stringify({
    iss: sa.client_email, sub: email,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  })));
  const si = `${h}.${p}`;
  const pem = sa.private_key.replace(/-----BEGIN PRIVATE KEY-----/,'').replace(/-----END PRIVATE KEY-----/,'').replace(/\s/g,'');
  const key = await crypto.subtle.importKey('pkcs8',
    Uint8Array.from(atob(pem), c => c.charCodeAt(0)),
    { name:'RSASSA-PKCS1-v1_5', hash:'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(si));
  const jwt = `${si}.${b64u(sig)}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body: new URLSearchParams({ grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  const d = await res.json() as { access_token?: string };
  if (!d.access_token) throw new Error('token error');
  return d.access_token;
}

export async function GET() {
  const adminDb = createAdminClient();
  const sa = JSON.parse(process.env.GOOGLE_CALENDAR_SA_KEY!) as SA;

  // Buscar duplicatas: origem=google_calendar com título [HUB-FLY]
  const { data: rows } = await (adminDb.from('gantt_planejamento') as any)
    .select('id, google_calendar_event_id, profile_id')
    .eq('origem', 'google_calendar')
    .ilike('titulo', '[HUB-FLY]%')
    .limit(3);

  const items = ((rows ?? []) as { id: string; google_calendar_event_id: string; profile_id: string }[]);
  const results: { id: string; ok: boolean; err?: string }[] = [];

  // Cache de tokens por profile_id
  const tokenCache = new Map<string, string>();

  for (const row of items) {
    try {
      // Pegar email do usuário
      let token = tokenCache.get(row.profile_id);
      if (!token) {
        const { data: { user } } = await adminDb.auth.admin.getUserById(row.profile_id);
        if (!user?.email) throw new Error('email não encontrado');
        token = await getToken(sa, user.email);
        tokenCache.set(row.profile_id, token);
      }

      // Deletar do GCal
      const gcalRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${row.google_calendar_event_id}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
      );

      if (gcalRes.ok || gcalRes.status === 404 || gcalRes.status === 410) {
        // Deletar do DB
        await adminDb.from('gantt_planejamento').delete().eq('id', row.id);
        results.push({ id: row.id, ok: true });
      } else {
        const txt = await gcalRes.text();
        results.push({ id: row.id, ok: false, err: `GCal ${gcalRes.status}: ${txt.slice(0,100)}` });
      }
    } catch (e) {
      results.push({ id: row.id, ok: false, err: String(e) });
    }
  }

  const ok = results.filter(r => r.ok).length;
  console.log(`[gcal-cleanup] ${ok}/${items.length} removidos`);
  return NextResponse.json({ total: items.length, ok, results });
}
