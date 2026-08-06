import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Cron: sincroniza Google Calendar → gantt_planejamento (origem = 'google_calendar')
 * GET /api/cron/google-calendar-sync
 * Executa a cada 5 minutos via vercel.json
 * Usa Service Account + Domain-Wide Delegation — sem dependência externa.
 */

export const dynamic = 'force-dynamic';

const DOMAIN     = 'moni.casa';
const DAYS_AHEAD = 15;

// ── Service account types ────────────────────────────────────────────────────

type ServiceAccountKey = {
  client_email: string;
  private_key:  string;
};

type CalendarEvent = {
  id: string;
  summary?: string;
  location?: string;
  start?:    { dateTime?: string; date?: string };
  end?:      { dateTime?: string; date?: string };
  organizer?: { email?: string; displayName?: string };
  attendees?: { email?: string; displayName?: string; responseStatus?: string }[];
  conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
  htmlLink?: string;
};

// ── JWT / OAuth2 (Web Crypto — zero dependências) ────────────────────────────

function base64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...bytes))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function makeJWT(credentials: ServiceAccountKey, subject: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header  = base64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const payload = base64url(new TextEncoder().encode(JSON.stringify({
    iss:   credentials.client_email,
    sub:   subject,
    scope: 'https://www.googleapis.com/auth/calendar.readonly',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  })));

  const sigInput = `${header}.${payload}`;

  // Importar chave privada PEM (PKCS8)
  const pemBody = credentials.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const keyBuf = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyBuf,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign'],
  );

  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', cryptoKey,
    new TextEncoder().encode(sigInput),
  );

  return `${sigInput}.${base64url(sig)}`;
}

async function getAccessToken(credentials: ServiceAccountKey, userEmail: string): Promise<string> {
  const jwt = await makeJWT(credentials, userEmail);
  const res  = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt,
    }),
  });
  const data = await res.json() as { access_token?: string; error?: string; error_description?: string };
  if (!data.access_token) {
    throw new Error(`OAuth2 error: ${data.error} — ${data.error_description ?? ''}`);
  }
  return data.access_token;
}

// ── Helpers de data/hora (fuso Brasília) ─────────────────────────────────────

function toDateBR(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).split('/').reverse().join('-'); // DD/MM/YYYY → YYYY-MM-DD
}

function toTimeBR(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false,
  }).slice(0, 5); // "HH:MM"
}

// ── Sync de um usuário ────────────────────────────────────────────────────────

async function syncUser(
  supabase: ReturnType<typeof createClient<any, any, any>>,
  credentials: ServiceAccountKey,
  userId: string,
  userEmail: string,
): Promise<{ synced: number; removed: number }> {
  const token = await getAccessToken(credentials, userEmail);

  const now    = new Date();
  const future = new Date();
  future.setDate(future.getDate() + DAYS_AHEAD);

  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
  url.searchParams.set('timeMin',      now.toISOString());
  url.searchParams.set('timeMax',      future.toISOString());
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy',      'startTime');
  url.searchParams.set('maxResults',   '250');

  const gcalRes = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!gcalRes.ok) {
    const txt = await gcalRes.text();
    throw new Error(`Calendar API ${gcalRes.status}: ${txt.slice(0, 200)}`);
  }

  const gcalData = await gcalRes.json() as { items?: CalendarEvent[] };
  const events   = gcalData.items ?? [];
  const eventIds: string[] = [];

  for (const ev of events) {
    if (!ev.id || !ev.start) continue;
    eventIds.push(ev.id);

    const isAllDay   = !ev.start.dateTime;
    const data       = isAllDay ? ev.start.date! : toDateBR(ev.start.dateTime!);
    const hora_inicio = isAllDay ? '00:00' : toTimeBR(ev.start.dateTime!);
    const hora_fim    = (!isAllDay && ev.end?.dateTime) ? toTimeBR(ev.end.dateTime) : null;

    const meetLink = ev.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri ?? null;

    const attendees = (ev.attendees ?? [])
      .map(a => a.displayName ? `${a.displayName} <${a.email ?? ''}>` : (a.email ?? ''))
      .filter(Boolean);

    await (supabase.from('gantt_planejamento') as any).upsert({
      profile_id:               userId,
      origem:                   'google_calendar',
      google_calendar_event_id: ev.id,
      google_calendar_organizer: ev.organizer?.displayName
        ? `${ev.organizer.displayName} <${ev.organizer.email ?? ''}>`
        : (ev.organizer?.email ?? null),
      titulo:                   ev.summary ?? '(sem título)',
      data,
      hora_inicio,
      hora_fim,
      link_reuniao:             meetLink ?? ev.htmlLink ?? null,
      local_reuniao:            ev.location ?? null,
      participantes_externos:   attendees,
    }, {
      onConflict: 'profile_id,google_calendar_event_id',
    });
  }

  // Remover eventos deletados no Google
  let removed = 0;
  const { data: existingRows } = await supabase
    .from('gantt_planejamento')
    .select('id, google_calendar_event_id')
    .eq('profile_id', userId)
    .eq('origem', 'google_calendar')
    .gte('data', now.toISOString().slice(0, 10));

  const toDelete = ((existingRows ?? []) as { id: string; google_calendar_event_id: string }[])
    .filter(r => !eventIds.includes(r.google_calendar_event_id))
    .map(r => r.id);

  if (toDelete.length > 0) {
    await supabase.from('gantt_planejamento').delete().in('id', toDelete);
    removed = toDelete.length;
  }

  return { synced: events.length, removed };
}

// ── Handler principal ─────────────────────────────────────────────────────────

export async function GET(request: Request) {
  // Auth
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET não configurado' }, { status: 500 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  // Credenciais da service account
  let credentials: ServiceAccountKey;
  try {
    credentials = JSON.parse(process.env.GOOGLE_CALENDAR_SA_KEY!) as ServiceAccountKey;
    if (!credentials.client_email || !credentials.private_key) throw new Error('campos ausentes');
  } catch {
    return NextResponse.json({ error: 'GOOGLE_CALENDAR_SA_KEY inválida ou ausente' }, { status: 500 });
  }

  // Cliente Supabase admin
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Buscar todos os usuários do domínio
  const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const users = (usersData?.users ?? []).filter(u => u.email?.endsWith(`@${DOMAIN}`));

  const results: { email: string; synced?: number; removed?: number; error?: string }[] = [];

  console.log(`[gcal-sync] iniciando — ${users.length} usuário(s) @${DOMAIN}`);

  for (const user of users) {
    if (!user.email) continue;
    try {
      const { synced, removed } = await syncUser(supabase, credentials, user.id, user.email);
      results.push({ email: user.email, synced, removed });
      console.log(`[gcal-sync] ✓ ${user.email} — synced=${synced} removed=${removed}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ email: user.email, error: msg });
      console.error(`[gcal-sync] ✗ ${user.email} — ${msg}`);
    }
  }

  console.log(`[gcal-sync] concluído — ${results.filter(r => !r.error).length}/${results.length} ok`);
  return NextResponse.json({ ok: true, users: results.length, results });
}
