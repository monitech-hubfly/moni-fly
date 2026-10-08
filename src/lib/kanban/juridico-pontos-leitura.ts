import type { PontoJuridicoRow } from '@/lib/actions/juridico-pontos-actions';
import {
  JURIDICO_PONTO_APLICACOES,
  JURIDICO_PONTO_DECISOES,
  JURIDICO_PONTO_FAQ_STATUS,
} from '@/lib/kanban/juridico-pontos';
import { createClient } from '@/lib/supabase/client';

const COLUNAS_PONTO =
  'id, juridico_card_id, tipo, rodada, ordem, duvida_recebida, resposta, clausula_trecho, solicitacao_alteracao, decisao, texto_final_aprovado, aplicacao_futura, motivo_resposta, faq_status, faq_article_id, repositorio_tipo_id, repositorio_variacao_id, repositorio_nova_variacao_nome, repositorio_nova_variacao_quando_utilizar';

function texto(valor: unknown): string | null {
  const t = String(valor ?? '').trim();
  return t || null;
}

function umDe<T extends string>(valor: unknown, lista: readonly T[]): T | null {
  const t = String(valor ?? '').trim();
  return (lista as readonly string[]).includes(t) ? (t as T) : null;
}

function unicos(ids: Array<string | null>): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

function mapLinha(row: Record<string, unknown>): PontoJuridicoRow {
  return {
    id: String(row.id),
    juridico_card_id: String(row.juridico_card_id),
    tipo: row.tipo === 'alteracao' ? 'alteracao' : 'duvida',
    rodada: Number(row.rodada),
    ordem: Number(row.ordem),
    duvida_recebida: texto(row.duvida_recebida),
    resposta: texto(row.resposta),
    clausula_trecho: texto(row.clausula_trecho),
    solicitacao_alteracao: texto(row.solicitacao_alteracao),
    decisao: umDe(row.decisao, JURIDICO_PONTO_DECISOES),
    texto_final_aprovado: texto(row.texto_final_aprovado),
    aplicacao_futura: umDe(row.aplicacao_futura, JURIDICO_PONTO_APLICACOES),
    motivo_resposta: texto(row.motivo_resposta),
    faq_status: umDe(row.faq_status, JURIDICO_PONTO_FAQ_STATUS),
    faq_article_id: texto(row.faq_article_id),
    faq_pergunta: null,
    faq_slug: null,
    faq_artigo_status: null,
    repositorio_tipo_id: texto(row.repositorio_tipo_id),
    repositorio_variacao_id: texto(row.repositorio_variacao_id),
    repositorio_nova_variacao_nome: texto(row.repositorio_nova_variacao_nome),
    repositorio_nova_variacao_quando_utilizar: texto(row.repositorio_nova_variacao_quando_utilizar),
    repositorio_tipo_nome: null,
    repositorio_variacao_nome: null,
    tem_versao_repositorio: false,
    repositorio_documento_id: null,
  };
}

/**
 * Lê os pontos do card no browser, sem server action.
 * A lista usa só a tabela juridico_pontos. FAQ e Repositório entram depois, e só se o ponto tiver vínculo.
 */
export async function lerPontosJuridicosNoCard(
  cardId: string,
): Promise<{ ok: true; pontos: PontoJuridicoRow[] } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('juridico_pontos')
    .select(COLUNAS_PONTO)
    .eq('juridico_card_id', cardId)
    .order('rodada', { ascending: false })
    .order('ordem', { ascending: true });
  if (error) return { ok: false, error: error.message };

  const pontos = ((data ?? []) as Record<string, unknown>[]).map(mapLinha);
  if (pontos.length === 0) return { ok: true, pontos };

  const faqIds = unicos(pontos.map((ponto) => ponto.faq_article_id));
  const tipoIds = unicos(pontos.map((ponto) => ponto.repositorio_tipo_id));
  const variacaoIds = unicos(pontos.map((ponto) => ponto.repositorio_variacao_id));
  const precisaVersao = tipoIds.length > 0 || variacaoIds.length > 0;

  const [faqs, tipos, variacoes, versoes] = await Promise.all([
    faqIds.length > 0
      ? supabase.from('faq_articles').select('id, question, slug, status').in('id', faqIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
    tipoIds.length > 0
      ? supabase.from('repositorio_tipos').select('id, nome').in('id', tipoIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
    variacaoIds.length > 0
      ? supabase.from('repositorio_variacoes').select('id, nome').in('id', variacaoIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
    precisaVersao
      ? supabase
          .from('repositorio_documentos')
          .select('id, juridico_ponto_id')
          .in(
            'juridico_ponto_id',
            pontos.map((ponto) => ponto.id),
          )
      : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
  ]);

  if (!faqs.error) {
    const porId = new Map(
      ((faqs.data ?? []) as Record<string, unknown>[]).map((artigo) => [String(artigo.id), artigo]),
    );
    for (const ponto of pontos) {
      if (!ponto.faq_article_id) continue;
      const artigo = porId.get(ponto.faq_article_id);
      if (!artigo) continue;
      ponto.faq_pergunta = texto(artigo.question);
      ponto.faq_slug = texto(artigo.slug);
      const status = String(artigo.status ?? '');
      ponto.faq_artigo_status =
        status === 'draft' || status === 'published' || status === 'archived' ? status : null;
    }
  }

  if (!tipos.error) {
    const porId = new Map(
      ((tipos.data ?? []) as Record<string, unknown>[]).map((tipo) => [String(tipo.id), texto(tipo.nome)]),
    );
    for (const ponto of pontos) {
      if (ponto.repositorio_tipo_id) ponto.repositorio_tipo_nome = porId.get(ponto.repositorio_tipo_id) ?? null;
    }
  }

  if (!variacoes.error) {
    const porId = new Map(
      ((variacoes.data ?? []) as Record<string, unknown>[]).map((variacao) => [
        String(variacao.id),
        texto(variacao.nome),
      ]),
    );
    for (const ponto of pontos) {
      if (ponto.repositorio_variacao_id) {
        ponto.repositorio_variacao_nome = porId.get(ponto.repositorio_variacao_id) ?? null;
      }
    }
  }

  if (!versoes.error) {
    const porPonto = new Map<string, string>();
    for (const versao of (versoes.data ?? []) as Record<string, unknown>[]) {
      const pontoId = texto(versao.juridico_ponto_id);
      const docId = texto(versao.id);
      if (pontoId && docId) porPonto.set(pontoId, docId);
    }
    for (const ponto of pontos) {
      const docId = porPonto.get(ponto.id) ?? null;
      ponto.tem_versao_repositorio = Boolean(docId);
      ponto.repositorio_documento_id = docId;
    }
  }

  return { ok: true, pontos };
}
