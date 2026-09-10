import { createClient } from '@/lib/supabase/server';
import { tryCreateAdminClient } from '@/lib/supabase/admin';
import {
  mapTemplateRow,
  rowToTemplateConfig,
  TAXA_JUROS_FINANCIAMENTO_ANUAL_PADRAO_FRACAO,
} from '@/lib/loteamento-simulador-template';
import type { LotePublico, SimuladorPublicoView } from '@/app/simulador/[id]/types';

function lotesDeJson(raw: unknown): LotePublico[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const o = item as { id?: unknown; codigo?: unknown; valor?: unknown };
      const id = String(o.id ?? '').trim();
      const codigo = String(o.codigo ?? '').trim();
      const valor = Number(o.valor);
      if (!id || !codigo || !Number.isFinite(valor)) return null;
      return { id, codigo, valor };
    })
    .filter((l): l is LotePublico => l != null);
}

export async function carregarSimuladorPublico(token: string): Promise<SimuladorPublicoView | null> {
  const trimmed = String(token ?? '').trim();
  if (!trimmed) return null;

  const supabase = await createClient();
  const rpc = await supabase.rpc('simulador_publico_carregar', { p_token: trimmed });
  let rawTpl: Record<string, unknown> | null = null;
  let lotes: LotePublico[] = [];

  if (!rpc.error && rpc.data) {
    const pack = rpc.data as { template?: Record<string, unknown>; lotes?: unknown };
    rawTpl = pack.template ?? null;
    lotes = lotesDeJson(pack.lotes);
  } else {
    const admin = tryCreateAdminClient();
    if (!admin) return null;
    const porToken = await admin
      .from('loteamento_simulador_templates')
      .select('*')
      .eq('link_token', trimmed)
      .maybeSingle();
    rawTpl = (porToken.data as Record<string, unknown> | null) ?? null;
    if (rawTpl?.id) {
      const lotesRes = await admin
        .from('lotes_template')
        .select('id, codigo, valor')
        .eq('template_id', String(rawTpl.id))
        .eq('disponivel', true)
        .order('codigo', { ascending: true });
      lotes = lotesDeJson(lotesRes.data);
    }
  }

  if (!rawTpl?.id) return null;
  const template = mapTemplateRow(rawTpl);
  const nomeLoteamento = template.nome?.trim() || 'Loteamento Casa Moní';

  return {
    token: template.link_token || trimmed,
    templateId: template.id,
    nomeLoteamento,
    prazoObraMeses: template.prazo_obra_meses,
    valorLotePadrao: template.valor_lote_padrao,
    taxaFinanciamentoAnual:
      template.taxa_juros_financiamento_anual ?? TAXA_JUROS_FINANCIAMENTO_ANUAL_PADRAO_FRACAO,
    kanbanCardId: template.kanban_card_id,
    redeLoteadorId: template.rede_loteador_id,
    config: rowToTemplateConfig(template),
    lotes,
  };
}
