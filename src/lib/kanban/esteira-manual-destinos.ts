import {
  FASE_SLUGS,
  KANBAN_IDS,
  KANBANS_COM_CHAMADO_JURIDICO,
  KANBANS_INTERNOS,
  KANBANS_VINCULO_MANUAL_LIVRE,
} from '@/lib/constants/kanban-ids';

export type DestinoEsteiraManualKey =
  | 'acoplamento'
  | 'contabilidade'
  | 'contratacoes'
  | 'credito_obra'
  | 'funding'
  | 'hdm_homologacoes'
  | 'hdm_modelo_virtual'
  | 'hdm_produto'
  | 'juridico'
  | 'moni_capital'
  | 'motor01'
  | 'projeto_legal'
  | 'projetos_legais'
  | 'projetos_locais';

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
    faseDestinoSlug: FASE_SLUGS.CONTABILIDADE_INCORPORADORA,
  },
  contratacoes: {
    label: 'Contratações',
    kanbanDestinoId: KANBAN_IDS.CONTRATACOES,
    faseDestinoSlug: 'rh_vaga',
  },
  credito_obra: {
    label: 'Cash Me',
    kanbanDestinoId: KANBAN_IDS.CREDITO_OBRA,
    faseDestinoSlug: FASE_SLUGS.CO_NOVO_PROJETO,
  },
  funding: {
    label: 'Funding',
    kanbanDestinoId: KANBAN_IDS.FUNDING,
    faseDestinoSlug: FASE_SLUGS.FUNDING_LEADS,
  },
  hdm_homologacoes: {
    label: 'Homologações',
    kanbanDestinoId: KANBAN_IDS.HDM_HOMOLOGACOES,
    faseDestinoSlug: FASE_SLUGS.HOMOLOG_NOVAS_HOMOLOGACOES,
  },
  hdm_modelo_virtual: {
    label: 'Modelo Virtual',
    kanbanDestinoId: KANBAN_IDS.HDM_MODELO_VIRTUAL,
    faseDestinoSlug: 'mv_recebimento',
  },
  hdm_produto: {
    label: 'Produto HDM',
    kanbanDestinoId: KANBAN_IDS.HDM_PRODUTO,
    faseDestinoSlug: 'prod_brief',
  },
  juridico: {
    label: 'Jurídico',
    kanbanDestinoId: KANBAN_IDS.JURIDICO,
    faseDestinoSlug: 'juridico_recebimento',
  },
  moni_capital: {
    label: 'Divify',
    kanbanDestinoId: KANBAN_IDS.MONI_CAPITAL,
    faseDestinoSlug: 'capital_recebimento',
  },
  motor01: {
    label: 'Motor 01',
    kanbanDestinoId: KANBAN_IDS.MOTOR01,
    faseDestinoSlug: 'm1_r01',
  },
  projeto_legal: {
    label: 'Projeto Legal',
    kanbanDestinoId: KANBAN_IDS.PROJETO_LEGAL,
    faseDestinoSlug: FASE_SLUGS.PL_NOVA_DEMANDA,
  },
  projetos_legais: {
    label: 'Projetos Legais',
    kanbanDestinoId: KANBAN_IDS.PROJETOS_LEGAIS,
    faseDestinoSlug: 'projetos_legais_protocolo',
  },
  projetos_locais: {
    label: 'Projetos Locais',
    kanbanDestinoId: KANBAN_IDS.PROJETOS_LOCAIS,
    faseDestinoSlug: 'pl_000_novo_projeto',
  },
};

/** Acoplamento usa botão dedicado no painel de vínculos — não entra na lista genérica. */
const DESTINOS_ESTEIRA_GENERICOS: DestinoEsteiraManualKey[] = (
  Object.keys(DESTINOS_ESTEIRA_MANUAL) as DestinoEsteiraManualKey[]
).filter((key) => key !== 'acoplamento');

const MOTOR01_DESTINOS: DestinoEsteiraManualKey[] = [
  'juridico',
  'projeto_legal',
  'credito_obra',
];

const KANBANS_INTERNOS_SET = new Set<string>(KANBANS_INTERNOS as readonly string[]);

export function kanbanPermiteDispararEsteiraManual(kanbanId: string | null | undefined): boolean {
  return destinosEsteiraManualParaKanban(kanbanId).length > 0;
}

export function destinosEsteiraManualParaKanban(
  kanbanId: string | null | undefined,
): DestinoEsteiraManualKey[] {
  const id = String(kanbanId ?? '').trim();
  if (!id) return [];
  if (KANBANS_INTERNOS_SET.has(id)) return [];
  if ((KANBANS_VINCULO_MANUAL_LIVRE as readonly string[]).includes(id)) {
    return DESTINOS_ESTEIRA_GENERICOS;
  }
  if (id === KANBAN_IDS.MOTOR01) return MOTOR01_DESTINOS;
  if ((KANBANS_COM_CHAMADO_JURIDICO as readonly string[]).includes(id)) {
    return ['juridico', 'projeto_legal', 'credito_obra'];
  }
  return ['projeto_legal', 'credito_obra'];
}
