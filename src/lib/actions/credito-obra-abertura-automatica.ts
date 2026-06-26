'use server';

import { revalidatePath } from 'next/cache';
import { FASE_SLUGS, KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { criarCardFilho } from '@/lib/actions/kanban-bastoes';
import {
  calcularDataEnvioCreditoObra,
  dataEnvioCreditoObraJaChegou,
  formatDataEnvioCreditoObraExibicao,
  parsePreObraDataParaIso,
} from '@/lib/pre-obra/credito-obra-envio-data';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export type CreditoObraAberturaPendenteResult =
  | {
      ok: true;
      deveExibir: boolean;
      dataEnvio: string | null;
      dataEnvioExibicao: string | null;
      tituloCard: string;
      processoId: string | null;
      motivoNaoExibir?: string;
    }
  | { ok: false; error: string };

function normalizarDataGravacao(input: string | null | undefined): string | null {
  return parsePreObraDataParaIso(input);
}

async function carregarContextoAbertura(cardId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Faça login para continuar.' };

  let db: ReturnType<typeof createAdminClient>;
  try {
    db = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false as const, error: `Serviço indisponível: ${msg}` };
  }

  const { data: card, error: errCard } = await db
    .from('kanban_cards')
    .select('id, titulo, kanban_id, projeto_id, rede_franqueado_id, fase_id')
    .eq('id', cardId)
    .maybeSingle();

  if (errCard) return { ok: false as const, error: errCard.message };
  if (!card?.id) return { ok: false as const, error: 'Card não encontrado.' };

  const kanbanId = String(card.kanban_id ?? '').trim();
  if (kanbanId !== KANBAN_IDS.OPERACOES) {
    return {
      ok: true as const,
      card,
      faseSlug: null,
      processo: null,
      filhoCreditoObraId: null,
      motivo: 'Card fora do Funil Pré Obra e Obra.',
    };
  }

  const { data: fase, error: errFase } = await db
    .from('kanban_fases')
    .select('slug')
    .eq('id', String(card.fase_id ?? ''))
    .maybeSingle();

  if (errFase) return { ok: false as const, error: errFase.message };

  const faseSlug = String((fase as { slug?: string | null } | null)?.slug ?? '').trim();
  if (faseSlug !== FASE_SLUGS.APROVACAO_PREFEITURA) {
    return {
      ok: true as const,
      card,
      faseSlug,
      processo: null,
      filhoCreditoObraId: null,
      motivo: 'Card não está na fase Aprovação na Prefeitura.',
    };
  }

  const projetoId = String(card.projeto_id ?? '').trim();
  if (!projetoId) {
    return {
      ok: true as const,
      card,
      faseSlug,
      processo: null,
      filhoCreditoObraId: null,
      motivo: 'Card sem processo vinculado (Dados Pré Obra).',
    };
  }

  const { data: processo, error: errProc } = await db
    .from('processo_step_one')
    .select('id, previsao_aprovacao_prefeitura, previsao_liberacao_credito_obra')
    .eq('id', projetoId)
    .maybeSingle();

  if (errProc) return { ok: false as const, error: errProc.message };
  if (!processo?.id) {
    return {
      ok: true as const,
      card,
      faseSlug,
      processo: null,
      filhoCreditoObraId: null,
      motivo: 'Processo não encontrado.',
    };
  }

  const { data: filho, error: errFilho } = await db
    .from('kanban_cards')
    .select('id')
    .eq('origem_card_id', cardId)
    .eq('kanban_id', KANBAN_IDS.CREDITO_OBRA)
    .limit(1)
    .maybeSingle();

  if (errFilho) return { ok: false as const, error: errFilho.message };

  return {
    ok: true as const,
    card,
    faseSlug,
    processo: processo as {
      id: string;
      previsao_aprovacao_prefeitura: string | null;
      previsao_liberacao_credito_obra: string | null;
    },
    filhoCreditoObraId: filho?.id ? String(filho.id) : null,
    motivo: undefined,
  };
}

