/** Documentos das empresas adicionais (`franqueado_empresas` tipo `empresa` — mesmos slots que SPE). */

import { isRedeDocSlotCompleto } from '@/lib/rede-documentos-franquia';
import type { FranqueadoEmpresaExtraRow } from '@/lib/franqueado-empresa-extra';

export type FranqueadoEmpresaExtraDocId =
  | 'contrato_social'
  | 'cnpj'
  | 'inscricao_municipal'
  | 'certidao_junta'
  | 'conta_bancaria'
  | 'inscricao_estadual';

export type FranqueadoEmpresaExtraAnexoDocTipo = `emp_extra_${FranqueadoEmpresaExtraDocId}`;

export type FranqueadoEmpresaExtraDocSlot = {
  docId: FranqueadoEmpresaExtraDocId;
  tipo: FranqueadoEmpresaExtraAnexoDocTipo;
  titulo: string;
  pathKey: keyof Pick<
    FranqueadoEmpresaExtraRow,
    | 'anexo_contrato_social_path'
    | 'anexo_cnpj_path'
    | 'anexo_inscricao_municipal_path'
    | 'anexo_certidao_junta_path'
    | 'anexo_conta_bancaria_path'
    | 'anexo_inscricao_estadual_path'
  >;
  justificativaKey: keyof Pick<
    FranqueadoEmpresaExtraRow,
    | 'anexo_contrato_social_justificativa'
    | 'anexo_cnpj_justificativa'
    | 'anexo_inscricao_municipal_justificativa'
    | 'anexo_certidao_junta_justificativa'
    | 'anexo_conta_bancaria_justificativa'
  > | null;
  obrigatorioParaCadastroCompleto: boolean;
};

const DOC_DEFS: readonly { docId: FranqueadoEmpresaExtraDocId; titulo: string; obrigatorio: boolean }[] = [
  {
    docId: 'contrato_social',
    titulo: 'Contrato Social ou Estatuto registrado na Junta Comercial do estado',
    obrigatorio: true,
  },
  { docId: 'cnpj', titulo: 'CNPJ ativo emitido pela Receita Federal (cartão CNPJ ou consulta no site)', obrigatorio: true },
  { docId: 'inscricao_municipal', titulo: 'Inscrição Municipal (alvará ou CCM dependendo do município)', obrigatorio: true },
  { docId: 'certidao_junta', titulo: 'Certidão de Regularidade da Junta Comercial', obrigatorio: true },
  { docId: 'conta_bancaria', titulo: 'Comprovante de abertura de conta bancária PJ em nome da empresa', obrigatorio: true },
  { docId: 'inscricao_estadual', titulo: 'Inscrição Estadual (se aplicável à atividade)', obrigatorio: false },
] as const;

function pathKeyFor(docId: FranqueadoEmpresaExtraDocId): FranqueadoEmpresaExtraDocSlot['pathKey'] {
  const map: Record<FranqueadoEmpresaExtraDocId, FranqueadoEmpresaExtraDocSlot['pathKey']> = {
    contrato_social: 'anexo_contrato_social_path',
    cnpj: 'anexo_cnpj_path',
    inscricao_municipal: 'anexo_inscricao_municipal_path',
    certidao_junta: 'anexo_certidao_junta_path',
    conta_bancaria: 'anexo_conta_bancaria_path',
    inscricao_estadual: 'anexo_inscricao_estadual_path',
  };
  return map[docId];
}

function justKeyFor(docId: FranqueadoEmpresaExtraDocId): FranqueadoEmpresaExtraDocSlot['justificativaKey'] {
  if (docId === 'inscricao_estadual') return null;
  const map: Partial<
    Record<FranqueadoEmpresaExtraDocId, NonNullable<FranqueadoEmpresaExtraDocSlot['justificativaKey']>>
  > = {
    contrato_social: 'anexo_contrato_social_justificativa',
    cnpj: 'anexo_cnpj_justificativa',
    inscricao_municipal: 'anexo_inscricao_municipal_justificativa',
    certidao_junta: 'anexo_certidao_junta_justificativa',
    conta_bancaria: 'anexo_conta_bancaria_justificativa',
  };
  return map[docId] ?? null;
}

export const FRANQUEADO_EMPRESA_EXTRA_DOC_SLOTS: readonly FranqueadoEmpresaExtraDocSlot[] = DOC_DEFS.map((d) => ({
  docId: d.docId,
  tipo: `emp_extra_${d.docId}` as FranqueadoEmpresaExtraAnexoDocTipo,
  titulo: d.titulo,
  pathKey: pathKeyFor(d.docId),
  justificativaKey: justKeyFor(d.docId),
  obrigatorioParaCadastroCompleto: d.obrigatorio,
}));

export function getFranqueadoEmpresaExtraDocSlotValues(
  row: FranqueadoEmpresaExtraRow,
  slot: FranqueadoEmpresaExtraDocSlot,
): { path: string | null; justificativa: string | null } {
  const path = (row[slot.pathKey] ?? '').toString().trim() || null;
  const justificativa = slot.justificativaKey
    ? (row[slot.justificativaKey] ?? '').toString().trim() || null
    : null;
  return { path, justificativa };
}

export function isFranqueadoEmpresaExtraAnexoDocTipo(tipo: string): tipo is FranqueadoEmpresaExtraAnexoDocTipo {
  return FRANQUEADO_EMPRESA_EXTRA_DOC_SLOTS.some((s) => s.tipo === tipo);
}

export function slotEmpresaExtraPorTipo(
  tipo: FranqueadoEmpresaExtraAnexoDocTipo,
): FranqueadoEmpresaExtraDocSlot | undefined {
  return FRANQUEADO_EMPRESA_EXTRA_DOC_SLOTS.find((s) => s.tipo === tipo);
}

export function pendenciasDocsEmpresaExtra(row: FranqueadoEmpresaExtraRow): string[] {
  const label = row.nome?.trim() || row.razao_social?.trim() || 'Empresa';
  const out: string[] = [];
  for (const slot of FRANQUEADO_EMPRESA_EXTRA_DOC_SLOTS) {
    if (!slot.obrigatorioParaCadastroCompleto) continue;
    const { path, justificativa } = getFranqueadoEmpresaExtraDocSlotValues(row, slot);
    if (!isRedeDocSlotCompleto(path, justificativa)) {
      out.push(`${label}: ${slot.titulo}`);
    }
  }
  return out;
}
