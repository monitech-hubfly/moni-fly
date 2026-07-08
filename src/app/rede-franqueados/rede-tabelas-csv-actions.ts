'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { normalizeAccessRole } from '@/lib/authz';
import {
  exigirColunas,
  parseCsvTexto,
  patchCsvNaoVazio,
  valorCsv,
} from '@/lib/csv-tabela-rede';
import type { FranqueadoEmpresaStatus } from '@/lib/franqueado-empresas';
import { criarCadastroMoniCapital, verificarDuplicataMoniCapital } from '@/lib/moni-capital-cadastros-actions';
import type { RedeLoteadorStatus } from '@/lib/rede-loteadores';
import { normalizeNFranquiaCsv } from '@/lib/import-rede-csv';

type Ok = { ok: true; mensagem: string };
type Err = { ok: false; error: string };
type CsvResult = Ok | Err;

async function requireRedeStaff(): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; userId: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const access = normalizeAccessRole((profile as { role?: string } | null)?.role);
  if (access !== 'admin' && access !== 'team') {
    return { ok: false, error: 'Apenas administradores ou time podem importar ou exportar.' };
  }
  return { ok: true, supabase, userId: user.id };
}

function parseNumeroCsv(raw: string): number | null {
  const t = raw.trim().replace(/\./g, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function parseStatusLoteador(raw: string): RedeLoteadorStatus | undefined {
  const t = raw.trim().toLowerCase();
  if (t === 'ativo' || t === 'inativo') return t;
  if (t === 'em_analise' || t === 'em analise') return 'em_analise';
  return undefined;
}

function parseStatusEmpresa(raw: string): FranqueadoEmpresaStatus | undefined {
  const t = raw.trim().toLowerCase();
  if (t === 'ativa') return 'ativa';
  if (t === 'inativa') return 'inativa';
  if (t === 'em_abertura' || t === 'em abertura') return 'em_abertura';
  return undefined;
}

function chaveLoteador(row: Record<string, string>): string | null {
  const id = valorCsv(row, 'id');
  if (id) return `id:${id}`;
  const cnpj = valorCsv(row, 'cnpj').replace(/\D/g, '');
  if (cnpj) return `cnpj:${cnpj}`;
  const nome = valorCsv(row, 'nome').toLowerCase();
  return nome ? `nome:${nome}` : null;
}

function chaveCondominio(row: Record<string, string>): string | null {
  const id = valorCsv(row, 'id');
  if (id) return `id:${id}`;
  const nome = valorCsv(row, 'nome').toLowerCase();
  return nome ? `nome:${nome}` : null;
}

const LOTEADOR_CSV_COLS = [
  'nome',
  'cnpj',
  'cidade',
  'estado',
  'contato_nome',
  'contato_telefone',
  'contato_email',
  'portfolio_descricao',
  'status',
  'observacoes',
] as const;

function rowLoteadorFromCsv(row: Record<string, string>): Record<string, unknown> {
  const patch = patchCsvNaoVazio(row, LOTEADOR_CSV_COLS);
  const out: Record<string, unknown> = { ...patch };
  const st = parseStatusLoteador(valorCsv(row, 'status'));
  if (st) out.status = st;
  if (!out.nome) out.nome = valorCsv(row, 'nome');
  return out;
}

function rowCondominioFromCsv(row: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of ['nome', 'endereco', 'numero', 'cep', 'cidade', 'estado', 'extrato_como_eram_casas', 'extrato_tempo_venda']) {
    const v = valorCsv(row, k);
    if (v) out[k] = v;
  }
  for (const k of [
    'ticket_medio_lote',
    'ticket_medio_casas',
    'ticket_medio_casas_rsm2',
    'estimativa_casas_vendidas_ano',
    'recuo_frontal_m',
    'recuo_fundo_m',
    'recuo_lateral_m',
  ]) {
    const raw = valorCsv(row, k);
    if (!raw) continue;
    const n = parseNumeroCsv(raw);
    if (n != null) out[k] = n;
  }
  return out;
}

export async function importarRedeLoteadoresCSV(csvText: string): Promise<CsvResult> {
  const gate = await requireRedeStaff();
  if (!gate.ok) return gate;

  const parsed = parseCsvTexto(csvText);
  if (!parsed.ok) return parsed;
  const miss = exigirColunas(parsed.headers, ['nome']);
  if (miss) return { ok: false, error: miss };

  let inseridos = 0;
  for (const row of parsed.rows) {
    const data = rowLoteadorFromCsv(row);
    const nome = String(data.nome ?? '').trim();
    if (!nome) continue;
    data.criado_por = gate.userId;
    data.updated_at = new Date().toISOString();
    if (!data.status) data.status = 'ativo';

    const { error } = await gate.supabase.from('rede_loteadores').insert(data as never);
    if (error) return { ok: false, error: error.message };
    inseridos++;
  }

  revalidatePath('/rede-franqueados');
  return {
    ok: true,
    mensagem: inseridos === 1 ? '1 loteador importado.' : `${inseridos} loteadores importados.`,
  };
}

export async function atualizarRedeLoteadoresCSV(csvText: string): Promise<CsvResult> {
  const gate = await requireRedeStaff();
  if (!gate.ok) return gate;

  const parsed = parseCsvTexto(csvText);
  if (!parsed.ok) return parsed;

  const { data: existentes } = await gate.supabase.from('rede_loteadores').select('id, nome, cnpj');
  const mapa = new Map<string, string>();
  for (const r of existentes ?? []) {
    const row = r as { id: string; nome?: string | null; cnpj?: string | null };
    mapa.set(`id:${row.id}`, row.id);
    const cnpj = String(row.cnpj ?? '').replace(/\D/g, '');
    if (cnpj) mapa.set(`cnpj:${cnpj}`, row.id);
    const nome = String(row.nome ?? '').trim().toLowerCase();
    if (nome) mapa.set(`nome:${nome}`, row.id);
  }

  let atualizados = 0;
  let ignorados = 0;
  for (const row of parsed.rows) {
    const chave = chaveLoteador(row);
    const patch = rowLoteadorFromCsv(row);
    delete patch.nome;
    if (Object.keys(patch).length === 0) {
      ignorados++;
      continue;
    }
    const id = chave ? mapa.get(chave) : undefined;
    if (!id) {
      ignorados++;
      continue;
    }
    patch.updated_at = new Date().toISOString();
    const { error } = await gate.supabase.from('rede_loteadores').update(patch as never).eq('id', id);
    if (error) return { ok: false, error: error.message };
    atualizados++;
  }

  revalidatePath('/rede-franqueados');
  return {
    ok: true,
    mensagem: `${atualizados} loteador(es) atualizado(s)${ignorados ? `, ${ignorados} ignorado(s)` : ''}.`,
  };
}

export async function importarCondominiosCSV(csvText: string): Promise<CsvResult> {
  const gate = await requireRedeStaff();
  if (!gate.ok) return gate;

  const parsed = parseCsvTexto(csvText);
  if (!parsed.ok) return parsed;
  const miss = exigirColunas(parsed.headers, ['nome']);
  if (miss) return { ok: false, error: miss };

  let inseridos = 0;
  for (const row of parsed.rows) {
    const data = rowCondominioFromCsv(row);
    const nome = String(data.nome ?? '').trim();
    if (!nome) continue;
    data.criado_por = gate.userId;
    data.updated_at = new Date().toISOString();

    const { error } = await gate.supabase.from('condominios').insert(data as never);
    if (error) return { ok: false, error: error.message };
    inseridos++;
  }

  revalidatePath('/rede-franqueados');
  return {
    ok: true,
    mensagem: inseridos === 1 ? '1 condomínio importado.' : `${inseridos} condomínios importados.`,
  };
}

export async function atualizarCondominiosCSV(csvText: string): Promise<CsvResult> {
  const gate = await requireRedeStaff();
  if (!gate.ok) return gate;

  const parsed = parseCsvTexto(csvText);
  if (!parsed.ok) return parsed;

  const { data: existentes } = await gate.supabase.from('condominios').select('id, nome');
  const mapa = new Map<string, string>();
  for (const r of existentes ?? []) {
    const row = r as { id: string; nome?: string | null };
    mapa.set(`id:${row.id}`, row.id);
    const nome = String(row.nome ?? '').trim().toLowerCase();
    if (nome) mapa.set(`nome:${nome}`, row.id);
  }

  let atualizados = 0;
  let ignorados = 0;
  for (const row of parsed.rows) {
    const chave = chaveCondominio(row);
    const patch = rowCondominioFromCsv(row);
    if (Object.keys(patch).length === 0) {
      ignorados++;
      continue;
    }
    const id = chave ? mapa.get(chave) : undefined;
    if (!id) {
      ignorados++;
      continue;
    }
    patch.updated_at = new Date().toISOString();
    const { error } = await gate.supabase.from('condominios').update(patch as never).eq('id', id);
    if (error) return { ok: false, error: error.message };
    atualizados++;
  }

  revalidatePath('/rede-franqueados');
  return {
    ok: true,
    mensagem: `${atualizados} condomínio(s) atualizado(s)${ignorados ? `, ${ignorados} ignorado(s)` : ''}.`,
  };
}

export async function atualizarCadastrosEmpresasCSV(csvText: string): Promise<CsvResult> {
  const gate = await requireRedeStaff();
  if (!gate.ok) return gate;

  const parsed = parseCsvTexto(csvText);
  if (!parsed.ok) return parsed;
  const miss = exigirColunas(parsed.headers, ['n_franquia']);
  if (miss) return { ok: false, error: miss };

  const { data: rede } = await gate.supabase.from('rede_franqueados').select('id, n_franquia');
  const porFranquia = new Map<string, string>();
  for (const r of rede ?? []) {
    const chave = normalizeNFranquiaCsv((r as { n_franquia?: string }).n_franquia)?.toLowerCase();
    if (chave) porFranquia.set(chave, String((r as { id: string }).id));
  }

  let atualizados = 0;
  let ignorados = 0;

  for (const row of parsed.rows) {
    const nf = normalizeNFranquiaCsv(valorCsv(row, 'n_franquia'));
    if (!nf) {
      ignorados++;
      continue;
    }
    const redeId = porFranquia.get(nf.toLowerCase());
    if (!redeId) {
      ignorados++;
      continue;
    }

    for (const tipo of ['incorporadora', 'gestora'] as const) {
      const prefix = tipo === 'incorporadora' ? 'inc' : 'gest';
      const dados: Record<string, unknown> = {};
      const mapCols: [string, string][] = [
        [`${prefix}_razao_social`, 'razao_social'],
        [`${prefix}_cnpj`, 'cnpj'],
        [`${prefix}_inscricao_municipal`, 'inscricao_municipal'],
        [`${prefix}_inscricao_estadual`, 'inscricao_estadual'],
        [`${prefix}_conta_banco`, 'conta_banco'],
        [`${prefix}_conta_agencia`, 'conta_agencia'],
        [`${prefix}_conta_numero`, 'conta_numero'],
      ];
      for (const [csvKey, dbKey] of mapCols) {
        const v = valorCsv(row, csvKey);
        if (v) dados[dbKey] = v;
      }
      const st = parseStatusEmpresa(valorCsv(row, `${prefix}_status`));
      if (st) dados.status = st;
      if (Object.keys(dados).length === 0) continue;

      dados.rede_franqueado_id = redeId;
      dados.tipo = tipo;
      dados.updated_at = new Date().toISOString();

      const { error } = await gate.supabase
        .from('franqueado_empresas')
        .upsert(dados as never, { onConflict: 'rede_franqueado_id,tipo' });
      if (error) return { ok: false, error: error.message };
      atualizados++;
    }
  }

  revalidatePath('/rede-franqueados');
  return {
    ok: true,
    mensagem: `${atualizados} registro(s) de empresa atualizado(s)${ignorados ? `, ${ignorados} linha(s) ignorada(s)` : ''}.`,
  };
}

export async function importarCadastrosEmpresasCSV(csvText: string): Promise<CsvResult> {
  return atualizarCadastrosEmpresasCSV(csvText);
}

const MC_CSV_COLS = [
  'broker_nome',
  'broker_email',
  'broker_telefone',
  'investidor_nome',
  'investidor_email',
  'investidor_telefone',
] as const;

function rowMoniCapitalFromCsv(row: Record<string, string>): Record<string, unknown> {
  return patchCsvNaoVazio(row, MC_CSV_COLS);
}

export async function importarMoniCapitalCadastrosCSV(csvText: string): Promise<CsvResult> {
  const gate = await requireRedeStaff();
  if (!gate.ok) return gate;

  const parsed = parseCsvTexto(csvText);
  if (!parsed.ok) return parsed;

  let inseridos = 0;
  let ignorados = 0;

  for (const row of parsed.rows) {
    const dados = rowMoniCapitalFromCsv(row);
    const temCampo = Object.values(dados).some((v) => String(v ?? '').trim() !== '');
    if (!temCampo) {
      ignorados++;
      continue;
    }

    const res = await criarCadastroMoniCapital({
      broker_nome: String(dados.broker_nome ?? '') || null,
      broker_email: String(dados.broker_email ?? '') || null,
      broker_telefone: String(dados.broker_telefone ?? '') || null,
      investidor_nome: String(dados.investidor_nome ?? '') || null,
      investidor_email: String(dados.investidor_email ?? '') || null,
      investidor_telefone: String(dados.investidor_telefone ?? '') || null,
      criarCardFunding: true,
    });
    if (!res.ok) return res;
    inseridos++;
  }

  revalidatePath('/rede-franqueados');
  return {
    ok: true,
    mensagem:
      inseridos === 1
        ? '1 cadastro Moní Capital importado.'
        : `${inseridos} cadastros Moní Capital importados.${ignorados ? ` ${ignorados} linha(s) ignorada(s).` : ''}`,
  };
}

export async function atualizarMoniCapitalCadastrosCSV(csvText: string): Promise<CsvResult> {
  const gate = await requireRedeStaff();
  if (!gate.ok) return gate;

  const parsed = parseCsvTexto(csvText);
  if (!parsed.ok) return parsed;
  const miss = exigirColunas(parsed.headers, ['n_cadastro']);
  if (miss) return { ok: false, error: miss };

  const { data: existentes } = await gate.supabase.from('moni_capital_cadastros').select('id, n_cadastro');
  const porNC = new Map<string, string>();
  for (const r of existentes ?? []) {
    const nc = String((r as { n_cadastro?: string }).n_cadastro ?? '').trim().toUpperCase();
    if (nc) porNC.set(nc, String((r as { id: string }).id));
  }

  let atualizados = 0;
  let ignorados = 0;

  for (const row of parsed.rows) {
    const nc = valorCsv(row, 'n_cadastro').toUpperCase();
    if (!nc || nc === 'MC0000') {
      ignorados++;
      continue;
    }
    const id = porNC.get(nc);
    if (!id) {
      ignorados++;
      continue;
    }

    const patch = rowMoniCapitalFromCsv(row);
    if (Object.keys(patch).length === 0) {
      ignorados++;
      continue;
    }

    const dup = await verificarDuplicataMoniCapital(
      {
        broker_nome: String(patch.broker_nome ?? '') || null,
        broker_email: String(patch.broker_email ?? '') || null,
        broker_telefone: String(patch.broker_telefone ?? '') || null,
        investidor_nome: String(patch.investidor_nome ?? '') || null,
        investidor_email: String(patch.investidor_email ?? '') || null,
        investidor_telefone: String(patch.investidor_telefone ?? '') || null,
      },
      id,
    );
    if (!dup.ok) return dup;

    patch.updated_at = new Date().toISOString();
    const { error } = await gate.supabase
      .from('moni_capital_cadastros')
      .update(patch as never)
      .eq('id', id);
    if (error) return { ok: false, error: error.message };
    atualizados++;
  }

  revalidatePath('/rede-franqueados');
  return {
    ok: true,
    mensagem: `${atualizados} cadastro(s) atualizado(s)${ignorados ? `, ${ignorados} ignorado(s)` : ''}.`,
  };
}
