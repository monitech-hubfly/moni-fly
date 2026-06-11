'use server';

import { carregarGruposPreBatalhaKanban } from '@/app/step-one/[id]/etapa/actions';
import {
  agregarCasasConfiguradorDePreBatalha,
  parseConfiguradorCasasValores,
  type CasaConfiguradorRanking,
  type ConfiguradorCasasValoresJson,
} from '@/lib/kanban/configurador-casas-ranking';
import type { FaixaMercado } from '@/lib/kanban/mapa-competidores-condominio';
import { createClient } from '@/lib/supabase/server';

export type ConfiguradorCasasChecklistData =
  | {
      ok: true;
      casas: CasaConfiguradorRanking[];
      faixasAtivas: FaixaMercado[];
      valores: ConfiguradorCasasValoresJson;
    }
  | { ok: false; error: string };

export async function carregarConfiguradorCasasChecklist(
  processoId: string | null | undefined,
  cardId: string,
  itemId?: string | null,
): Promise<ConfiguradorCasasChecklistData> {
  const pid = processoId?.trim();
  const cid = cardId.trim();
  if (!pid || !cid) return { ok: false, error: 'Processo ou card inválido.' };

  const rankingRes = await carregarGruposPreBatalhaKanban({
    cardId: cid,
    processoId: pid,
  });
  if (!rankingRes.ok) return { ok: false, error: rankingRes.error };

  const { casas, faixasAtivas } = agregarCasasConfiguradorDePreBatalha(rankingRes.grupos);

  let valores = parseConfiguradorCasasValores('');
  const iid = itemId?.trim();
  if (iid) {
    const supabase = await createClient();
    const { data: resp } = await supabase
      .from('kanban_fase_checklist_respostas')
      .select('valor')
      .eq('card_id', cid)
      .eq('item_id', iid)
      .maybeSingle();
    valores = parseConfiguradorCasasValores(
      (resp as { valor?: string | null } | null)?.valor ?? '',
    );
  }

  return { ok: true, casas, faixasAtivas, valores };
}
