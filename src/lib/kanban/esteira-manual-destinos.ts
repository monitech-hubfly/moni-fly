import {
  FASE_SLUGS,
  KANBAN_IDS,
  KANBANS_COM_CHAMADO_JURIDICO,
  KANBANS_INTERNOS,
} from '@/lib/constants/kanban-ids';

export type DestinoEsteiraManualKey =
  | 'acoplamento'
  | 'contabilidade'
  | 'credito_obra'
  | 'juridico'
  | 'moni_capital'
  | 'projeto_legal';

export const DESTINOS_ESTEIRA_MANUAL: Record<
  DestinoEsteiraManualKey,
  { label: string; kanbanDestinoId: string; faseDestinoSlug: string }
> = {
  acoplamento: {
    label: 'Acoplamento',
    kanbanDestinoId: KANBAN_IDS.ACOPLAMENTO,
    faseDestinoSlug: 'modelagem_terreno',
  },
  contabilidade: {
    label: 'Contabilidade',
    kanbanDestinoId: KANBAN_IDS.CONTABILIDADE,
    faseDestinoSlug: 'contabilidade_incorporadora',
  },
  credito_obra: {
    label: 'Crédito Obra',
    kanbanDestinoId: KANBAN_IDS.CREDITO_OBRA,
    faseDestinoSlug: FASE_SLUGS.CO_NOVO_PROJETO,
  },
  juridico: {
    label: 'Jurídico',
    kanbanDestinoId: KANBAN_IDS.JURIDICO,
    faseDestinoSlug: 'juridico_recebimento',
  },
  moni_capital: {
    label: 'Moní Capital',
    kanbanDestinoId: KANBAN_IDS.MONI_CAPITAL,
    faseDestinoSlug: 'capital_recebimento',
  },
  projeto_legal: {
    label: 'Projeto Legal',
    kanbanDestinoId: KANBAN_IDS.PROJETO_LEGAL,
    faseDestinoSlug: FASE_SLUGS.PL_NOVA_DEMANDA,
  },
};

/** Acoplamento não entra na esteira genérica — use `abrirFunilAcoplamentoManualDoCard` no painel de vínculos. */
const PORTFOLIO_DESTINOS: DestinoEsteiraManualKey[] = [
  'contabilidade',
  'credito_obra',
  'juridico',
  'moni_capital',
  'projeto_legal',
];

const KANBANS_INTERNOS_SET = new Set<string>(KANBANS_INTERNOS as readonly string[]);

/** Funis com destinos de esteira manual do Portfólio (sem Acoplamento — ver painel de vínculos). */
const KANBANS_ESTEIRA_MANUAL_COMPLETA: readonly string[] = [
  KANBAN_IDS.PORTFOLIO,
  KANBAN_IDS.OPERACOES,
];

export function kanbanPermiteDispararEsteiraManual(kanbanId: string | null | undefined): boolean {
  return destinosEsteiraManualParaKanban(kanbanId).length > 0;
}

export function destinosEsteiraManualParaKanban(
  kanbanId: string | null | undefined,
): DestinoEsteiraManualKey[] {
  const id = String(kanbanId ?? '').trim();
  if (!id || KANBANS_INTERNOS_SET.has(id)) return [];
  if ((KANBANS_ESTEIRA_MANUAL_COMPLETA as readonly string[]).includes(id)) return PORTFOLIO_DESTINOS;
  if ((KANBANS_COM_CHAMADO_JURIDICO as readonly string[]).includes(id)) {
    return ['juridico', 'projeto_legal', 'credito_obra'];
  }
  return ['projeto_legal', 'credito_obra'];
}
