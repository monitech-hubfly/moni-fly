import { getPublicAppUrl } from '@/lib/app-url'
import { sendEmailViaResend } from '@/lib/email'
import {
  listarLinksJornadaPorCorretores,
  type LinkJornadaCorretor,
} from '@/lib/corretor-links-jornada'
type Db = { from: (table: string) => any }

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function blocoLinks(links: LinkJornadaCorretor[]): { html: string; text: string } {
  if (links.length === 0) {
    const frase =
      'Ainda não há empreendimento vinculado com jornada disponível. Quando houver, o link entra neste mesmo formato.'
    return {
      html: `<p style="margin:0 0 16px;color:#4A3929;font-size:14px;line-height:1.5;">${frase}</p>`,
      text: frase,
    }
  }

  const itens = links
    .map((link) => {
      const nome = escapeHtml(link.nome)
      if (!link.url) {
        return `<li style="margin:0 0 12px;"><strong>${nome}</strong><br/><span style="color:#6b6258;">A jornada deste empreendimento ainda não está disponível.</span></li>`
      }
      const href = escapeHtml(link.url)
      return `<li style="margin:0 0 12px;"><strong>${nome}</strong><br/><a href="${href}" style="color:#0C2633;">${href}</a></li>`
    })
    .join('')

  const text = links
    .map((link) =>
      link.url
        ? `${link.nome}\n${link.url}`
        : `${link.nome}\nA jornada deste empreendimento ainda não está disponível.`,
    )
    .join('\n\n')

  return {
    html: `<ul style="margin:0 0 16px;padding-left:18px;color:#1c1917;font-size:14px;line-height:1.5;">${itens}</ul>`,
    text,
  }
}

function layout(titulo: string, corpoHtml: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f7f5f2;font-family:Georgia, 'Times New Roman', serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:#0C2633;padding:20px 24px;">
      <p style="margin:0;color:#ffffff;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;">Casa Moní</p>
      <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:500;">${escapeHtml(titulo)}</h1>
    </div>
    <div style="background:#ffffff;padding:24px;border:0.5px solid #e7e0d6;">
      ${corpoHtml}
    </div>
  </div>
</body>
</html>`
}

const EXPLICACAO =
  'Esses links são para compartilhar com os seus clientes. Quem fizer a jornada por esse endereço entra identificado com você e com o empreendimento, e os dados desse cliente são destinados a você.'

export async function enviarEmailCadastroCorretorRecebido(input: {
  nome: string
  email: string | null | undefined
}): Promise<void> {
  const email = String(input.email ?? '').trim()
  if (!email.includes('@')) return
  const nome = String(input.nome ?? '').trim() || 'corretor'
  const texto = [
    `Olá, ${nome}.`,
    '',
    'Recebemos seu cadastro de corretor. Ele está em análise pela Casa Moní.',
    '',
    'Depois da aprovação, você recebe os links dos empreendimentos em que se vinculou.',
    EXPLICACAO,
  ].join('\n')
  const html = layout(
    'Cadastro recebido',
    `<p style="margin:0 0 12px;color:#1c1917;font-size:15px;">Olá, <strong>${escapeHtml(nome)}</strong>.</p>
     <p style="margin:0 0 12px;color:#4A3929;font-size:14px;line-height:1.5;">Recebemos seu cadastro de corretor. Ele está em análise pela Casa Moní.</p>
     <p style="margin:0 0 12px;color:#4A3929;font-size:14px;line-height:1.5;">Depois da aprovação, você recebe os links dos empreendimentos em que se vinculou.</p>
     <p style="margin:0;color:#4A3929;font-size:14px;line-height:1.5;">${EXPLICACAO}</p>`,
  )
  const enviado = await sendEmailViaResend({
    to: email,
    subject: 'Cadastro recebido — Casa Moní',
    text: texto,
    html,
  })
  if (!enviado.ok) console.error('[corretor-email] cadastro recebido:', enviado.error)
}

export async function enviarEmailComLinks(input: {
  nome: string
  email: string
  assunto: string
  titulo: string
  intro: string
  links: LinkJornadaCorretor[]
}): Promise<{ ok: true; skipped?: boolean } | { ok: false; error: string }> {
  const email = input.email.trim()
  if (!email.includes('@')) return { ok: true, skipped: true }
  const bloco = blocoLinks(input.links)
  const nome = input.nome.trim() || 'corretor'
  const texto = [`Olá, ${nome}.`, '', input.intro, '', bloco.text, '', EXPLICACAO].join('\n')
  const html = layout(
    input.titulo,
    `<p style="margin:0 0 12px;color:#1c1917;font-size:15px;">Olá, <strong>${escapeHtml(nome)}</strong>.</p>
     <p style="margin:0 0 16px;color:#4A3929;font-size:14px;line-height:1.5;">${escapeHtml(input.intro)}</p>
     ${bloco.html}
     <p style="margin:0;color:#4A3929;font-size:14px;line-height:1.5;">${EXPLICACAO}</p>`,
  )
  return sendEmailViaResend({
    to: email,
    subject: input.assunto,
    text: texto,
    html,
  })
}

export async function enviarEmailLinksDoCorretor(input: {
  supabase: Db
  corretorId: string
  nome: string
  email: string
  assunto: string
  titulo: string
  intro: string
}): Promise<{ ok: true; skipped?: boolean } | { ok: false; error: string }> {
  const mapa = await listarLinksJornadaPorCorretores(input.supabase, [input.corretorId], getPublicAppUrl())
  return enviarEmailComLinks({
    nome: input.nome,
    email: input.email,
    assunto: input.assunto,
    titulo: input.titulo,
    intro: input.intro,
    links: mapa.get(input.corretorId) ?? [],
  })
}

export function hojeSaoPaulo(data = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(data)
}
