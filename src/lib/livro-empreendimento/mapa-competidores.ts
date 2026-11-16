/**
 * Lê o mapa de competidores em Dados do Negócio.
 * Aba de resultado, coluna da compatibilidade: alta, média e baixa.
 * Aba base: média do preço de venda e média do R$/m².
 */

import * as XLSX from 'xlsx'
import { baixarPlanilha, classificarLinkBca, listarPasta, tokensDrive } from '@/lib/livro-empreendimento/cenarios-bca'

export interface MercadoCompetidores {
  alta: number
  media: number
  baixa: number
  precoMedio: number | null
  valorM2: number | null
}

const MIME_PLANILHA = 'application/vnd.google-apps.spreadsheet'

export function mercadoDoXlsx(buffer: Buffer): MercadoCompetidores | null {
  const livro = XLSX.read(buffer, { type: 'buffer' })
  const resultado = abaNome(livro, (nome) => /mapa de competidores/.test(nome) && /resul/.test(nome))
  const base = abaNome(livro, (nome) => /mapa de competidores/.test(nome) && /base/.test(nome))
  if (!resultado && !base) return null
  const compat = resultado ? contagemCompatibilidade(livro.Sheets[resultado]) : { alta: 0, media: 0, baixa: 0 }
  const precos = base ? mediasDaBase(livro.Sheets[base]) : { precoMedio: null, valorM2: null }
  if (compat.alta + compat.media + compat.baixa === 0 && precos.precoMedio == null && precos.valorM2 == null) {
    return null
  }
  return { ...compat, ...precos }
}

export async function mercadoDaPlanilha(link: string, email?: string): Promise<MercadoCompetidores | null> {
  const ref = classificarLinkBca(link)
  if (!ref) return null
  const id = ref.tipo === 'pasta' ? await idMapaNaPasta(ref.id, email) : ref.id
  if (!id) return null
  const buffer = await baixarPlanilha(id, email)
  if (!buffer) return null
  return mercadoDoXlsx(buffer)
}

function abaNome(livro: XLSX.WorkBook, aceita: (nome: string) => boolean): string | null {
  return livro.SheetNames.find((nome) => aceita(semAcento(nome))) ?? null
}

function contagemCompatibilidade(aba: XLSX.WorkSheet): { alta: number; media: number; baixa: number } {
  const contagem = { alta: 0, media: 0, baixa: 0 }
  const coluna = colunaDoRotulo(aba, /compatib/) ?? 6
  const faixa = faixaDaAba(aba)
  if (!faixa) return contagem
  const inicio = linhaDoRotulo(aba, coluna, /compatib/)
  for (let linha = inicio + 1; linha <= faixa.e.r; linha += 1) {
    const classe = classeCompatibilidade(textoCelula(aba, coluna, linha))
    if (classe) contagem[classe] += 1
  }
  return contagem
}

function mediasDaBase(aba: XLSX.WorkSheet): { precoMedio: number | null; valorM2: number | null } {
  const preco = colunaDoRotulo(aba, /preco de venda|preco venda/) ?? 9
  const metro = colunaDoRotulo(aba, /r\$\s*\/\s*m/) ?? 11
  return {
    precoMedio: mediaDaColuna(aba, preco, /preco de venda|preco venda/),
    valorM2: mediaDaColuna(aba, metro, /r\$\s*\/\s*m/),
  }
}

function mediaDaColuna(aba: XLSX.WorkSheet, coluna: number, rotulo: RegExp): number | null {
  const faixa = faixaDaAba(aba)
  if (!faixa) return null
  const inicio = linhaDoRotulo(aba, coluna, rotulo)
  const numeros: number[] = []
  for (let linha = inicio + 1; linha <= faixa.e.r; linha += 1) {
    const n = numeroCelula(aba, coluna, linha)
    if (n != null && n > 0) numeros.push(n)
  }
  if (numeros.length === 0) return null
  return numeros.reduce((soma, n) => soma + n, 0) / numeros.length
}

function colunaDoRotulo(aba: XLSX.WorkSheet, rotulo: RegExp): number | null {
  const faixa = faixaDaAba(aba)
  if (!faixa) return null
  const limite = Math.min(faixa.e.r, faixa.s.r + 40)
  for (let linha = faixa.s.r; linha <= limite; linha += 1) {
    for (let coluna = faixa.s.c; coluna <= faixa.e.c; coluna += 1) {
      if (rotulo.test(semAcento(textoCelula(aba, coluna, linha)))) return coluna
    }
  }
  return null
}

