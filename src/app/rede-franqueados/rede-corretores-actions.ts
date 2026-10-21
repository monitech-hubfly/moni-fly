'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { normalizeAccessRole } from '@/lib/authz'
import {
  cleanCorretorPatch,
  insertRedeCorretorRow,
  validarCamposCorretor,
} from '@/lib/rede-corretor-persist'
import { enviarEmailLinksDoCorretor } from '@/lib/corretor-emails'
import {
  listarEmpreendimentosParaVinculoCorretor,
  substituirVinculosCorretorEmpreendimentos,
  vincularCorretorAosEmpreendimentosAtivos,
  type EmpreendimentoVinculoOpcao,
} from '@/lib/corretor-empreendimentos-vinculo'
import type { RedeCorretorPatch, RedeCorretorStatus } from '@/lib/rede-corretores'

type Ok = { ok: true; mensagem: string; id?: string }
type Err = { ok: false; error: string }

async function requireRedeCorretoresStaff(): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; userId: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Faça login.' }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const access = normalizeAccessRole((profile as { role?: string } | null)?.role)
  if (access !== 'admin' && access !== 'team') {
    return { ok: false, error: 'Apenas administradores ou time podem gerir corretores.' }
  }
  return { ok: true, supabase, userId: user.id }
}

export async function listarEmpreendimentosAbertosParaCorretor(): Promise<EmpreendimentoVinculoOpcao[]> {
  const gate = await requireRedeCorretoresStaff()
  if (!gate.ok) return []
  return listarEmpreendimentosParaVinculoCorretor(gate.supabase)
}

export async function listarEmpreendimentosVinculadosDoCorretor(corretorId: string): Promise<string[]> {
  const gate = await requireRedeCorretoresStaff()
  if (!gate.ok) return []
  const id = String(corretorId ?? '').trim()
  if (!id) return []
  const { data, error } = await gate.supabase
    .from('imob_corretor_empreendimentos')
    .select('empreendimento_id')
    .eq('corretor_id', id)
  if (error) return []
  return (data ?? [])
    .map((row: { empreendimento_id?: string }) => String(row.empreendimento_id ?? ''))
    .filter(Boolean)
}

export async function vincularEmpreendimentosDoNovoCorretor(
  corretorId: string,
  empreendimentoIds: string[],
): Promise<Ok | Err> {
  const gate = await requireRedeCorretoresStaff()
  if (!gate.ok) return gate
  const vinculo = await vincularCorretorAosEmpreendimentosAtivos(
    gate.supabase,
    corretorId,
    empreendimentoIds,
  )
  if (!vinculo.ok) return vinculo
  revalidatePath('/rede-franqueados')
  return { ok: true, mensagem: 'Empreendimentos vinculados.' }
}

export async function salvarVinculosEmpreendimentoDoCorretor(
  corretorId: string,
  empreendimentoIds: string[],
): Promise<Ok | Err> {
  const gate = await requireRedeCorretoresStaff()
  if (!gate.ok) return gate
  const salvo = await substituirVinculosCorretorEmpreendimentos(
    gate.supabase,
    corretorId,
    empreendimentoIds,
  )
  if (!salvo.ok) return salvo
  revalidatePath('/rede-franqueados')
  return { ok: true, mensagem: 'Empreendimentos vinculados.' }
}

export async function criarRedeCorretor(patch: RedeCorretorPatch): Promise<Ok | Err> {
  const gate = await requireRedeCorretoresStaff()
  if (!gate.ok) return gate

  const status: RedeCorretorStatus = patch.status ?? 'aprovado'

  const inserted = await insertRedeCorretorRow({
    supabase: gate.supabase,
    patch,
    status,
    userId: gate.userId,
  })
  if (!inserted.ok) return inserted

  revalidatePath('/rede-franqueados')
  revalidatePath('/corretores/novo')
  return {
    ok: true,
    mensagem: `Corretor cadastrado (${inserted.n_corretor}).`,
    id: inserted.id,
  }
}

