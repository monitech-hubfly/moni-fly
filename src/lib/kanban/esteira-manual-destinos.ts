import {
  KANBAN_IDS,
  KANBANS_COM_CHAMADO_JURIDICO,
} from '@/lib/constants/kanban-ids';

export type DestinoEsteiraManualKey =
  | 'acoplamento'
  | 'credito_terreno'
  | 'contabilidade'
  | 'juridico'
  | 'moni_capital';

export const DESTINOS_ESTEIRA_MANUAL: Record<
  DestinoEsteiraManualKey,
  { label: string; kanbanDestinoId: string; faseDestinoSlug: string }
> = {
  acoplamento: {
    label: 'Acoplamento',
    kanbanDestinoId: KANBAN_IDS.ACOPLAMENTO,
    faseDestinoSlug: 'modelagem_terreno',
  },
  credito_terreno: {
    label: 'Crédito Terreno',
    kanbanDestinoId: KANBAN_IDS.CREDITO_OBRA,
    faseDestinoSlug: 'credito_terreno',
  },
  contabilidade: {
    label: 'Contabilidade',
    kanbanDestinoId: KANBAN_IDS.CONTABILIDADE,
    faseDestinoSlug: 'contabilidade_incorporadora',
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
};

/** Acoplamento não entra na esteira genérica — use `abrirFunilAcoplamentoManualDoCard` no painel de vínculos. */
const PORTFOLIO_DESTINOS: DestinoEsteiraManualKey[] = [
  'credito_terreno',
  'contabilidade',
  'juridico',
  'moni_capital',
];

/** Funis com destinos de esteira manual do Portfólio (sem Acoplamento — ver painel de vínculos). */
const KANBANS_ESTEIRA_MANUAL_COMPLETA: readonly string[] = [
  KANBAN_IDS.PORTFOLIO,
  KANBAN_IDS.OPERACOES,
];

export function kanbanPermiteDispararEsteiraManual(kanbanId: string | null | undefined): boolean {
  const id = String(kanbanId ?? '').trim();
  if (!id) return false;
  if ((KANBANS_ESTEIRA_MANUAL_COMPLETA as readonly string[]).includes(id)) return true;
  return (KANBANS_COM_CHAMADO_JURIDICO as readonly string[]).includes(id);
}

export function destinosEsteiraManualParaKanban(
  kanbanId: string | null | undefined,
): DestinoEsteiraManualKey[] {
  const id = String(kanbanId ?? '').trim();
  if ((KANBANS_ESTEIRA_MANUAL_COMPLETA as readonly string[]).includes(id)) return PORTFOLIO_DESTINOS;
  if ((KANBANS_COM_CHAMADO_JURIDICO as readonly string[]).includes(id)) return ['juridico'];
  return [];
}
