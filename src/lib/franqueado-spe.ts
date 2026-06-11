/** SPE por projeto do franqueado (`franqueado_spe`). */

import type { createClient } from '@/lib/supabase/server';
import {
  formatNFranquiaRedeExibicao,
  ordenarRedePorNFranquia,
  type RedeFranqueadoRowDb,
} from '@/lib/rede-franqueados';
import type { FranqueadoEmpresaStatus } from '@/lib/franqueado-empresas';
import { FRANQUEADO_EMPRESA_STATUS_LABEL, formatContaBancariaEmpresa } from '@/lib/franqueado-empresas';

export type FranqueadoSpeStatus = FranqueadoEmpresaStatus;

export type FranqueadoSpeRow = {
  id: string;
  rede_franqueado_id: string;
  kanban_card_id: string | null;
  nome_projeto: string | null;
  razao_social: string | null;
  cnpj: string | null;
  inscricao_municipal: string | null;
  inscricao_estadual: string | null;
  status: FranqueadoSpeStatus;
  conta_banco: string | null;
  conta_agencia: string | null;
  conta_numero: string | null;
  conta_tipo: string | null;
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

export type FranqueadoSpeUpsertDados = {
  nome_projeto?: string | null;
  razao_social?: string | null;
  cnpj?: string | null;
  inscricao_municipal?: string | null;
  inscricao_estadual?: string | null;
  status?: FranqueadoSpeStatus;
  conta_banco?: string | null;
  conta_agencia?: string | null;
  conta_numero?: string | null;
  conta_tipo?: string | null;
  kanban_card_id?: string | null;
};

export type CardEmpresasDetalhe = {
  redeFranqueadoId: string | null;
  incorporadora: import('@/lib/franqueado-empresas').FranqueadoEmpresaRow | null;
  gestora: import('@/lib/franqueado-empresas').FranqueadoEmpresaRow | null;
  spe: FranqueadoSpeRow | null;
};

function mapSpeRow(r: Record<string, unknown>): FranqueadoSpeRow {
  const statusRaw = String(r.status ?? 'em_abertura').trim() as FranqueadoSpeStatus;
  const status: FranqueadoSpeStatus =
    statusRaw === 'ativa' || statusRaw === 'inativa' ? statusRaw : 'em_abertura';
  return {
    id: String(r.id),
    rede_franqueado_id: String(r.rede_franqueado_id),
    kanban_card_id: (r.kanban_card_id as string | null) ?? null,
    nome_projeto: (r.nome_projeto as string | null) ?? null,
    razao_social: (r.razao_social as string | null) ?? null,
    cnpj: (r.cnpj as string | null) ?? null,
    inscricao_municipal: (r.inscricao_municipal as string | null) ?? null,
    inscricao_estadual: (r.inscricao_estadual as string | null) ?? null,
    status,
    conta_banco: (r.conta_banco as string | null) ?? null,
    conta_agencia: (r.conta_agencia as string | null) ?? null,
    conta_numero: (r.conta_numero as string | null) ?? null,
    conta_tipo: (r.conta_tipo as string | null) ?? null,
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

export async function fetchFranqueadoSpeRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<FranqueadoSpeRow[] | null> {
  const { data, error } = await supabase.from('franqueado_spe').select('*').order('created_at', { ascending: true });
  if (error) return null;
  return (data ?? []).map((r) => mapSpeRow(r as Record<string, unknown>));
}

export async function fetchSpeByKanbanCardId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cardId: string,
): Promise<FranqueadoSpeRow | null> {
  const id = cardId.trim();
  if (!id) return null;
  const { data, error } = await supabase
    .from('franqueado_spe')
    .select('*')
    .eq('kanban_card_id', id)
    .maybeSingle();
  if (error || !data) return null;
  return mapSpeRow(data as Record<string, unknown>);
}

export async function fetchSpeById(
  supabase: Awaited<ReturnType<typeof createClient>>,
  speId: string,
): Promise<FranqueadoSpeRow | null> {
  const id = speId.trim();
  if (!id) return null;
  const { data, error } = await supabase.from('franqueado_spe').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return mapSpeRow(data as Record<string, unknown>);
}

export function spesPorRedeId(spes: FranqueadoSpeRow[]): Map<string, FranqueadoSpeRow[]> {
  const map = new Map<string, FranqueadoSpeRow[]>();
  for (const s of spes) {
    const list = map.get(s.rede_franqueado_id) ?? [];
    list.push(s);
    map.set(s.rede_franqueado_id, list);
  }
  return map;
}

export function speResumoColapsado(spes: FranqueadoSpeRow[]): string {
  if (spes.length === 0) return '—';
  if (spes.length === 1) {
    const s = spes[0]!;
    const nome = s.nome_projeto?.trim() || s.razao_social?.trim() || 'SPE';
    return nome;
  }
  return `${spes.length} SPEs`;
}

export function speMatchesBusca(spe: FranqueadoSpeRow, busca: string): boolean {
  const q = busca
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  if (!q) return true;
  const parts = [
    spe.nome_projeto,
    spe.razao_social,
    spe.cnpj,
    spe.inscricao_municipal,
    spe.inscricao_estadual,
    spe.status,
    FRANQUEADO_EMPRESA_STATUS_LABEL[spe.status],
    spe.kanban_card_id,
    formatContaBancariaEmpresa(spe.conta_banco, spe.conta_agencia, spe.conta_numero),
  ];
  return parts.some((p) => (p ?? '').toLowerCase().includes(q));
}

export type CadastroEmpresasLinhaComSpe = import('@/lib/franqueado-empresas').CadastroEmpresasLinha & {
  spes: FranqueadoSpeRow[];
};

export function buildCadastrosEmpresasLinhasComSpe(
  redeRows: RedeFranqueadoRowDb[],
  linhasBase: import('@/lib/franqueado-empresas').CadastroEmpresasLinha[],
  spes: FranqueadoSpeRow[],
): CadastroEmpresasLinhaComSpe[] {
  const porRede = spesPorRedeId(spes);
  return ordenarRedePorNFranquia(redeRows).map((r) => {
    const base = linhasBase.find((l) => l.redeId === r.id);
    return {
      redeId: r.id,
      ordem: r.ordem,
      n_franquia: base?.n_franquia ?? (formatNFranquiaRedeExibicao(r.n_franquia, r.ordem) || null),
      modalidade: base?.modalidade ?? (r.modalidade as string | null) ?? null,
      nome_completo: base?.nome_completo ?? (r.nome_completo as string | null) ?? null,
      status_franquia: base?.status_franquia ?? (r.status_franquia as string | null) ?? null,
      incorporadora: base?.incorporadora ?? null,
      gestora: base?.gestora ?? null,
      spes: porRede.get(r.id) ?? [],
    };
  });
}
