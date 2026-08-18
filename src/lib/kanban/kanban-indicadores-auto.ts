import { createAdminClient } from '@/lib/supabase/admin';
import { KANBAN_IDS, FASE_IDS } from '@/lib/constants/kanban-ids';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

interface KanbanIndicadorConfig {
  /** Label para logs */
  label: string;
  /** UUID do indicador em `indicadores` — preenchido após rodar a migration SQL */
  indicadorId: string;
  /** UUID do kanban (funil) */
  kanbanId: string;
  /** UUID da fase que conta como "conversão" */
  faseAlvoId: string;
}

interface ResultadoProcessamento {
  label: string;
  indicadorId: string;
  semana: number;
  semanaAno: number;
  count: number;
  operacao: 'insert' | 'update' | 'skip';
  erro?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Config — adicionar novos funis aqui
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cada entrada representa um indicador automático vinculado a uma fase de funil.
 * Para adicionar um novo funil:
 *   1. Inserir a fase e o kanban em kanban-ids.ts (se ainda não existir)
 *   2. Criar o indicador no banco (migration SQL)
 *   3. Adicionar uma entrada aqui com o indicadorId retornado pelo INSERT
 */
export const KANBAN_INDICADORES_CONFIG: KanbanIndicadorConfig[] = [
  {
    label: 'Acoplamentos Realizados',
    indicadorId: '304e450a-f63a-4e93-aa06-d1488ad87ebf',
    kanbanId: KANBAN_IDS.ACOPLAMENTO,
    faseAlvoId: FASE_IDS.ACOPLAMENTO_APROVADO,
  },
  // Próximos funis — comentados até as migrations serem rodadas:
  // {
  //   label: 'Portfólio — ...',
  //   indicadorId: 'UUID_DO_INDICADOR',
  //   kanbanId: KANBAN_IDS.PORTFOLIO,
  //   faseAlvoId: FASE_IDS.PORTFOLIO_APROVADO,
  // },
];

// ─────────────────────────────────────────────────────────────────────────────
// ISO Week helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Retorna { week, year } ISO da data fornecida. */
function getIsoWeekInfo(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7; // Dom=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // mover para quinta da semana
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return { week, year: d.getUTCFullYear() };
}

/** Retorna o Date UTC da segunda-feira que inicia a semana ISO (year, week). */
function isoWeekMonday(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4)); // 4 jan sempre em semana 1
  const dayOfWeek = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1 + (week - 1) * 7);
  return monday;
}

/**
 * Dada uma data de referência (geralmente "hoje"),
 * retorna dados da semana ISO *anterior* completa (seg–dom).
 */
export function getSemanaAnterior(ref: Date): {
  week: number;
  year: number;
  start: Date; // seg 00:00 UTC
  end: Date;   // seg 00:00 UTC da semana seguinte (exclusive)
} {
  const umaSemanaAtras = new Date(ref);
  umaSemanaAtras.setUTCDate(ref.getUTCDate() - 7);

  const { week, year } = getIsoWeekInfo(umaSemanaAtras);
  const start = isoWeekMonday(year, week);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);

  return { week, year, start, end };
}

// ─────────────────────────────────────────────────────────────────────────────
// Contagem de cards na fase alvo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Conta quantos cards distintos do funil `kanbanId` entraram na fase `faseAlvoId`
 * dentro do intervalo [weekStart, weekEnd).
 *
 * Fontes:
 *  1. kanban_historico onde detalhe->>'fase_nova_id' = faseAlvoId (inclui avançados E retrocedidos que foram parar lá)
 *  2. kanban_cards atualmente na fase com entered_fase_at no intervalo (cards sem histórico)
 */
