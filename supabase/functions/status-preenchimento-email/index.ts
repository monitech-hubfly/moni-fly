/**
 * Lembrete de entrega semanal — toda sexta-feira 08h Brasília (11h UTC).
 * Envia e-mail via Resend e registra em audit_log.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildEmailHtml(nome: string, semana: number, appUrl: string): string {
  const n = escapeHtml(nome || 'usuário');
  const link = `${appUrl.replace(/\/$/, '')}/carometro/status-preenchimento`;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;font-family:system-ui,-apple-system,sans-serif;background:#f4f5f0;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:#1C3A2B;border-radius:10px 10px 0 0;padding:20px 24px;text-align:center;">
      <span style="font-size:28px;font-weight:700;color:#D4EDAA;">M</span>
    </div>
    <div style="background:#EAF3DE;border-left:4px solid #639922;padding:20px 24px;">
      <p style="margin:0 0 12px;color:#1D2F25;font-size:15px;">Olá, <strong>${n}</strong></p>
      <p style="margin:0 0 12px;color:#1D2F25;font-size:14px;line-height:1.5;">
        É sexta-feira! Conclua o preenchimento semanal no Carômetro antes do final do dia.
        O registro será bloqueado automaticamente após esta data.
      </p>
      <p style="margin:0 0 8px;color:#1D2F25;font-size:14px;font-weight:600;">O que deve estar entregue hoje (S${semana}):</p>
      <div style="background:#F9F9F6;border-radius:8px;padding:12px 16px;margin-bottom:16px;">
        <p style="margin:4px 0;color:#1D2F25;font-size:13px;"><span style="color:#639922;">✓</span> Status de Preenchimento — registro da entrega semanal</p>
        <p style="margin:4px 0;color:#1D2F25;font-size:13px;"><span style="color:#639922;">✓</span> Planejamento (Gantt) — atividades e execuções da semana</p>
        <p style="margin:4px 0;color:#1D2F25;font-size:13px;"><span style="color:#639922;">✓</span> Indicadores — valores e status da área na semana</p>
      </div>
      <div style="background:#FAEEDA;border-radius:8px;padding:12px 14px;margin-bottom:20px;font-size:12.5px;color:#5F5E5A;line-height:1.45;">
        <strong>Atenção a feriados:</strong> em semanas com feriado, antecipe o preenchimento para o último dia útil.
        A sexta-feira é sempre o prazo limite — não há prorrogação automática.
      </div>
      <a href="${link}" style="display:inline-block;background:#2F4A3A;color:#D4EDAA;text-decoration:none;padding:12px 20px;border-radius:6px;font-size:13px;font-weight:600;">
        Acessar o Carômetro e registrar entrega
      </a>
    </div>
    <p style="margin:16px 0 0;font-size:11px;color:#B4B2A9;text-align:center;">
      Enviado automaticamente toda sexta-feira pelo Carômetro · Moní.
    </p>
  </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const resendKey = Deno.env.get('RESEND_API_KEY') ?? '';
  const resendFrom = Deno.env.get('RESEND_FROM') ?? 'Casa Moní <onboarding@moni.casa>';
  const appUrl = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? Deno.env.get('NEXT_PUBLIC_SITE_URL') ?? 'https://moni.casa';

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Supabase não configurado' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const semana = isoWeek(new Date());

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, nome_completo, role, invite_accepted_at, aprovado_em')
    .in('role', ['admin', 'team', 'supervisor'])
    .not('email', 'is', null);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const ativos = (profiles ?? []).filter(
    (p) => p.invite_accepted_at || p.aprovado_em || p.role === 'admin',
  );

  let enviados = 0;
  let falhas = 0;
  const logs: string[] = [];

  for (const p of ativos) {
    const email = String(p.email ?? '').trim();
    if (!email.includes('@')) continue;
    const nome = (p.full_name || p.nome_completo || email.split('@')[0] || '').trim();

    if (resendKey) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: resendFrom,
          to: [email],
          subject: `[Carômetro] Lembrete de entrega semanal — S${semana}`,
          text: `Olá, ${nome}\n\nÉ sexta-feira! Conclua o preenchimento semanal no Carômetro antes do final do dia.\n\n${appUrl}/carometro/status-preenchimento`,
          html: buildEmailHtml(nome, semana, appUrl),
        }),
      });
      if (!res.ok) {
        falhas += 1;
        logs.push(`Falha ${email}: ${await res.text()}`);
        continue;
      }
      enviados += 1;
    }

    await supabase.from('audit_log').insert({
      usuario: 'Sistema',
      is_admin: true,
      modulo: 'Status de Preenchimento',
      area: null,
      entidade: 'email_status_preenchimento',
      operacao: 'INSERT',
      descricao: `E-mail S${semana} enviado para ${email}`,
    });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      semana,
      enviados,
      falhas,
      resendConfigured: Boolean(resendKey),
      destinatarios: ativos.length,
      logs: logs.slice(0, 5),
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
