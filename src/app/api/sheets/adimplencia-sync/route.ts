// src/app/api/sheets/adimplencia-sync/route.ts
//
// Webhook recebido do Google Apps Script quando a coluna O da planilha é editada.
// Atualiza diag_adimplencia em rede_franqueados pelo n_franquia (ex: FK0001).
//
// Variável de ambiente necessária:
//   SHEETS_SYNC_SECRET=<string aleatória longa — mesma no Apps Script e aqui>

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const SYNC_SECRET = process.env.SHEETS_SYNC_SECRET

const STATUS_MAP: Record<string, string> = {
  'em dia':           'ok',
  'em atraso':        'inad',
  'em transferência': 'em_transferencia',
  'em transferencia': 'em_transferencia',
}

type Registro = { fk: string; status: string }
type Resultado = { fk: string; ok: boolean; erro?: string }

export async function POST(req: NextRequest) {
  // 1. Verificar secret
  const authHeader = req.headers.get('x-sync-secret')
  if (!SYNC_SECRET || authHeader !== SYNC_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Aceita objeto único ou array
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const registros: Registro[] = Array.isArray(body) ? body : [body as Registro]

  const supabase = await createClient()
  const resultados: Resultado[] = []

  for (const { fk, status } of registros) {
    if (!fk || !status) {
      resultados.push({ fk: fk ?? '', ok: false, erro: 'fk ou status ausente' })
      continue
    }

    const statusNormalizado = STATUS_MAP[status.toLowerCase().trim()] ?? null

    if (!statusNormalizado) {
      resultados.push({ fk, ok: false, erro: `Status desconhecido: "${status}"` })
      continue
    }

    const { error } = await supabase
      .from('rede_franqueados')
      .update({
        diag_adimplencia:               statusNormalizado,
        diag_adimplencia_atualizado_em: new Date().toISOString(),
        diag_adimplencia_origem:        'google_sheets',
      })
      .eq('n_franquia', fk.trim().toUpperCase())

    resultados.push({ fk, ok: !error, erro: error?.message })
  }

  const falhas = resultados.filter(r => !r.ok)
  return NextResponse.json(
    { resultados, total: resultados.length, falhas: falhas.length },
    { status: falhas.length > 0 && falhas.length === resultados.length ? 422 : 200 }
  )
}
