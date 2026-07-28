/**
 * Backfill one-time — sincroniza campos do painel esquerdo (grupo de sync)
 * para cards vinculados em Funil Portfólio e Funil Pré Obra e Obra (Operações).
 *
 * Uso:
 *   node --env-file=.env.local --import tsx scripts/backfill-vinculos-campos-esquerdo-dev.ts
 *   node --env-file=.env.local --import tsx scripts/backfill-vinculos-campos-esquerdo-dev.ts --dry-run
 */
import { createAdminClient } from '../src/lib/supabase/admin';
import {
  listarKanbanCardIdsSyncGroup,
  sincronizarGrupoSyncFromPrimario,
} from '../src/lib/kanban/card-sync-group';
import { KANBAN_IDS } from '../src/lib/constants/kanban-ids';

const KANBANS_ALVO = [KANBAN_IDS.PORTFOLIO, KANBAN_IDS.OPERACOES];
const dryRun = process.argv.includes('--dry-run');

async function main() {
  const admin = createAdminClient();

  const { data: cards, error } = await admin
    .from('kanban_cards')
    .select('id, titulo, kanban_id')
    .in('kanban_id', KANBANS_ALVO)
    .eq('arquivado', false);

  if (error) throw new Error(error.message);

  const gruposProcessados = new Set<string>();
  let grupos = 0;
  let kanbanTotal = 0;
  let processosTotal = 0;
  let erros = 0;

  console.log(`[backfill] ${(cards ?? []).length} cards ativos em Portfólio + Pré Obra e Obra`);
  if (dryRun) console.log('[backfill] modo dry-run — nenhuma escrita');

  for (const row of cards ?? []) {
    const cardId = String((row as { id?: string }).id ?? '').trim();
    if (!cardId) continue;

    const groupIds = await listarKanbanCardIdsSyncGroup(admin, cardId);
    if (groupIds.length <= 1) continue;

    const groupKey = [...groupIds].sort().join('|');
    if (gruposProcessados.has(groupKey)) continue;
    gruposProcessados.add(groupKey);

    const titulo = String((row as { titulo?: string | null }).titulo ?? '').trim();
    console.log(`\n[grupo ${grupos + 1}] ${groupIds.length} cards — seed ${cardId} (${titulo || 'sem título'})`);

    if (dryRun) {
      grupos++;
      continue;
    }

    const result = await sincronizarGrupoSyncFromPrimario(admin, cardId);
    if (!result.ok) {
      console.error(`  ERRO: ${result.error}`);
      erros++;
      continue;
    }

    grupos++;
    kanbanTotal += result.kanbanAtualizados;
    processosTotal += result.processosAtualizados;
    console.log(`  ok — kanban: ${result.kanbanAtualizados}, processos: ${result.processosAtualizados}`);
  }

  console.log('\n--- resumo ---');
  console.log(`grupos processados: ${grupos}`);
  console.log(`cards kanban atualizados: ${kanbanTotal}`);
  console.log(`processos atualizados: ${processosTotal}`);
  console.log(`erros: ${erros}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
