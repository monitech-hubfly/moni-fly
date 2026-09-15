import { createClient } from '@/lib/supabase/server';
import { tryCreateAdminClient } from '@/lib/supabase/admin';
import {
  mapTemplateRow,
  rowToTemplateConfig,
  TAXA_JUROS_FINANCIAMENTO_ANUAL_PADRAO_FRACAO,
} from '@/lib/loteamento-simulador-template';
import { parsePlanilhaLotesBuffer } from '@/lib/simulador/parse-planilha-lotes';
import type { LotePublico, SimuladorPublicoView } from '@/app/simulador/[id]/types';

const BUCKET_PLANILHA = 'processo-docs';

type ClientComStorage = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        maybeSingle: () => Promise<{ data: unknown; error: { message?: string } | null }>;
      };
    };
  };
  storage: {
    from: (bucket: string) => {
      download: (
        path: string,
      ) => Promise<{ data: Blob | ArrayBuffer | Uint8Array | null; error: { message?: string } | null }>;
    };
  };
};

type PlanilhaRef = { path: string; nome: string };

function planilhaDePack(raw: unknown): PlanilhaRef | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as { path?: unknown; nome?: unknown };
  const path = String(o.path ?? '').trim();
  if (!path) return null;
  const nome = String(o.nome ?? '').trim() || 'planilha.xlsx';
  return { path, nome };
}

async function toArrayBuffer(data: Blob | ArrayBuffer | Uint8Array): Promise<ArrayBuffer> {
  if (data instanceof ArrayBuffer) return data;
  if (typeof Blob !== 'undefined' && data instanceof Blob) return data.arrayBuffer();
  if (typeof (data as Blob).arrayBuffer === 'function') return (data as Blob).arrayBuffer();
  const view = data as Uint8Array;
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
}

function lotesDeLinhasPlanilha(
  buffer: ArrayBuffer,
  nome: string,
): LotePublico[] {
  return parsePlanilhaLotesBuffer(buffer, nome).map((l, i) => ({
    id: `planilha:${i}:${l.codigo}`,
    codigo: l.codigo,
    valor: l.valor,
  }));
}

async function refPlanilhaDoCard(
  client: ClientComStorage,
  cardId: string,
): Promise<PlanilhaRef | null> {
  const { data, error } = await client
    .from('imob_card_modelo')
    .select('planilha_lotes_path, planilha_lotes_nome')
    .eq('card_id', cardId)
    .maybeSingle();
  if (error || !data || typeof data !== 'object') return null;
  const row = data as { planilha_lotes_path?: unknown; planilha_lotes_nome?: unknown };
  const path = String(row.planilha_lotes_path ?? '').trim();
  if (!path) return null;
  const nome = String(row.planilha_lotes_nome ?? '').trim() || 'planilha.xlsx';
  return { path, nome };
}

async function baixarPlanilha(
  client: ClientComStorage,
  ref: PlanilhaRef,
): Promise<LotePublico[] | null> {
  const down = await client.storage.from(BUCKET_PLANILHA).download(ref.path);
  if (down.error || !down.data) return null;
  try {
    const buf = await toArrayBuffer(down.data);
    return lotesDeLinhasPlanilha(buf, ref.nome);
  } catch {
    return null;
  }
}

async function lotesDaPlanilha(
  clients: Array<ClientComStorage | null>,
  cardId: string | null,
  refRpc: PlanilhaRef | null,
): Promise<LotePublico[] | null> {
  const vivos = clients.filter((c): c is ClientComStorage => c != null);
  let ref = refRpc;
  if (!ref) {
    const cid = String(cardId ?? '').trim();
    if (!cid) return null;
    for (const client of vivos) {
      ref = await refPlanilhaDoCard(client, cid);
      if (ref) break;
    }
  }
  if (!ref) return null;

  for (const client of vivos) {
    const lotes = await baixarPlanilha(client, ref);
    if (lotes) return lotes;
  }
  return [];
}

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
  const admin = tryCreateAdminClient();
  const rpc = await supabase.rpc('simulador_publico_carregar', { p_token: trimmed });
  let rawTpl: Record<string, unknown> | null = null;
  let lotes: LotePublico[] = [];
  let planilhaRpc: PlanilhaRef | null = null;

  if (!rpc.error && rpc.data) {
    const pack = rpc.data as { template?: Record<string, unknown>; lotes?: unknown; planilha?: unknown };
    rawTpl = pack.template ?? null;
    lotes = lotesDeJson(pack.lotes);
    planilhaRpc = planilhaDePack(pack.planilha);
  } else {
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

  const daPlanilha = await lotesDaPlanilha(
    [admin as ClientComStorage | null, supabase as unknown as ClientComStorage],
    template.kanban_card_id,
    planilhaRpc,
  );
  if (daPlanilha) lotes = daPlanilha;

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
