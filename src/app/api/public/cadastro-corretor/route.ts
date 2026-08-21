import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { clientIpFromRequest, checkIpRateLimit } from '@/lib/public-rate-limit'
import { insertRedeCorretorRow } from '@/lib/rede-corretor-persist'
import type { RedeCorretorPatch } from '@/lib/rede-corretores'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const ip = clientIpFromRequest(req)
  const limited = checkIpRateLimit({
    key: `cadastro-corretor:${ip}`,
    limit: 8,
    windowMs: 15 * 60 * 1000,
  })
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: 'Muitas tentativas. Aguarde e tente novamente.' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } },
    )
  }

  const body = (await req.json().catch(() => null)) as RedeCorretorPatch | null
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'Dados inválidos.' }, { status: 400 })
  }

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json({ ok: false, error: 'Serviço indisponível.' }, { status: 503 })
  }

  const patch: RedeCorretorPatch = {
    nome: body.nome,
    cpf_cnpj: body.cpf_cnpj,
    creci_numero: body.creci_numero,
    creci_uf: body.creci_uf,
    creci_tipo_registro: body.creci_tipo_registro,
    creci_validade: body.creci_validade,
    email: body.email,
    telefone: body.telefone,
    atuacao_ufs: body.atuacao_ufs,
    atuacao_cidades: body.atuacao_cidades,
    conta_banco_codigo: body.conta_banco_codigo,
    conta_agencia: body.conta_agencia,
    conta_numero: body.conta_numero,
    conta_tipo: body.conta_tipo,
    conta_titular: body.conta_titular,
    conta_pix_tipo: body.conta_pix_tipo,
    conta_pix_chave: body.conta_pix_chave,
    observacoes: body.observacoes,
  }

  const inserted = await insertRedeCorretorRow({
    supabase: admin,
    patch,
    status: 'pendente',
    userId: null,
  })

  if (!inserted.ok) {
    return NextResponse.json({ ok: false, error: inserted.error }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    id: inserted.id,
    n_corretor: inserted.n_corretor,
    mensagem: 'Cadastro recebido. Aguarde a análise da equipe Moní.',
  })
}
