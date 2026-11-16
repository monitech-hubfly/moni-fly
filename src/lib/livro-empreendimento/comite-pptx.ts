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

function notasDoSlide(xml: string): number[] {
  const tabelas = xml.match(/<a:tbl[\s\S]*?<\/a:tbl>/g) ?? []
  const notas: number[] = []
  for (const tabela of tabelas) {
    const linhas = (tabela.match(/<a:tr[\s\S]*?<\/a:tr>/g) ?? []).map(celulasDaLinha)
    const cabecalho = linhas.findIndex((linha) => linha.some((celula) => /score\s*moni/i.test(semAcento(celula))))
    if (cabecalho < 0) continue
    const coluna = linhas[cabecalho].findIndex((celula) => /score\s*moni/i.test(semAcento(celula)))
    for (const linha of linhas.slice(cabecalho + 1)) {
      const nota = notaCelula(linha[coluna] ?? '')
      if (nota != null) notas.push(nota)
    }
  }
  return notas
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
