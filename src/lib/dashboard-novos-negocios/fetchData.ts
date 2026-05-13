import type { SupabaseClient } from '@supabase/supabase-js';

export type ProcessoDashRow = {
  id: string;
  user_id: string;
  cidade: string | null;
  estado: string | null;
  nome_franqueado: string | null;
  numero_franquia: string | null;
  nome_condominio: string | null;
  etapa_painel: string | null;
  status: string | null;
  cancelado_em: string | null;
  removido_em: string | null;
  vgv_pretendido: string | null;
  valor_terreno: string | null;
  created_at: string | null;
  historico_base_id: string | null;
  tipo_aquisicao_terreno: string | null;
  previsao_aprovacao_condominio: string | null;
  previsao_aprovacao_prefeitura: string | null;
  previsao_emissao_alvara: string | null;
  previsao_liberacao_credito_obra: string | null;
  previsao_inicio_obra: string | null;
  data_aprovacao_condominio: string | null;
  data_aprovacao_prefeitura: string | null;
  data_emissao_alvara: string | null;
  data_aprovacao_credito: string | null;
  fase_contabilidade: string | null;
  fase_credito: string | null;
  motivo_cancelamento: string | null;
  motivo_reprovacao_comite: string | null;
};

export type ComiteDashRow = { processo_id: string; comite_resultado: string | null; updated_at: string | null };
export type EventoDashRow = {
  processo_id: string;
  tipo: string;
  created_at: string;
  detalhes: Record<string, unknown> | null;
};
export type ChecklistDashRow = {
  processo_id: string;
  titulo: string | null;
  concluido: boolean | null;
  etapa_painel: string | null;
};
export type DocDashRow = { processo_id: string; titulo: string | null; storage_path: string | null; link_url: string | null };
export type RedeDashRow = {
  id: string;
  estado_casa_frank: string | null;
  area_atuacao: string | null;
  nome_completo: string | null;
  n_franquia: string | null;
};

export type ChecklistLegalRow = { processo_id: string; completo: boolean | null };
export type ChecklistCreditoRow = {
  processo_id: string | null;
  upload_matricula: string | null;
  upload_projeto_aprovado: string | null;
};

const PROCESSO_SELECT = [
  'id',
  'user_id',
  'cidade',
  'estado',
  'nome_franqueado',
  'numero_franquia',
  'nome_condominio',
  'etapa_painel',
  'status',
  'cancelado_em',
  'removido_em',
  'vgv_pretendido',
  'valor_terreno',
  'created_at',
  'historico_base_id',
  'tipo_aquisicao_terreno',
  'previsao_aprovacao_condominio',
  'previsao_aprovacao_prefeitura',
  'previsao_emissao_alvara',
  'previsao_liberacao_credito_obra',
  'previsao_inicio_obra',
  'data_aprovacao_condominio',
  'data_aprovacao_prefeitura',
  'data_emissao_alvara',
  'data_aprovacao_credito',
  'fase_contabilidade',
  'fase_credito',
  'motivo_cancelamento',
  'motivo_reprovacao_comite',
].join(',');

export async function fetchDashboardRawData(supabase: SupabaseClient): Promise<{
  processos: ProcessoDashRow[];
  comites: ComiteDashRow[];
  eventos: EventoDashRow[];
  checklists: ChecklistDashRow[];
  documentos: DocDashRow[];
  rede: RedeDashRow[];
  checklistLegal: ChecklistLegalRow[];
  checklistCredito: ChecklistCreditoRow[];
}> {
  const eventSince = new Date();
  eventSince.setMonth(eventSince.getMonth() - 24);

  const procPromise = supabase.from('processo_step_one').select(PROCESSO_SELECT).limit(20000);

  const checklistPromise = supabase
    .from('processo_card_checklist')
    .select('processo_id, titulo, concluido, etapa_painel')
    .limit(50000);

  const docsPromise = supabase
    .from('processo_card_documentos')
    .select('processo_id, titulo, storage_path, link_url')
    .limit(50000);

  const redePromise = supabase
    .from('rede_franqueados')
    .select('id, estado_casa_frank, area_atuacao, nome_completo, n_franquia')
    .limit(20000);

  const [procRes, checklistRes, docsRes, redeRes] = await Promise.all([
    procPromise,
    checklistPromise,
    docsPromise,
    redePromise,
  ]);

  if (procRes.error) throw new Error(procRes.error.message);
  const processos = (procRes.data ?? []) as unknown as ProcessoDashRow[];

  const baseIds = [...new Set(processos.map((p) => String(p.historico_base_id ?? p.id)))];
  const procIds = processos.map((p) => p.id);

  const comitePromise =
    baseIds.length > 0
      ? supabase.from('processo_card_comite').select('processo_id, comite_resultado, updated_at').in('processo_id', baseIds)
      : Promise.resolve({ data: [] as ComiteDashRow[], error: null });

  const eventosPromise =
    procIds.length > 0
      ? supabase
          .from('processo_card_eventos')
          .select('processo_id, tipo, created_at, detalhes')
          .eq('tipo', 'card_move')
          .gte('created_at', eventSince.toISOString())
          .in('processo_id', procIds)
          .limit(30000)
      : Promise.resolve({ data: [] as EventoDashRow[], error: null });

  const legalPromise = supabase.from('processo_card_checklist_legal').select('processo_id, completo').limit(20000);
  const creditoCkPromise = supabase
    .from('checklist_credito')
    .select('processo_id, upload_matricula, upload_projeto_aprovado')
    .limit(20000);

  const [comiteRes, eventosRes, legalRes, creditoCkRes] = await Promise.all([
    comitePromise,
    eventosPromise,
    legalPromise,
    creditoCkPromise,
  ]);

  if (checklistRes.error) throw new Error(checklistRes.error.message);
  if (docsRes.error) throw new Error(docsRes.error.message);
  if (redeRes.error) throw new Error(redeRes.error.message);
  if (comiteRes.error) throw new Error(comiteRes.error.message);
  if (eventosRes.error) throw new Error(eventosRes.error.message);
  if (legalRes.error) throw new Error(legalRes.error.message);
  if (creditoCkRes.error) throw new Error(creditoCkRes.error.message);

  return {
    processos,
    comites: (comiteRes.data ?? []) as ComiteDashRow[],
    eventos: (eventosRes.data ?? []) as EventoDashRow[],
    checklists: (checklistRes.data ?? []) as ChecklistDashRow[],
    documentos: (docsRes.data ?? []) as DocDashRow[],
    rede: (redeRes.data ?? []) as RedeDashRow[],
    checklistLegal: (legalRes.data ?? []) as ChecklistLegalRow[],
    checklistCredito: (creditoCkRes.data ?? []) as ChecklistCreditoRow[],
  };
}
