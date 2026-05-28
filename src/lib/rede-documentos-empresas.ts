/** Documentos das empresas (seção 2) — Incorporadora e Gestora. */

import { isRedeDocSlotCompleto } from '@/lib/rede-documentos-franquia';

export type RedeEmpresaSubsecaoId = 'incorporadora' | 'gestora';

export type RedeEmpresaDocPathKey =
  | 'anexo_emp_incorp_contrato_social_path'
  | 'anexo_emp_incorp_cnpj_path'
  | 'anexo_emp_incorp_inscricao_municipal_path'
  | 'anexo_emp_incorp_certidao_junta_path'
  | 'anexo_emp_incorp_conta_bancaria_path'
  | 'anexo_emp_incorp_inscricao_estadual_path'
  | 'anexo_emp_gest_contrato_social_path'
  | 'anexo_emp_gest_cnpj_path'
  | 'anexo_emp_gest_inscricao_municipal_path'
  | 'anexo_emp_gest_certidao_junta_path'
  | 'anexo_emp_gest_conta_bancaria_path'
  | 'anexo_emp_gest_inscricao_estadual_path';

export type RedeEmpresaDocJustificativaKey =
  | 'anexo_emp_incorp_contrato_social_justificativa'
  | 'anexo_emp_incorp_cnpj_justificativa'
  | 'anexo_emp_incorp_inscricao_municipal_justificativa'
  | 'anexo_emp_incorp_certidao_junta_justificativa'
  | 'anexo_emp_incorp_conta_bancaria_justificativa'
  | 'anexo_emp_gest_contrato_social_justificativa'
  | 'anexo_emp_gest_cnpj_justificativa'
  | 'anexo_emp_gest_inscricao_municipal_justificativa'
  | 'anexo_emp_gest_certidao_junta_justificativa'
  | 'anexo_emp_gest_conta_bancaria_justificativa';

export type RedeEmpresaAnexoDocTipo =
  | 'emp_incorp_contrato_social'
  | 'emp_incorp_cnpj'
  | 'emp_incorp_inscricao_municipal'
  | 'emp_incorp_certidao_junta'
  | 'emp_incorp_conta_bancaria'
  | 'emp_incorp_inscricao_estadual'
  | 'emp_gest_contrato_social'
  | 'emp_gest_cnpj'
  | 'emp_gest_inscricao_municipal'
  | 'emp_gest_certidao_junta'
  | 'emp_gest_conta_bancaria'
  | 'emp_gest_inscricao_estadual';

export type RedeDocEmpresaSlot = {
  tipo: RedeEmpresaAnexoDocTipo;
  subsecao: RedeEmpresaSubsecaoId;
  titulo: string;
  pathKey: RedeEmpresaDocPathKey;
  justificativaKey: RedeEmpresaDocJustificativaKey | null;
  obrigatorioParaCadastroCompleto: boolean;
};

export const REDE_EMPRESAS_SUBSECOES: readonly { id: RedeEmpresaSubsecaoId; titulo: string }[] = [
  { id: 'incorporadora', titulo: 'Incorporadora' },
  { id: 'gestora', titulo: 'Gestora' },
] as const;

const DOC_DEFS = [
  {
    docId: 'contrato_social',
    titulo: 'Contrato Social ou Estatuto registrado na Junta Comercial do estado',
    obrigatorio: true,
  },
  {
    docId: 'cnpj',
    titulo: 'CNPJ ativo emitido pela Receita Federal (cartão CNPJ ou consulta no site)',
    obrigatorio: true,
  },
  {
    docId: 'inscricao_municipal',
    titulo: 'Inscrição Municipal (alvará ou CCM dependendo do município)',
    obrigatorio: true,
  },
  {
    docId: 'certidao_junta',
    titulo: 'Certidão de Regularidade da Junta Comercial',
    obrigatorio: true,
  },
  {
    docId: 'conta_bancaria',
    titulo: 'Comprovante de abertura de conta bancária PJ em nome da empresa',
    obrigatorio: true,
  },
  {
    docId: 'inscricao_estadual',
    titulo: 'Inscrição Estadual (se aplicável à atividade)',
    obrigatorio: false,
  },
] as const;

