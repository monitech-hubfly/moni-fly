export type ParsedCR = { num: number; width: number } | null

export function parseCRValue(value: string | null | undefined): ParsedCR {
  const s = (value ?? '').toString().trim().toUpperCase()
  if (!s) return null
  const m = s.match(/^CR(\d+)$/i)
  if (!m) return null
  const digits = m[1] ?? ''
  const num = Number.parseInt(digits, 10)
  if (!Number.isFinite(num)) return null
  return { num, width: digits.length }
}

export function formatCRValue(num: number, width: number): string {
  const w = Number.isFinite(width) && width > 0 ? width : 4
  return `CR${String(num).padStart(w, '0')}`
}

export async function getNextCRFromRedeCorretores(supabase: {
  from: (table: string) => {
    select: (cols: string) => any
  }
}): Promise<string> {
  const { data, error } = await supabase.from('rede_corretores').select('n_corretor, ordem')

  if (error || !Array.isArray(data) || data.length === 0) {
    return formatCRValue(1, 4)
  }

  let maxNum = 0
  let width = 4
  for (const row of data as { n_corretor?: string | null; ordem?: number | null }[]) {
    const parsed = parseCRValue(row.n_corretor)
    if (parsed && parsed.num > maxNum) {
      maxNum = parsed.num
      width = parsed.width
    } else if (row.ordem != null && row.ordem > maxNum) {
      maxNum = row.ordem
    }
  }
  return formatCRValue(maxNum + 1, width)
}
