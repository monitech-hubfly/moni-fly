import type { SupabaseClient } from '@supabase/supabase-js';
import { montarRotuloCard, termoBuscaPortfolio, type CardPortfolioFormulario } from '@/lib/formularios/card-portfolio';
import { KANBAN_IDS } from '@/lib/constants/kanban-ids';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CARD_SELECT =
  'id, titulo, nome_condominio, quadra, lote, rede_franqueado_id, condominio_id, processo_step_one_id, projeto_id';

type CardRow = {
  id: string;
  titulo: string | null;
  nome_condominio: string | null;
  quadra: string | null;
  lote: string | null;
  rede_franqueado_id: string | null;
  condominio_id: string | null;
  processo_step_one_id: string | null;
  projeto_id: string | null;
};

type ProcRow = {
  id: string;
  produto_modelo_casa: string | null;
  m2_terreno: number | string | null;
  nome_condominio: string | null;
  quadra: string | null;
  lote: string | null;
  quadra_lote: string | null;
  condominio_id: string | null;
  origem_rede_franqueados_id: string | null;
};

function limpo(valor: unknown): string {
  return String(valor ?? '').trim();
}

function unicos(ids: Array<string | null | undefined>): string[] {
  return [...new Set(ids.map((id) => limpo(id)).filter(Boolean))];
}

function filtroIlike(coluna: string, termo: string): string {
  const valor = `%${termo}%`;
  return valor.includes(' ') ? `${coluna}.ilike."${valor}"` : `${coluna}.ilike.${valor}`;
}

function juntarCidade(cidade: string, uf: string): string {
  if (cidade && uf) return `${cidade} / ${uf}`;
  return cidade || uf;
}

function juntarQuadraLote(quadra: string, lote: string, legado: string): string {
  if (quadra && lote) return `Quadra ${quadra} / Lote ${lote}`;
  if (quadra) return `Quadra ${quadra}`;
  if (lote) return `Lote ${lote}`;
  return legado;
}

function rotuloFranqueado(numero: string, nome: string): string {
  if (numero && nome) return `${numero} — ${nome}`;
  return nome || numero;
}

function areaTexto(valor: unknown): string {
  if (valor == null || valor === '') return '';
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return '';
  return String(numero);
}

function procDoCard(row: CardRow, processos: Map<string, ProcRow>): ProcRow | undefined {
  if (row.processo_step_one_id && processos.has(row.processo_step_one_id)) {
    return processos.get(row.processo_step_one_id);
  }
  if (row.projeto_id && processos.has(row.projeto_id)) return processos.get(row.projeto_id);
  return undefined;
}

