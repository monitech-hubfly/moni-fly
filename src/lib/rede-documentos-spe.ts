/** Documentos das SPEs (`franqueado_spe` — mesmos slots que Incorporadora/Gestora). */

import { isRedeDocSlotCompleto } from '@/lib/rede-documentos-franquia';
import type { FranqueadoSpeRow } from '@/lib/franqueado-spe';

export type FranqueadoSpeDocId =
  | 'contrato_social'
  | 'cnpj'
  | 'inscricao_municipal'
  | 'certidao_junta'
  | 'conta_bancaria'
  | 'inscricao_estadual';

export type FranqueadoSpeAnexoDocTipo = `emp_spe_${FranqueadoSpeDocId}`;

export type FranqueadoSpeDocSlot = {
  docId: FranqueadoSpeDocId;
  tipo: FranqueadoSpeAnexoDocTipo;
  titulo: string;
  pathKey: keyof Pick<
    FranqueadoSpeRow,
    | 'anexo_contrato_social_path'
    | 'anexo_cnpj_path'
    | 'anexo_inscricao_municipal_path'
    | 'anexo_certidao_junta_path'
    | 'anexo_conta_bancaria_path'
    | 'anexo_inscricao_estadual_path'
  >;
  justificativaKey: keyof Pick<
    FranqueadoSpeRow,
    | 'anexo_contrato_social_justificativa'
    | 'anexo_cnpj_justificativa'
    | 'anexo_inscricao_municipal_justificativa'
    | 'anexo_certidao_junta_justificativa'
    | 'anexo_conta_bancaria_justificativa'
  > | null;
  obrigatorioParaCadastroCompleto: boolean;
};

const DOC_DEFS: readonly { docId: FranqueadoSpeDocId; titulo: string; obrigatorio: boolean }[] = [
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

function pathKeyFor(docId: FranqueadoSpeDocId): FranqueadoSpeDocSlot['pathKey'] {
  const map: Record<FranqueadoSpeDocId, FranqueadoSpeDocSlot['pathKey']> = {
    contrato_social: 'anexo_contrato_social_path',
    cnpj: 'anexo_cnpj_path',
    inscricao_municipal: 'anexo_inscricao_municipal_path',
    certidao_junta: 'anexo_certidao_junta_path',
    conta_bancaria: 'anexo_conta_bancaria_path',
    inscricao_estadual: 'anexo_inscricao_estadual_path',
  };
  return map[docId];
}

function justKeyFor(docId: FranqueadoSpeDocId): FranqueadoSpeDocSlot['justificativaKey'] {
  if (docId === 'inscricao_estadual') return null;
  const map: Partial<Record<FranqueadoSpeDocId, NonNullable<FranqueadoSpeDocSlot['justificativaKey']>>> = {
    contrato_social: 'anexo_contrato_social_justificativa',
    cnpj: 'anexo_cnpj_justificativa',
    inscricao_municipal: 'anexo_inscricao_municipal_justificativa',
    certidao_junta: 'anexo_certidao_junta_justificativa',
    conta_bancaria: 'anexo_conta_bancaria_justificativa',
  };
  return map[docId] ?? null;
}

export const FRANQUEADO_SPE_DOC_SLOTS: readonly FranqueadoSpeDocSlot[] = DOC_DEFS.map((d) => ({
  docId: d.docId,
  tipo: `emp_spe_${d.docId}` as FranqueadoSpeAnexoDocTipo,
  titulo: d.titulo,
  pathKey: pathKeyFor(d.docId),
  justificativaKey: justKeyFor(d.docId),
  obrigatorioParaCadastroCompleto: d.obrigatorio,
}));

export function getFranqueadoSpeDocSlotValues(
  row: FranqueadoSpeRow,
  slot: FranqueadoSpeDocSlot,
): { path: string | null; justificativa: string | null } {
  const path = (row[slot.pathKey] ?? '').toString().trim() || null;
  const justificativa = slot.justificativaKey
    ? (row[slot.justificativaKey] ?? '').toString().trim() || null
    : null;
  return { path, justificativa };
}

export function isFranqueadoSpeDocSlotPendente(row: FranqueadoSpeRow, slot: FranqueadoSpeDocSlot): boolean {
  if (!slot.obrigatorioParaCadastroCompleto) return false;
  const { path, justificativa } = getFranqueadoSpeDocSlotValues(row, slot);
  return !isRedeDocSlotCompleto(path, justificativa);
}

export function pendenciasDocsSpe(row: FranqueadoSpeRow): string[] {
  const label = row.nome_projeto?.trim() || row.razao_social?.trim() || 'SPE';
  const out: string[] = [];
  for (const slot of FRANQUEADO_SPE_DOC_SLOTS) {
    if (!isFranqueadoSpeDocSlotPendente(row, slot)) continue;
    out.push(`${label}: ${slot.titulo}`);
  }
  return out;
}

export function isFranqueadoSpeAnexoDocTipo(tipo: string): tipo is FranqueadoSpeAnexoDocTipo {
  return FRANQUEADO_SPE_DOC_SLOTS.some((s) => s.tipo === tipo);
}

export function slotSpePorTipo(tipo: FranqueadoSpeAnexoDocTipo): FranqueadoSpeDocSlot | undefined {
  return FRANQUEADO_SPE_DOC_SLOTS.find((s) => s.tipo === tipo);
}
