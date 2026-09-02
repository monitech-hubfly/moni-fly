import { FASE_SLUGS } from '@/lib/constants/kanban-ids';

/** Slugs terminais explícitos (evita falso positivo em *_projeto_aprovado). */
const SLUGS_APROVADO_TERMINAL = new Set<string>([
  FASE_SLUGS.ACOPLAMENTO_APROVADO,
  FASE_SLUGS.CO_SHAREPOINT_3A,
  /** @deprecated legado — migration 494 */
  FASE_SLUGS.CREDITO_OBRA_APROVADO,
  FASE_SLUGS.HOM_APROVADO,
]);

const SLUGS_FASE_CONCLUSAO_EXPLICITOS = new Set<string>([
  FASE_SLUGS.PASSAGEM_WAYSER,
  FASE_SLUGS.LOTEADORES_ASSINADOS,
  FASE_SLUGS.OPERACOES_ENTREGUE,
  FASE_SLUGS.PL_PAGAMENTOS,
  FASE_SLUGS.PL_C_PROJETO_APROVADO,
  FASE_SLUGS.PL_P_PROJETO_APROVADO,
  FASE_SLUGS.HOMOLOG_CRIAR_PRODUTO_DATABASE,
  FASE_SLUGS.FUNDING_CONTRATO,
  FASE_SLUGS.MKT_GRAV_DECUPAGEM,
  FASE_SLUGS.MKT_PROG_AGENDAMENTO,
  FASE_SLUGS.MKT_INC_D4_FINAL,
  FASE_SLUGS.CARE_ARQUIVADO,
  FASE_SLUGS.CAPITAL_NAO_ELEGIVEL,
  ...SLUGS_APROVADO_TERMINAL,
]);

/** Fases finais / paralisadas / concluídas — cards com transparência no board. */
export function isFaseConclusaoKanban(fase: {
  slug?: string | null;
  nome?: string | null;
}): boolean {
  const slug = String(fase.slug ?? '').trim().toLowerCase();
  if (slug) {
    if (SLUGS_FASE_CONCLUSAO_EXPLICITOS.has(slug)) return true;
    if (/_concluido$/.test(slug)) return true;
    if (/_reprovado$/.test(slug)) return true;
    if (/_nao_elegivel$/.test(slug)) return true;
    if (slug.includes('paralisad')) return true;
  }

  const nome = String(fase.nome ?? '').trim().toLowerCase();
  if (!nome) return false;
  if (/^paralisados?$/.test(nome)) return true;
  if (nome === 'aprovado') return true;
  if (nome === 'assinados') return true;
  if (nome.includes('conclu')) return true;
  if (/\breprovado\b/.test(nome)) return true;

  return false;
}