/** Verifica se o popup de autorização deve ser exibido ao abrir o card em Operações / Aprovação Prefeitura. */
export async function consultarAberturaCreditoObraPendente(
  cardId: string,
): Promise<CreditoObraAberturaPendenteResult> {
  const id = String(cardId ?? '').trim();
  if (!id) return { ok: false, error: 'Card inválido.' };

  const ctx = await carregarContextoAbertura(id);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const tituloCard = String(ctx.card.titulo ?? '').trim() || 'Card';
  const processoId = ctx.processo?.id ? String(ctx.processo.id) : null;

  if (ctx.filhoCreditoObraId) {
    return {
      ok: true,
      deveExibir: false,
      dataEnvio: null,
      dataEnvioExibicao: null,
      tituloCard,
      processoId,
      motivoNaoExibir: 'Já existe card no Funil Cash Me.',
    };
  }

  if (!ctx.processo) {
    return {
      ok: true,
      deveExibir: false,
      dataEnvio: null,
      dataEnvioExibicao: null,
      tituloCard,
      processoId,
      motivoNaoExibir: ctx.motivo,
    };
  }

  let dataEnvio = normalizarDataGravacao(ctx.processo.previsao_liberacao_credito_obra);
  if (!dataEnvio) {
    dataEnvio = calcularDataEnvioCreditoObra(ctx.processo.previsao_aprovacao_prefeitura);
  }

  if (!dataEnvio) {
    return {
      ok: true,
      deveExibir: false,
      dataEnvio: null,
      dataEnvioExibicao: null,
      tituloCard,
      processoId,
      motivoNaoExibir: 'Informe a previsão de aprovação na prefeitura em Dados Pré Obra.',
    };
  }

  if (!dataEnvioCreditoObraJaChegou(dataEnvio)) {
    return {
      ok: true,
      deveExibir: false,
      dataEnvio,
      dataEnvioExibicao: formatDataEnvioCreditoObraExibicao(dataEnvio),
      tituloCard,
      processoId,
      motivoNaoExibir: 'A data de envio para Crédito Obra ainda não foi atingida.',
    };
  }

  return {
    ok: true,
    deveExibir: true,
    dataEnvio,
    dataEnvioExibicao: formatDataEnvioCreditoObraExibicao(dataEnvio),
    tituloCard,
    processoId,
  };
}

export type CreditoObraAberturaAcaoResult =
  | { ok: true; cardFilhoId?: string; dataEnvio?: string | null }
  | { ok: false; error: string };

/** Autoriza a abertura do card filho no Funil Cash Me (fase Novo Projeto). */
export async function autorizarAberturaCreditoObra(
  cardId: string,
  basePath?: string,
): Promise<CreditoObraAberturaAcaoResult> {
  const pendente = await consultarAberturaCreditoObraPendente(cardId);
  if (!pendente.ok) return pendente;
  if (!pendente.deveExibir) {
    return { ok: false, error: pendente.motivoNaoExibir ?? 'Abertura não está pendente.' };
  }

  const ctx = await carregarContextoAbertura(cardId);
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!ctx.processo) return { ok: false, error: 'Processo não encontrado.' };

  const titulo = String(ctx.card.titulo ?? '').trim() || 'Card';

  try {
    const filho = await criarCardFilho({
      cardPaiId: cardId,
      kanbanDestinoId: KANBAN_IDS.CREDITO_OBRA,
      faseDestinoSlug: FASE_SLUGS.CO_NOVO_PROJETO,
      titulo,
      projetoId: String(ctx.card.projeto_id ?? '').trim() || null,
      redeFranqueadoId: String(ctx.card.rede_franqueado_id ?? '').trim() || null,
      kanbanOrigemSlug: 'operacoes',
      faseOrigemSlug: FASE_SLUGS.APROVACAO_PREFEITURA,
    });

    if (!filho?.id) {
      return { ok: false, error: 'Já existe um card no Funil Cash Me para este projeto.' };
    }

    const path = basePath?.trim() || '/';
    revalidatePath(path);
    revalidatePath('/');
    revalidatePath('/funil-credito-obra');

    return { ok: true, cardFilhoId: String(filho.id), dataEnvio: pendente.dataEnvio };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

/** Recusa a abertura: nova previsão na prefeitura e recálculo da data de envio Crédito Obra. */
export async function recusarAberturaCreditoObra(
  cardId: string,
  novaPrevisaoAprovacaoPrefeitura: string,
  basePath?: string,
): Promise<CreditoObraAberturaAcaoResult> {
  const id = String(cardId ?? '').trim();
  const novaPref = parsePreObraDataParaIso(novaPrevisaoAprovacaoPrefeitura);
  if (!id) return { ok: false, error: 'Card inválido.' };
  if (!novaPref) return { ok: false, error: 'Informe uma nova previsão de aprovação na prefeitura (data válida).' };

  const ctx = await carregarContextoAbertura(id);
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!ctx.processo?.id) return { ok: false, error: 'Processo não encontrado.' };

  const novaLiberacao = calcularDataEnvioCreditoObra(novaPref);
  if (!novaLiberacao) {
    return { ok: false, error: 'Não foi possível calcular a nova data de envio para Crédito Obra.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para continuar.' };

  const { error } = await supabase
    .from('processo_step_one')
    .update({
      previsao_aprovacao_prefeitura: novaPref,
      previsao_liberacao_credito_obra: novaLiberacao,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', ctx.processo.id);

  if (error) return { ok: false, error: error.message };

  const path = basePath?.trim() || '/';
  revalidatePath(path);
  revalidatePath('/');

  return { ok: true, dataEnvio: novaLiberacao };
}
