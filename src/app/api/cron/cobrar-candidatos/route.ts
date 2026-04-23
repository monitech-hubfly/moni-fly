import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmailViaResend } from '@/lib/email';

/**
 * Cobrança automática de candidatos que não preencheram o formulário em 5+ dias.
 * Limite: 3 cobranças por token. Intervalo mínimo entre cobranças: 5 dias.
 *
 * Vercel Cron: GET /api/cron/cobrar-candidatos (diário, 8h UTC)
 * Header: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET não configurado.' }, { status: 500 });
  }
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'Admin client indisponível.' }, { status: 500 });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    'http://localhost:3000';

  const now = new Date();
  const cincosDiasAtras = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();

  const { data: tokens, error } = await admin
    .from('kanban_card_form_tokens')
    .select('id, token, email_candidato, nome_candidato, cobrancas_enviadas')
    .is('usado_em', null)
    .gt('expires_at', now.toISOString())
    .not('email_candidato', 'is', null)
    .lt('cobrancas_enviadas', 3)
    .lte('created_at', cincosDiasAtras)
    .or(`cobranca_enviada_em.is.null,cobranca_enviada_em.lte.${cincosDiasAtras}`);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (tokens ?? []) as {
    id: string;
    token: string;
    email_candidato: string;
    nome_candidato: string | null;
    cobrancas_enviadas: number;
  }[];

  let enviados = 0;
  let falhas = 0;

  for (const row of rows) {
    const nome = row.nome_candidato?.trim() || 'Candidato';
    const link = `${baseUrl}/formulario-candidato/${row.token}`;

    const result = await sendEmailViaResend({
      to: row.email_candidato,
      subject: 'Pendência: Formulário de pré-qualificação Moní',
      text: [
        `Olá, ${nome}!`,
        '',
        'Identificamos que o seu formulário de pré-qualificação ainda não foi preenchido.',
        'Por favor, acesse o link abaixo para concluir o preenchimento:',
        '',
        link,
        '',
        'Em caso de dúvidas, entre em contato com a equipe Moní.',
        '',
        'Atenciosamente,',
        'Casa Moní',
      ].join('\n'),
      html: `
        <p>Olá, <strong>${nome}</strong>!</p>
        <p>Identificamos que o seu <strong>formulário de pré-qualificação</strong> ainda não foi preenchido.</p>
        <p>Por favor, acesse o link abaixo para concluir o preenchimento:</p>
        <p><a href="${link}" style="color:#7c3aed;font-weight:600;">Acessar formulário</a></p>
        <p>Em caso de dúvidas, entre em contato com a equipe Moní.</p>
        <p>Atenciosamente,<br/><strong>Casa Moní</strong></p>
      `.trim(),
    });

    if (result.ok && !result.skipped) {
      await admin
        .from('kanban_card_form_tokens')
        .update({
          cobranca_enviada_em: now.toISOString(),
          cobrancas_enviadas: (row.cobrancas_enviadas ?? 0) + 1,
        })
        .eq('id', row.id);
      enviados++;
    } else if (!result.ok) {
      falhas++;
    }
  }

  return NextResponse.json({ ok: true, candidatos: rows.length, enviados, falhas });
}
