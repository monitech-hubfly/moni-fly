/**
 * Envio de e-mail para o franqueado quando o status do ticket jurídico muda.
 * Usa Resend (https://resend.com). Configure RESEND_API_KEY e RESEND_FROM no .env.local.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM ?? 'Viabilidade Moní <onboarding@resend.dev>';

export async function sendJuridicoStatusEmail(
  to: string,
  titulo: string,
  mensagem: string,
  statusLabel: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!to?.trim()) return { ok: false, error: 'E-mail do destinatário não informado.' };
  if (!RESEND_API_KEY) {
    // Sem chave: não envia, não falha (evita quebrar o fluxo em dev)
    return { ok: true };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [to.trim()],
        subject: `[Jurídico] ${statusLabel}: ${titulo}`,
        text: `${mensagem}\n\nAcesse o portal para ver detalhes.`,
        html: `<p>${mensagem.replace(/\n/g, '<br>')}</p><p>Acesse o portal para ver detalhes.</p>`,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Resend: ${res.status} ${body}` };
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
