// src/lib/empreendimento/carregar-empreendimento.ts
import { createClient } from '@/lib/supabase/server';
import { tryCreateAdminClient } from '@/lib/supabase/admin';
import { parsePlanilhaLotesBuffer } from '@/lib/simulador/parse-planilha-lotes';
import type {
  EmpreendimentoPublico,
  LotePublicoEmp,
  ItemCustomizacao,
  OfertaEmpreendimento,
  TemplateConfigPublico,
} from '@/app/empreendimento/[slug]/types';

const BUCKET = 'processo-docs';

// ─────────────────────────────────────────────────────────────────────────────
// Parse do resultado da RPC
// ─────────────────────────────────────────────────────────────────────────────
function parseItem(raw: unknown): ItemCustomizacao | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = String(r.id ?? '').trim();
  const nome = String(r.nome ?? '').trim();
  const categoria = String(r.categoria ?? '');
  if (!id || !nome) return null;
  if (categoria !== 'kit_moni' && categoria !== 'gadget') return null;
  return {
    id,
    categoria: categoria as 'kit_moni' | 'gadget',
    nome,
    descricao: r.descricao != null ? String(r.descricao) : null,
    valor: Number(r.valor ?? 0),
    ordem: Number(r.ordem ?? 0),
  };
}

function parseOferta(raw: unknown): OfertaEmpreendimento | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = String(r.id ?? '').trim();
  if (!id) return null;
  return {
    id,
    nome: r.nome != null ? String(r.nome) : null,
    ordem: Number(r.ordem ?? 0),
    valor_avista: r.valor_avista != null ? Number(r.valor_avista) : null,
    titulo_oferta: r.titulo_oferta != null ? String(r.titulo_oferta) : null,
    produto_modelo: r.produto_modelo != null ? String(r.produto_modelo) : null,
    descricao: r.descricao != null ? String(r.descricao) : null,
  };
}

function parseTemplate(raw: unknown): TemplateConfigPublico | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = String(r.id ?? '').trim();
  if (!id) return null;
  return {
    id,
    link_token: String(r.link_token ?? ''),
    prazo_obra_meses: Number(r.prazo_obra_meses ?? 0),
    valor_lote_padrao: r.valor_lote_padrao != null ? Number(r.valor_lote_padrao) : null,
    taxa_juros_financiamento_anual:
      r.taxa_juros_financiamento_anual != null ? Number(r.taxa_juros_financiamento_anual) : null,
    taxa_juros_parcelado_mes:
      r.taxa_juros_parcelado_mes != null ? Number(r.taxa_juros_parcelado_mes) : null,
    perc_entrada_minima: r.perc_entrada_minima != null ? Number(r.perc_entrada_minima) : null,
    perc_entrada_sugerida: r.perc_entrada_sugerida != null ? Number(r.perc_entrada_sugerida) : null,
    perc_parcela_mensal: r.perc_parcela_mensal != null ? Number(r.perc_parcela_mensal) : null,
    perc_cp: r.perc_cp != null ? Number(r.perc_cp) : null,
    num_meses_cp: r.num_meses_cp != null ? Number(r.num_meses_cp) : null,
    itbi_percentual: r.itbi_percentual != null ? Number(r.itbi_percentual) : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Lotes (da planilha no Storage)
// O valor de acoplamento varia por lote e vem da coluna Acoplamento da planilha.
// ─────────────────────────────────────────────────────────────────────────────
async function carregarLotesDaPlanilha(
  planilhaPath: string,
  planilhaNome: string,
): Promise<LotePublicoEmp[]> {
  const supabase = await createClient();
  const admin = tryCreateAdminClient();

  const clients = [admin, supabase as unknown as typeof admin].filter(Boolean);

  for (const client of clients) {
    if (!client) continue;
    const { data, error } = await client.storage.from(BUCKET).download(planilhaPath);
    if (error || !data) continue;
    try {
      let buf: ArrayBuffer;
      if (data instanceof ArrayBuffer) {
        buf = data;
      } else if (typeof (data as Blob).arrayBuffer === 'function') {
        buf = await (data as Blob).arrayBuffer();
      } else {
        const view = data as Uint8Array;
        buf = view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
      }
      return parsePlanilhaLotesBuffer(buf, planilhaNome).map((l, i) => ({
        id: `planilha:${i}:${l.codigo}`,
        codigo: l.codigo,
        valor: l.valor,
        acoplamento: l.valorAcoplamento,
      }));
    } catch {
      // tenta o próximo client
    }
  }
  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Função principal
// ─────────────────────────────────────────────────────────────────────────────
export async function carregarEmpreendimento(
  slug: string,
): Promise<EmpreendimentoPublico | null> {
  const s = String(slug ?? '').trim();
  if (!s) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('empreendimento_publico_carregar', { p_slug: s });

  if (error || !data || typeof data !== 'object') return null;

  const raw = data as Record<string, unknown>;
  const card_id = String(raw.card_id ?? '').trim();
  if (!card_id) return null;

  const itens_customizacao = Array.isArray(raw.itens_customizacao)
    ? raw.itens_customizacao.map(parseItem).filter((i): i is ItemCustomizacao => i != null)
    : [];
  const ofertas = Array.isArray(raw.ofertas)
    ? raw.ofertas.map(parseOferta).filter((o): o is OfertaEmpreendimento => o != null)
    : [];

  // Carrega lotes da planilha (inclui valor de acoplamento por lote)
  const planilhaPath = raw.planilha_lotes_path != null ? String(raw.planilha_lotes_path) : null;
  const planilhaNome = raw.planilha_lotes_nome != null ? String(raw.planilha_lotes_nome) : 'planilha.xlsx';
  const lotes = planilhaPath
    ? await carregarLotesDaPlanilha(planilhaPath, planilhaNome)
    : [];

  return {
    card_id,
    slug: String(raw.slug ?? s),
    titulo: String(raw.titulo ?? ''),
    descricao: raw.descricao != null ? String(raw.descricao) : null,
    status_imovel: raw.status_imovel != null ? String(raw.status_imovel) : null,
    imagem_principal_path:
      raw.imagem_principal_path != null ? String(raw.imagem_principal_path) : null,
    planilha_lotes_path: planilhaPath,
    planilha_lotes_nome: planilhaNome,
    template: parseTemplate(raw.template),
    itens_customizacao,
    ofertas,
    lotes,
  };
}
