import type { SupabaseClient } from '@supabase/supabase-js';

/** Colunas do card liberadas para o portal. Não inclui arquivamento, vínculos nem esteira. */
export const PORTAL_FRANK_CARD_SELECT = [
  'id',
  'titulo',
  'created_at',
  'entered_fase_at',
  'sla_iniciado_em',
  'sla_pausado_em',
  'condominio_aprovada_em',
  'alvara_emitido_em',
  'prefeitura_aprovada_em',
  'obra_iniciada_em',
  'obra_finalizada_em',
  'prev_aprovacao_prefeitura',
  'prev_inicio_obra',
  'nome_condominio',
  'quadra',
  'lote',
  'condominio_id',
  'fase_id',
  'kanban_id',
  'processo_step_one_id',
  'rede_franqueado_id',
].join(', ');

export const PORTAL_FRANK_CARD_EMBED = `
  kanbans ( nome ),
  kanban_fases!fase_id ( nome, slug, sla_dias, sla_tipo, instrucoes, materiais )
`;

export const PORTAL_FRANK_CONDOMINIO_SELECT = [
  'id',
  'nome',
  'endereco',
  'numero',
  'cep',
  'cidade',
  'estado',
  'descricao_breve',
  'ticket_medio_lote',
  'ticket_medio_casas',
  'ticket_medio_casas_rsm2',
  'estimativa_casas_vendidas_ano',
  'extrato_como_eram_casas',
  'extrato_tempo_venda',
  'prazo_aprovacao_condominio_dias',
  'prazo_aprovacao_condominio_sla_tipo',
  'prazo_aprovacao_prefeitura_dias',
  'prazo_aprovacao_prefeitura_sla_tipo',
].join(', ');

/** Negócio + calculadora + pré-obra em processo_step_one. link_gbox é só leitura. */
export const PORTAL_FRANK_NEGOCIO_SELECT = [
  'id',
  'tipo_aquisicao_terreno',
  'valor_terreno',
  'vgv_pretendido',
  'produto_modelo_casa',
  'link_bca',
  'link_gbox',
  'link_mapa_competidores',
  'link_acoplamento',
  'link_apresentacao_comite',
  'link_opcao_permuta',
  'anexo_opcao_permuta_path',
  'link_contrato_permuta',
  'anexo_contrato_permuta_path',
  'link_seguro_garantia',
  'anexo_seguro_garantia_path',
  'link_moni_capital_seguro_garantia',
  'comentario_moni_capital_seguro_garantia',
  'link_moni_capital_gastos_aporte_inicial',
  'comentario_moni_capital_gastos_aporte_inicial',
  'negociacao_linhas',
  'prazo_opcao_dias',
  'prazo_opcao_sla_tipo',
  'prazo_opcao_modo',
  'prazo_opcao_fase_id',
  'prazo_opcao_data',
  'prazo_instrumento_garantidor_dias',
  'prazo_instrumento_garantidor_sla_tipo',
  'prazo_instrumento_garantidor_modo',
  'prazo_instrumento_garantidor_fase_id',
  'prazo_instrumento_garantidor_data',
  'calculadora_ancora_fase_slug',
  'calculadora_ancora_data_fim',
  'previsao_aprovacao_condominio',
  'previsao_aprovacao_prefeitura',
  'previsao_emissao_alvara',
  'previsao_liberacao_credito_obra',
  'previsao_inicio_obra',
  'data_aprovacao_condominio',
  'data_aprovacao_prefeitura',
  'data_emissao_alvara',
  'data_aprovacao_credito',
].join(', ');

export const PORTAL_FRANK_EMPRESA_SELECT = [
  'id',
  'rede_franqueado_id',
  'tipo',
  'razao_social',
  'cnpj',
  'inscricao_municipal',
  'inscricao_estadual',
  'status',
  'conta_banco',
  'conta_agencia',
  'conta_numero',
  'conta_pix_tipo',
  'conta_pix_chave',
].join(', ');