async function contarCardsNaFase(
  db: ReturnType<typeof createAdminClient>,
  kanbanId: string,
  faseAlvoId: string,
  weekStart: Date,
  weekEnd: Date,
): Promise<number> {
  const startIso = weekStart.toISOString();
  const endIso   = weekEnd.toISOString();

  // Fonte 1: via kanban_historico
  // Supabase PostgREST suporta .filter('detalhe->>chave', 'eq', valor) para JSONB text
  const { data: histRows, error: histErr } = await db
    .from('kanban_historico')
    .select('card_id, kanban_cards!inner(kanban_id)')
    .filter('detalhe->>fase_nova_id', 'eq', faseAlvoId)
    .gte('criado_em', startIso)
    .lt('criado_em', endIso);

  if (histErr) {
    console.error('[kanban-indicadores-auto] erro ao ler kanban_historico:', histErr.message);
  }

  const cardIds = new Set<string>();

  for (const row of histRows ?? []) {
    const r = row as unknown as { card_id: string; kanban_cards: { kanban_id: string } | { kanban_id: string }[] | null };
    const kc = r.kanban_cards;
    const kanbanIdRow = Array.isArray(kc) ? kc[0]?.kanban_id : kc?.kanban_id;
    if (kanbanIdRow === kanbanId) {
      cardIds.add(r.card_id);
    }
  }

  // Fonte 2: cards que estão AGORA na faseAlvo com entered_fase_at no período
  // (captura cards que nunca tiveram registro no histórico)
  const { data: currRows, error: currErr } = await db
    .from('kanban_cards')
    .select('id')
    .eq('kanban_id', kanbanId)
    .eq('fase_id', faseAlvoId)
    .gte('entered_fase_at', startIso)
    .lt('entered_fase_at', endIso);

  if (currErr) {
    console.error('[kanban-indicadores-auto] erro ao ler kanban_cards:', currErr.message);
  }

  for (const row of currRows ?? []) {
    cardIds.add((row as { id: string }).id);
  }

  return cardIds.size;
}

// ─────────────────────────────────────────────────────────────────────────────
// Upsert em indicador_lancamentos
// ─────────────────────────────────────────────────────────────────────────────

async function upsertLancamento(
  db: ReturnType<typeof createAdminClient>,
  indicadorId: string,
  semana: number,
  semanaAno: number,
  valor: number,
): Promise<'insert' | 'update'> {
  const { data: existing } = await db
    .from('indicador_lancamentos')
    .select('id')
    .eq('indicador_id', indicadorId)
    .eq('semana', semana)
    .eq('semana_ano', semanaAno)
    .maybeSingle();

  if (existing) {
    await db
      .from('indicador_lancamentos')
      .update({ valor: String(valor) })
      .eq('id', (existing as { id: string }).id);
    return 'update';
  }

  await db
    .from('indicador_lancamentos')
    .insert({
      indicador_id: indicadorId,
      semana,
      semana_ano: semanaAno,
      valor: String(valor),
    });
  return 'insert';
}

// ─────────────────────────────────────────────────────────────────────────────
// Função principal — chamada pelo cron
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Processa todos os indicadores configurados em KANBAN_INDICADORES_CONFIG.
 * Para cada um, conta os cards que entraram na fase alvo na semana anterior
 * e persiste o valor em indicador_lancamentos.
 *
 * @param ref  Data de referência (default: now). O cron passa `new Date()`.
 */
export async function processarKanbanIndicadores(
  ref: Date = new Date(),
): Promise<ResultadoProcessamento[]> {
  const db = createAdminClient();
  const semana = getSemanaAnterior(ref);

  console.log(
    `[kanban-indicadores-auto] Processando semana ISO ${semana.week}/${semana.year}` +
    ` (${semana.start.toISOString()} – ${semana.end.toISOString()})`,
  );

  const resultados: ResultadoProcessamento[] = [];

  for (const cfg of KANBAN_INDICADORES_CONFIG) {
    if (cfg.indicadorId === 'PREENCHER_APOS_MIGRATION') {
      console.warn(`[kanban-indicadores-auto] ${cfg.label}: indicadorId não configurado — pulando`);
    resultados.push({
      label: cfg.label,
      indicadorId: cfg.indicadorId,
      semana: semana.week,
      semanaAno: semana.year,
      count: 0,
      operacao: 'skip',
      erro: 'indicadorId não configurado',
    });
    continue;
    }

    try {
      const count = await contarCardsNaFase(
        db,
        cfg.kanbanId,
        cfg.faseAlvoId,
        semana.start,
        semana.end,
      );

      const operacao = await upsertLancamento(
        db,
        cfg.indicadorId,
        semana.week,
        semana.year,
        count,
      );

      console.log(`[kanban-indicadores-auto] ${cfg.label}: ${count} → ${operacao}`);
      resultados.push({
        label: cfg.label,
        indicadorId: cfg.indicadorId,
        semana: semana.week,
        semanaAno: semana.year,
        count,
        operacao,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[kanban-indicadores-auto] ${cfg.label} ERRO:`, msg);
      resultados.push({
        label: cfg.label,
        indicadorId: cfg.indicadorId,
        semana: semana.week,
        semanaAno: semana.year,
        count: 0,
        operacao: 'skip',
        erro: msg,
      });
    }
  }

  return resultados;
}
