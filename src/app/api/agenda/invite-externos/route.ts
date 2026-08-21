/**
 * POST /api/agenda/invite-externos
 * Envia convite por e-mail com .ics + links RSVP para participantes externos.
 * Body: { gantt_id: string }
 */

import { NextResponse } from 'next/server';
import { createClient }  from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmailViaResend } from '@/lib/email';
import { getPublicAppUrl } from '@/lib/app-url';

export const dynamic = 'force-dynamic';

// ── Helpers ───────────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0'); }

/** Converte YYYY-MM-DD + HH:MM:SS para YYYYMMDDTHHMMSS (local SP) */
function toICSDate(data: string, hora: string): string {
  const [y, m, d]    = data.split('-');
  const [hh, mm, ss] = hora.replace(/:/g, ':').split(':');
  return `${y}${m}${d}T${hh ?? '00'}${mm ?? '00'}${ss ?? '00'}`;
}

function generateICS(params: {
  uid: string;
  summary: string;
  dtstart: string;
  dtend:   string;
  description: string;
  location: string;
  organizerEmail: string;
  organizerName:  string;
}): string {
  const now = (() => {
    const d = new Date();
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  })();

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Moní HUB-FLY//PT',
    'METHOD:REQUEST',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${params.uid}`,
    `DTSTAMP:${now}`,
    `DTSTART;TZID=America/Sao_Paulo:${params.dtstart}`,
    `DTEND;TZID=America/Sao_Paulo:${params.dtend}`,
    `SUMMARY:${params.summary}`,
    ...(params.description ? [`DESCRIPTION:${params.description.replace(/\n/g,'\\n')}`] : []),
    ...(params.location    ? [`LOCATION:${params.location}`]    : []),
    `ORGANIZER;CN="${params.organizerName}":MAILTO:${params.organizerEmail}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n');
}

