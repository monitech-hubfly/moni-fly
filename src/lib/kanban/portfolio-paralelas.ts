import { FASE_SLUGS, KANBAN_IDS } from '@/lib/constants/kanban-ids';
import type { createClient } from '@/lib/supabase/server';

export const PORTFOLIO_KANBAN_NOME = 'Funil Portfólio' as const;

export type PortfolioParalelaFlag =
  | 'acoplamento_concluido'
  | 'credito_terreno_ok'
  | 'contabilidade_ok'
  | 'juridico_ok'
  | 'capital_ok';

export const PORTFOLIO_PARALELAS: {
  flag: PortfolioParalelaFlag;
  label: string;
  labelCurto: string;
}[] = [
  { flag: 'acoplamento_concluido', label: 'Acoplamento', labelCurto: 'Acoplamento' },
  { flag: 'credito_terreno_ok', label: 'Crédito Terreno', labelCurto: 'Créd. Terreno' },
  { flag: 'contabilidade_ok', label: 'Contabilidade', labelCurto: 'Contab.' },
  { flag: 'juridico_ok', label: 'Jurídico', labelCurto: 'Jurídico' },
  { flag: 'capital_ok', label: 'Divify', labelCurto: 'Divify' },
];

export type PortfolioParalelasFlags = Partial<Record<PortfolioParalelaFlag, boolean | null | undefined>>;

type SupabaseHistoricoClient = Pick<Awaited<ReturnType<typeof createClient>>, 'from'>;

export function isPortfolioKanbanRef(kanbanId: string | null | undefined, kanbanNome?: string | null): boolean {
  if (String(kanbanNome ?? '').trim() === PORTFOLIO_KANBAN_NOME) return true;
  return String(kanbanId ?? '').trim() === KANBAN_IDS.PORTFOLIO;
}

export const LOTEADORES_KANBAN_NOME = 'Funil Loteadores' as const;

export function isLoteadoresKanbanRef(kanbanId: string | null | undefined, kanbanNome?: string | null): boolean {
  if (String(kanbanNome ?? '').trim() === LOTEADORES_KANBAN_NOME) return true;
  return String(kanbanId ?? '').trim() === KANBAN_IDS.LOTEADORES;
}

export function deveValidarGateLoteadoresComite(
  novaFaseSlug: string | null | undefined,
  kanbanId: string | null | undefined,
  kanbanNome?: string | null,
): boolean {
  return (
    String(novaFaseSlug ?? '').trim() === FASE_SLUGS.LOTEADORES_COMITE &&
    isLoteadoresKanbanRef(kanbanId, kanbanNome)
  );
}

export function mensagemGateLoteadoresComite(): string {
  return 'Não é possível avançar para o Comitê. Esteira pendente: Acoplamento.';
}

/** Card pai no Funil Portfólio / Loteadores / Operações (ou filho com origem nesses funis). */
export async function resolverCardPaiParaAcoplamento(
  supabase: SupabaseHistoricoClient,
  cardId: string,
): Promise<string | null> {
  const portfolioId = await resolverCardPaiPortfolioParaAcoplamento(supabase, cardId);
  if (portfolioId) return portfolioId;

  const cid = String(cardId ?? '').trim();
  if (!cid) return null;

  const { data: card, error } = await supabase
    .from('kanban_cards')
    .select('id, kanban_id, origem_card_id')
    .eq('id', cid)
    .maybeSingle();

  if (!error && card?.id) {
    const kanbanId = String((card as { kanban_id?: string | null }).kanban_id ?? '').trim();
    // Set Up (Step One), Loteadores ou Pré Obra e Obra como pai do vínculo manual de Acoplamento
    if (
      kanbanId === KANBAN_IDS.STEP_ONE ||
      kanbanId === KANBAN_IDS.LOTEADORES ||
      kanbanId === KANBAN_IDS.OPERACOES
    ) {
      return cid;
    }

    const origemId = String((card as { origem_card_id?: string | null }).origem_card_id ?? '').trim();
    if (origemId) {
      const { data: origem } = await supabase
        .from('kanban_cards')
        .select('kanban_id')
        .eq('id', origemId)
        .maybeSingle();

      const origemKanban = String(
        (origem as { kanban_id?: string | null } | null)?.kanban_id ?? '',
      ).trim();
      if (
        origemKanban === KANBAN_IDS.STEP_ONE ||
        origemKanban === KANBAN_IDS.LOTEADORES ||
        origemKanban === KANBAN_IDS.OPERACOES
      ) {
        return origemId;
      }
    }
  }

  return null;
}

/** Card pai no Funil Portfólio (ou card de Operações com origem no Portfólio). */
export async function resolverCardPaiPortfolioParaAcoplamento(
  supabase: SupabaseHistoricoClient,
  cardId: string,
): Promise<string | null> {
  const cid = String(cardId ?? '').trim();
  if (!cid) return null;

  const { data: card, error } = await supabase
    .from('kanban_cards')
    .select('id, kanban_id, origem_card_id')
    .eq('id', cid)
    .maybeSingle();

  if (!error && card?.id) {
    const kanbanId = String((card as { kanban_id?: string | null }).kanban_id ?? '').trim();
    if (kanbanId === KANBAN_IDS.PORTFOLIO) return cid;

    const origemId = String((card as { origem_card_id?: string | null }).origem_card_id ?? '').trim();
    if (origemId) {
      const { data: origem } = await supabase
        .from('kanban_cards')
        .select('kanban_id')
        .eq('id', origemId)
        .maybeSingle();

      if (
        String((origem as { kanban_id?: string | null } | null)?.kanban_id ?? '').trim() ===
        KANBAN_IDS.PORTFOLIO
      ) {
        return origemId;
      }
    }
  }

  const { data: vLeg, error: vErr } = await supabase
    .from('v_processo_como_kanban_cards')
    .select('id, kanban_id')
    .eq('id', cid)
    .maybeSingle();

  if (vErr || !vLeg?.id) return null;

  const kanbanLegadoId = String((vLeg as { kanban_id?: string | null }).kanban_id ?? '').trim();
  if (kanbanLegadoId === KANBAN_IDS.PORTFOLIO) return cid;

  return null;
}

/** Bastão automático: fase Acoplamento no Funil Portfólio ou Funil Loteadores. */
export function deveDispararBastaoAcoplamentoAutomatico(
  novaFaseSlug: string,
  kanbanPaiId: string | null | undefined,
): boolean {
  const slug = String(novaFaseSlug ?? '').trim();
  const kid = String(kanbanPaiId ?? '').trim();
  if (slug === FASE_SLUGS.ACOPLAMENTO && kid === KANBAN_IDS.PORTFOLIO) return true;
  if (slug === FASE_SLUGS.LOTEADORES_ACOPLAMENTO && kid === KANBAN_IDS.LOTEADORES) return true;
  return false;
}

export function kanbanPermiteAbrirFunilAcoplamentoManual(kanbanId: string | null | undefined): boolean {
  const id = String(kanbanId ?? '').trim();
  return (
    id === KANBAN_IDS.STEP_ONE ||
    id === KANBAN_IDS.PORTFOLIO ||
    id === KANBAN_IDS.LOTEADORES ||
    id === KANBAN_IDS.OPERACOES
  );
}