function linhaDoRotulo(aba: XLSX.WorkSheet, coluna: number, rotulo: RegExp): number {
  const faixa = faixaDaAba(aba)
  if (!faixa) return -1
  const limite = Math.min(faixa.e.r, faixa.s.r + 40)
  for (let linha = faixa.s.r; linha <= limite; linha += 1) {
    if (rotulo.test(semAcento(textoCelula(aba, coluna, linha)))) return linha
  }
  return faixa.s.r
}

function classeCompatibilidade(valor: string): 'alta' | 'media' | 'baixa' | null {
  const texto = semAcento(valor).trim()
  if (texto === 'alto' || texto === 'alta' || texto.startsWith('alta ')) return 'alta'
  if (texto === 'medio' || texto === 'media' || texto.startsWith('media ') || texto.startsWith('medio ')) return 'media'
  if (texto === 'baixo' || texto === 'baixa' || texto.startsWith('baixa ') || texto.startsWith('baixo ')) return 'baixa'
  return null
}

function faixaDaAba(aba: XLSX.WorkSheet): XLSX.Range | null {
  if (!aba['!ref']) return null
  return XLSX.utils.decode_range(aba['!ref'])
}

function textoCelula(aba: XLSX.WorkSheet, coluna: number, linha: number): string {
  const celula = aba[XLSX.utils.encode_cell({ c: coluna, r: linha })]
  if (!celula || celula.t === 'e') return ''
  return String(celula.w ?? celula.v ?? '').replace(/\s+/g, ' ').trim()
}

function numeroCelula(aba: XLSX.WorkSheet, coluna: number, linha: number): number | null {
  const celula = aba[XLSX.utils.encode_cell({ c: coluna, r: linha })]
  if (!celula || celula.t === 'e') return null
  if (typeof celula.v === 'number' && Number.isFinite(celula.v)) return celula.v
  return numeroTexto(String(celula.w ?? celula.v ?? ''))
}

function numeroTexto(value: string): number | null {
  let texto = value.replace(/r\$/gi, '').replace(/\s/g, '').trim()
  if (!texto || !/\d/.test(texto)) return null
  const temVirgula = texto.includes(',')
  const temPonto = texto.includes('.')
  if (temVirgula && temPonto && /\.\d{1,2}$/.test(texto)) texto = texto.replace(/,/g, '')
  else if (temVirgula && temPonto) texto = texto.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(,\d{3})+$/.test(texto)) texto = texto.replace(/,/g, '')
  else if (temVirgula) texto = texto.replace(',', '.')
  else if (temPonto && /^\d{1,3}(\.\d{3})+$/.test(texto)) texto = texto.replace(/\./g, '')
  texto = texto.replace(/[^\d.-]/g, '')
  const n = Number(texto)
  return Number.isFinite(n) ? n : null
}

function semAcento(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

async function idMapaNaPasta(folderId: string, email?: string): Promise<string | null> {
  for (const token of await tokensDrive(email)) {
    const id = await acharMapa(folderId, token, 0)
    if (id) return id
  }
  return null
}

async function acharMapa(folderId: string, token: string, profundidade: number): Promise<string | null> {
  const arquivos = await listarPasta(folderId, token)
  const planilhas = arquivos
    .filter((arquivo) => ehPlanilha(arquivo))
    .map((arquivo) => ({ id: arquivo.id, nota: notaNome(arquivo.nome) }))
    .filter((arquivo) => arquivo.nota > 0)
    .sort((a, b) => b.nota - a.nota)
  if (planilhas[0]) return planilhas[0].id
  if (profundidade >= 2) return null
  for (const pasta of arquivos.filter((arquivo) => arquivo.mime === 'application/vnd.google-apps.folder')) {
    const achado = await acharMapa(pasta.id, token, profundidade + 1)
    if (achado) return achado
  }
  return null
}

function notaNome(nome: string): number {
  const plano = semAcento(nome)
  if (/analises de viabilidade/.test(plano)) return 2
  if (/mapa de competidores/.test(plano)) return 1
  return 0
}

function ehPlanilha(arquivo: { nome: string; mime: string }): boolean {
  return arquivo.mime === MIME_PLANILHA
    || /spreadsheet|excel/i.test(arquivo.mime)
    || /\.xlsx?$/i.test(arquivo.nome)
}