export const PORTAL_FRANK_SPE_SELECT = [
  'id',
  'rede_franqueado_id',
  'kanban_card_id',
  'razao_social',
  'cnpj',
  'inscricao_municipal',
  'inscricao_estadual',
  'status',
  'conta_banco',
  'conta_agencia',
  'conta_numero',
  'conta_pix_tipo',
  'conta_pix_chave',
].join(', ');

/** Contato gravável direto em rede_franqueados. Sem aprovação. */
export const PORTAL_FRANK_REDE_CONTATO_SELECT = [
  'id',
  'email_frank',
  'telefone_frank',
  'cpf_frank',
  'data_nasc_frank',
  'tamanho_camisa_frank',
  'endereco_casa_frank',
  'endereco_casa_frank_numero',
  'endereco_casa_frank_complemento',
  'cep_casa_frank',
  'socios',
].join(', ');

export const PORTAL_FRANK_CHECKLIST_ITEM_SELECT = 'id, fase_id, ordem, label, tipo, obrigatorio';
export const PORTAL_FRANK_CHECKLIST_RESPOSTA_SELECT = 'id, item_id, card_id, valor, arquivo_path';

export const PORTAL_FRANK_IMOB_EMPREENDIMENTO_SELECT = 'id, nome, specs, card_id, condominio_id';

export const PORTAL_FRANK_IMOB_MODELO_SELECT =
  'card_id, status_imovel, imagem_principal_path, imagem_principal_nome';

export const PORTAL_FRANK_IMOB_SIMULACAO_SELECT = [
  'id',
  'card_id',
  'ordem',
  'tipo',
  'nome',
  'produto_modelo',
  'titulo_oferta',
  'ano_lancamento',
  'quartos',
  'banheiros',
  'vagas',
  'area_vendas_m2',
  'link_modelo',
  'descricao',
  'link_imagens_planta',
  'imagem_oferta_path',
  'imagem_oferta_nome',
  'valor_avista',
  'entrada',
  'parcelas_mensais',
  'parcela_unica',
  'prazo_total_meses',
  'simulacao_pagamento_id',
  'balao_parcial_8',
  'balao_parcial_18',
  'balao_parcial_24',
  'balao_quitado_8',
  'balao_quitado_18',
  'balao_quitado_24',
  'balao_lote_8',
  'balao_lote_18',
  'balao_lote_24',
  'fin_parcial_valor',
  'fin_parcial_p1',
  'fin_parcial_ultima',
  'fin_parcial_total',
  'fin_quitado_valor',
  'fin_quitado_p1',
  'fin_quitado_ultima',
  'fin_quitado_total',
  'fin_lote_valor',
  'fin_lote_p1',
  'fin_lote_ultima',
  'fin_lote_total',
].join(', ');

export type PortalFrankCardLeitura = {
  card: Record<string, unknown>;
  condominio: Record<string, unknown> | null;
  negocio: Record<string, unknown> | null;
  empresas: Record<string, unknown>[];
  spes: Record<string, unknown>[];
  redeContato: Record<string, unknown> | null;
  checklistItens: Record<string, unknown>[];
  checklistRespostas: Record<string, unknown>[];
  imobEmpreendimentos: Record<string, unknown>[];
  imobModelo: Record<string, unknown> | null;
  imobSimulacoes: Record<string, unknown>[];
};

function asRow(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  return data as Record<string, unknown>;
}

function asRows(data: unknown): Record<string, unknown>[] {
  if (!Array.isArray(data)) return [];
  return data.filter((row) => row && typeof row === 'object') as Record<string, unknown>[];
}

/**
 * Leitura do card para o portal do franqueado.
 * A policy de kanban_cards já restringe a linha; este select restringe as colunas.
 */
