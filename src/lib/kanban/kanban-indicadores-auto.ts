import { createAdminClient } from '@/lib/supabase/admin';
import { KANBAN_IDS, FASE_IDS } from '@/lib/constants/kanban-ids';
export { KANBAN_INDICADORES_MENSAIS_IDS } from './kanban-indicadores-ids';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

/** Indicador semanal: conta cards que entraram em uma fase específica na semana anterior */
interface KanbanIndicadorFaseConfig {
  tipo?: 'fase_entrada'; // default — omitir ou declarar explicitamente
  /** Label para logs */
  label: string;
  /** UUID do indicador em `indicadores` */
  indicadorId: string;
  /** UUID do kanban (funil) */
  kanbanId: string;
  /** UUID da fase que conta como "conversão" */
  faseAlvoId: string;
}

/** Indicador mensal: acumula contagem desde o 1º do mês corrente.
 *  No 1º Monday de cada mês novo, reescreve todas as semanas do mês anterior com o total final. */
interface KanbanIndicadorMensalConfig {
  tipo: 'mensal_acumulado';
  /** Label para logs */
  label: string;
  /** UUID do indicador em `indicadores` */
  indicadorId: string;
  /** UUID do kanban (funil) */
  kanbanId: string;
  /** Campo boolean a verificar em kanban_cards (ex: 'contrato_assinado') */
  campoFlag: string;
  /** Campo timestamp correspondente (ex: 'contrato_assinado_em') */
  campoData: string;
}

type KanbanIndicadorConfig = KanbanIndicadorFaseConfig | KanbanIndicadorMensalConfig;

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
 * Para adicionar indicador de FASE (semanal):
 *   1. Inserir fase e kanban em kanban-ids.ts
 *   2. Criar indicador no banco (migration SQL)
 *   3. Adicionar entrada com tipo?: 'fase_entrada' (ou omitir tipo)
 *
 * Para adicionar indicador MENSAL (acumulado):
 *   1. Criar indicador no banco com meta_unidade = 'mensal'
 *   2. Adicionar entrada com tipo: 'mensal_acumulado', campoFlag e campoData
 */
