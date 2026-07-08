'use server';

import { createClient } from '@/lib/supabase/server';

type ActionResult = { ok: true } | { ok: false; error: string };

type TopicoHistoricoEvento = {
  tipo: string;
  em: string;
  por?: string | null;
  detalhe?: string | null;
};

function appendHistoricoEvento(historico: unknown, evento: TopicoHistoricoEvento): TopicoHistoricoEvento[] {
  const base = Array.isArray(historico) ? (historico as TopicoHistoricoEvento[]) : [];
  return [...base, evento];
}

type TopicoAtribuicaoRow = {
  id: number;
  responsavel_id: string | null;
  atribuicao_status: string | null;
  historico: unknown;
  chamado_id: number | null;
};

async function carregarTopicoAtribuicao(
  supabase: Awaited<ReturnType<typeof createClient>>,
  topicoId: number,
): Promise<TopicoAtribuicaoRow | null> {
  const { data } = await supabase
    .from('sirene_topicos')
    .select('id, responsavel_id, atribuicao_status, historico, chamado_id')
    .eq('id', topicoId)
    .maybeSingle();
  return data as TopicoAtribuicaoRow | null;
}

/** Responsável aceita a atribuição de uma atividade sirene. */
export async function aceitarAtribuicaoTopico(
  topicoId: string,
  basePath?: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const idNum = Number.parseInt(String(topicoId), 10);
  if (!Number.isFinite(idNum)) return { ok: false, error: 'Atividade inválida.' };

  const row = await carregarTopicoAtribuicao(supabase, idNum);
  if (!row) return { ok: false, error: 'Atividade não encontrada.' };
  if (!row.responsavel_id) return { ok: false, error: 'Esta atividade não tem responsável atribuído.' };
  if (user.id !== row.responsavel_id) return { ok: false, error: 'Somente o responsável pode aceitar esta atribuição.' };
  if (row.atribuicao_status !== 'pendente_aceite') return { ok: false, error: 'Esta atribuição já foi processada.' };

  const { error } = await supabase
    .from('sirene_topicos')
    .update({
      atribuicao_status: 'aceito',
      historico: appendHistoricoEvento(row.historico, {
        tipo: 'Atribuição aceita',
        em: new Date().toISOString(),
        por: user.id,
      }),
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', row.id);
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}

/** Responsável recusa a atribuição de uma atividade sirene, com justificativa obrigatória. */
export async function recusarAtribuicaoTopico(
  topicoId: string,
  justificativa: string,
  basePath?: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const texto = justificativa.trim();
  if (!texto) return { ok: false, error: 'A justificativa é obrigatória.' };

  const idNum = Number.parseInt(String(topicoId), 10);
  if (!Number.isFinite(idNum)) return { ok: false, error: 'Atividade inválida.' };

  const row = await carregarTopicoAtribuicao(supabase, idNum);
  if (!row) return { ok: false, error: 'Atividade não encontrada.' };
  if (!row.responsavel_id) return { ok: false, error: 'Esta atividade não tem responsável atribuído — não é possível recusar.' };
  if (user.id !== row.responsavel_id) return { ok: false, error: 'Somente o responsável atual pode recusar esta atribuição.' };
  if (row.atribuicao_status !== 'pendente_aceite') return { ok: false, error: 'Esta atribuição já foi processada.' };

  const { error } = await supabase
    .from('sirene_topicos')
    .update({
      atribuicao_status: 'recusado',
      atribuicao_recusado_por: user.id,
      atribuicao_justificativa: texto,
      responsavel_id: null,
      responsaveis_ids: [],
      historico: appendHistoricoEvento(row.historico, {
        tipo: 'Atribuição recusada',
        em: new Date().toISOString(),
        por: user.id,
        detalhe: texto,
      }),
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', row.id);
  if (error) return { ok: false, error: error.message };

  // Comentário automático no chamado — falha não reverte o update do tópico
  if (row.chamado_id != null) {
    const { data: perfil } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();
    const autorNome = String((perfil as { full_name?: string | null } | null)?.full_name ?? '').trim() || null;
    const { error: commentError } = await supabase.from('kanban_card_comentarios').insert({
      sirene_chamado_id: row.chamado_id,
      autor_id: user.id,
      autor_nome: autorNome,
      conteudo: `${autorNome ?? 'Responsável'} recusou a atividade: ${texto}`,
    });
    if (commentError) {
      console.error('[recusarAtribuicaoTopico] Falha ao criar comentário automático:', commentError.message);
    }
  }

  return { ok: true };
}