export async function fetchPortalFrankCardLeitura(
  supabase: SupabaseClient,
  cardId: string,
): Promise<{ ok: true; leitura: PortalFrankCardLeitura } | { ok: false; error: string }> {
  const id = String(cardId ?? '').trim();
  if (!id) return { ok: false, error: 'Card inválido.' };

  const { data: cardData, error: cardError } = await supabase
    .from('kanban_cards')
    .select(`${PORTAL_FRANK_CARD_SELECT}, ${PORTAL_FRANK_CARD_EMBED}`)
    .eq('id', id)
    .maybeSingle();

  if (cardError) return { ok: false, error: cardError.message };
  const card = asRow(cardData);
  if (!card) return { ok: false, error: 'Card não encontrado.' };

  const condominioId = card.condominio_id != null ? String(card.condominio_id) : '';
  const processoId = card.processo_step_one_id != null ? String(card.processo_step_one_id) : '';
  const redeId = card.rede_franqueado_id != null ? String(card.rede_franqueado_id) : '';
  const faseId = card.fase_id != null ? String(card.fase_id) : '';

  const [condominioRes, negocioRes, empresasRes, speRes, redeRes, itensRes, respostasRes, imobEmpRes, imobModeloRes, imobSimRes] =
    await Promise.all([
      condominioId
        ? supabase.from('condominios').select(PORTAL_FRANK_CONDOMINIO_SELECT).eq('id', condominioId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      processoId
        ? supabase.from('processo_step_one').select(PORTAL_FRANK_NEGOCIO_SELECT).eq('id', processoId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      redeId
        ? supabase.from('franqueado_empresas').select(PORTAL_FRANK_EMPRESA_SELECT).eq('rede_franqueado_id', redeId)
        : Promise.resolve({ data: [], error: null }),
      supabase.from('franqueado_spe').select(PORTAL_FRANK_SPE_SELECT).eq('kanban_card_id', id),
      redeId
        ? supabase.from('rede_franqueados').select(PORTAL_FRANK_REDE_CONTATO_SELECT).eq('id', redeId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      faseId
        ? supabase
            .from('kanban_fase_checklist_itens')
            .select(PORTAL_FRANK_CHECKLIST_ITEM_SELECT)
            .eq('fase_id', faseId)
            .order('ordem', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('kanban_fase_checklist_respostas')
        .select(PORTAL_FRANK_CHECKLIST_RESPOSTA_SELECT)
        .eq('card_id', id),
      supabase.from('imob_empreendimentos').select(PORTAL_FRANK_IMOB_EMPREENDIMENTO_SELECT).eq('card_id', id),
      supabase.from('imob_card_modelo').select(PORTAL_FRANK_IMOB_MODELO_SELECT).eq('card_id', id).maybeSingle(),
      supabase
        .from('imob_card_empreendimentos')
        .select(PORTAL_FRANK_IMOB_SIMULACAO_SELECT)
        .eq('card_id', id)
        .order('ordem', { ascending: true }),
    ]);

  const firstError =
    condominioRes.error ||
    negocioRes.error ||
    empresasRes.error ||
    speRes.error ||
    redeRes.error ||
    itensRes.error ||
    respostasRes.error ||
    imobEmpRes.error ||
    imobModeloRes.error ||
    imobSimRes.error;
  if (firstError) return { ok: false, error: firstError.message };

  return {
    ok: true,
    leitura: {
      card,
      condominio: asRow(condominioRes.data),
      negocio: asRow(negocioRes.data),
      empresas: asRows(empresasRes.data),
      spes: asRows(speRes.data),
      redeContato: asRow(redeRes.data),
      checklistItens: asRows(itensRes.data),
      checklistRespostas: asRows(respostasRes.data),
      imobEmpreendimentos: asRows(imobEmpRes.data),
      imobModelo: asRow(imobModeloRes.data),
      imobSimulacoes: asRows(imobSimRes.data),
    },
  };
}
