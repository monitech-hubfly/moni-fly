import { isoWeek } from './periodos'

/** Extrai o número da semana a partir de `meta_unidade` / `concluido_em` (S12 ou número). */
export function parseSemanaMetaTexto(raw) {
  const s = String(raw ?? '').trim()
  const m = s.match(/^S\s*(\d{1,2})$/i)
  if (m?.[1]) {
    const n = Number(m[1])
    if (!Number.isFinite(n) || n < 1 || n > 53) return null
    return n
  }
  const n = Number(s)
  if (!Number.isFinite(n) || n < 1 || n > 53) return null
  return n
}

/** Rótulo da semana ISO atual, alinhado ao restante do app (ex.: meta_unidade). */
export function labelSemanaIsoAtual() {
  const w = isoWeek(new Date())
  if (!Number.isFinite(w) || w < 1 || w > 53) return 'S1'
  return `S${w}`
}

export function semanaMetaNoPrazo(prazoRaw, concluidoRaw) {
  const prazo = parseSemanaMetaTexto(prazoRaw)
  const concl = parseSemanaMetaTexto(concluidoRaw)
  if (prazo == null || concl == null) return null
  return concl <= prazo
}
