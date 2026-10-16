'use server';

import { FASE_SLUGS, KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { podeLerPontosJuridicos } from '@/lib/kanban/juridico-pontos';
import {
  JANELA_SUBMISSAO_IGUAL_MS,
  JURIDICO_ORIGEM_COMERCIAL,
  isTipoSolicitacaoComercial,
  tituloSolicitacaoComercial,
  type TipoSolicitacaoComercial,
} from '@/lib/kanban/juridico-solicitacao-comercial';
import {
  JURIDICO_TAG_COF,
  JURIDICO_TAG_CTO_FRANQUIA,
  aplicarTagJuridicoPortfolio,
} from '@/lib/kanban/juridico-portfolio-tag';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export type CriarSolicitacaoComercialResult =
  | { ok: true; cardId: string; repetida: boolean }
  | { ok: false; error: string };

const TAG_POR_TIPO = {
  cof: JURIDICO_TAG_COF,
  franquia: JURIDICO_TAG_CTO_FRANQUIA,
} as const;

/**
 * Abre atendimento no Funil Jurídico a partir do Comercial.
 * O card nasce em Recebimento, sem card pai e sem espelho de Pipedrive.
 */
export async function criarSolicitacaoJuridicaComercial(input: {
  tipo: string;
  candidato: string;
  observacao: string;
  estado?: string;
  cidade?: string;
}): Promise<CriarSolicitacaoComercialResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para abrir a solicitação.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (!podeLerPontosJuridicos((profile as { role?: string | null } | null)?.role)) {
    return { ok: false, error: 'Sem permissão para abrir solicitação jurídica.' };
  }

  if (!isTipoSolicitacaoComercial(input.tipo)) {
    return { ok: false, error: 'Selecione COF ou Cto de Franquia.' };
  }
  const tipo: TipoSolicitacaoComercial = input.tipo;
  const candidato = String(input.candidato ?? '').trim();
  const observacao = String(input.observacao ?? '').trim();
  if (!candidato) return { ok: false, error: 'Informe o candidato.' };
  if (!observacao) return { ok: false, error: 'Descreva a solicitação.' };
  if (candidato.length > 120) return { ok: false, error: 'O nome do candidato é longo demais.' };

  const estado = String(input.estado ?? '').trim() || null;
  const cidade = String(input.cidade ?? '').trim() || null;

  const desde = new Date(Date.now() - JANELA_SUBMISSAO_IGUAL_MS).toISOString();
  const { data: recente, error: errRecente } = await supabase
    .from('kanban_cards')
    .select('id')
    .eq('kanban_id', KANBAN_IDS.JURIDICO)
    .eq('franqueado_id', user.id)
    .eq('juridico_origem', JURIDICO_ORIGEM_COMERCIAL)
    .eq('juridico_tipo_contrato', tipo)
    .eq('juridico_nome_candidato', candidato)
    .eq('juridico_observacoes', observacao)
    .is('origem_card_id', null)
    .gte('created_at', desde)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (errRecente) return { ok: false, error: errRecente.message };
  const repetidoId = String((recente as { id?: string } | null)?.id ?? '').trim();
  if (repetidoId) return { ok: true, cardId: repetidoId, repetida: true };

  const { data: fase, error: errFase } = await supabase
    .from('kanban_fases')
    .select('id')
    .eq('kanban_id', KANBAN_IDS.JURIDICO)
    .eq('slug', FASE_SLUGS.JURIDICO_RECEBIMENTO)
    .eq('ativo', true)
    .maybeSingle();
  if (errFase) return { ok: false, error: errFase.message };
  const faseId = String((fase as { id?: string } | null)?.id ?? '').trim();
  if (!faseId) return { ok: false, error: 'A fase Recebimento do Funil Jurídico não foi encontrada.' };

  const titulo = tituloSolicitacaoComercial(tipo, candidato);
  const { data: cardRow, error: errInsert } = await supabase
    .from('kanban_cards')
    .insert({
      kanban_id: KANBAN_IDS.JURIDICO,
      fase_id: faseId,
      franqueado_id: user.id,
      titulo,
      status: 'ativo',
      juridico_bolinha_count: 1,
      juridico_origem: JURIDICO_ORIGEM_COMERCIAL,
      juridico_tipo_contrato: tipo,
      juridico_nome_candidato: candidato,
      juridico_observacoes: observacao,
      juridico_estado: estado,
      juridico_cidade: cidade,
      origem_card_id: null,
      origem_kanban_id: null,
      origem_kanban_nome: null,
    } as never)
    .select('id')
    .single();
  if (errInsert) return { ok: false, error: errInsert.message };
  const cardId = String((cardRow as { id: string }).id);

  const { aplicarResponsaveisPadraoTodasFasesJuridico } = await import(
    '@/lib/kanban/responsavel-fase-checklist'
  );
  await aplicarResponsaveisPadraoTodasFasesJuridico(supabase, cardId, user.id);
  await aplicarTagJuridicoPortfolio(supabase, cardId, TAG_POR_TIPO[tipo], KANBAN_IDS.JURIDICO);

  revalidatePath('/funil-juridico');
  return { ok: true, cardId, repetida: false };
}
