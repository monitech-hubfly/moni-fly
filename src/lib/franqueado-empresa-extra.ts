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
  observacoes: string | null;
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
    observacoes: (r.observacoes as string | null) ?? null,
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
