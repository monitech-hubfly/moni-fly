import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/agenda/backfill-gcal?mode=cleanup
 * Temporário — remove do GCal todos os eventos que foram empurrados pelo HubFly.
 * Rodar em loop até total=0, depois apagar este arquivo.
 */
export const dynamic = 'force-dynamic';

type ServiceAccountKey = { client_email: string; private_key: string };

function base64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
}

async function makeJWT(creds: ServiceAccountKey, sub: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const h = base64url(new TextEncoder().encode(JSON.stringify({ alg:'RS256', typ:'JWT' })));
  const p = base64url(new TextEncoder().encode(JSON.stringify({
    iss: creds.client_email, sub, scope: 'https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  })));
  const sig_input = `${h}.${p}`;
  const pem = creds.private_key.replace(/-----BEGIN PRIVATE KEY-----/,'').replace(/-----END PRIVATE KEY-----/,'').replace(/\s/g,'');
  const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), c => c.charCodeAt(0)),
    { name:'RSASSA-PKCS1-v1_5', hash:'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(sig_input));
  return `${sig_input}.${base64url(sig)}`;
}

async function getToken(creds: ServiceAccountKey, email: string): Promise<string> {
  const jwt = await makeJWT(creds, email);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  const d = await res.json() as { access_token?: string };
  if (!d.access_token) throw new Error('token error');
  return d.access_token;
}

export async function GET(_request: Request) {
  const adminDb = createAdminClient();
  const creds = JSON.parse(process.env.GOOGLE_CALENDAR_SA_KEY!) as ServiceAccountKey;

  // Buscar em lotes de 10 para não dar timeout
  const { data: rows } = await (adminDb.from('gantt_planejamento') as any)
    .select('id, gcal_hubfly_push_id, gcal_hubfly_organizer_email')
    .not('gcal_hubfly_push_id', 'is', null)
    .limit(10);

  const items = ((rows ?? []) as { id: string; gcal_hubfly_push_id: string; gcal_hubfly_organizer_email: string }[]);
  const results: { id: string; ok: boolean }[] = [];

  for (const row of items) {
    try {
      const token = await getToken(creds, row.gcal_hubfly_organizer_email);
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${row.gcal_hubfly_push_id}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok || res.status === 410 || res.status === 404) {
        // Limpar colunas do DB
        await (adminDb.from('gantt_planejamento') as any)
          .update({ gcal_hubfly_push_id: null, gcal_hubfly_organizer_email: null })
          .eq('id', row.id);
        results.push({ id: row.id, ok: true });
      } else {
        results.push({ id: row.id, ok: false });
      }
    } catch {
      results.push({ id: row.id, ok: false });
    }
  }

  const ok = results.filter(r => r.ok).length;
  return NextResponse.json({ total: items.length, ok, results });
}
