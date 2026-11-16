/**
 * Lê a coluna Score Moni do slide "5. Análise de mercado" no PPTX do Comitê.
 * Nota positiva: avaliações melhores. Zero: similares. Negativa: concorrentes superiores.
 */

import JSZip from 'jszip'
import { baixar, classificarLinkBca, listarPasta, tokensDrive } from '@/lib/livro-empreendimento/cenarios-bca'

export interface PosicionamentoComite {
  melhores: number
  similares: number
  superiores: number
}

const MIME_PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
const MIME_SLIDES = 'application/vnd.google-apps.presentation'

export function contagemDasNotas(notas: number[]): PosicionamentoComite {
  const contagem: PosicionamentoComite = { melhores: 0, similares: 0, superiores: 0 }
  for (const nota of notas) {
    if (nota > 0) contagem.melhores += 1
    else if (nota < 0) contagem.superiores += 1
    else contagem.similares += 1
  }
  return contagem
}

export async function notasDoPptx(buffer: Buffer): Promise<number[]> {
  const zip = await JSZip.loadAsync(buffer)
  const nomes = Object.keys(zip.files)
    .filter((nome) => /^ppt\/slides\/slide\d+\.xml$/i.test(nome))
    .sort((a, b) => numeroSlide(a) - numeroSlide(b))
  const notas: number[] = []
  for (const nome of nomes) {
    const xml = await zip.files[nome].async('string')
    notas.push(...notasDoSlide(xml))
  }
  return notas
}

export async function posicionamentoDaApresentacaoComite(
  link: string,
  email?: string,
): Promise<PosicionamentoComite | null> {
  const buffer = await baixarPptxComite(link, email)
  if (!buffer) return null
  const notas = await notasDoPptx(buffer)
  if (notas.length === 0) return null
  return contagemDasNotas(notas)
}

function numeroSlide(nome: string): number {
  return Number(nome.match(/slide(\d+)/i)?.[1] ?? 0)
}

interface Caixa {
  x: number
  y: number
  cx: number
  cy: number
}

function notasDoSlide(xml: string): number[] {
  const plano = semAcento(xml)
  if (!/analise de mercado|batalha de casas|score\s*moni/.test(plano)) return []
  const rotulosScore = caixasComTexto(xml, /^score\s*moni$/)
  const rotulosPreco = caixasComTexto(xml, /^preco$/)
  const notas: number[] = []
  for (const frame of xml.match(/<p:graphicFrame[\s\S]*?<\/p:graphicFrame>/g) ?? []) {
    if (!frame.includes('<a:tbl')) continue
    const linhas = (frame.match(/<a:tr[\s\S]*?<\/a:tr>/g) ?? []).map(celulasDaLinha)
    const cabecalho = linhas.findIndex((linha) => linha.some((celula) => /^score\s*moni$/.test(semAcento(celula).trim())))
    const coluna = cabecalho >= 0
      ? linhas[cabecalho].findIndex((celula) => /^score\s*moni$/.test(semAcento(celula).trim()))
      : colunaScoreMoni(frame, rotulosScore, rotulosPreco)
    if (coluna == null || coluna < 0) continue
    for (const linha of linhas.slice(cabecalho >= 0 ? cabecalho + 1 : 0)) {
      const nota = notaCelula(linha[coluna] ?? '')
      if (nota != null) notas.push(nota)
    }
  }
  return notas
}

function colunaScoreMoni(frame: string, rotulosScore: Caixa[], rotulosPreco: Caixa[]): number | null {
  const faixas = faixasDaTabela(frame)
  if (faixas.length === 0) return null
  const topo = caixaDe(frame.match(/<p:xfrm[\s\S]*?<\/p:xfrm>/)?.[0] ?? '')?.y ?? 0
  const acima = (caixa: Caixa) => caixa.y < topo + 200000
  const alinhada = rotulosScore.filter(acima).map((caixa) => indiceDaFaixa(faixas, caixa)).find((indice) => indice != null)
  if (alinhada != null) return alinhada
  const preco = rotulosPreco.filter(acima).map((caixa) => indiceDaFaixa(faixas, caixa)).find((indice) => indice != null)
  if (preco != null && preco + 1 < faixas.length) return preco + 1
  return null
}

function faixasDaTabela(frame: string): Array<{ x0: number; x1: number }> {
  const origem = caixaDe(frame.match(/<p:xfrm[\s\S]*?<\/p:xfrm>/)?.[0] ?? '')
  if (!origem) return []
  const larguras = [...frame.matchAll(/<a:gridCol[^>]*\bw="(\d+)"/g)].map((achado) => Number(achado[1]))
  let x = origem.x
  return larguras.map((largura) => {
    const faixa = { x0: x, x1: x + largura }
    x += largura
    return faixa
  })
}

