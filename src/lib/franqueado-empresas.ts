/** Cadastro Incorporadora / Gestora (`franqueado_empresas`). */

import type { createClient } from '@/lib/supabase/server';
import {
  formatNFranquiaRedeExibicao,
  ordenarRedePorNFranquia,
  type RedeFranqueadoRowDb,
} from '@/lib/rede-franqueados';

export type FranqueadoEmpresaTipo = 'incorporadora' | 'gestora';

export type FranqueadoEmpresaStatus = 'ativa' | 'inativa' | 'em_abertura';

export type FranqueadoEmpresaRow = {
  id: string;
  rede_franqueado_id: string;
  tipo: FranqueadoEmpresaTipo;
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

export const FRANQUEADO_EMPRESA_STATUS_LABEL: Record<FranqueadoEmpresaStatus, string> = {
  ativa: 'Ativa',
  inativa: 'Inativa',
  em_abertura: 'Em abertura',
};

export type CadastroEmpresasLinha = {
  redeId: string;
  ordem: number;
  n_franquia: string | null;
  modalidade: string | null;
  nome_completo: string | null;
  status_franquia: string | null;
  incorporadora: FranqueadoEmpresaRow | null;
  gestora: FranqueadoEmpresaRow | null;
};

export type FranqueadoEmpresaUpsertDados = {
  razao_social?: string | null;
  cnpj?: string | null;
  inscricao_municipal?: string | null;
  inscricao_estadual?: string | null;
  status?: FranqueadoEmpresaStatus;
  conta_banco?: string | null;
  conta_agencia?: string | null;
  conta_numero?: string | null;
  conta_tipo?: string | null;
};

function mapEmpresaRow(r: Record<string, unknown>): FranqueadoEmpresaRow {
  const statusRaw = String(r.status ?? 'ativa').trim() as FranqueadoEmpresaStatus;
  const status: FranqueadoEmpresaStatus =
    statusRaw === 'inativa' || statusRaw === 'em_abertura' ? statusRaw : 'ativa';
  const tipo = String(r.tipo ?? '').trim() as FranqueadoEmpresaTipo;
  return {
    id: String(r.id),
    rede_franqueado_id: String(r.rede_franqueado_id),
    tipo: tipo === 'gestora' ? 'gestora' : 'incorporadora',
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

export async function fetchFranqueadoEmpresasRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<FranqueadoEmpresaRow[] | null> {
  const { data, error } = await supabase.from('franqueado_empresas').select('*');
  if (error) return null;
  return (data ?? []).map((r) => mapEmpresaRow(r as Record<string, unknown>));
}

export function buildCadastrosEmpresasLinhas(
  redeRows: RedeFranqueadoRowDb[],
  empresas: FranqueadoEmpresaRow[],
): CadastroEmpresasLinha[] {
  const porRede = new Map<string, { incorporadora?: FranqueadoEmpresaRow; gestora?: FranqueadoEmpresaRow }>();
  for (const e of empresas) {
    const cur = porRede.get(e.rede_franqueado_id) ?? {};
    if (e.tipo === 'incorporadora') cur.incorporadora = e;
    else cur.gestora = e;
    porRede.set(e.rede_franqueado_id, cur);
  }

  return ordenarRedePorNFranquia(redeRows).map((r) => {
    const emp = porRede.get(r.id);
    return {
      redeId: r.id,
      ordem: r.ordem,
      n_franquia: formatNFranquiaRedeExibicao(r.n_franquia, r.ordem) || null,
      modalidade: (r.modalidade as string | null) ?? null,
      nome_completo: (r.nome_completo as string | null) ?? null,
      status_franquia: (r.status_franquia as string | null) ?? null,
      incorporadora: emp?.incorporadora ?? null,
      gestora: emp?.gestora ?? null,
    };
  });
}

export function formatContaBancariaEmpresa(
  banco: string | null | undefined,
  agencia: string | null | undefined,
  numero: string | null | undefined,
): string {
  const b = (banco ?? '').trim();
  const a = (agencia ?? '').trim();
  const n = (numero ?? '').trim();
  const parts: string[] = [];
  if (b) parts.push(b);
  if (a) parts.push(`ag. ${a}`);
  if (n) parts.push(`cc ${n}`);
  return parts.length ? parts.join(' · ') : '—';
}

function normBusca(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function cadastroEmpresasLinhaMatchesBusca(linha: CadastroEmpresasLinha, busca: string): boolean {
  const q = normBusca(busca);
  if (!q) return true;
  const parts: Array<string | null | undefined> = [
    linha.n_franquia,
    linha.modalidade,
    linha.nome_completo,
    linha.status_franquia,
  ];
  for (const emp of [linha.incorporadora, linha.gestora]) {
    if (!emp) continue;
    parts.push(
      emp.razao_social,
      emp.cnpj,
      emp.inscricao_municipal,
      emp.inscricao_estadual,
      emp.status,
      FRANQUEADO_EMPRESA_STATUS_LABEL[emp.status],
      emp.conta_banco,
      emp.conta_agencia,
      emp.conta_numero,
      formatContaBancariaEmpresa(emp.conta_banco, emp.conta_agencia, emp.conta_numero),
    );
  }
  return parts.some((p) => normBusca(p ?? '').includes(q));
}