function buildSlots(subsecao: RedeEmpresaSubsecaoId): RedeDocEmpresaSlot[] {
  const prefix = subsecao === 'incorporadora' ? 'emp_incorp' : 'emp_gest';
  return DOC_DEFS.map((d) => {
    const tipo = `${prefix}_${d.docId}` as RedeEmpresaAnexoDocTipo;
    const pathKey = `anexo_${prefix}_${d.docId}_path` as RedeEmpresaDocPathKey;
    const justificativaKey = d.obrigatorio
      ? (`anexo_${prefix}_${d.docId}_justificativa` as RedeEmpresaDocJustificativaKey)
      : null;
    return {
      tipo,
      subsecao,
      titulo: d.titulo,
      pathKey,
      justificativaKey,
      obrigatorioParaCadastroCompleto: d.obrigatorio,
    };
  });
}

export const REDE_DOCS_EMPRESA_SLOTS: readonly RedeDocEmpresaSlot[] = [
  ...buildSlots('incorporadora'),
  ...buildSlots('gestora'),
];

export type RedeEmpresaDocsRow = Partial<
  Record<RedeEmpresaDocPathKey | RedeEmpresaDocJustificativaKey, string | null>
>;

export function getRedeEmpresaDocSlots(subsecao: RedeEmpresaSubsecaoId): RedeDocEmpresaSlot[] {
  return REDE_DOCS_EMPRESA_SLOTS.filter((s) => s.subsecao === subsecao);
}

export function getRedeEmpresaDocSlotValues(
  row: RedeEmpresaDocsRow,
  slot: RedeDocEmpresaSlot,
): { path: string | null; justificativa: string | null } {
  const path = norm(row[slot.pathKey]);
  const justificativa = slot.justificativaKey ? norm(row[slot.justificativaKey]) : null;
  return {
    path: path || null,
    justificativa: justificativa || null,
  };
}

function norm(s: string | null | undefined): string {
  return (s ?? '').toString().trim();
}

export function isRedeEmpresaDocSlotPendente(
  row: RedeEmpresaDocsRow,
  slot: RedeDocEmpresaSlot,
): boolean {
  if (!slot.obrigatorioParaCadastroCompleto) return false;
  const { path, justificativa } = getRedeEmpresaDocSlotValues(row, slot);
  return !isRedeDocSlotCompleto(path, justificativa);
}

/** Pendências de docs de empresa para cadastro incompleto (exclui Inscrição Estadual). */
export function pendenciasDocsEmpresasRede(row: RedeEmpresaDocsRow): string[] {
  const out: string[] = [];
  for (const slot of REDE_DOCS_EMPRESA_SLOTS) {
    if (!isRedeEmpresaDocSlotPendente(row, slot)) continue;
    const sub = slot.subsecao === 'incorporadora' ? 'Incorporadora' : 'Gestora';
    out.push(`${sub}: ${slot.titulo}`);
  }
  return out;
}

export const REDE_EMPRESA_ANEXO_PATH_COLUNA: Record<RedeEmpresaAnexoDocTipo, RedeEmpresaDocPathKey> =
  Object.fromEntries(REDE_DOCS_EMPRESA_SLOTS.map((s) => [s.tipo, s.pathKey])) as Record<
    RedeEmpresaAnexoDocTipo,
    RedeEmpresaDocPathKey
  >;

export const REDE_EMPRESA_ANEXO_JUSTIFICATIVA_COLUNA: Partial<
  Record<RedeEmpresaAnexoDocTipo, RedeEmpresaDocJustificativaKey>
> = Object.fromEntries(
  REDE_DOCS_EMPRESA_SLOTS.filter((s) => s.justificativaKey).map((s) => [s.tipo, s.justificativaKey!]),
) as Partial<Record<RedeEmpresaAnexoDocTipo, RedeEmpresaDocJustificativaKey>>;

export function isRedeEmpresaAnexoDocTipo(tipo: string): tipo is RedeEmpresaAnexoDocTipo {
  return tipo in REDE_EMPRESA_ANEXO_PATH_COLUNA;
}

export function slotEmpresaPorTipo(tipo: RedeEmpresaAnexoDocTipo): RedeDocEmpresaSlot | undefined {
  return REDE_DOCS_EMPRESA_SLOTS.find((s) => s.tipo === tipo);
}

/** Extrai campos de docs de empresa de uma linha `rede_franqueados`. */
export function pickRedeEmpresaDocsFromRow(r: Record<string, unknown>): RedeEmpresaDocsRow {
  const out: RedeEmpresaDocsRow = {};
  for (const slot of REDE_DOCS_EMPRESA_SLOTS) {
    out[slot.pathKey] = (r[slot.pathKey] as string | null | undefined) ?? null;
    if (slot.justificativaKey) {
      out[slot.justificativaKey] = (r[slot.justificativaKey] as string | null | undefined) ?? null;
    }
  }
  return out;
}