async function hidratarCards(admin: SupabaseClient, rows: CardRow[]): Promise<CardPortfolioFormulario[]> {
  const procIds = unicos(rows.flatMap((row) => [row.processo_step_one_id, row.projeto_id]));
  const processos = new Map<string, ProcRow>();
  if (procIds.length > 0) {
    const { data } = await admin
      .from('processo_step_one')
      .select(
        'id, produto_modelo_casa, m2_terreno, nome_condominio, quadra, lote, quadra_lote, condominio_id, origem_rede_franqueados_id',
      )
      .in('id', procIds);
    for (const item of data ?? []) processos.set(String((item as ProcRow).id), item as ProcRow);
  }

  const redeIds = unicos(
    rows.flatMap((row) => {
      const proc = procDoCard(row, processos);
      return [row.rede_franqueado_id, proc?.origem_rede_franqueados_id];
    }),
  );
  const condIds = unicos(
    rows.flatMap((row) => {
      const proc = procDoCard(row, processos);
      return [row.condominio_id, proc?.condominio_id];
    }),
  );

  const [redesRes, condsRes] = await Promise.all([
    redeIds.length > 0
      ? admin.from('rede_franqueados').select('id, nome_completo, n_franquia').in('id', redeIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    condIds.length > 0
      ? admin.from('condominios').select('id, nome, cidade, estado').in('id', condIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
  ]);

  const redes = new Map<string, { nome: string; numero: string }>();
  for (const item of redesRes.data ?? []) {
    const row = item as { id: string; nome_completo: string | null; n_franquia: string | null };
    redes.set(row.id, { nome: limpo(row.nome_completo), numero: limpo(row.n_franquia) });
  }
  const condominios = new Map<string, { nome: string; cidade: string; uf: string }>();
  for (const item of condsRes.data ?? []) {
    const row = item as { id: string; nome: string | null; cidade: string | null; estado: string | null };
    condominios.set(row.id, { nome: limpo(row.nome), cidade: limpo(row.cidade), uf: limpo(row.estado) });
  }

  const cards = rows.map((row) => {
    const proc = procDoCard(row, processos);
    const redeId = limpo(row.rede_franqueado_id) || limpo(proc?.origem_rede_franqueados_id) || null;
    const condId = limpo(row.condominio_id) || limpo(proc?.condominio_id) || null;
    const rede = redeId ? redes.get(redeId) : undefined;
    const cond = condId ? condominios.get(condId) : undefined;
    const condominio = limpo(row.nome_condominio) || limpo(proc?.nome_condominio) || cond?.nome || limpo(row.titulo);
    const quadra = limpo(row.quadra) || limpo(proc?.quadra);
    const lote = limpo(row.lote) || limpo(proc?.lote);
    const base = {
      franqueado: rotuloFranqueado(rede?.numero ?? '', rede?.nome ?? ''),
      condominio,
      cidade_uf: juntarCidade(cond?.cidade ?? '', cond?.uf ?? ''),
      quadra_lote: juntarQuadraLote(quadra, lote, limpo(proc?.quadra_lote)),
      casa: limpo(proc?.produto_modelo_casa),
      area_lote: areaTexto(proc?.m2_terreno),
    };
    return {
      id: row.id,
      ...base,
      rotulo: montarRotuloCard(base),
      rede_franqueado_id: redeId,
      numero_franquia: rede?.numero || null,
    };
  });

  return cards.sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
}

export async function buscarCardsPortfolio(admin: SupabaseClient, bruto: string): Promise<CardPortfolioFormulario[]> {
  const termo = termoBuscaPortfolio(bruto);
  if (termo.length < 2) return [];

  const [franks, conds] = await Promise.all([
    admin
      .from('rede_franqueados')
      .select('id')
      .or(`${filtroIlike('nome_completo', termo)},${filtroIlike('n_franquia', termo)}`)
      .limit(30),
    admin
      .from('condominios')
      .select('id')
      .or(`${filtroIlike('nome', termo)},${filtroIlike('cidade', termo)}`)
      .limit(30),
  ]);

  const frankIds = unicos((franks.data ?? []).map((row) => String((row as { id: string }).id)));
  const condIds = unicos((conds.data ?? []).map((row) => String((row as { id: string }).id)));
  const filtros = [
    filtroIlike('titulo', termo),
    filtroIlike('nome_condominio', termo),
    filtroIlike('quadra', termo),
    filtroIlike('lote', termo),
  ];
  if (frankIds.length > 0) filtros.push(`rede_franqueado_id.in.(${frankIds.join(',')})`);
  if (condIds.length > 0) filtros.push(`condominio_id.in.(${condIds.join(',')})`);

  const { data, error } = await admin
    .from('kanban_cards')
    .select(CARD_SELECT)
    .eq('kanban_id', KANBAN_IDS.PORTFOLIO)
    .eq('arquivado', false)
    .or(filtros.join(','))
    .limit(20);

  if (error || !data?.length) return [];
  return hidratarCards(admin, data as CardRow[]);
}

export async function carregarCardPortfolio(admin: SupabaseClient, id: string): Promise<CardPortfolioFormulario | null> {
  const cardId = id.trim();
  if (!UUID_RE.test(cardId)) return null;
  const { data } = await admin
    .from('kanban_cards')
    .select(CARD_SELECT)
    .eq('id', cardId)
    .eq('kanban_id', KANBAN_IDS.PORTFOLIO)
    .eq('arquivado', false)
    .maybeSingle();
  if (!data) return null;
  const lista = await hidratarCards(admin, [data as CardRow]);
  return lista[0] ?? null;
}
