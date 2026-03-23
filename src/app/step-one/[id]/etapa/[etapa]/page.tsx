import Link from 'next/link';
import { ETAPAS } from '@/types/domain';
import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import { Etapa1Praca } from '../Etapa1Praca';
import { Etapa2Condominios } from '../Etapa2Condominios';
import { Etapa3Resumo } from '../Etapa3Resumo';
import { Etapa4Casas, type CasaRow } from '../Etapa4Casas';
import { Etapa5Lotes, type LoteRow } from '../Etapa5Lotes';
import { Etapa10BCA } from '../Etapa10BCA';
import { Etapa11PDF, type ResumoProcesso } from '../Etapa11PDF';
import { FinalizarEstudoButton } from '../FinalizarEstudoButton';
import { IrParaStep3Button } from '../IrParaStep3Button';
import { CancelarProcessoButtonEtapa } from '../CancelarProcessoButtonEtapa';
import { getBcaInputs } from '../actions';

interface PageProps {
  params: Promise<{ id: string; etapa: string }>;
}

export default async function EtapaPage({ params }: PageProps) {
  const { id, etapa } = await params;
  const etapaNum = parseInt(etapa, 10);
  if ([8, 9].includes(etapaNum)) redirect(`/step-one/${id}/etapa/7`);
  const etapaInfo = ETAPAS.find((e) => e.id === etapaNum);
  if (!etapaInfo || etapaNum < 1 || etapaNum > 11) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: processo } = await supabase
    .from('processo_step_one')
    .select(
      'id, cidade, estado, ultima_validacao_casas_manuais_em, observacoes_praca, cidade_ibge_cod, anexos_etapa1, pdf_url_etapa1',
    )
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!processo) notFound();

  let etapaProgresso: {
    dados_json?: { narrativa?: string; analise_ibge?: unknown };
    status?: string;
  } | null = null;
  if (etapaNum === 1) {
    const { data } = await supabase
      .from('etapa_progresso')
      .select('dados_json, status')
      .eq('processo_id', id)
      .eq('etapa_id', 1)
      .eq('user_id', user.id)
      .single();
    etapaProgresso = data;
  }

  const isEtapa1 = etapaNum === 1;
  const observacoesPraca = processo?.observacoes_praca ?? '';
  const anexosEtapa1 = (processo?.anexos_etapa1 as { url: string; nome: string }[] | null) ?? [];
  const pdfUrlEtapa1 = processo?.pdf_url_etapa1 ?? null;

  let condominiosEtapa2: {
    id: string;
    nome: string;
    qtd_casas: number | null;
    preco_medio: number | null;
    m2_medio: number | null;
  }[] = [];
  let etapa2Concluida = false;
  if (etapaNum === 2) {
    const { data: condList } = await supabase
      .from('condominios_etapa2')
      .select('id, nome, qtd_casas, preco_medio, m2_medio')
      .eq('processo_id', id)
      .order('created_at', { ascending: true });
    condominiosEtapa2 =
      (condList ?? []).map((c) => ({
        id: c.id as string,
        nome: (c.nome as string) ?? '',
        qtd_casas: (c.qtd_casas as number | null) ?? null,
        preco_medio: (c.preco_medio as number | null) ?? null,
        m2_medio: (c.m2_medio as number | null) ?? null,
      })) ?? [];
    const { data: ep2 } = await supabase
      .from('etapa_progresso')
      .select('status')
      .eq('processo_id', id)
      .eq('etapa_id', 2)
      .eq('user_id', user.id)
      .single();
    etapa2Concluida = ep2?.status === 'concluida';
  }
  let condominiosEtapa3: { id: string; nome: string; ordem: number }[] = [];
  let etapa3Resumo: Record<
    string,
    {
      estoque_casas?: string;
      ticket_lote?: string;
      ticket_casas?: string;
      ticket_casas_m2?: string;
      estimativa_vendidas_ano?: string;
    }
  > = {};
  let etapa3Conclusao: {
    mais_promissores?: string;
    faixa_preco?: string;
    produto_mais_vende?: string;
    erros?: string;
    oportunidade?: string;
  } = {};
  let etapa3Concluida = false;
  if (etapaNum === 3) {
    const { data: condList } = await supabase
      .from('processo_condominios')
      .select('id, nome, ordem')
      .eq('processo_id', id)
      .order('ordem', { ascending: true });
    condominiosEtapa3 = (condList ?? []).map((c) => ({
      id: c.id,
      nome: c.nome,
      ordem: c.ordem ?? 1,
    }));
    const { data: ep3 } = await supabase
      .from('etapa_progresso')
      .select('dados_json, status')
      .eq('processo_id', id)
      .eq('etapa_id', 3)
      .eq('user_id', user.id)
      .single();
    const d3 =
      (ep3?.dados_json as {
        resumo_condominios?: Record<string, unknown>;
        conclusao?: Record<string, string>;
      } | null) ?? {};
    etapa3Resumo = (d3.resumo_condominios ?? {}) as typeof etapa3Resumo;
    etapa3Conclusao = (d3.conclusao ?? {}) as typeof etapa3Conclusao;
    etapa3Concluida = ep3?.status === 'concluida';
  }
  let casas: CasaRow[] = [];
  let casasEscolhidasEtapa5: { id: string; catalogo_casa_id: string }[] = [];
  let catalogoEtapa5: {
    id: string;
    nome: string | null;
    quartos: number | null;
    banheiros: number | null;
    vagas: number | null;
    preco_venda_m2: number | null;
  }[] = [];
  let batalhasEtapa5: {
    casa_escolhida_id: string;
    listing_id: string;
    nota_preco: number | null;
    nota_produto: number | null;
    nota_localizacao: number | null;
    nota_final: number | null;
  }[] = [];
  let lotes: LoteRow[] = [];
  let catalogo: {
    id: string;
    nome: string | null;
    area_m2: number | null;
    quartos: number | null;
    preco_venda: number | null;
    preco_venda_m2: number | null;
  }[] = [];
  let loteEscolhido: {
    cidade: string | null;
    condominio: string | null;
    recuos_permitidos: string | null;
    localizacao_condominio: string | null;
    area_lote_m2: number | null;
    topografia: string | null;
    frente_m: number | null;
    fundo_m: number | null;
    preco: number | null;
    preco_m2: number | null;
  } | null = null;
  let batalhas: {
    listing_casa_id: string;
    catalogo_casa_id: string;
    nota_preco: number | null;
    nota_produto: number | null;
    nota_localizacao: number | null;
  }[] = [];
  let catalogoEscolhidos: { catalogo_casa_id: string; ordem: number }[] = [];

  let loteEscolhidoIdEtapa4: string | null = null;
  if (etapaNum === 4 || etapaNum === 7) {
    const { data } = await supabase
      .from('listings_lotes')
      .select(
        'id, condominio, area_lote_m2, preco, preco_m2, link, valor_condominio, iptu, caracteristicas_condominio, caracteristicas, manual',
      )
      .eq('processo_id', id)
      .order('created_at', { ascending: false });
    lotes = (data ?? []) as LoteRow[];
    const { data: le } = await supabase
      .from('lote_escolhido')
      .select('listing_lote_id')
      .eq('processo_id', id)
      .maybeSingle();
    loteEscolhidoIdEtapa4 = le?.listing_lote_id ?? null;
  }
  let pdfScoreBatalhaUrl: string | null = null;
  if (etapaNum === 5 || etapaNum === 6) {
    const { data } = await supabase
      .from('listings_casas')
      .select(
        'id, cidade, foto_url, status, condominio, localizacao_condominio, quartos, banheiros, vagas, piscina, marcenaria, preco, area_casa_m2, preco_m2, estado, compatibilidade_moni, data_publicacao, data_despublicado, link, manual',
      )
      .eq('processo_id', id)
      .order('created_at', { ascending: false });
    casas = (data ?? []) as CasaRow[];
    const { data: escolhidas } = await supabase
      .from('casas_escolhidas_etapa5')
      .select('id, catalogo_casa_id')
      .eq('processo_id', id);
    casasEscolhidasEtapa5 = (escolhidas ?? []) as typeof casasEscolhidasEtapa5;
    const { data: cat5 } = await supabase
      .from('catalogo_casas')
      .select('id, nome, quartos, banheiros, vagas, preco_venda_m2, area_m2, preco_venda')
      .eq('ativo', true);
    catalogoEtapa5 = (cat5 ?? []) as typeof catalogoEtapa5;
    const { data: batalhas5 } = await supabase
      .from('batalha_casas')
      .select(
        'casa_escolhida_id, listing_id, nota_preco, nota_produto, nota_localizacao, nota_final, atributos_lote_json, preco_dados_json, produto_dados_json',
      )
      .eq('processo_id', id);
    batalhasEtapa5 = (batalhas5 ?? []) as typeof batalhasEtapa5;
    if (etapaNum === 6) {
      const { data: ep6 } = await supabase
        .from('etapa_progresso')
        .select('dados_json')
        .eq('processo_id', id)
        .eq('etapa_id', 6)
        .eq('user_id', user.id)
        .single();
      const d6 = (ep6?.dados_json as { pdf_url?: string } | null) ?? {};
      pdfScoreBatalhaUrl = d6.pdf_url ?? null;
    }
  }
  let etapa10Opcoes: { catalogo_casa_id: string; titulo: string; descricao?: string }[] = [];
  let etapa10BcaInputs: Awaited<ReturnType<typeof getBcaInputs>> = null;
  if (etapaNum === 10) {
    const [ceListRes, catListRes, ep10Res, bcaRes] = await Promise.all([
      supabase
        .from('catalogo_escolhidos')
        .select('catalogo_casa_id, ordem')
        .eq('processo_id', id)
        .order('ordem', { ascending: true }),
      supabase
        .from('catalogo_casas')
        .select('id, nome, area_m2, quartos, preco_venda')
        .eq('ativo', true),
      supabase
        .from('etapa_progresso')
        .select('dados_json')
        .eq('processo_id', id)
        .eq('etapa_id', 10)
        .eq('user_id', user.id)
        .single(),
      getBcaInputs(id),
    ]);
    catalogoEscolhidos = (ceListRes.data ?? []) as typeof catalogoEscolhidos;
    catalogo = (catListRes.data ?? []) as typeof catalogo;
    const dados10 =
      (ep10Res.data?.dados_json as {
        opcoes?: { catalogo_casa_id: string; titulo: string; descricao?: string }[];
      } | null) ?? {};
    etapa10Opcoes = dados10.opcoes ?? [];
    etapa10BcaInputs = bcaRes;
  }
  let resumoEtapa11: ResumoProcesso | null = null;
  let modeloEscolhidoNome11 = '';
  if (etapaNum === 11) {
    const { data: ep1 } = await supabase
      .from('etapa_progresso')
      .select('dados_json')
      .eq('processo_id', id)
      .eq('etapa_id', 1)
      .eq('user_id', user.id)
      .single();
    const narrativa11 = (ep1?.dados_json as { narrativa?: string } | null)?.narrativa ?? '';
    const { data: le11 } = await supabase
      .from('lote_escolhido')
      .select('condominio, area_lote_m2, preco, preco_m2')
      .eq('processo_id', id)
      .single();
    const { data: batList } = await supabase
      .from('batalhas')
      .select('listing_casa_id, catalogo_casa_id, nota_preco, nota_produto, nota_localizacao')
      .eq('processo_id', id);
    const { data: ceList } = await supabase
      .from('catalogo_escolhidos')
      .select('catalogo_casa_id, ordem')
      .eq('processo_id', id)
      .order('ordem', { ascending: true });
    const { data: catList } = await supabase
      .from('catalogo_casas')
      .select('id, nome')
      .eq('ativo', true);
    const { data: ep9 } = await supabase
      .from('etapa_progresso')
      .select('dados_json')
      .eq('processo_id', id)
      .eq('etapa_id', 9)
      .eq('user_id', user.id)
      .single();
    const { data: ep10 } = await supabase
      .from('etapa_progresso')
      .select('dados_json')
      .eq('processo_id', id)
      .eq('etapa_id', 10)
      .eq('user_id', user.id)
      .single();
    const justificativas11 =
      (ep9?.dados_json as { justificativas?: Record<string, string> } | null)?.justificativas ?? {};
    const opcoes10 =
      (ep10?.dados_json as { opcoes?: { titulo: string; descricao?: string }[] } | null)?.opcoes ??
      [];
    const batalhas11 = batList ?? [];
    const ce11 = ceList ?? [];
    const cat11 = catList ?? [];
    const ids = [...ce11].sort((a, b) => a.ordem - b.ordem).map((ce) => ce.catalogo_casa_id);
    const rankingRows = ids.map((catalogoId) => {
      const rows = batalhas11.filter((b) => b.catalogo_casa_id === catalogoId);
      let sum = 0;
      for (const r of rows) {
        sum += (r.nota_preco ?? 0) + (r.nota_produto ?? 0) + (r.nota_localizacao ?? 0);
      }
      const media = rows.length > 0 ? sum / rows.length : 0;
      const casa = cat11.find((c) => c.id === catalogoId);
      return { catalogo_casa_id: catalogoId, nome: casa?.nome ?? '—', media };
    });
    rankingRows.sort((a, b) => b.media - a.media);
    const ranking = rankingRows.map((r, i) => ({
      posicao: i + 1,
      nome: r.nome,
      media: r.media,
      justificativa: justificativas11[r.catalogo_casa_id],
    }));
    modeloEscolhidoNome11 = ranking[0]?.nome ?? '';
    resumoEtapa11 = {
      cidade: processo.cidade ?? '',
      estado: processo.estado ?? null,
      narrativa: narrativa11,
      lote: le11
        ? {
            condominio: le11.condominio,
            area_lote_m2: le11.area_lote_m2,
            preco: le11.preco,
            preco_m2: le11.preco_m2,
          }
        : null,
      ranking,
      bcaOpcoes: opcoes10.map((o) => ({ titulo: o.titulo, descricao: o.descricao })),
    };
  }

  const isStep2Etapa = [6, 7, 10, 11].includes(etapaNum);
  const backHref = isStep2Etapa ? `/step-2/${id}` : `/step-one/${id}`;
  const backLabel = isStep2Etapa ? '← Step 2' : '← Step 1';
  /** No Step 2, exibir número da lista (6–9) em vez do ID interno (7, 6, 10, 11). */
  const STEP2_DISPLAY_NUM: Record<number, number> = { 7: 6, 6: 7, 10: 8, 11: 9 };
  const etapaDisplayNum = isStep2Etapa ? (STEP2_DISPLAY_NUM[etapaNum] ?? etapaNum) : etapaNum;

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white print:hidden">
        <div className="mx-auto flex h-14 max-w-7xl flex-wrap items-center gap-4 px-4">
          <Link href={backHref} className="text-moni-primary hover:underline">
            {backLabel}
          </Link>
          <span className="text-stone-500">/</span>
          <span className="font-medium text-stone-700">
            Etapa {etapaDisplayNum}: {etapaInfo.nome}
          </span>
          {isStep2Etapa && (
            <div className="ml-auto">
              <CancelarProcessoButtonEtapa processoId={id} />
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="card">
          {etapaNum !== 5 && etapaNum !== 6 && (
            <>
              <h1 className="text-xl font-bold text-moni-dark">
                Etapa {etapaDisplayNum} — {etapaInfo.nome}
              </h1>
              <p className="mt-2 text-stone-600">{etapaInfo.descricao}</p>
            </>
          )}

          {isEtapa1 ? (
            <Etapa1Praca
              processoId={id}
              cidade={processo.cidade ?? ''}
              estado={processo.estado}
              initialObservacoes={observacoesPraca}
              initialAnexos={anexosEtapa1}
              pdfUrlEtapa1={pdfUrlEtapa1}
            />
          ) : etapaNum === 2 ? (
            <Etapa2Condominios
              processoId={id}
              condominios={condominiosEtapa2}
              initialConcluida={etapa2Concluida}
            />
          ) : etapaNum === 3 ? (
            <Etapa3Resumo
              processoId={id}
              condominios={condominiosEtapa3}
              initialResumo={etapa3Resumo}
              initialConclusao={etapa3Conclusao}
              initialConcluida={etapa3Concluida}
            />
          ) : etapaNum === 4 ? (
            <Etapa5Lotes
              listagemOnly
              processoId={id}
              lotes={lotes}
              loteEscolhidoId={null}
              cidadeInicial={processo?.cidade ?? ''}
              estadoInicial={processo?.estado ?? ''}
            />
          ) : etapaNum === 7 ? (
            <Etapa5Lotes
              processoId={id}
              lotes={lotes}
              loteEscolhidoId={loteEscolhidoIdEtapa4}
              cidadeInicial={processo?.cidade ?? ''}
              estadoInicial={processo?.estado ?? ''}
            />
          ) : etapaNum === 5 ? (
            <>
              <h1 className="text-xl font-bold text-moni-dark">
                Etapa {etapaDisplayNum} — {etapaInfo.nome}
              </h1>
              <p className="mt-2 text-stone-600">{etapaInfo.descricao}</p>
              <div className="mt-6 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
                <Etapa4Casas
                  listagemOnly
                  processoId={id}
                  casas={casas}
                  cidadeInicial={processo?.cidade ?? ''}
                  estadoInicial={processo?.estado ?? ''}
                  ultimaValidacaoCasasManuaisEm={
                    processo?.ultima_validacao_casas_manuais_em ?? null
                  }
                  casasEscolhidas={casasEscolhidasEtapa5}
                  catalogo={catalogoEtapa5}
                  batalhasIniciais={batalhasEtapa5}
                />
              </div>
            </>
          ) : etapaNum === 6 ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold text-moni-dark">
                    Etapa {etapaDisplayNum} — {etapaInfo.nome}
                  </h1>
                  <p className="mt-2 text-stone-600">{etapaInfo.descricao}</p>
                </div>
                <div
                  id="etapa6-resultado-batalha"
                  className="w-full sm:w-auto sm:min-w-[320px] sm:max-w-[360px]"
                />
              </div>
              <div className="mt-6 rounded-xl border border-stone-200 bg-white shadow-sm">
                <Etapa4Casas
                  resultadoPortalTargetId="etapa6-resultado-batalha"
                  processoId={id}
                  casas={casas}
                  cidadeInicial={processo?.cidade ?? ''}
                  estadoInicial={processo?.estado ?? ''}
                  ultimaValidacaoCasasManuaisEm={
                    processo?.ultima_validacao_casas_manuais_em ?? null
                  }
                  casasEscolhidas={casasEscolhidasEtapa5}
                  catalogo={catalogoEtapa5}
                  batalhasIniciais={batalhasEtapa5}
                  pdfScoreBatalhaUrl={pdfScoreBatalhaUrl}
                />
              </div>
            </>
          ) : etapaNum === 10 ? (
            <Etapa10BCA
              processoId={id}
              catalogoEscolhidos={catalogoEscolhidos}
              catalogo={catalogo}
              initialOpcoes={etapa10Opcoes}
              initialBcaInputs={etapa10BcaInputs}
            />
          ) : etapaNum === 11 && resumoEtapa11 ? (
            <Etapa11PDF
              processoId={id}
              resumo={resumoEtapa11}
              modeloEscolhidoNome={modeloEscolhidoNome11}
            />
          ) : (
            <>
              <p className="mt-4 text-sm text-stone-500">
                Processo: <code className="rounded bg-stone-100 px-1">{id}</code>
              </p>
              <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Conteúdo e formulários desta etapa serão implementados nas próximas sprints.
              </div>
            </>
          )}

          <div className="mt-8 flex flex-wrap gap-3 print:hidden">
            {(() => {
              const isEtapa5Step1 = etapaNum === 5;
              const step2Order = [7, 6, 10, 11];
              const isStep2EtapaNav = step2Order.includes(etapaNum);
              const ids = isStep2EtapaNav ? step2Order : ETAPAS.map((e) => e.id);
              const idx = ids.indexOf(etapaNum);
              const prevId = idx > 0 ? ids[idx - 1] : null;
              const nextId = idx >= 0 && idx < ids.length - 1 ? ids[idx + 1] : null;
              const isUltimaEtapaStep2 = isStep2EtapaNav && nextId == null;
              return (
                <>
                  {prevId != null && (
                    <Link href={`/step-one/${id}/etapa/${prevId}`} className="btn-primary">
                      Etapa anterior
                    </Link>
                  )}
                  {isEtapa5Step1 ? (
                    <FinalizarEstudoButton processoId={id} />
                  ) : nextId != null ? (
                    <Link href={`/step-one/${id}/etapa/${nextId}`} className="btn-primary">
                      Próxima etapa
                    </Link>
                  ) : isUltimaEtapaStep2 ? (
                    <IrParaStep3Button processoId={id} />
                  ) : null}
                </>
              );
            })()}
          </div>
        </div>
      </main>
    </div>
  );
}