function indiceDaFaixa(faixas: Array<{ x0: number; x1: number }>, caixa: Caixa): number | null {
  const centro = caixa.x + caixa.cx / 2
  const indice = faixas.findIndex((faixa, posicao) => centro >= faixa.x0 && (posicao === faixas.length - 1 ? centro <= faixa.x1 : centro < faixa.x1))
  return indice >= 0 ? indice : null
}

function caixasComTexto(xml: string, texto: RegExp): Caixa[] {
  const caixas: Caixa[] = []
  for (const shape of xml.match(/<p:sp(?:\s[^>]*)?>[\s\S]*?<\/p:sp>/g) ?? []) {
    const lido = [...shape.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)].map((achado) => decodeXml(achado[1])).join(' ').replace(/\s+/g, ' ').trim()
    if (!texto.test(semAcento(lido))) continue
    const caixa = caixaDe(shape.match(/<a:xfrm[\s\S]*?<\/a:xfrm>/)?.[0] ?? '')
    if (!caixa || caixa.cx <= 0) continue
    caixas.push(caixa)
  }
  return caixas
}

function caixaDe(bloco: string): Caixa | null {
  const off = bloco.match(/<a:off[^>]*\bx="(-?\d+)"[^>]*\by="(-?\d+)"/)
  const ext = bloco.match(/<a:ext[^>]*\bcx="(\d+)"[^>]*\bcy="(\d+)"/)
  if (!off) return null
  return {
    x: Number(off[1]),
    y: Number(off[2]),
    cx: ext ? Number(ext[1]) : 0,
    cy: ext ? Number(ext[2]) : 0,
  }
}

function celulasDaLinha(linha: string): string[] {
  const celulas = linha.match(/<a:tc[\s\S]*?<\/a:tc>/g) ?? []
  return celulas.map((celula) => {
    const textos = [...celula.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)].map((achado) => decodeXml(achado[1]))
    return textos.join(' ').replace(/\s+/g, ' ').trim()
  })
}

function notaCelula(texto: string): number | null {
  const limpo = texto.replace(/\s/g, '').replace(/−/g, '-')
  const achado = limpo.match(/^([+-]?\d+)$/)
  if (!achado) return null
  const nota = Number(achado[1])
  return Number.isFinite(nota) ? nota : null
}

function semAcento(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#43;/g, '+')
    .replace(/&apos;/g, "'")
}

function ehZip(buffer: Buffer): boolean {
  return buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b
}

function classificarLinkComite(link: string): { tipo: 'pasta' | 'arquivo'; id: string } | null {
  let url: URL
  try {
    url = new URL(link.trim())
  } catch {
    return null
  }
  const apresentacao = url.pathname.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/)
  if (apresentacao) return { tipo: 'arquivo', id: apresentacao[1] }
  const base = classificarLinkBca(link)
  if (!base) return null
  if (base.tipo === 'pasta') return { tipo: 'pasta', id: base.id }
  return { tipo: 'arquivo', id: base.id }
}

async function baixarPptxComite(link: string, email?: string): Promise<Buffer | null> {
  const ref = classificarLinkComite(link)
  if (!ref) return null
  if (ref.tipo === 'arquivo') return baixarPptx(ref.id, undefined, email)
  for (const token of await tokensDrive(email)) {
    const arquivo = await acharComite(ref.id, token, 0)
    if (arquivo) return baixarPptx(arquivo.id, arquivo.mime, email)
  }
  return null
}

async function acharComite(
  folderId: string,
  token: string,
  profundidade: number,
): Promise<{ id: string; mime: string } | null> {
  const arquivos = await listarPasta(folderId, token)
  const comite = arquivos.find((arquivo) => ehApresentacao(arquivo) && /comit/i.test(semAcento(arquivo.nome)))
  if (comite) return { id: comite.id, mime: comite.mime }
  if (profundidade >= 2) return null
  for (const pasta of arquivos.filter((arquivo) => arquivo.mime === 'application/vnd.google-apps.folder')) {
    const achado = await acharComite(pasta.id, token, profundidade + 1)
    if (achado) return achado
  }
  return null
}

function ehApresentacao(arquivo: { nome: string; mime: string }): boolean {
  return arquivo.mime === MIME_SLIDES
    || arquivo.mime === MIME_PPTX
    || /presentation/i.test(arquivo.mime)
    || /\.pptx?$/i.test(arquivo.nome)
}

async function baixarPptx(id: string, mime: string | undefined, email?: string): Promise<Buffer | null> {
  const modos = mime === MIME_SLIDES ? ['export'] : ['media', 'export']
  const publico = await baixar(`https://drive.google.com/uc?export=download&id=${id}`)
  if (publico && ehZip(publico)) return publico
  for (const token of await tokensDrive(email)) {
    for (const modo of modos) {
      const url = modo === 'export'
        ? `https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=${encodeURIComponent(MIME_PPTX)}&supportsAllDrives=true`
        : `https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`
      const arquivo = await baixar(url, token)
      if (arquivo && ehZip(arquivo)) return arquivo
    }
  }
  return null
}