export const KANBAN_INDICADORES_CONFIG: KanbanIndicadorConfig[] = [
  {
    label: 'Acoplamentos Realizados',
    indicadorId: '304e450a-f63a-4e93-aa06-d1488ad87ebf',
    kanbanId: KANBAN_IDS.ACOPLAMENTO,
    faseAlvoId: FASE_IDS.ACOPLAMENTO_APROVADO,
  },
  {
    label: 'Projetos Executivos Locais Realizados',
    indicadorId: 'b18dadfd-31b9-44f7-a7cb-270f5312e6a6',
    kanbanId: KANBAN_IDS.PROJETOS_LOCAIS,
    faseAlvoId: FASE_IDS.PROJETOS_LOCAIS_CONCLUIDO,
  },
  {
    tipo: 'mensal_acumulado',
    label: 'Contratos Assinados Portfólio',
    indicadorId: '34ea3769-d0c9-4c89-8710-386f48f830a6',
    kanbanId: KANBAN_IDS.PORTFOLIO,
    campoFlag: 'contrato_assinado',
    campoData: 'contrato_assinado_em',
  },
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

/**
 * Retorna todos os Domingos do mês (1-based) de um dado year.
 * Usado para saber quais (semana, semanaAno) reescrever no fechamento do mês.
 */
function getSundaysInMonth(year: number, month: number): Date[] {
  const sundays: Date[] = [];
  const d = new Date(Date.UTC(year, month - 1, 1));
  // Avançar até o primeiro domingo do mês
  while (d.getUTCDay() !== 0) d.setUTCDate(d.getUTCDate() + 1);
  // Coletar todos os domingos enquanto ainda estamos no mesmo mês
  while (d.getUTCMonth() === month - 1) {
    sundays.push(new Date(d));
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return sundays;
}

// ─────────────────────────────────────────────────────────────────────────────
// Contagem de cards na fase alvo (indicadores semanais)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Conta quantos cards distintos do funil `kanbanId` entraram na fase `faseAlvoId`
 * dentro do intervalo [weekStart, weekEnd).
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
// Contagem por campo booleano + timestamp (indicadores mensais)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Conta cards do funil `kanbanId` onde `campoFlag = true` e
 * `campoData` está no intervalo [monthStart, countEnd).
 *
 * Usado para indicadores mensais (ex: contratos_assinado_em no mês corrente).
 */
async function contarCardsPorCampo(
  db: ReturnType<typeof createAdminClient>,
  kanbanId: string,
  campoFlag: string,
  campoData: string,
  monthStart: Date,
  countEnd: Date,
): Promise<number> {
  const { count, error } = await db
    .from('kanban_cards')
    .select('id', { count: 'exact', head: true })
    .eq('kanban_id', kanbanId)
    .eq(campoFlag, true)
    .gte(campoData, monthStart.toISOString())
    .lt(campoData, countEnd.toISOString());

  if (error) {
    console.error('[kanban-indicadores-auto] erro ao contar por campo:', error.message);
    return 0;
  }

  return count ?? 0;
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

/**
 * Reescreve todos os lançamentos do mês `closingMonth/closingYear` com o valor final.
 * Chamado no 1º Monday de cada mês para fechar o mês anterior.
 */
async function reescreverMesFechado(
  db: ReturnType<typeof createAdminClient>,
  indicadorId: string,
  closingYear: number,
  closingMonth: number, // 1-based
  finalCount: number,
): Promise<void> {
  const sundays = getSundaysInMonth(closingYear, closingMonth);
  for (const sunday of sundays) {
    const { week, year: weekYear } = getIsoWeekInfo(sunday);
    await upsertLancamento(db, indicadorId, week, weekYear, finalCount);
    console.log(
      `[kanban-indicadores-auto] reescrita: semana ${week}/${weekYear} → ${finalCount}`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Função principal — chamada pelo cron
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Processa todos os indicadores configurados em KANBAN_INDICADORES_CONFIG.
 *
 * - Indicadores de fase (semanal): conta cards que entraram na fase na semana anterior.
 * - Indicadores mensais: acumula contratos/eventos desde o 1º do mês até domingo passado.
 *   No 1º Monday de novo mês (crossing de mês), reescreve todas as semanas do mês fechado
 *   com o total final.
 *
 * @param ref  Data de referência (default: now). O cron passa `new Date()`.
 */
export async function processarKanbanIndicadores(
  ref: Date = new Date(),
): Promise<ResultadoProcessamento[]> {
  const db = createAdminClient();
  const semanaAnterior = getSemanaAnterior(ref);

  // Para indicadores mensais: domingo anterior ao cron (= último dia da semana processada)
  const prevSunday = new Date(ref);
  prevSunday.setUTCDate(ref.getUTCDate() - 1);
  const prevSundayMonth = prevSunday.getUTCMonth() + 1; // 1-based
  const prevSundayYear  = prevSunday.getUTCFullYear();
  // É um run de fechamento se o Monday (ref) está num mês diferente do Sunday anterior
  const refMonth = ref.getUTCMonth() + 1;
  const isMensalFechamento = refMonth !== prevSundayMonth;

  console.log(
    `[kanban-indicadores-auto] Processando semana ISO ${semanaAnterior.week}/${semanaAnterior.year}` +
    ` (${semanaAnterior.start.toISOString()} – ${semanaAnterior.end.toISOString()})` +
    (isMensalFechamento ? ` | FECHAMENTO MÊS ${prevSundayMonth}/${prevSundayYear}` : ''),
  );

  const resultados: ResultadoProcessamento[] = [];

  for (const cfg of KANBAN_INDICADORES_CONFIG) {
    if (cfg.indicadorId.startsWith('PREENCHER')) {
      console.warn(`[kanban-indicadores-auto] ${cfg.label}: indicadorId não configurado — pulando`);
      resultados.push({
        label: cfg.label,
        indicadorId: cfg.indicadorId,
        semana: semanaAnterior.week,
        semanaAno: semanaAnterior.year,
        count: 0,
        operacao: 'skip',
        erro: 'indicadorId não configurado',
      });
      continue;
    }

    try {
      if (cfg.tipo === 'mensal_acumulado') {
        // ── INDICADOR MENSAL ──────────────────────────────────────────────────
        const monthStart = new Date(Date.UTC(prevSundayYear, prevSundayMonth - 1, 1));
        // countEnd = início do Monday (exclusive) = fim do domingo
        const countEnd = new Date(ref);

        const count = await contarCardsPorCampo(
          db,
          cfg.kanbanId,
          cfg.campoFlag,
          cfg.campoData,
          monthStart,
          countEnd,
        );

        if (isMensalFechamento) {
          // Mês fechado: reescrever TODAS as semanas do mês anterior com total final
          await reescreverMesFechado(db, cfg.indicadorId, prevSundayYear, prevSundayMonth, count);
          console.log(
            `[kanban-indicadores-auto] ${cfg.label}: FECHAMENTO ${prevSundayMonth}/${prevSundayYear} → ${count}`,
          );
          resultados.push({
            label: cfg.label,
            indicadorId: cfg.indicadorId,
            semana: semanaAnterior.week,
            semanaAno: semanaAnterior.year,
            count,
            operacao: 'update',
          });
        } else {
          // Mês em andamento: salvar acumulado como simulação desta semana
          const { week, year: weekYear } = getIsoWeekInfo(prevSunday);
          const operacao = await upsertLancamento(db, cfg.indicadorId, week, weekYear, count);
          console.log(`[kanban-indicadores-auto] ${cfg.label}: acumulado ${count} (semana ${week}/${weekYear}) → ${operacao}`);
          resultados.push({
            label: cfg.label,
            indicadorId: cfg.indicadorId,
            semana: week,
            semanaAno: weekYear,
            count,
            operacao,
          });
        }

      } else {
        // ── INDICADOR SEMANAL (fase entrada) ─────────────────────────────────
        const count = await contarCardsNaFase(
          db,
          cfg.kanbanId,
          cfg.faseAlvoId,
          semanaAnterior.start,
          semanaAnterior.end,
        );

        const operacao = await upsertLancamento(
          db,
          cfg.indicadorId,
          semanaAnterior.week,
          semanaAnterior.year,
          count,
        );

        console.log(`[kanban-indicadores-auto] ${cfg.label}: ${count} → ${operacao}`);
        resultados.push({
          label: cfg.label,
          indicadorId: cfg.indicadorId,
          semana: semanaAnterior.week,
          semanaAno: semanaAnterior.year,
          count,
          operacao,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[kanban-indicadores-auto] ${cfg.label} ERRO:`, msg);
      resultados.push({
        label: cfg.label,
        indicadorId: cfg.indicadorId,
        semana: semanaAnterior.week,
        semanaAno: semanaAnterior.year,
        count: 0,
        operacao: 'skip',
        erro: msg,
      });
    }
  }

  return resultados;
}
