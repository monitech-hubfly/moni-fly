/**
 * Lê venda bruta, R$/m² de vendas e mês de venda da planilha do BCA.
 * Colunas C, D e E (Planta, Target, Liquidação). Linhas 59, 61 e 62.
 */

import * as XLSX from 'xlsx'

export interface CenariosPlanilha {
  vendaBruta: [string, string, string]
  metroVendas: [string, string, string]
  mesVenda: [string, string, string]
}

type ReferenciaDrive = { tipo: 'planilha' | 'pasta' | 'arquivo'; id: string }

const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const COLUNAS = [2, 3, 4] as const

export function classificarLinkBca(link: string): ReferenciaDrive | null {
  let url: URL
  try {
    url = new URL(link.trim())
  } catch {
    return null
  }
  const host = url.hostname.replace(/^www\./, '')
  if (!/^(docs|drive|sheets)\.google\.com$/.test(host)) return null
  const planilha = url.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  if (planilha) return { tipo: 'planilha', id: planilha[1] }
  const pasta = url.pathname.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  if (pasta) return { tipo: 'pasta', id: pasta[1] }
  const arquivo = url.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (arquivo) return { tipo: 'arquivo', id: arquivo[1] }
  const id = url.searchParams.get('id')
  if (id && /^[a-zA-Z0-9_-]+$/.test(id)) return { tipo: 'arquivo', id }
  return null
}

export function cenariosDoXlsx(buffer: Buffer): CenariosPlanilha | null {
  const livro = XLSX.read(buffer, { type: 'buffer' })
  const nomes = [...livro.SheetNames].sort((a, b) => Number(/resumo/i.test(b)) - Number(/resumo/i.test(a)))
  for (const nome of nomes) {
    const aba = livro.Sheets[nome]
    const bloco = aba ? blocoCenarios(aba) : null
    if (bloco) return bloco
  }
  return null
}

export async function cenariosDaPlanilhaBca(link: string, email?: string): Promise<CenariosPlanilha | null> {
  const ref = classificarLinkBca(link)
  if (!ref) return null
  const id = ref.tipo === 'pasta' ? await idPlanilhaNaPasta(ref.id, email) : ref.id
  if (!id) return null
  const buffer = await baixarPlanilha(id, email)
  if (!buffer) return null
  return cenariosDoXlsx(buffer)
}

function blocoCenarios(aba: XLSX.WorkSheet): CenariosPlanilha | null {
  const faixa = aba['!ref']
  if (!faixa) return null
  const range = XLSX.utils.decode_range(faixa)
  for (let r = range.s.r; r <= range.e.r; r += 1) {
    if (!/venda bruta/i.test(rotuloLinha(aba, r))) continue
    let linhaMetro = 0
    let linhaMes = 0
    for (let i = 1; i <= 8; i += 1) {
      const proximo = semAcento(rotuloLinha(aba, r + i))
      if (!linhaMetro && /r\$\s*\/\s*m|area de vendas/.test(proximo) && !/area util/.test(proximo)) {
        linhaMetro = r + i
      }
      if (!linhaMes && /mes de venda/.test(proximo)) linhaMes = r + i
    }
    if (!linhaMetro || !linhaMes) continue
    if (numero(valor(aba, 2, r + 1)) == null) continue
    return {
      vendaBruta: triplo(aba, r + 1, moeda),
      metroVendas: triplo(aba, linhaMetro + 1, formatarMetro),
      mesVenda: triplo(aba, linhaMes + 1, mes),
    }
  }
  return null
}

function rotuloLinha(aba: XLSX.WorkSheet, linhaBaseZero: number): string {
  return `${texto(aba, 0, linhaBaseZero + 1)} ${texto(aba, 1, linhaBaseZero + 1)}`
}

function semAcento(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function triplo(
  aba: XLSX.WorkSheet,
  linha: number,
  formatar: (value: unknown) => string,
): [string, string, string] {
  return COLUNAS.map((coluna) => formatar(valor(aba, coluna, linha))) as [string, string, string]
}

function valor(aba: XLSX.WorkSheet, coluna: number, linha: number): unknown {
  const celula = aba[XLSX.utils.encode_cell({ c: coluna, r: linha - 1 })]
  if (!celula) return ''
  if (typeof celula.v === 'number') return celula.v
  if (typeof celula.w === 'string' && celula.w.trim()) return celula.w
  return celula.v ?? ''
}

function texto(aba: XLSX.WorkSheet, coluna: number, linha: number): string {
  return String(valor(aba, coluna, linha) ?? '')
}

function numero(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null
  let textoNumero = value.replace(/r\$/gi, '').replace(/\s/g, '').trim()
  if (!textoNumero || !/\d/.test(textoNumero)) return null
  const temVirgula = textoNumero.includes(',')
  const temPonto = textoNumero.includes('.')
  if (temVirgula && temPonto) textoNumero = textoNumero.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(,\d{3})+$/.test(textoNumero)) textoNumero = textoNumero.replace(/,/g, '')
  else if (temVirgula) textoNumero = textoNumero.replace(',', '.')
  else if (temPonto && /^\d{1,3}(\.\d{3})+$/.test(textoNumero)) textoNumero = textoNumero.replace(/\./g, '')
  textoNumero = textoNumero.replace(/[^\d.-]/g, '')
  const n = Number(textoNumero)
  return Number.isFinite(n) ? n : null
}

