'use server';

import { createAdminClient } from '@/lib/supabase/admin';

// ── Service account types ─────────────────────────────────────────────────────

type ServiceAccountKey = {
  client_email: string;
  private_key:  string;
};

// ── JWT / OAuth2 (Web Crypto — zero dependências) ─────────────────────────────

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
    scope: 'https://www.googleapis.com/auth/calendar',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  })));

  const sigInput = `${header}.${payload}`;

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

function getCredentials(): ServiceAccountKey {
  const raw = process.env.GOOGLE_CALENDAR_SA_KEY;
  if (!raw) throw new Error('GOOGLE_CALENDAR_SA_KEY não configurada');
  const creds = JSON.parse(raw) as ServiceAccountKey;
  if (!creds.client_email || !creds.private_key) throw new Error('GOOGLE_CALENDAR_SA_KEY inválida');
  return creds;
}

function extractEmail(str: string): string {
  return /([^<>\s]+@[^<>\s]+)/.exec(str)?.[1] ?? str;
}

// ── Push HubFly → GCal ────────────────────────────────────────────────────────

export async function pushParaGCal(ganttId: string): Promise<void> {
  try {
    const adminDb = createAdminClient();

    const { data: gantt } = await (adminDb.from('gantt_planejamento') as any)
      .select('id, titulo, data, hora_inicio, hora_fim, link_reuniao, local_reuniao, origem, gcal_hubfly_push_id, gcal_hubfly_organizer_email, profile_id, participantes_externos, acoes(tipo_atividade)')
      .eq('id', ganttId)
      .maybeSingle();

    if (!gantt) return;
    if (gantt.origem === 'google_calendar') return;

    // Buscar email do organizador
    const { data: { user: organizer } } = await adminDb.auth.admin.getUserById(gantt.profile_id);
    const organizerEmail = organizer?.email;
    if (!organizerEmail) throw new Error(`Email não encontrado para profile_id=${gantt.profile_id}`);

    // Buscar participantes internos
    const { data: partRows } = await (adminDb.from('gantt_agenda_participantes') as any)
      .select('profile_id')
      .eq('gantt_id', ganttId);

    const internalEmails: string[] = [];
    for (const row of ((partRows ?? []) as { profile_id: string }[])) {
      try {
        const { data: { user: u } } = await adminDb.auth.admin.getUserById(row.profile_id);
        if (u?.email) internalEmails.push(u.email);
      } catch { /* ignora */ }
    }

    // Participantes externos: strings "Nome <email>" ou "email"
    const externalEmails: string[] = ((gantt.participantes_externos as string[] | null) ?? [])
      .map(extractEmail)
      .filter(Boolean);

    const allAttendees = [...new Set([organizerEmail, ...internalEmails, ...externalEmails])]
      .map(email => ({ email }));

    // Montar horários
    const data: string = gantt.data; // YYYY-MM-DD
    const horaInicio: string = gantt.hora_inicio ?? '00:00';
    let horaFim: string;
    if (gantt.hora_fim) {
      horaFim = gantt.hora_fim;
    } else {
      // hora_inicio + 1h
      const [h, m] = horaInicio.split(':').map(Number);
      const totalMin = (h ?? 0) * 60 + (m ?? 0) + 60;
      horaFim = `${String(Math.floor(totalMin / 60) % 24).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
    }

    const body: Record<string, unknown> = {
      summary: (Array.isArray(gantt.acoes) ? gantt.acoes[0] : gantt.acoes)?.tipo_atividade
        ?? (gantt.titulo as string | null)
        ?? '(sem título)',
      start: { dateTime: `${data}T${horaInicio}:00`, timeZone: 'America/Sao_Paulo' },
      end:   { dateTime: `${data}T${horaFim}:00`,   timeZone: 'America/Sao_Paulo' },
      attendees: allAttendees,
      extendedProperties: { private: { hubfly_id: ganttId } },
    };

    if (gantt.local_reuniao) {
      body.location = gantt.local_reuniao;
    }

    const link: string | null = gantt.link_reuniao ?? null;
    if (link && link.includes('meet.google.com')) {
      body.conferenceData = {
        conferenceSolution: { key: { type: 'hangoutsMeet' } },
        entryPoints: [{ entryPointType: 'video', uri: link }],
      };
    }

    const credentials = getCredentials();
    const token = await getAccessToken(credentials, organizerEmail);

    let gcalEventId: string;

    if (gantt.gcal_hubfly_push_id) {
      // PATCH — update
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${gantt.gcal_hubfly_push_id}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`GCal PATCH ${res.status}: ${txt.slice(0, 200)}`);
      }
      const updated = await res.json() as { id: string };
      gcalEventId = updated.id;
    } else {
      // POST — create
      const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
      if (link && link.includes('meet.google.com')) {
        url.searchParams.set('conferenceDataVersion', '1');
      }
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`GCal POST ${res.status}: ${txt.slice(0, 200)}`);
      }
      const created = await res.json() as { id: string };
      gcalEventId = created.id;
    }

    await (adminDb.from('gantt_planejamento') as any).update({
      gcal_hubfly_push_id:         gcalEventId,
      gcal_hubfly_organizer_email: organizerEmail,
    }).eq('id', ganttId);

    console.log(`[gcal-push] ✓ ${ganttId} → ${gcalEventId}`);
  } catch (e) {
    console.error(`[gcal-push] ✗ ${ganttId}:`, e instanceof Error ? e.message : e);
  }
}

// ── Deletar do GCal ───────────────────────────────────────────────────────────

export async function deletarDoGCal(ganttId: string): Promise<void> {
  try {
    const adminDb = createAdminClient();

    const { data: gantt } = await (adminDb.from('gantt_planejamento') as any)
      .select('gcal_hubfly_push_id, gcal_hubfly_organizer_email')
      .eq('id', ganttId)
      .maybeSingle();

    if (!gantt?.gcal_hubfly_push_id) return;

    const organizerEmail: string | null = gantt.gcal_hubfly_organizer_email ?? null;
    if (!organizerEmail) return;

    const credentials = getCredentials();
    const token = await getAccessToken(credentials, organizerEmail);

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${gantt.gcal_hubfly_push_id}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!res.ok && res.status !== 410) {
      const txt = await res.text();
      console.warn(`[gcal-delete] ${res.status}: ${txt.slice(0, 200)}`);
    } else {
      console.log(`[gcal-delete] ✓ ${ganttId} → ${gantt.gcal_hubfly_push_id}`);
    }
  } catch (e) {
    console.error(`[gcal-delete] ✗ ${ganttId}:`, e instanceof Error ? e.message : e);
  }
}
