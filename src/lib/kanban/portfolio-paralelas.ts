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

export type GatePortfolioStep5Opts = {
  /** Quando false, Moní Capital não entra no gate (card nunca passou por captacao_moni_capital). */
  exigirCapital?: boolean;
};

function detStr(detalhe: unknown, key: string): string {
  if (!detalhe || typeof detalhe !== 'object') return '';
  const v = (detalhe as Record<string, unknown>)[key];
  return v != null ? String(v).trim() : '';
}

type SupabaseHistoricoClient = Pick<Awaited<ReturnType<typeof createClient>>, 'from'>;

/**
 * Retorna true se o card deve cumprir `capital_ok` no gate (passou pela fase captacao_moni_capital).
 * Consulta `kanban_historico` (não bloqueia quando nunca entrou na captação).
 */
export async function deveVerificarCapital(
  supabase: SupabaseHistoricoClient,
  cardId: string,
): Promise<boolean> {
  const cid = String(cardId ?? '').trim();
  if (!cid) return false;

  const { data: faseRow, error: faseErr } = await supabase
    .from('kanban_fases')
    .select('id')
    .eq('slug', FASE_SLUGS.CAPTACAO_CAPITAL)
    .eq('kanban_id', KANBAN_IDS.PORTFOLIO)
    .maybeSingle();

  if (faseErr) return false;
  const captacaoFaseId = String((faseRow as { id?: string } | null)?.id ?? '').trim();
  if (!captacaoFaseId) return false;

  const { data: cardRow } = await supabase
    .from('kanban_cards')
    .select('fase_id')
    .eq('id', cid)
    .maybeSingle();

  const faseAtual = String((cardRow as { fase_id?: string } | null)?.fase_id ?? '').trim();
  if (faseAtual === captacaoFaseId) return true;

  const { data: hist, error: histErr } = await supabase
    .from('kanban_historico')
    .select('acao, detalhe')
    .eq('card_id', cid)
    .limit(500);

  if (histErr || !hist?.length) return false;

  for (const h of hist) {
    const acao = String(h.acao ?? '').trim();
    const det = h.detalhe;
    if (acao === 'card_criado' && detStr(det, 'fase_id') === captacaoFaseId) return true;
    if (acao === 'fase_avancada' || acao === 'fase_retrocedida') {
      if (detStr(det, 'fase_nova_id') === captacaoFaseId) return true;
      if (detStr(det, 'fase_anterior_id') === captacaoFaseId) return true;
    }
  }

  return false;
}

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

export function listarEsteirasParalelasPendentes(
  flags: PortfolioParalelasFlags,
  opts?: GatePortfolioStep5Opts,
): string[] {
  const exigirCapital = opts?.exigirCapital !== false;
  return PORTFOLIO_PARALELAS.filter((p) => {
    if (p.flag === 'capital_ok' && !exigirCapital) return false;
    return !Boolean(flags[p.flag]);
  }).map((p) => p.label);
}

export function mensagemGatePortfolioStep5(pendentes: string[]): string {
  if (pendentes.length === 0) {
    return 'Não é possível avançar para o Comitê: esteiras paralelas ainda pendentes.';
  }
  return `Não é possível avançar para o Comitê. Esteiras pendentes: ${pendentes.join(', ')}.`;
}

export function gatePortfolioStep5Liberado(
  flags: PortfolioParalelasFlags,
  opts?: GatePortfolioStep5Opts,
): boolean {
  return listarEsteirasParalelasPendentes(flags, opts).length === 0;
}

export function deveValidarGatePortfolioStep5(
  novaFaseSlug: string | null | undefined,
  kanbanId: string | null | undefined,
  kanbanNome?: string | null,
): boolean {
  return (
    String(novaFaseSlug ?? '').trim() === FASE_SLUGS.STEP_5 && isPortfolioKanbanRef(kanbanId, kanbanNome)
  );
}

/** Card pai no Funil Portfólio / Loteadores (ou filho com origem nesses funis). */
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
    if (kanbanId === KANBAN_IDS.LOTEADORES) return cid;

    const origemId = String((card as { origem_card_id?: string | null }).origem_card_id ?? '').trim();
    if (origemId) {
      const { data: origem } = await supabase
        .from('kanban_cards')
        .select('kanban_id')
        .eq('id', origemId)
        .maybeSingle();

      if (
        String((origem as { kanban_id?: string | null } | null)?.kanban_id ?? '').trim() ===
        KANBAN_IDS.LOTEADORES
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
  return id === KANBAN_IDS.PORTFOLIO || id === KANBAN_IDS.LOTEADORES || id === KANBAN_IDS.OPERACOES;
}
