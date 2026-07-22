import {
  FASE_SLUGS,
  KANBAN_ID_BY_NOME,
  KANBAN_IDS,
  KANBANS_COM_CHAMADO_JURIDICO,
  KANBANS_INTERNOS,
  KANBANS_VINCULO_MANUAL_LIVRE,
} from '@/lib/constants/kanban-ids';
import { KANBAN_NOME_FUNIL_LOTEADORES } from '@/lib/kanban/funil-loteadores';

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
  | 'pre_obra_obra'
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
  pre_obra_obra: {
    label: 'Pré Obra e Obra',
    kanbanDestinoId: KANBAN_IDS.OPERACOES,
    faseDestinoSlug: 'planialtimetrico',
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

const MOTOR01_DESTINOS: DestinoEsteiraManualKey[] = ['juridico', 'credito_obra'];

const KANBANS_INTERNOS_SET = new Set<string>(KANBANS_INTERNOS as readonly string[]);

/** Somente Pré Obra e Obra pode abrir vínculo manual com Funil Projeto Legal. */
export function kanbanPermiteVinculoComProjetoLegal(
  kanbanId: string | null | undefined,
): boolean {
  return String(kanbanId ?? '').trim() === KANBAN_IDS.OPERACOES;
}

/** Funil Loteadores ou Step One — sempre devem poder abrir Pré Obra e Obra. */
export function kanbanEhLoteadoresOuStepOne(kanbanOrigemId: string | null | undefined): boolean {
  const kid = String(kanbanOrigemId ?? '').trim();
  return kid === KANBAN_IDS.LOTEADORES || kid === KANBAN_IDS.STEP_ONE;
}

/** Normaliza o funil de origem (UUID do card ou nome do board no modal). */
export function resolverKanbanOrigemIdParaEsteiraManual(
  kanbanId: string | null | undefined,
  kanbanNome?: string | null,
): string {
  const nome = String(kanbanNome ?? '').trim();
  if (nome === KANBAN_NOME_FUNIL_LOTEADORES) return KANBAN_IDS.LOTEADORES;
  const fromNome = nome ? String(KANBAN_ID_BY_NOME[nome] ?? '').trim() : '';
  if (fromNome) return fromNome;

  const id = String(kanbanId ?? '').trim();
  if ((KANBANS_VINCULO_MANUAL_LIVRE as readonly string[]).includes(id)) return id;
  if ((KANBANS_COM_CHAMADO_JURIDICO as readonly string[]).includes(id)) return id;
  if (id === KANBAN_IDS.MOTOR01) return id;

  return id;
}

export function kanbanPermiteDispararEsteiraManual(
  kanbanId: string | null | undefined,
  kanbanNome?: string | null,
): boolean {
  return destinosEsteiraManualParaKanban(kanbanId, kanbanNome).length > 0;
}

/** Step One / Loteadores: garante Pré Obra e Obra e coloca no topo. */
function garantirPreObraObraParaLoteadoresStepOne(
  kanbanOrigemId: string,
  destinos: DestinoEsteiraManualKey[],
): DestinoEsteiraManualKey[] {
  if (!kanbanEhLoteadoresOuStepOne(kanbanOrigemId)) return destinos;
  const filtrados = destinos.filter((key) => key !== 'pre_obra_obra');
  return ['pre_obra_obra', ...filtrados];
}

/** Step One / Loteadores: Pré Obra e Obra no topo da lista de botões. */
export function ordenarDestinosEsteiraManualParaExibicao(
  kanbanOrigemId: string,
  destinos: DestinoEsteiraManualKey[],
): DestinoEsteiraManualKey[] {
  return garantirPreObraObraParaLoteadoresStepOne(kanbanOrigemId, destinos);
}

function filtrarDestinosEsteiraManual(
  kanbanOrigemId: string,
  destinos: DestinoEsteiraManualKey[],
): DestinoEsteiraManualKey[] {
  return destinos.filter(
    (key) => DESTINOS_ESTEIRA_MANUAL[key].kanbanDestinoId !== kanbanOrigemId,
  );
}

function aplicarRestricaoProjetoLegal(
  kanbanOrigemId: string,
  destinos: DestinoEsteiraManualKey[],
): DestinoEsteiraManualKey[] {
  if (kanbanPermiteVinculoComProjetoLegal(kanbanOrigemId)) return destinos;
  return destinos.filter((key) => key !== 'projeto_legal');
}

export function destinosEsteiraManualParaKanban(
  kanbanId: string | null | undefined,
  kanbanNome?: string | null,
): DestinoEsteiraManualKey[] {
  const id = resolverKanbanOrigemIdParaEsteiraManual(kanbanId, kanbanNome);
  if (!id) return [];
  if (KANBANS_INTERNOS_SET.has(id)) return [];

  let destinos: DestinoEsteiraManualKey[];
  if ((KANBANS_VINCULO_MANUAL_LIVRE as readonly string[]).includes(id)) {
    destinos = aplicarRestricaoProjetoLegal(
      id,
      filtrarDestinosEsteiraManual(id, DESTINOS_ESTEIRA_GENERICOS),
    );
  } else if (id === KANBAN_IDS.MOTOR01) {
    destinos = aplicarRestricaoProjetoLegal(id, filtrarDestinosEsteiraManual(id, MOTOR01_DESTINOS));
  } else if ((KANBANS_COM_CHAMADO_JURIDICO as readonly string[]).includes(id)) {
    destinos = aplicarRestricaoProjetoLegal(
      id,
      filtrarDestinosEsteiraManual(id, ['juridico', 'credito_obra']),
    );
  } else {
    destinos = aplicarRestricaoProjetoLegal(id, filtrarDestinosEsteiraManual(id, ['credito_obra']));
  }

  return garantirPreObraObraParaLoteadoresStepOne(id, destinos);
}
