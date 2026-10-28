/**
 * Envio pela Gmail API, com a mesma conta de serviço do Google Calendar.
 * A delegação no Admin do Workspace precisa incluir
 * https://www.googleapis.com/auth/gmail.send
 * e o remetente precisa ser uma caixa real do domínio (não um grupo).
 */

type ServiceAccountKey = {
  client_email: string
  private_key: string
}

type Anexo = {
  filename: string
  content: string
  content_type: string
}

export type EmailGmailInput = {
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  text: string
  html: string
  from?: string
  attachments?: Anexo[]
}

export type EmailGmailResult = { ok: true; id?: string } | { ok: false; error: string }

const ESCOPO = 'https://www.googleapis.com/auth/gmail.send'
const CAIXA_PADRAO = 'agenda@moni.casa'

function base64url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function lerConta(): ServiceAccountKey | null | 'invalida' {
  const raw = process.env.GOOGLE_CALENDAR_SA_KEY
  if (!raw) return null
  try {
    const creds = JSON.parse(raw) as ServiceAccountKey
    if (!creds.client_email || !creds.private_key) return 'invalida'
    return creds
  } catch {
    return 'invalida'
  }
}

function caixaRemetente(from?: string): { email: string; nome: string } {
  const informado = extrairCaixa(from)
  if (informado?.email.endsWith('@moni.casa')) return informado
  const ambiente = extrairCaixa(process.env.GOOGLE_GMAIL_FROM)
  if (ambiente?.email.endsWith('@moni.casa')) return ambiente
  return { email: CAIXA_PADRAO, nome: 'Casa Moní' }
}

function extrairCaixa(raw?: string | null): { email: string; nome: string } | null {
  const texto = String(raw ?? '').trim()
  if (!texto) return null
  const completo = /^(.*)<([^>]+)>$/.exec(texto)
  if (completo) {
    const email = completo[2].trim().toLowerCase()
    const nome = completo[1].replace(/"/g, '').trim() || 'Casa Moní'
    return email.includes('@') ? { email, nome } : null
  }
  if (texto.includes('@')) return { email: texto.toLowerCase(), nome: 'Casa Moní' }
  return null
}

function encodedWord(valor: string): string {
  if (/^[\x20-\x7E]*$/.test(valor)) return valor
  return `=?UTF-8?B?${btoa(unescape(encodeURIComponent(valor)))}?=`
}

function quebrarBase64(b64: string): string {
  return b64.replace(/.{1,76}/g, '$&\r\n').trim()
}

function montarRfc822(input: EmailGmailInput, caixa: { email: string; nome: string }): string {
  const mixed = `mix_${Date.now()}`
  const alt = `alt_${Date.now()}`
  const anexos = input.attachments ?? []
  const cabecalho = [
    `From: ${encodedWord(caixa.nome)} <${caixa.email}>`,
    `To: ${input.to.join(', ')}`,
    input.cc?.length ? `Cc: ${input.cc.join(', ')}` : '',
    `Subject: ${encodedWord(input.subject)}`,
    'MIME-Version: 1.0',
    anexos.length
      ? `Content-Type: multipart/mixed; boundary="${mixed}"`
      : `Content-Type: multipart/alternative; boundary="${alt}"`,
  ]
    .filter(Boolean)
    .join('\r\n')

  const alternativa = [
    `--${alt}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    quebrarBase64(btoa(unescape(encodeURIComponent(input.text)))),
    `--${alt}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    quebrarBase64(btoa(unescape(encodeURIComponent(input.html)))),
    `--${alt}--`,
  ].join('\r\n')

  if (!anexos.length) return `${cabecalho}\r\n\r\n${alternativa}`

  const partes = anexos.map((anexo) =>
    [
      `--${mixed}`,
      `Content-Type: ${anexo.content_type || 'application/octet-stream'}; name="${anexo.filename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${anexo.filename}"`,
      '',
      quebrarBase64(anexo.content.replace(/\s/g, '')),
    ].join('\r\n'),
  )
  return `${cabecalho}\r\n\r\n--${mixed}\r\nContent-Type: multipart/alternative; boundary="${alt}"\r\n\r\n${alternativa}\r\n${partes.join('\r\n')}\r\n--${mixed}--`
}

async function tokenDeAcesso(creds: ServiceAccountKey, subject: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))
  const payload = base64url(
    new TextEncoder().encode(
      JSON.stringify({
        iss: creds.client_email,
        sub: subject,
        scope: ESCOPO,
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      }),
    ),
  )
  const pem = creds.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '')
  const keyBuf = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBuf,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(`${header}.${payload}`))
  const jwt = `${header}.${payload}.${base64url(new Uint8Array(sig))}`
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  const data = (await res.json()) as { access_token?: string; error?: string; error_description?: string }
  if (!data.access_token) {
    const detalhe = `${data.error ?? 'oauth'} ${data.error_description ?? ''}`.trim()
    if (/unauthorized_client|access_denied|invalid_scope/i.test(detalhe)) {
      throw new Error(
        `A conta Google ainda não pode enviar e-mail. No Admin do Workspace, na delegação de domínio, inclua o escopo ${ESCOPO} para a conta de serviço. (${detalhe})`,
      )
    }
    throw new Error(`Google: ${detalhe}`)
  }
  return data.access_token
}

/** null = conta de serviço ausente, o chamador usa o Resend. */
export async function enviarEmailGmail(input: EmailGmailInput): Promise<EmailGmailResult | null> {
  const creds = lerConta()
  if (creds === 'invalida') return { ok: false, error: 'GOOGLE_CALENDAR_SA_KEY inválida.' }
  if (!creds) return null
  if (input.to.length === 0) return { ok: false, error: 'E-mail do destinatário não informado.' }
  const caixa = caixaRemetente(input.from)
  try {
    const token = await tokenDeAcesso(creds, caixa.email)
    const raw = base64url(new TextEncoder().encode(montarRfc822(input, caixa)))
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    })
    if (!res.ok) {
      const texto = await res.text()
      return { ok: false, error: `Gmail: ${res.status} ${texto.slice(0, 300)}` }
    }
    const payload = (await res.json()) as { id?: string }
    return { ok: true, id: payload.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}
