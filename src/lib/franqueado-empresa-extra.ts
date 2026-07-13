import type { createClient } from '@/lib/supabase/server';
import type { FranqueadoEmpresaStatus } from '@/lib/franqueado-empresas';

export type FranqueadoEmpresaExtraRow = {
  id: string;
  rede_franqueado_id: string;
  tipo: 'empresa';
  nome: string | null;
  razao_social: string | null;
  cnpj: string | null;
  inscricao_municipal: string | null;
  inscricao_estadual: string | null;
  data_abertura: string | null;
  status: FranqueadoEmpresaStatus;
  conta_banco: string | null;
  conta_agencia: string | null;
  conta_numero: string | null;
  conta_tipo: string | null;
  conta_pix_tipo: string | null;
  conta_pix_chave: string | null;
  observacoes: string | null;
  anexo_contrato_social_path: string | null;
  anexo_contrato_social_justificativa: string | null;
  anexo_cnpj_path: string | null;
  anexo_cnpj_justificativa: string | null;
  anexo_inscricao_municipal_path: string | null;
  anexo_inscricao_municipal_justificativa: string | null;
  anexo_certidao_junta_path: string | null;
  anexo_certidao_junta_justificativa: string | null;
  anexo_conta_bancaria_path: string | null;
  anexo_conta_bancaria_justificativa: string | null;
  anexo_inscricao_estadual_path: string | null;
};

function mapEmpresaExtraRow(r: Record<string, unknown>): FranqueadoEmpresaExtraRow {
  const statusRaw = String(r.status ?? 'ativa').trim() as FranqueadoEmpresaStatus;
  const status: FranqueadoEmpresaStatus =
    statusRaw === 'inativa' || statusRaw === 'em_abertura' ? statusRaw : 'ativa';
  return {
    id: String(r.id),
    rede_franqueado_id: String(r.rede_franqueado_id),
    tipo: 'empresa',
    nome: (r.nome as string | null) ?? null,
    razao_social: (r.razao_social as string | null) ?? null,
    cnpj: (r.cnpj as string | null) ?? null,
    inscricao_municipal: (r.inscricao_municipal as string | null) ?? null,
    inscricao_estadual: (r.inscricao_estadual as string | null) ?? null,
    data_abertura: (r.data_abertura as string | null) ?? null,
    status,
    conta_banco: (r.conta_banco as string | null) ?? null,
    conta_agencia: (r.conta_agencia as string | null) ?? null,
    conta_numero: (r.conta_numero as string | null) ?? null,
    conta_tipo: (r.conta_tipo as string | null) ?? null,
    conta_pix_tipo: (r.conta_pix_tipo as string | null) ?? null,
    conta_pix_chave: (r.conta_pix_chave as string | null) ?? null,
    observacoes: (r.observacoes as string | null) ?? null,
    anexo_contrato_social_path: (r.anexo_contrato_social_path as string | null) ?? null,
    anexo_contrato_social_justificativa: (r.anexo_contrato_social_justificativa as string | null) ?? null,
    anexo_cnpj_path: (r.anexo_cnpj_path as string | null) ?? null,
    anexo_cnpj_justificativa: (r.anexo_cnpj_justificativa as string | null) ?? null,
    anexo_inscricao_municipal_path: (r.anexo_inscricao_municipal_path as string | null) ?? null,
    anexo_inscricao_municipal_justificativa:
      (r.anexo_inscricao_municipal_justificativa as string | null) ?? null,
    anexo_certidao_junta_path: (r.anexo_certidao_junta_path as string | null) ?? null,
    anexo_certidao_junta_justificativa: (r.anexo_certidao_junta_justificativa as string | null) ?? null,
    anexo_conta_bancaria_path: (r.anexo_conta_bancaria_path as string | null) ?? null,
    anexo_conta_bancaria_justificativa: (r.anexo_conta_bancaria_justificativa as string | null) ?? null,
    anexo_inscricao_estadual_path: (r.anexo_inscricao_estadual_path as string | null) ?? null,
  };
}

export async function fetchFranqueadoEmpresasExtrasRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  redeFranqueadoId: string,
): Promise<FranqueadoEmpresaExtraRow[] | null> {
  const { data, error } = await supabase
    .from('franqueado_empresas')
    .select('*')
    .eq('rede_franqueado_id', redeFranqueadoId)
    .eq('tipo', 'empresa')
    .order('created_at', { ascending: true });
  if (error) return null;
  return (data ?? []).map((r) => mapEmpresaExtraRow(r as Record<string, unknown>));
}