function formatDataHora(data: string, horaInicio: string, horaFim: string | null): string {
  const [y, m, d] = data.split('-');
  const dataFmt = `${d}/${m}/${y}`;
  const ini = horaInicio.slice(0, 5);
  const fim = horaFim ? ` – ${horaFim.slice(0, 5)}` : '';
  return `${dataFmt} às ${ini}${fim}`;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json() as { gantt_id?: string };
    const ganttId = String(body.gantt_id ?? '').trim();
    if (!ganttId) return NextResponse.json({ error: 'gantt_id obrigatório' }, { status: 400 });

    const admin = createAdminClient();

    // Busca evento
    const { data: evento } = await admin
      .from('gantt_planejamento')
      .select('id, titulo, data, hora_inicio, hora_fim, link_reuniao, local_reuniao, participantes_externos, profile_id, acoes(tipo_atividade)')
      .eq('id', ganttId)
      .maybeSingle();

    if (!evento) return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 });

    const ev = evento as {
      id: string;
      titulo: string | null;
      data: string;
      hora_inicio: string;
      hora_fim: string | null;
      link_reuniao: string | null;
      local_reuniao: string | null;
      participantes_externos: string[] | null;
      profile_id: string;
      acoes: { tipo_atividade: string } | { tipo_atividade: string }[] | null;
    };

    const externos = ev.participantes_externos ?? [];
    if (externos.length === 0) {
      return NextResponse.json({ ok: true, enviados: 0, msg: 'Sem externos' });
    }

    // Nome e e-mail do organizador
    const { data: orgProfile } = await admin
      .from('area_pessoas')
      .select('nome, email')
      .eq('profile_id', ev.profile_id)
      .maybeSingle();
    const { data: authUser } = await admin.auth.admin.getUserById(ev.profile_id);
    const orgEmail = (orgProfile as { email?: string } | null)?.email ?? authUser?.user?.email ?? 'agenda@moni.casa';
    const orgNome  = (orgProfile as { nome?: string } | null)?.nome  ?? orgEmail.split('@')[0] ?? 'Organizador';

    const acao = Array.isArray(ev.acoes) ? ev.acoes[0] : ev.acoes;
    const titulo = acao?.tipo_atividade ?? ev.titulo ?? 'Evento';
    const appUrl = getPublicAppUrl();

    // Gera .ics base64
    const dtstart = toICSDate(ev.data, ev.hora_inicio ?? '09:00:00');
    const dtend   = toICSDate(ev.data, ev.hora_fim    ?? ev.hora_inicio ?? '10:00:00');
    const location = ev.link_reuniao ?? ev.local_reuniao ?? '';
    const icsContent = generateICS({
      uid:            `${ganttId}@moni-fly`,
      summary:        titulo,
      dtstart, dtend, location,
      description:    location ? `Link: ${location}` : '',
      organizerEmail: orgEmail,
      organizerName:  orgNome,
    });
    const icsBase64 = Buffer.from(icsContent, 'utf-8').toString('base64');

    const dataHoraFmt = formatDataHora(ev.data, ev.hora_inicio, ev.hora_fim);
    const results: { email: string; ok: boolean; error?: string }[] = [];

    for (const email of externos) {
      // Upsert token RSVP
      const { data: rsvpRow } = await admin
        .from('gantt_rsvp_externos')
        .upsert({ gantt_id: ganttId, email, status: 'pendente' }, { onConflict: 'gantt_id,email', ignoreDuplicates: false })
        .select('token')
        .maybeSingle();

      const token = (rsvpRow as { token?: string } | null)?.token;
      if (!token) {
        results.push({ email, ok: false, error: 'token não gerado' });
        continue;
      }

      const simUrl = `${appUrl}/api/agenda/rsvp?token=${token}&r=sim`;
      const naoUrl = `${appUrl}/api/agenda/rsvp?token=${token}&r=nao`;

      const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:system-ui,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
        <!-- Header -->
        <tr><td style="background:#1d4ed8;padding:24px 32px">
          <p style="margin:0;color:#93c5fd;font-size:12px;text-transform:uppercase;letter-spacing:.08em">Convite de evento</p>
          <h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:700">${titulo}</h1>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:28px 32px">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6">
              <span style="color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:.05em">Data e hora</span><br>
              <span style="color:#111827;font-size:15px;font-weight:600">${dataHoraFmt}</span>
            </td></tr>
            ${orgNome ? `<tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6">
              <span style="color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:.05em">Organizador</span><br>
              <span style="color:#111827;font-size:15px">${orgNome}</span>
            </td></tr>` : ''}
            ${location ? `<tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6">
              <span style="color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:.05em">Link / Local</span><br>
              <a href="${location}" style="color:#1d4ed8;font-size:15px;word-break:break-all">${location}</a>
            </td></tr>` : ''}
          </table>
          <!-- RSVP buttons -->
          <p style="margin:28px 0 12px;color:#374151;font-size:14px">Você vai participar?</p>
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-right:12px">
                <a href="${simUrl}" style="display:inline-block;padding:12px 28px;background:#16a34a;color:#fff;font-size:14px;font-weight:600;border-radius:8px;text-decoration:none">✓ Confirmar presença</a>
              </td>
              <td>
                <a href="${naoUrl}" style="display:inline-block;padding:12px 28px;background:#f3f4f6;color:#374151;font-size:14px;font-weight:600;border-radius:8px;text-decoration:none">✗ Recusar</a>
              </td>
            </tr>
          </table>
          <p style="margin-top:24px;color:#9ca3af;font-size:12px">
            O arquivo .ics em anexo permite adicionar este evento diretamente ao seu calendário.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 32px;background:#f9fafb;border-top:1px solid #f3f4f6">
          <p style="margin:0;color:#d1d5db;font-size:11px">Moní HUB-FLY · Este convite foi enviado por ${orgNome}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

      const text =
        `Convite: ${titulo}\n` +
        `Data: ${dataHoraFmt}\n` +
        `Organizador: ${orgNome}\n` +
        (location ? `Link: ${location}\n` : '') +
        `\nConfirmar presença: ${simUrl}\n` +
        `Recusar: ${naoUrl}\n`;

      const result = await sendEmailViaResend({
        from:    'Moní Agenda <agenda@moni.casa>',
        to:      email,
        subject: `Convite: ${titulo} — ${dataHoraFmt}`,
        text, html,
        attachments: [{
          filename:     'convite.ics',
          content:      icsBase64,
          content_type: 'text/calendar;method=REQUEST',
        }],
      });

      results.push({ email, ok: result.ok, error: result.ok ? undefined : result.error });
    }

    const enviados = results.filter(r => r.ok).length;
    return NextResponse.json({ ok: true, enviados, total: externos.length, results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[invite-externos]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