export async function atualizarRedeCorretor(id: string, patch: RedeCorretorPatch): Promise<Ok | Err> {
  const gate = await requireRedeCorretoresStaff()
  if (!gate.ok) return gate
  if (!id) return { ok: false, error: 'ID inválido.' }

  if (patch.nome !== undefined && !String(patch.nome).trim()) {
    return { ok: false, error: 'Informe o nome completo ou razão social.' }
  }

  const errVal = validarCamposCorretor({
    ...patch,
    nome: patch.nome ?? '__skip__',
  })
  if (errVal && errVal !== 'Informe o nome completo ou razão social.') {
    return { ok: false, error: errVal }
  }

  const row = cleanCorretorPatch(patch)
  if (Object.keys(row).length === 0) return { ok: false, error: 'Nada para atualizar.' }

  row.updated_at = new Date().toISOString()
  row.ultima_atualizacao_por = gate.userId

  const { error } = await gate.supabase.from('rede_corretores').update(row as never).eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/rede-franqueados')
  revalidatePath('/corretores/novo')
  return { ok: true, mensagem: 'Corretor atualizado.' }
}

export async function arquivarRedeCorretor(id: string): Promise<Ok | Err> {
  return atualizarRedeCorretor(id, { status: 'inativo' })
}

async function notificarLinksDoCorretor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  textos: { titulo: string; intro: string; semEmail: string; falha: string; semServico: string; enviado: string },
): Promise<string> {
  const { data } = await supabase
    .from('rede_corretores')
    .select('id, nome, email')
    .eq('id', id)
    .maybeSingle()
  const row = data as { nome?: string | null; email?: string | null } | null
  const email = String(row?.email ?? '').trim()
  if (!email.includes('@')) return textos.semEmail

  const enviado = await enviarEmailLinksDoCorretor({
    supabase,
    corretorId: id,
    nome: String(row?.nome ?? ''),
    email,
    assunto: 'Seus links de jornada — Casa Moní',
    titulo: textos.titulo,
    intro: textos.intro,
  })
  if (!enviado.ok) return `${textos.falha}: ${enviado.error}`
  if (!enviado.skipped) {
    await supabase
      .from('rede_corretores')
      .update({ email_enviado_em: new Date().toISOString() } as never)
      .eq('id', id)
  }
  return enviado.skipped ? textos.semServico : textos.enviado
}

export async function aprovarRedeCorretor(id: string): Promise<Ok | Err> {
  const gate = await requireRedeCorretoresStaff()
  if (!gate.ok) return gate
  const atualizado = await atualizarRedeCorretor(id, { status: 'aprovado' })
  if (!atualizado.ok) return atualizado

  const mensagem = await notificarLinksDoCorretor(gate.supabase, id, {
    titulo: 'Cadastro aprovado',
    intro: 'Seu cadastro foi aprovado. Abaixo estão os links dos empreendimentos vinculados a você.',
    semEmail: 'Cadastro aprovado. O corretor não tem e-mail para receber os links.',
    falha: 'Cadastro aprovado. O e-mail dos links não foi enviado',
    semServico: 'Cadastro aprovado. O serviço de e-mail não está configurado neste ambiente.',
    enviado: 'Cadastro aprovado. O corretor recebeu os links dos empreendimentos.',
  })
  return { ok: true, mensagem }
}

/** Cadastro feito pela equipe: status aprovado recebe na hora os links dos vínculos. */
export async function enviarLinksDoCadastroNaRede(id: string): Promise<Ok | Err> {
  const gate = await requireRedeCorretoresStaff()
  if (!gate.ok) return gate
  const corretorId = String(id ?? '').trim()
  if (!corretorId) return { ok: false, error: 'ID inválido.' }

  const { data } = await gate.supabase
    .from('rede_corretores')
    .select('status')
    .eq('id', corretorId)
    .maybeSingle()
  if (String((data as { status?: string } | null)?.status ?? '') !== 'aprovado') {
    return { ok: true, mensagem: 'Corretor cadastrado.' }
  }

  const mensagem = await notificarLinksDoCorretor(gate.supabase, corretorId, {
    titulo: 'Seus links de jornada',
    intro: 'Abaixo estão os links dos empreendimentos vinculados a você.',
    semEmail: 'Corretor cadastrado como aprovado. Não há e-mail para enviar os links.',
    falha: 'Corretor cadastrado como aprovado. O e-mail dos links não foi enviado',
    semServico: 'Corretor cadastrado como aprovado. O serviço de e-mail não está configurado neste ambiente.',
    enviado: 'Corretor cadastrado como aprovado. Ele recebeu os links dos empreendimentos.',
  })
  return { ok: true, mensagem }
}