function moeda(value: unknown): string {
  const n = numero(value)
  if (n == null) return 'R$ 0'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(n).replace(/\u00a0/g, ' ')
}

function formatarMetro(value: unknown): string {
  const n = numero(value)
  if (n == null) return '0'
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(n).replace(/\u00a0/g, ' ')
}

function mes(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return `mês ${Math.round(value)}`
  const bruto = String(value ?? '').trim()
  const digitos = bruto.match(/(\d+)/)
  if (!digitos) return 'mês 0'
  return `mês ${digitos[1]}`
}

function ehZip(buffer: Buffer): boolean {
  return buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b
}

async function baixarPlanilha(id: string, email?: string): Promise<Buffer | null> {
  const publica = await baixar(`https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`)
  if (publica && ehZip(publica)) return publica
  const arquivo = await baixar(`https://drive.google.com/uc?export=download&id=${id}`)
  if (arquivo && ehZip(arquivo)) return arquivo
  for (const token of await tokensDrive(email)) {
    const exportada = await baixar(
      `https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=${encodeURIComponent(MIME_XLSX)}&supportsAllDrives=true`,
      token,
    )
    if (exportada && ehZip(exportada)) return exportada
    const media = await baixar(
      `https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`,
      token,
    )
    if (media && ehZip(media)) return media
  }
  return null
}

async function baixar(url: string, token?: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

async function idPlanilhaNaPasta(folderId: string, email?: string): Promise<string | null> {
  const daPagina = await idPelaPaginaDaPasta(folderId)
  if (daPagina) return daPagina
  for (const token of await tokensDrive(email)) {
    const id = await idNaArvore(folderId, token, 0)
    if (id) return id
  }
  return null
}

type ArquivoDrive = { id: string; nome: string; mime: string }

async function idNaArvore(folderId: string, token: string, profundidade: number): Promise<string | null> {
  const arquivos = await listarPasta(folderId, token)
  const planilhas = arquivos.filter((arquivo) => ehPlanilha(arquivo))
  const escolhida = escolherPlanilha(planilhas)
  if (escolhida) return escolhida
  if (profundidade >= 2) return null
  for (const pasta of arquivos.filter((arquivo) => arquivo.mime === 'application/vnd.google-apps.folder')) {
    const id = await idNaArvore(pasta.id, token, profundidade + 1)
    if (id) return id
  }
  return null
}

async function listarPasta(folderId: string, token: string): Promise<ArquivoDrive[]> {
  const q = `'${folderId}' in parents and trashed = false`
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType)&supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=100`
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return []
    const data = await res.json() as { files?: { id?: string; name?: string; mimeType?: string }[] }
    return (data.files ?? []).flatMap((arquivo) => {
      const id = typeof arquivo.id === 'string' ? arquivo.id : ''
      if (!id) return []
      return [{
        id,
        nome: typeof arquivo.name === 'string' ? arquivo.name : '',
        mime: typeof arquivo.mimeType === 'string' ? arquivo.mimeType : '',
      }]
    })
  } catch {
    return []
  }
}

function ehPlanilha(arquivo: ArquivoDrive): boolean {
  return arquivo.mime === 'application/vnd.google-apps.spreadsheet'
    || /spreadsheet|excel/i.test(arquivo.mime)
    || /\.xlsx?$/i.test(arquivo.nome)
}

async function idPelaPaginaDaPasta(folderId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://drive.google.com/embeddedfolderview?id=${folderId}`, {
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    const html = await res.text()
    const arquivos: { id: string; nome: string }[] = []
    const vistos = new Set<string>()
    const guardar = (id: string, nome: string) => {
      if (vistos.has(id)) return
      vistos.add(id)
      arquivos.push({ id, nome: nome.replace(/\s+/g, ' ').trim() })
    }
    for (const achado of html.matchAll(/id="entry-([a-zA-Z0-9_-]{10,})"[^>]*aria-label="([^"]*)"/g)) {
      guardar(achado[1], achado[2])
    }
    for (const achado of html.matchAll(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/g)) {
      guardar(achado[1], '')
    }
    return escolherPlanilha(arquivos)
  } catch {
    return null
  }
}

function escolherPlanilha(arquivos: { id: string; nome: string }[]): string | null {
  const bca = arquivos.find((arquivo) => /bca/i.test(arquivo.nome))
  if (bca) return bca.id
  if (arquivos.length === 1) return arquivos[0].id
  return null
}

type ContaServico = { client_email: string; private_key: string }

async function tokensDrive(email?: string): Promise<string[]> {
  const tokens: string[] = []
  const conta = email?.includes('@') ? await tokenDrive(email) : null
  if (conta) tokens.push(conta)
  const servico = await tokenDrive()
  if (servico && servico !== conta) tokens.push(servico)
  return tokens
}

async function tokenDrive(assunto?: string): Promise<string | null> {
  const raw = process.env.GOOGLE_CALENDAR_SA_KEY
  if (!raw) return null
  let creds: ContaServico
  try {
    creds = JSON.parse(raw) as ContaServico
  } catch {
    return null
  }
  if (!creds.client_email || !creds.private_key) return null
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))
  const corpo: Record<string, string | number> = {
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }
  if (assunto) corpo.sub = assunto
  const payload = base64url(new TextEncoder().encode(JSON.stringify(corpo)))
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
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    })
    const data = await res.json() as { access_token?: string }
    return data.access_token ?? null
  } catch {
    return null
  }
}

function base64url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}
