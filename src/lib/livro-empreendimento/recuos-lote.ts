/**
 * Recuos do Checklist Técnico | Acoplamento para Comitê
 * (form-acoplamento-checklist-comite) para a ficha do lote.
 */

export const FORMULARIO_CHECKLIST_ACOPLAMENTO_ID = 'form-acoplamento-checklist-comite'
export const FORMULARIO_CHECKLIST_ACOPLAMENTO_NOME = 'Checklist Técnico | Acoplamento para Comitê'

export const CHAVES_RECUO_CHECKLIST = {
  frontal: { id: 'campo-actc-recuo-front', rotulo: 'recuo frontal' },
  fundos: { id: 'campo-actc-recuo-fundos', rotulo: 'recuo de fundos' },
  direita: { id: 'campo-actc-recuo-dir', rotulo: 'recuo lateral direita' },
  esquerda: { id: 'campo-actc-recuo-esq', rotulo: 'recuo lateral esquerda' },
} as const

export type PapelRecuo = keyof typeof CHAVES_RECUO_CHECKLIST

export type RecuosLote = {
  frontal: string | null
  fundos: string | null
  direita: string | null
  esquerda: string | null
}

export const RECUOS_VAZIOS: RecuosLote = {
  frontal: null,
  fundos: null,
  direita: null,
  esquerda: null,
}

export type CampoRecuoDefinicao = {
  id: string
  nome: string | null
}

export type ValorRecuoCampo = {
  campo_id: string
  valor_texto: string | null
  valor_numero: number | string | null
}

function normalizarRotulo(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function formatarNumeroPtBr(valor: number): string {
  const arredondado = Math.round(Math.abs(valor) * 100) / 100
  const [inteiro, fracao = ''] = arredondado.toFixed(2).split('.')
  const milhar = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const decimal = fracao.replace(/0+$/, '')
  return decimal ? `${milhar},${decimal}` : milhar
}

/** Extrai o número de textos como "5", "2,5", "5 metros" ou "2,5 metros m". */
export function numeroRecuo(valor: unknown): number | null {
  if (typeof valor === 'number') {
    if (!Number.isFinite(valor) || valor === 0) return null
    return valor
  }
  if (typeof valor !== 'string') return null
  const texto = valor.trim()
  if (!texto) return null
  const match = texto.match(/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?/)
  if (!match) return null
  const bruto = match[0]
  let normalizado: string
  if (bruto.includes(',') && bruto.includes('.')) {
    normalizado = bruto.replace(/\./g, '').replace(',', '.')
  } else if (bruto.includes(',')) {
    normalizado = bruto.replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(bruto)) {
    normalizado = bruto.replace(/\./g, '')
  } else {
    normalizado = bruto
  }
  const numero = Number(normalizado)
  if (!Number.isFinite(numero) || numero === 0) return null
  return numero
}

export function metrosRecuo(valor: unknown): string | null {
  const numero = numeroRecuo(valor)
  if (numero == null) return null
  return `${formatarNumeroPtBr(numero)} m`
}

function textoDoValor(valor: ValorRecuoCampo | undefined): string | null {
  if (!valor) return null
  const texto = typeof valor.valor_texto === 'string' ? valor.valor_texto.trim() : ''
  if (texto) return texto
  if (valor.valor_numero == null || valor.valor_numero === '') return null
  return String(valor.valor_numero)
}

function idRealDoPapel(campos: CampoRecuoDefinicao[], papel: PapelRecuo): string | null {
  const def = CHAVES_RECUO_CHECKLIST[papel]
  if (campos.some((campo) => campo.id === def.id)) return def.id
  const porRotulo = campos.find((campo) => normalizarRotulo(String(campo.nome ?? '')) === def.rotulo)
  return porRotulo?.id ?? null
}

export function recuosDosValores(campos: CampoRecuoDefinicao[], valores: ValorRecuoCampo[]): RecuosLote {
  const porCampo = new Map(valores.map((valor) => [valor.campo_id, valor]))
  const ler = (papel: PapelRecuo): string | null => {
    const id = idRealDoPapel(campos, papel)
    if (!id) return null
    return textoDoValor(porCampo.get(id))
  }
  return {
    frontal: ler('frontal'),
    fundos: ler('fundos'),
    direita: ler('direita'),
    esquerda: ler('esquerda'),
  }
}

function mesmaMedida(a: number, b: number): boolean {
  return Math.round(a * 100) === Math.round(b * 100)
}

/** Linha da ficha. Sem nenhum recuo útil, devolve null para a linha não ser renderizada. */
export function textoLinhaRecuos(recuos: RecuosLote | null | undefined): string | null {
  if (!recuos) return null
  const frente = numeroRecuo(recuos.frontal)
  const fundo = numeroRecuo(recuos.fundos)
  const direita = numeroRecuo(recuos.direita)
  const esquerda = numeroRecuo(recuos.esquerda)
  const partes: string[] = []
  if (frente != null) partes.push(`${formatarNumeroPtBr(frente)} m frente`)
  if (fundo != null) partes.push(`${formatarNumeroPtBr(fundo)} m fundo`)
  if (direita != null && esquerda != null) {
    if (mesmaMedida(direita, esquerda)) {
      partes.push(`${formatarNumeroPtBr(direita)} m laterais`)
    } else {
      partes.push(`${formatarNumeroPtBr(direita)} m direita`)
      partes.push(`${formatarNumeroPtBr(esquerda)} m esquerda`)
    }
  } else if (direita != null) {
    partes.push(`${formatarNumeroPtBr(direita)} m direita`)
  } else if (esquerda != null) {
    partes.push(`${formatarNumeroPtBr(esquerda)} m esquerda`)
  }
  if (partes.length === 0) return null
  return `Recuos · ${partes.join(' · ')}`
}
