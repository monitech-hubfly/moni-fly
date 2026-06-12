'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmailViaResend } from '@/lib/email';
import { getPublicAppUrl } from '@/lib/app-url';
import { isoWeek, isoWeekYear } from '@/utils/periodos';

export async function dispararAlertaStatusPreenchimento(): Promise<{ ok: true; notificados: number } | { ok: false; error: string }> {
  try {
    const admin = createAdminClient();
    const hoje = new Date();
    const semanaAtual = isoWeek(hoje);
    const anoAtual = isoWeekYear(hoje);
    const appUrl = getPublicAppUrl();

    // Busca todos os profiles team e admin com email
    const { data: profiles, error: errProfiles } = await admin
      .from('profiles')
      .select('id, full_name, email')
      .in('role', ['admin', 'team'])
      .not('email', 'is', null);
    if (errProfiles) return { ok: false, error: errProfiles.message };

    let notificados = 0;

    for (const profile of profiles || []) {
      const p = profile as { id: string; full_name?: string | null; email?: string | null };
      if (!p.email) continue;

      const nome = (p.full_name || '').trim() || 'Equipe';

      // Insert no sininho (alertas)
      await admin.from('alertas').insert({
        user_id: p.id,
        tipo: 'status_preenchimento_lembrete',
        mensagem: `Lembrete: registre sua entrega semanal (S${semanaAtual}) até hoje (sexta-feira).`,
        referencia_path: '/carometro/status-preenchimento',
        lido: false,
      });

      // Envia e-mail
      await sendEmailViaResend({
        to: p.email,
        subject: `[Carômetro] Lembrete de entrega semanal — S${semanaAtual}`,
        text:
          `Olá${nome ? `, ${nome}` : ''}!\n\n` +
          `É sexta-feira! Conclua o preenchimento semanal no Carômetro antes do final do dia.\n\n` +
          `O que deve estar entregue hoje (S${semanaAtual}):\n` +
          `✓ Status de Preenchimento — registro da entrega semanal\n` +
          `✓ Planejamento (Gantt) — atividades e execuções da semana\n` +
          `✓ Indicadores — valores e status da área na semana\n\n` +
          `Atenção a feriados: em semanas com feriado, antecipe o preenchimento para o último dia útil.\n\n` +
          `Acesse agora: ${appUrl}/carometro/status-preenchimento\n\n` +
          `Enviado automaticamente toda sexta-feira pelo Carômetro · Moní.`,
        html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:system-ui,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:32px auto">
    <tr><td style="background:#1C3A2B;padding:24px 32px;border-radius:8px 8px 0 0">
      <span style="font-size:28px;font-weight:700;color:#D4EDAA">M</span>
      <span style="color:#D4EDAA;font-size:14px;margin-left:8px;opacity:0.8">Carômetro · Moní</span>
    </td></tr>
    <tr><td style="background:#EAF3DE;border-left:4px solid #639922;padding:24px 32px">
      <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:#1C3A2B">📅 Lembrete de entrega semanal — S${semanaAtual}</p>
      <p style="margin:0 0 16px;color:#3a3a3a">Olá${nome ? `, <strong>${nome}</strong>` : ''}! É sexta-feira — conclua o preenchimento antes do final do dia.</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f6;border-radius:6px;padding:16px;margin-bottom:16px">
        <tr><td style="padding:6px 0;color:#1C3A2B"><span style="color:#639922;font-weight:700">✓</span> Status de Preenchimento — registro da entrega semanal</td></tr>
        <tr><td style="padding:6px 0;color:#1C3A2B"><span style="color:#639922;font-weight:700">✓</span> Planejamento (Gantt) — atividades e execuções da semana</td></tr>
        <tr><td style="padding:6px 0;color:#1C3A2B"><span style="color:#639922;font-weight:700">✓</span> Indicadores — valores e status da área na semana</td></tr>
      </table>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAEEDA;border-radius:6px;padding:12px 16px;margin-bottom:20px">
        <tr><td style="color:#7a5f22;font-size:13px">⚠️ Em semanas com feriado, antecipe o preenchimento para o último dia útil. A sexta-feira é sempre o prazo — sem prorrogação automática.</td></tr>
      </table>
      <a href="${appUrl}/carometro/status-preenchimento" style="display:inline-block;background:#2F4A3A;color:#D4EDAA;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">Registrar entrega agora →</a>
    </td></tr>
    <tr><td style="padding:16px 32px;text-align:center">
      <p style="color:#B4B2A9;font-size:12px;margin:0">Enviado automaticamente toda sexta-feira pelo Carômetro · Moní</p>
    </td></tr>
  </table>
</body>
</html>`,
      });

      notificados++;
    }

    return { ok: true, notificados };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
