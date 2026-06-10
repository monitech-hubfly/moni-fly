'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  addCasaListing,
  updateCasaStatus,
  validarStatusCasasManuais,
  saveCasasEscolhidasEtapa5,
  saveBatalhaCasasEtapa5,
  saveScoreBatalhaPdfUrl,
  getAtributosLoteFromStepOneChecklist,
  autoMarcarChecklistPosRankingPreBatalha,
  type BatalhaCasaRow,
} from './actions';
import {
  ScoreBatalhaPDFContent,
  type ScoreBatalhaRow,
  type PrecoSubNotas,
  type ProdutoSubNotas,
} from './ScoreBatalhaPDFContent';
import {
  ATRIBUTOS_LOTE,
  notaAtributosLote,
  parseAtributosLoteRespostas,
  notaFinalBatalha,
  type AtributosLoteRespostas,
  CATEGORIAS_REFORMA,
  valorInvestimento,
  calcularNotaPrecoComChecklist,
  type CatalogoPrecoRef,
  notaTamanhoM2,
  notaQuartos,
  notaBanheiros,
  notaVagas,
  DESIGN_OPCOES,
  notaIdade,
  notaAmenidades,
  notaProdutoMedia,
  QUARTOS_PADRAO_NOSSA,
  type ChecklistReforma,
} from './REGRAS_BATALHA';
import { resolverTermoBuscaZap } from '@/lib/zap-condominio-busca';
import {
  calcularRankingModelos,
  badgeCompatibilidade,
  formatPrecoAnuncio,
  type CatalogoItem,
  type ResultadoRankingModelo,
} from '@/lib/kanban/pre-batalha-compatibilidade';
import {
  ordenarCasasPorFaixaMercado,
  type FaixaMercado,
} from '@/lib/kanban/mapa-competidores-condominio';

type ProdutoDadosBatalha = {
  designId?: string;
  idade?: number | null;
  banheiros?: number | null;
  vagas?: number | null;
};
import { createClient } from '@/lib/supabase/client';

export type CasaRow = {
  id: string;
  cidade: string | null;
  foto_url: string | null;
  status: string | null;
  condominio: string | null;
  localizacao_condominio: string | null;
  quartos: number | null;
  banheiros: number | null;
  vagas: number | null;
  piscina: boolean | null;
  marcenaria: boolean | null;
  preco: number | null;
  area_casa_m2: number | null;
  preco_m2: number | null;
  estado: string | null;
  compatibilidade_moni: string | null;
  data_publicacao: string | null;
  data_despublicado?: string | null;
  link: string | null;
  manual?: boolean | null;
  faixa?: FaixaMercado;
};

function atributosLoteRespostasVazio(resp: AtributosLoteRespostas): boolean {
  return !ATRIBUTOS_LOTE.some((a) => resp[a.id] === true);
}

export function Etapa4Casas(props: {
  processoId: string;
  casas: CasaRow[];
  cidadeInicial: string;
  estadoInicial: string;
  ultimaValidacaoCasasManuaisEm: string | null;
  casasEscolhidas: { id: string; catalogo_casa_id: string }[];
  catalogo: {
    id: string;
    nome: string | null;
    quartos: number | null;
    banheiros: number | null;
    vagas: number | null;
    preco_venda_m2: number | null;
    area_m2?: number | null;
    preco_venda?: number | null;
  }[];
  batalhasIniciais: {
    casa_escolhida_id: string;
    listing_id: string;
    nota_preco: number | null;
    nota_produto: number | null;
    nota_localizacao: number | null;
    nota_final: number | null;
    atributos_lote_json?: Record<string, boolean> | null;
    preco_dados_json?: unknown;
    produto_dados_json?: unknown;
  }[];
  resultadoPortalTargetId?: string;
  /** Step 1 — apenas listagem (sem modelo/batalha). Step 2 usa false. */
  listagemOnly?: boolean;
  /** Desabilita varredura ZAP, cadastro manual e edição de status. */
  readOnly?: boolean;
  /** Callback após mutação (ex.: recarregar dados no checklist Kanban). */
  onMutate?: () => void;
  /** Pré-preenche o condomínio na varredura ZAP e no cadastro manual (sessão por condomínio no funil). */
  condominioInicial?: string;
  /** Conteúdo entre o botão Buscar e a tabela (ex.: resumo de faixas no checklist). */
  painelAposBuscar?: React.ReactNode;
  modoPreBatalha?: boolean;
  /** URL do PDF Score & Batalha já armazenado na etapa 7 (etapa 6). */
  pdfScoreBatalhaUrl?: string | null;
  custosConstrucaoChecklist?: Record<number, number | null>;
}) {
  const {
    processoId,
    casas,
    cidadeInicial,
    estadoInicial,
    ultimaValidacaoCasasManuaisEm,
    casasEscolhidas,
    catalogo,
    batalhasIniciais,
    resultadoPortalTargetId,
    listagemOnly = false,
    readOnly = false,
    onMutate,
    condominioInicial = '',
    painelAposBuscar,
    modoPreBatalha = false,
    pdfScoreBatalhaUrl = null,
    custosConstrucaoChecklist = {},
  } = props;
  const casasManuais = useMemo(() => casas.filter((c) => c.manual === true), [casas]);
  const precisaAlertaValidacao = useMemo(() => {
    if (casasManuais.length === 0) return false;
    if (!ultimaValidacaoCasasManuaisEm) return true;
    const ultima = new Date(ultimaValidacaoCasasManuaisEm);
    const hoje = new Date();
    const diffDays = Math.floor((hoje.getTime() - ultima.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays > 30;
  }, [casasManuais.length, ultimaValidacaoCasasManuaisEm]);
  const router = useRouter();
  const stepOneAtributosCacheRef = useRef<AtributosLoteRespostas | null | undefined>(undefined);
  const autoMarcadoChecklistPreBatalhaRef = useRef(false);
  const [cidade, setCidade] = useState(cidadeInicial);
  const [estado, setEstado] = useState(estadoInicial);
  const [condominio, setCondominio] = useState(() =>
    listagemOnly ? resolverTermoBuscaZap(condominioInicial) : condominioInicial,
  );
  const [zapError, setZapError] = useState('');
  const [zapLoading, setZapLoading] = useState(false);
  const [zapResult, setZapResult] = useState<{
    inserted: number;
    updated: number;
    despublicados: number;
    itemCount: number;
  } | null>(null);

  const [cidadeManual, setCidadeManual] = useState(cidadeInicial);
  const [estadoManual, setEstadoManual] = useState(estadoInicial);
  const [statusManual, setStatusManual] = useState<'a_venda' | 'despublicado'>('a_venda');
  const [condominioManual, setCondominioManual] = useState(condominioInicial);
  const [enderecoManual, setEnderecoManual] = useState('');
  const [quartos, setQuartos] = useState('');
  const [banheiros, setBanheiros] = useState('');
  const [vagas, setVagas] = useState('');
  const [piscina, setPiscina] = useState(false);
  const [marcenaria, setMarcenaria] = useState(false);
  const [preco, setPreco] = useState('');
  const [areaCasa, setAreaCasa] = useState('');
  const [compatibilidadeMoni, setCompatibilidadeMoni] = useState('');
  const [dataLevantamento, setDataLevantamento] = useState('');
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const precoM2Auto = useMemo(() => {
    const p = preco ? parseFloat(String(preco).replace(/\D/g, '').replace(',', '.')) : NaN;
    const a = areaCasa ? parseFloat(areaCasa.replace(',', '.')) : NaN;
    if (Number.isFinite(p) && Number.isFinite(a) && a > 0) return (p / a).toFixed(2);
    return '';
  }, [preco, areaCasa]);

  const [manualFormOpen, setManualFormOpen] = useState(false);
  const [validandoStatus, setValidandoStatus] = useState(false);

  useEffect(() => {
    setCidade(cidadeInicial);
    setEstado(estadoInicial);
    setCidadeManual(cidadeInicial);
    setEstadoManual(estadoInicial);
  }, [cidadeInicial, estadoInicial]);

  useEffect(() => {
    const c = condominioInicial.trim();
    setCondominio(listagemOnly ? resolverTermoBuscaZap(c) : c);
    setCondominioManual(c);
  }, [condominioInicial, listagemOnly]);

  const campoTexto = listagemOnly ? 'text-[11px] leading-tight' : 'text-sm';
  const campoPadding = listagemOnly ? 'px-2 py-1' : 'px-3 py-2';
  const campoInputClass = `rounded-lg border border-stone-300 ${campoPadding} ${campoTexto} disabled:cursor-not-allowed disabled:opacity-60`;
  const campoLabelClass = listagemOnly
    ? 'text-[10px] font-medium leading-tight text-stone-600'
    : `font-medium text-stone-700 ${campoTexto}`;
  const tabelaTexto = listagemOnly ? 'text-[11px] leading-snug' : 'text-sm';
  const tabelaTh = listagemOnly ? 'px-1.5 py-1 text-left font-medium' : 'p-2 text-left';
  const tabelaTd = listagemOnly ? 'px-1.5 py-1' : 'p-2';

  const ROWS_PER_PAGE = 15;
  const casasExibicao = useMemo(() => {
    if (!listagemOnly) return casas;
    if (!casas.some((c) => c.preco != null)) return casas;
    return ordenarCasasPorFaixaMercado(casas);
  }, [casas, listagemOnly]);
  const contagemPorFaixa = useMemo(() => {
    if (!listagemOnly) return null;
    const m = new Map<FaixaMercado, number>();
    for (const c of casasExibicao) {
      if (c.faixa) m.set(c.faixa, (m.get(c.faixa) ?? 0) + 1);
    }
    return m;
  }, [casasExibicao, listagemOnly]);
  const totalPages = Math.max(1, Math.ceil(casasExibicao.length / ROWS_PER_PAGE));
  const [pageCasas, setPageCasas] = useState(1);
  const casasPaginated = useMemo(() => {
    const start = (pageCasas - 1) * ROWS_PER_PAGE;
    return casasExibicao.slice(start, start + ROWS_PER_PAGE);
  }, [casasExibicao, pageCasas]);
  useEffect(() => setPageCasas(1), [casasExibicao.length]);

  // --- Seção 2: escolha de modelos do catálogo (Pré Batalha: ranking por compatibilidade) ---
  const selectedLimit = modoPreBatalha ? null : 3;

  const [rankingPreBatalha, setRankingPreBatalha] = useState<ResultadoRankingModelo[]>([]);
  const [carregandoRankingPreBatalha, setCarregandoRankingPreBatalha] = useState(false);
  const [atributosLotePreBatalha, setAtributosLotePreBatalha] = useState<AtributosLoteRespostas>(
    {},
  );
  const [catalogoPreBatalha, setCatalogoPreBatalha] = useState<CatalogoItem[]>([]);
  const [rankingCardsExpandidos, setRankingCardsExpandidos] = useState<Set<string>>(new Set());

  const casasIdsKey = useMemo(() => casas.map((c) => c.id).sort().join(','), [casas]);

  const atributosLoteVazio = useMemo(
    () => !ATRIBUTOS_LOTE.some((a) => atributosLotePreBatalha[a.id] === true),
    [atributosLotePreBatalha],
  );

  const catalogoAtivoPreBatalha =
    catalogoPreBatalha.length > 0 ? catalogoPreBatalha : (catalogo as CatalogoItem[]);

  /** Pré Batalha: carrega atributos do lote, catálogo ativo e calcula ranking ao montar. */
  useEffect(() => {
    if (!modoPreBatalha || listagemOnly) return;

    let cancelado = false;
    setCarregandoRankingPreBatalha(true);

    void (async () => {
      try {
        const result = await getAtributosLoteFromStepOneChecklist(processoId);
        if (cancelado) return;

        const atributos = result.ok ? result.atributos : {};
        stepOneAtributosCacheRef.current = atributos;
        setAtributosLotePreBatalha(atributos);

        const supabase = createClient();
        const { data: catRows } = await supabase
          .from('catalogo_casas')
          .select(
            'id, nome, quartos, banheiros, vagas, preco_venda_m2, area_m2, preco_venda, topografia',
          )
          .eq('ativo', true);
        if (cancelado) return;

        const cat: CatalogoItem[] =
          catRows && catRows.length > 0 ? (catRows as CatalogoItem[]) : (catalogo as CatalogoItem[]);
        setCatalogoPreBatalha(cat);

        if (casas.length === 0 || cat.length === 0) {
          setRankingPreBatalha([]);
          return;
        }

        const atributosParaRanking = atributosLoteRespostasVazio(atributos) ? {} : atributos;
        const ranking = calcularRankingModelos(
          casas.map((c) => ({
            id: c.id,
            condominio: c.condominio,
            quartos: c.quartos,
            banheiros: c.banheiros,
            vagas: c.vagas,
            preco: c.preco,
            area_casa_m2: c.area_casa_m2,
            piscina: c.piscina,
            marcenaria: c.marcenaria,
          })),
          cat,
          atributosParaRanking,
        );
        if (!cancelado) setRankingPreBatalha(ranking);
      } finally {
        if (!cancelado) setCarregandoRankingPreBatalha(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [modoPreBatalha, listagemOnly, processoId, casasIdsKey, catalogo]);

  const rankingPreBatalhaIdsKey = useMemo(
    () => rankingPreBatalha.map((r) => r.catalogoId).join(','),
    [rankingPreBatalha],
  );

  useEffect(() => {
    if (rankingPreBatalha[0]) {
      setRankingCardsExpandidos(new Set([rankingPreBatalha[0].catalogoId]));
    } else {
      setRankingCardsExpandidos(new Set());
    }
  }, [rankingPreBatalhaIdsKey]);

  /** Pré Batalha: auto-marca checklist do kanban após ranking calculado (uma vez). */
  useEffect(() => {
    autoMarcadoChecklistPreBatalhaRef.current = false;
  }, [processoId]);

  useEffect(() => {
    if (!modoPreBatalha || listagemOnly || carregandoRankingPreBatalha) return;
    if (rankingPreBatalha.length === 0) return;
    if (autoMarcadoChecklistPreBatalhaRef.current) return;

    autoMarcadoChecklistPreBatalhaRef.current = true;

    void autoMarcarChecklistPosRankingPreBatalha(
      processoId,
      rankingPreBatalha.map((item) => ({
        modelo: item.modelo,
        topografia: item.topografia,
        notaFinal: item.notaFinal,
      })),
    ).then((res) => {
      if (!res.ok) {
        console.warn('[pre-batalha] Falha ao auto-marcar checklist:', res.error);
        autoMarcadoChecklistPreBatalhaRef.current = false;
      }
    });
  }, [
    modoPreBatalha,
    listagemOnly,
    carregandoRankingPreBatalha,
    rankingPreBatalhaIdsKey,
    processoId,
    rankingPreBatalha,
  ]);

  const toggleRankingCard = (catalogoId: string) => {
    setRankingCardsExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(catalogoId)) next.delete(catalogoId);
      else next.add(catalogoId);
      return next;
    });
  };

  const [selectedCatalogoIds, setSelectedCatalogoIds] = useState<string[]>(() =>
    casasEscolhidas.map((c) => c.catalogo_casa_id),
  );
  const [syncPreBatalha, setSyncPreBatalha] = useState(false);

  useEffect(() => {
    if (!modoPreBatalha || listagemOnly || rankingPreBatalha.length === 0) return;
    const ids = rankingPreBatalha.map((m) => m.catalogoId);
    const savedSorted = [...casasEscolhidas.map((c) => c.catalogo_casa_id)].sort().join(',');
    const targetSorted = [...ids].sort().join(',');
    if (savedSorted === targetSorted && casasEscolhidas.length === ids.length) return;

    let cancelado = false;
    setSyncPreBatalha(true);
    void (async () => {
      const result = await saveCasasEscolhidasEtapa5(processoId, ids, { limiteMaximo: null });
      if (cancelado) return;
      setSyncPreBatalha(false);
      if (!result.ok) {
        alert(result.error);
        return;
      }
      setSelectedCatalogoIds(ids);
      router.refresh();
    })();
    return () => {
      cancelado = true;
    };
  }, [
    modoPreBatalha,
    listagemOnly,
    rankingPreBatalha,
    casasEscolhidas,
    processoId,
    router,
  ]);

  const toggleCatalogoSelected = (id: string) => {
    if (modoPreBatalha) return;
    setSelectedCatalogoIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (selectedLimit != null && prev.length >= selectedLimit) return prev;
      return [...prev, id];
    });
  };

  const handleConfirmEscolhidas = async () => {
    const result = await saveCasasEscolhidasEtapa5(processoId, selectedCatalogoIds);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    router.refresh();
  };

  // --- Seção 3: batalha de casas (cada casa do catálogo vs cada anúncio da listagem) ---
  const escolhidasComDados = useMemo(() => {
    if (modoPreBatalha && rankingPreBatalha.length > 0) {
      return rankingPreBatalha
        .map((item, idx) => {
          const ce = casasEscolhidas.find((c) => c.catalogo_casa_id === item.catalogoId);
          if (!ce) return null;
          const catalogoRow =
            catalogoAtivoPreBatalha.find((c) => c.id === item.catalogoId) ?? null;
          if (!catalogoRow) return null;
          return {
            ...ce,
            ordem: idx + 1,
            catalogoRow,
          };
        })
        .filter((ce) => ce != null);
    }

    return casasEscolhidas
      .map((ce, idx) => ({
        ...ce,
        ordem: idx + 1,
        catalogoRow: catalogo.find((c) => c.id === ce.catalogo_casa_id) || null,
      }))
      .filter((ce) => ce.catalogoRow !== null);
  }, [casasEscolhidas, catalogo, catalogoAtivoPreBatalha, modoPreBatalha, rankingPreBatalha]);

  const batalhaByKey = useMemo(() => {
    const map = new Map<
      string,
      {
        nota_preco: number | null;
        nota_produto: number | null;
        nota_localizacao: number | null;
        nota_final: number | null;
      }
    >();
    for (const b of batalhasIniciais) {
      const key = `${b.casa_escolhida_id}__${b.listing_id}`;
      map.set(key, {
        nota_preco: b.nota_preco,
        nota_produto: b.nota_produto,
        nota_localizacao: b.nota_localizacao,
        nota_final: b.nota_final,
      });
    }
    return map;
  }, [batalhasIniciais]);

  const batalhaFullByKey = useMemo(() => {
    const map = new Map<string, (typeof batalhasIniciais)[0]>();
    for (const b of batalhasIniciais) {
      map.set(`${b.casa_escolhida_id}__${b.listing_id}`, b);
    }
    return map;
  }, [batalhasIniciais]);

  /** Atributos do Lote: respostas SIM/NÃO por (casa_escolhida_id, listing_id). Nota = soma dos scores. */
  const [atributosLoteByKey, setAtributosLoteByKey] = useState<
    Record<string, AtributosLoteRespostas>
  >(() => {
    const obj: Record<string, AtributosLoteRespostas> = {};
    batalhasIniciais.forEach((b) => {
      const key = `${b.casa_escolhida_id}__${b.listing_id}`;
      if (b.atributos_lote_json && typeof b.atributos_lote_json === 'object') {
        obj[key] = parseAtributosLoteRespostas(b.atributos_lote_json);
      }
    });
    return obj;
  });

  const diffToScore = (diff: number): number => {
    if (diff <= -2) return -2;
    if (diff === -1) return -1;
    if (diff === 0) return 0;
    if (diff === 1) return 1;
    return 2;
  };

  const calcularNotaPreco = (precoM2Casa: number | null, precoM2Anuncio: number | null): number => {
    if (precoM2Casa == null || precoM2Casa === 0 || precoM2Anuncio == null) return 0;
    const diffPerc = (precoM2Anuncio - precoM2Casa) / precoM2Casa;
    if (diffPerc <= -0.1) return -2;
    if (diffPerc <= -0.05) return -1;
    if (Math.abs(diffPerc) < 0.05) return 0;
    if (diffPerc < 0.1) return 1;
    return 2;
  };

  const calcularNotaProduto = (
    base: { quartos: number | null; banheiros: number | null; vagas: number | null },
    anuncio: CasaRow,
  ): number => {
    const campos: Array<'quartos' | 'banheiros' | 'vagas'> = ['quartos', 'banheiros', 'vagas'];
    const notas: number[] = [];
    for (const campo of campos) {
      const baseVal = base[campo];
      const anuncioVal = anuncio[campo];
      if (baseVal == null || anuncioVal == null) continue;
      const diff = Number(baseVal) - Number(anuncioVal);
      notas.push(diffToScore(diff));
    }
    if (notas.length === 0) return 0;
    const media = notas.reduce((sum, n) => sum + n, 0) / notas.length;
    return Math.round(media);
  };

  const isAtributosLoteEmpty = (resp: AtributosLoteRespostas | undefined): boolean => {
    if (resp === undefined) return true;
    return !ATRIBUTOS_LOTE.some((a) => resp[a.id] === true);
  };

  /** Nota Atributos do Lote para um par (casa_escolhida, listing). Respostas usam ids de ATRIBUTOS_LOTE (= LOTES_DISPONIVEIS_CHECKBOXES). */
  const getNotaAtributosLote = (key: string): number => {
    const resp = atributosLoteByKey[key];
    if (resp && !isAtributosLoteEmpty(resp)) return notaAtributosLote(resp);
    return batalhaByKey.get(key)?.nota_localizacao ?? 0;
  };

  const handleChangeAtributoLote = (key: string, atributoId: string, value: boolean) => {
    setAtributosLoteByKey((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? {}), [atributoId]: value },
    }));
  };

  const [openAtributosKey, setOpenAtributosKey] = useState<string | null>(null);
  const [prefillingAtributosKey, setPrefillingAtributosKey] = useState<string | null>(null);

  const handleOpenAtributosLote = async (key: string) => {
    if (openAtributosKey === key) {
      setOpenAtributosKey(null);
      return;
    }
    setOpenAtributosKey(key);
    if (!isAtributosLoteEmpty(atributosLoteByKey[key])) return;

    setPrefillingAtributosKey(key);
    try {
      if (stepOneAtributosCacheRef.current === undefined) {
        const result = await getAtributosLoteFromStepOneChecklist(processoId);
        stepOneAtributosCacheRef.current = result.ok ? result.atributos : {};
      }
      const prefill = stepOneAtributosCacheRef.current;
      setAtributosLoteByKey((prev) => {
        if (!isAtributosLoteEmpty(prev[key])) return prev;
        if (prefill && Object.keys(prefill).length > 0) {
          return { ...prev, [key]: { ...prefill } };
        }
        return { ...prev, [key]: prev[key] ?? {} };
      });
    } finally {
      setPrefillingAtributosKey(null);
    }
  };

  /** Pré Batalha: aplica atributos do lote escolhido a cada par modelo×anúncio. */
  useEffect(() => {
    if (!modoPreBatalha || listagemOnly || atributosLoteVazio) return;
    if (escolhidasComDados.length === 0 || casas.length === 0) return;

    setAtributosLoteByKey((prev) => {
      const next = { ...prev };
      for (const ce of escolhidasComDados) {
        for (const c of casas) {
          const key = `${ce.id}__${c.id}`;
          if (isAtributosLoteEmpty(next[key])) {
            next[key] = { ...atributosLotePreBatalha };
          }
        }
      }
      return next;
    });
  }, [
    modoPreBatalha,
    listagemOnly,
    atributosLotePreBatalha,
    atributosLoteVazio,
    escolhidasComDados,
    casas,
  ]);

  /** Checklist de reforma: um por listagem (listing_id). Alimenta os 4 sub-itens de Preço. */
  const [reformaChecklistByListingId, setReformaChecklistByListingId] = useState<
    Record<string, ChecklistReforma>
  >(() => {
    const obj: Record<string, ChecklistReforma> = {};
    batalhasIniciais.forEach((b) => {
      const preco = b.preco_dados_json as { checklist?: ChecklistReforma } | undefined;
      if (preco?.checklist && typeof preco.checklist === 'object') {
        obj[b.listing_id] = preco.checklist;
      }
    });
    return obj;
  });
  const [custoConstrucaoByCasaEscolhidaId, setCustoConstrucaoByCasaEscolhidaId] = useState<
    Record<string, number | null | undefined>
  >(() => {
    const obj: Record<string, number | null | undefined> = {};
    batalhasIniciais.forEach((b) => {
      const preco = b.preco_dados_json as { custo_construcao?: number } | undefined;
      if (preco?.custo_construcao != null && obj[b.casa_escolhida_id] === undefined) {
        obj[b.casa_escolhida_id] = preco.custo_construcao;
      }
    });
    return obj;
  });
  /** Produto: design, idade e overrides de banheiros/vagas por (casa_escolhida_id, listing_id). */
  const [produtoDadosByKey, setProdutoDadosByKey] = useState<
    Record<string, ProdutoDadosBatalha>
  >(() => {
    const obj: Record<string, ProdutoDadosBatalha> = {};
    batalhasIniciais.forEach((b) => {
      const prod = b.produto_dados_json as ProdutoDadosBatalha | undefined;
      if (
        prod &&
        (prod.designId != null ||
          prod.idade != null ||
          prod.banheiros != null ||
          prod.vagas != null)
      ) {
        const key = `${b.casa_escolhida_id}__${b.listing_id}`;
        obj[key] = {
          designId: prod.designId,
          idade: prod.idade,
          banheiros: prod.banheiros,
          vagas: prod.vagas,
        };
      }
    });
    return obj;
  });

  const getBanheirosAnuncio = (listing: CasaRow, prodDados: ProdutoDadosBatalha): number | null =>
    prodDados.banheiros ?? listing.banheiros;

  const getVagasAnuncio = (listing: CasaRow, prodDados: ProdutoDadosBatalha): number | null =>
    prodDados.vagas ?? listing.vagas;
  const [openPrecoKey, setOpenPrecoKey] = useState<string | null>(null);
  const [openProdutoKey, setOpenProdutoKey] = useState<string | null>(null);

  const getCustoConstrucaoModelo = (
    ce: (typeof escolhidasComDados)[0],
  ): number | null | undefined => custoConstrucaoByCasaEscolhidaId[ce.id];

  /** Nota Preço: se houver checklist de reforma para a listagem, usa 4 sub-itens; senão usa fórmula antiga (preço/m²). */
  const getNotaPrecoCompleta = (ce: (typeof escolhidasComDados)[0], listing: CasaRow): number => {
    const checklist = reformaChecklistByListingId[listing.id];
    const cat = ce.catalogoRow as CatalogoPrecoRef & { preco_venda_m2: number | null };
    const valorListing = listing.preco ?? null;
    const custo = getCustoConstrucaoModelo(ce);
    if (checklist && valorListing != null) {
      const calc = calcularNotaPrecoComChecklist(cat, checklist, valorListing, custo);
      if (calc) return calc.nota;
    }
    return calcularNotaPreco(cat.preco_venda_m2, listing.preco_m2);
  };

  /** Nota Produto: se houver design ou idade preenchidos, usa 7 sub-itens; senão fórmula antiga (quartos/banheiros/vagas). */
  const getNotaProdutoCompleta = (ce: (typeof escolhidasComDados)[0], listing: CasaRow): number => {
    const key = `${ce.id}__${listing.id}`;
    const dados = produtoDadosByKey[key] ?? {};
    const cat = ce.catalogoRow as {
      quartos: number | null;
      banheiros: number | null;
      vagas: number | null;
      area_m2?: number | null;
    };
    if (dados.designId != null || dados.idade != null) {
      const T = notaTamanhoM2(listing.area_casa_m2, cat.area_m2 ?? null);
      const A = notaAmenidades(listing);
      const Q = notaQuartos(cat.quartos, listing.quartos);
      const B = notaBanheiros(cat.banheiros, getBanheirosAnuncio(listing, dados));
      const V = notaVagas(cat.vagas, getVagasAnuncio(listing, dados));
      const designOpt = DESIGN_OPCOES.find((o) => o.id === dados.designId);
      const D = designOpt?.nota ?? 0;
      const I = notaIdade(dados.idade ?? null);
      return notaProdutoMedia(T, A, Q, B, V, D, I);
    }
    return calcularNotaProduto(cat, listing);
  };

  const calcNotaFinal = (notaAtrib: number, notaPreco: number, notaProduto: number): number =>
    notaFinalBatalha(notaAtrib, notaPreco, notaProduto);

  /** Cores por modelo (seções de colunas na tabela) */
  const CORES_POR_MODELO = [
    'bg-sky-50',
    'bg-emerald-50',
    'bg-amber-50',
    'bg-violet-50',
    'bg-rose-50',
    'bg-cyan-50',
  ] as const;
  const CORES_HEADER_POR_MODELO = [
    'bg-sky-100',
    'bg-emerald-100',
    'bg-amber-100',
    'bg-violet-100',
    'bg-rose-100',
    'bg-cyan-100',
  ] as const;

  /** Ranking por modelo: pontuação total = soma das notas finais. Desempate: Atributos do Lote > Preço > Produto. */
  const rankingPorModelo = useMemo(() => {
    if (escolhidasComDados.length === 0) return [];
    const scores: {
      ce: (typeof escolhidasComDados)[0];
      pontuacaoTotal: number;
      sumAtributos: number;
      sumPreco: number;
      sumProduto: number;
    }[] = [];
    for (const ce of escolhidasComDados) {
      let total = 0;
      let sumAtributos = 0;
      let sumPreco = 0;
      let sumProduto = 0;
      for (const c of casas) {
        const key = `${ce.id}__${c.id}`;
        const notaAtrib = getNotaAtributosLote(key);
        const notaPreco = getNotaPrecoCompleta(ce, c);
        const notaProduto = getNotaProdutoCompleta(ce, c);
        const notaFinal = calcNotaFinal(notaAtrib, notaPreco, notaProduto);
        total += notaFinal;
        sumAtributos += notaAtrib;
        sumPreco += notaPreco;
        sumProduto += notaProduto;
      }
      scores.push({
        ce,
        pontuacaoTotal: Number(total.toFixed(1)),
        sumAtributos,
        sumPreco,
        sumProduto,
      });
    }
    scores.sort((a, b) => {
      if (b.pontuacaoTotal !== a.pontuacaoTotal) return b.pontuacaoTotal - a.pontuacaoTotal;
      if (b.sumAtributos !== a.sumAtributos) return b.sumAtributos - a.sumAtributos;
      if (b.sumPreco !== a.sumPreco) return b.sumPreco - a.sumPreco;
      return b.sumProduto - a.sumProduto;
    });
    return scores;
  }, [
    casas,
    escolhidasComDados,
    atributosLoteByKey,
    batalhaByKey,
    reformaChecklistByListingId,
    produtoDadosByKey,
    custoConstrucaoByCasaEscolhidaId,
  ]);
  const rankingBatalha = useMemo(() => {
    if (escolhidasComDados.length === 0) return [];
    const scores: { casa: CasaRow; notaMedia: number }[] = [];
    for (const c of casas) {
      let soma = 0;
      let count = 0;
      for (const ce of escolhidasComDados) {
        const key = `${ce.id}__${c.id}`;
        const notaAtrib = getNotaAtributosLote(key);
        const notaPreco = getNotaPrecoCompleta(ce, c);
        const notaProduto = getNotaProdutoCompleta(ce, c);
        const notaFinal = calcNotaFinal(notaAtrib, notaPreco, notaProduto);
        if (
          atributosLoteByKey[key] !== undefined ||
          batalhaByKey.get(key)?.nota_localizacao != null ||
          reformaChecklistByListingId[c.id] !== undefined ||
          produtoDadosByKey[key] !== undefined
        ) {
          soma += notaFinal;
          count += 1;
        }
      }
      if (count > 0) scores.push({ casa: c, notaMedia: Number((soma / count).toFixed(1)) });
    }
    scores.sort((a, b) => b.notaMedia - a.notaMedia);
    return scores;
  }, [
    casas,
    escolhidasComDados,
    atributosLoteByKey,
    batalhaByKey,
    reformaChecklistByListingId,
    produtoDadosByKey,
    custoConstrucaoByCasaEscolhidaId,
  ]);

  /** Ranking final por pontuação total = soma das notas finais de cada modelo (para Seção 5). */
  // Mantido apenas se necessário futuramente; atualmente o ranking final detalhado foi removido.

  const handleSalvarBatalha = async () => {
    const rows: BatalhaCasaRow[] = [];
    for (const ce of escolhidasComDados) {
      for (const anuncio of casas) {
        const key = `${ce.id}__${anuncio.id}`;
        const respostas = atributosLoteByKey[key];
        const temReforma = reformaChecklistByListingId[anuncio.id] !== undefined;
        const temProduto = produtoDadosByKey[key] !== undefined;
        const custoConstrucao = getCustoConstrucaoModelo(ce);
        const temCustoConstrucao =
          custoConstrucao != null && Number.isFinite(custoConstrucao) && custoConstrucao > 0;
        if (respostas === undefined && !temReforma && !temProduto && !temCustoConstrucao) continue;
        const notaAtrib =
          respostas != null
            ? notaAtributosLote(respostas)
            : (batalhaByKey.get(key)?.nota_localizacao ?? 0);
        const notaPreco = getNotaPrecoCompleta(ce, anuncio);
        const notaProduto = getNotaProdutoCompleta(ce, anuncio);
        const notaFinal = calcNotaFinal(notaAtrib, notaPreco, notaProduto);
        const checklistReforma = reformaChecklistByListingId[anuncio.id];
        let precoDados: Record<string, unknown> | null = null;
        const catPreco = ce.catalogoRow as CatalogoPrecoRef;
        const valorListing = anuncio.preco ?? 0;
        if (checklistReforma) {
          const calc = calcularNotaPrecoComChecklist(
            catPreco,
            checklistReforma,
            valorListing,
            custoConstrucao,
          );
          if (calc) {
            precoDados = {
              checklist: checklistReforma,
              valor_investimento: valorInvestimento(checklistReforma),
              D: calc.D,
              E: calc.E,
              I: calc.I,
              P: calc.P,
              nota_preco: notaPreco,
              ...(temCustoConstrucao && { custo_construcao: custoConstrucao }),
            };
          }
        } else if (temCustoConstrucao) {
          precoDados = { custo_construcao: custoConstrucao };
        }
        const prodDados = produtoDadosByKey[key];
        let produtoDados: Record<string, unknown> | null = null;
        if (prodDados) {
          const cat = ce.catalogoRow as {
            area_m2?: number | null;
            quartos: number | null;
            banheiros: number | null;
            vagas: number | null;
          };
          const banheirosAnuncio = getBanheirosAnuncio(anuncio, prodDados);
          const vagasAnuncio = getVagasAnuncio(anuncio, prodDados);
          const T = notaTamanhoM2(anuncio.area_casa_m2, cat.area_m2 ?? null);
          const A = notaAmenidades(anuncio);
          const Q = notaQuartos(cat.quartos, anuncio.quartos);
          const B = notaBanheiros(cat.banheiros, banheirosAnuncio);
          const V = notaVagas(cat.vagas, vagasAnuncio);
          const designOpt = DESIGN_OPCOES.find((o) => o.id === prodDados.designId);
          const D = designOpt?.nota ?? 0;
          const I = notaIdade(prodDados.idade ?? null);
          produtoDados = {
            designId: prodDados.designId,
            idade: prodDados.idade,
            ...(prodDados.banheiros != null && { banheiros: prodDados.banheiros }),
            ...(prodDados.vagas != null && { vagas: prodDados.vagas }),
            nota_tamanho: T,
            nota_quartos: Q,
            nota_banheiros: B,
            nota_vagas: V,
            nota_amenidades: A,
            nota_design: D,
            nota_idade: I,
            nota_produto: notaProduto,
          };
        }
        rows.push({
          casa_escolhida_id: ce.id,
          listing_id: anuncio.id,
          nota_preco: notaPreco,
          nota_produto: notaProduto,
          nota_localizacao: notaAtrib,
          nota_final: notaFinal,
          ...(respostas != null && { atributos_lote_json: respostas }),
          ...(precoDados && { preco_dados_json: precoDados }),
          ...(produtoDados && { produto_dados_json: produtoDados }),
        });
      }
    }

    if (rows.length === 0) {
      alert(
        'Preencha pelo menos um Atributos do Lote, Preço (checklist reforma) ou Produto (design/idade) antes de salvar a batalha.',
      );
      return;
    }

    const result = await saveBatalhaCasasEtapa5(processoId, rows);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    router.refresh();
  };

  const handleVarrerZap = async () => {
    setZapError('');
    setZapResult(null);
    setZapLoading(true);

    const city = cidade.trim();
    const state = estado.trim();
    if (!city || !state) {
      setZapError('Preencha cidade e estado.');
      setZapLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/apify-zap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          cidade: city,
          estado: state,
          condominio: condominio.trim() || undefined,
          processoId,
          ...(listagemOnly && condominioInicial.trim()
            ? { condominioVinculo: condominioInicial.trim() }
            : {}),
        }),
      });
      const data = await res.json();

      if (!data.ok) {
        setZapError(data.error ?? 'Erro ao buscar listagens na ZAP.');
        setZapLoading(false);
        return;
      }

      if (data.saved) {
        setZapResult({
          inserted: data.inserted ?? 0,
          updated: data.updated ?? 0,
          despublicados: data.despublicados ?? 0,
          itemCount: data.itemCount ?? 0,
        });
        router.refresh();
        onMutate?.();
      } else {
        setZapError('Resposta inesperada da API (dados não salvos).');
      }
    } catch (err) {
      setZapError(err instanceof Error ? err.message : 'Falha ao chamar a API.');
    } finally {
      setZapLoading(false);
    }
  };

  const handleSubmitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const precoNum = preco
      ? parseFloat(String(preco).replace(/\D/g, '').replace(',', '.'))
      : undefined;
    const areaNum = areaCasa ? parseFloat(areaCasa.replace(',', '.')) : undefined;
    const precoM2FromAuto = precoM2Auto ? parseFloat(String(precoM2Auto).replace(',', '.')) : NaN;
    const precoM2Num = Number.isFinite(precoM2FromAuto)
      ? precoM2FromAuto
      : precoNum != null && areaNum != null && areaNum > 0
        ? precoNum / areaNum
        : undefined;
    const result = await addCasaListing(processoId, {
      cidade: cidadeManual.trim() || undefined,
      estado: estadoManual.trim().slice(0, 2).toUpperCase() || undefined,
      status: statusManual,
      condominio: condominioManual || undefined,
      localizacao_condominio: enderecoManual.trim() || undefined,
      quartos: quartos ? parseInt(quartos, 10) : undefined,
      banheiros: banheiros ? parseInt(banheiros, 10) : undefined,
      vagas: vagas ? parseInt(vagas, 10) : undefined,
      piscina,
      marcenaria,
      preco: precoNum,
      area_casa_m2: areaNum,
      preco_m2: precoM2Num,
      compatibilidade_moni: compatibilidadeMoni.trim() || undefined,
      data_coleta: dataLevantamento || undefined,
      link: link || undefined,
    });
    setLoading(false);
    if (result.ok) {
      router.refresh();
      onMutate?.();
      setCidadeManual(cidadeInicial);
      setEstadoManual(estadoInicial);
      setCondominioManual(condominioInicial.trim());
      setEnderecoManual('');
      setQuartos('');
      setBanheiros('');
      setVagas('');
      setPreco('');
      setAreaCasa('');
      setCompatibilidadeMoni('');
      setDataLevantamento('');
      setLink('');
      setPiscina(false);
      setMarcenaria(false);
      setStatusManual('a_venda');
    } else setError(result.error);
  };

  const handleStatusChange = async (casaId: string, status: 'a_venda' | 'despublicado') => {
    const result = await updateCasaStatus(casaId, status);
    if (result.ok) {
      router.refresh();
      onMutate?.();
    }
  };

  const handleValidarStatusCasasManuais = async () => {
    setValidandoStatus(true);
    const result = await validarStatusCasasManuais(processoId);
    setValidandoStatus(false);
    if (result.ok) {
      router.refresh();
      onMutate?.();
    }
  };

  const labelCasa = (c: CasaRow) =>
    [c.condominio ?? 'Anúncio', c.localizacao_condominio].filter(Boolean).join(' · ') ||
    c.id.slice(0, 8);

  const resultCardNode = (
    <div className="w-full overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm sm:sticky sm:top-4 sm:w-auto sm:min-w-[320px] sm:max-w-[400px]">
      <div className="p-3">
        {escolhidasComDados.length === 0 ? (
          <p className="text-sm italic text-stone-500">
            {modoPreBatalha
              ? carregandoRankingPreBatalha
                ? 'Calculando ranking dos modelos…'
                : syncPreBatalha
                  ? 'Sincronizando modelos ranqueados…'
                  : casas.length === 0
                    ? 'Nenhum anúncio ZAP encontrado. Execute a varredura no Mapa de Competidores primeiro.'
                    : 'Aguardando catálogo para ranquear os modelos.'
              : 'Selecione modelos e confirme para habilitar a batalha.'}
          </p>
        ) : rankingPorModelo.length === 0 ? (
          <p className="text-sm italic text-stone-500">
            Preencha as notas de localização na tabela e salve a batalha para ver o ranking.
          </p>
        ) : (
          <div className="flex gap-3">
            {/* Quadro 1: melhor modelo */}
            <div className="min-w-0 flex-1 shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">
                Melhor modelo
              </p>
              <p
                className="mt-0.5 truncate font-semibold text-stone-900"
                title={(rankingPorModelo[0].ce.catalogoRow as { nome: string | null }).nome ?? ''}
              >
                {(rankingPorModelo[0].ce.catalogoRow as { nome: string | null }).nome ??
                  `Casa ${rankingPorModelo[0].ce.ordem}`}
              </p>
              <p className="mt-1 text-2xl font-bold text-emerald-700">
                {rankingPorModelo[0].pontuacaoTotal}
              </p>
              <p className="text-xs text-stone-500">pontuação total</p>
            </div>
            {/* Quadro 2: demais modelos (ranking) */}
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="mb-1 text-xs font-medium text-stone-500">Demais modelos</p>
              <ul className="max-h-32 space-y-1 overflow-y-auto pr-1">
                {rankingPorModelo.slice(1).map((item, i) => {
                  const nome =
                    (item.ce.catalogoRow as { nome: string | null }).nome ??
                    `Casa ${item.ce.ordem}`;
                  return (
                    <li
                      key={item.ce.id}
                      className="flex items-baseline justify-between gap-2 text-sm text-stone-600"
                    >
                      <span className="truncate" title={nome}>
                        {i + 2}. {nome}
                      </span>
                      <span className="shrink-0 font-medium tabular-nums text-stone-800">
                        {item.pontuacaoTotal}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const pdfRef = useRef<HTMLDivElement>(null);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  /** Dados para o PDF Score & Batalha: uma linha por competidor (casa), com notas salvas do primeiro modelo. */
  const pdfRows = useMemo((): ScoreBatalhaRow[] => {
    if (rankingBatalha.length === 0 || escolhidasComDados.length === 0) return [];
    const primeiroModelo = escolhidasComDados[0];
    return rankingBatalha.map(({ casa, notaMedia }) => {
      const key = `${primeiroModelo.id}__${casa.id}`;
      const saved = batalhaFullByKey.get(key);

      const notaPreco =
        saved?.nota_preco ?? getNotaPrecoCompleta(primeiroModelo, casa);
      const notaProduto =
        saved?.nota_produto ?? getNotaProdutoCompleta(primeiroModelo, casa);
      const notaAtrib =
        saved?.nota_localizacao ?? getNotaAtributosLote(key);
      const notaFinal =
        saved?.nota_final ??
        calcNotaFinal(notaAtrib, notaPreco, notaProduto);

      const precoJson = saved?.preco_dados_json as Record<string, unknown> | undefined;
      const precoSub: PrecoSubNotas | null =
        precoJson && (precoJson.D != null || precoJson.E != null)
          ? {
              D: precoJson.D as number | null,
              E: precoJson.E as number | null,
              I: precoJson.I as number | null,
              P: precoJson.P as number | null,
            }
          : null;

      const prodJson = saved?.produto_dados_json as Record<string, unknown> | undefined;
      const produtoSub: ProdutoSubNotas | null =
        prodJson &&
        (prodJson.nota_tamanho != null ||
          prodJson.nota_quartos != null ||
          prodJson.nota_banheiros != null)
          ? {
              nota_tamanho: prodJson.nota_tamanho as number | null,
              nota_amenidades: prodJson.nota_amenidades as number | null,
              nota_quartos: prodJson.nota_quartos as number | null,
              nota_banheiros: prodJson.nota_banheiros as number | null,
              nota_vagas: prodJson.nota_vagas as number | null,
              nota_design: prodJson.nota_design as number | null,
              nota_idade: prodJson.nota_idade as number | null,
            }
          : null;

      const resultado: 'G' | 'E' | 'P' = notaMedia >= 1 ? 'G' : notaMedia <= -1 ? 'P' : 'E';
      const precoNum = casa.preco != null ? casa.preco / 1e6 : 0;
      const precoLabel = precoNum > 0 ? `R$ ${precoNum.toFixed(2).replace('.', ',')} MM` : '—';
      return {
        casa: { id: casa.id, foto_url: casa.foto_url, preco: casa.preco },
        precoLabel,
        notaPreco,
        notaProduto,
        notaLocalizacao: notaAtrib,
        notaFinal: Number(notaFinal.toFixed(1)),
        resultado,
        precoSub,
        produtoSub,
      };
    });
  }, [rankingBatalha, escolhidasComDados, batalhaFullByKey, atributosLoteByKey, batalhaByKey, reformaChecklistByListingId, produtoDadosByKey]);

  const handleGerarPdf = () => {
    if (pdfRows.length === 0) return;
    setGerandoPdf(true);
  };

  // Quando o overlay do PDF está visível, capturamos após o paint para evitar PDF em branco
  useEffect(() => {
    if (!gerandoPdf || pdfRows.length === 0) return;
    const runCapture = async () => {
      const el = pdfRef.current;
      if (!el) {
        setGerandoPdf(false);
        return;
      }
      try {
        const html2pdf = (await import('html2pdf.js')).default;
        const blob = await html2pdf()
          .set({
            margin: 10,
            filename: 'score-batalha.pdf',
            image: { type: 'jpeg', quality: 0.95 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          })
          .from(el)
          .outputPdf('blob');
        const supabase = createClient();
        const bucket = 'processo-docs';
        const path = `${processoId}/score-batalha.pdf`;
        const { error: uploadErr } = await supabase.storage.from(bucket).upload(path, blob, {
          contentType: 'application/pdf',
          upsert: true,
        });
        if (uploadErr) {
          alert(
            'Erro ao enviar o PDF: ' +
              uploadErr.message +
              '. Verifique se o bucket "' +
              bucket +
              '" existe no Supabase.',
          );
        } else {
          const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
          const result = await saveScoreBatalhaPdfUrl(processoId, urlData.publicUrl);
          if (!result.ok) alert(result.error);
          else router.refresh();
        }
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Erro ao gerar o PDF.');
      } finally {
        setGerandoPdf(false);
      }
    };
    const t = setTimeout(runCapture, 400);
    return () => clearTimeout(t);
  }, [gerandoPdf, processoId, pdfRows.length]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const portalTarget =
    mounted && resultadoPortalTargetId && typeof document !== 'undefined'
      ? document.getElementById(resultadoPortalTargetId)
      : null;

  return (
    <>
      {!listagemOnly && resultadoPortalTargetId && portalTarget
        ? createPortal(resultCardNode, portalTarget)
        : null}
      {!listagemOnly && !resultadoPortalTargetId && (
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:justify-end">
          <div className="hidden flex-1 sm:block" aria-hidden />
          {resultCardNode}
        </div>
      )}
      <div className={resultadoPortalTargetId ? 'space-y-8 p-4 sm:p-6' : 'mt-6 space-y-8'}>
        {/* Bloco Varrer ZAP */}
        <section className={`space-y-3 rounded-xl border border-stone-200 bg-stone-50 ${listagemOnly ? 'p-3' : 'p-4'}`}>
          <div className={`grid sm:grid-cols-3 ${listagemOnly ? 'gap-2' : 'gap-3'}`}>
            <label className="grid gap-1">
              <span className={campoLabelClass}>Cidade</span>
              <input
                type="text"
                placeholder="Ex.: Salto"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                disabled={readOnly}
                className={campoInputClass}
              />
            </label>
            <label className="grid gap-1">
              <span className={campoLabelClass}>Estado</span>
              <input
                type="text"
                placeholder="Ex.: SP"
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                disabled={readOnly}
                className={campoInputClass}
                maxLength={2}
              />
            </label>
            <label className="grid gap-1">
              <span className={campoLabelClass}>Condomínio</span>
              <input
                type="text"
                placeholder={listagemOnly ? 'Nome do condomínio' : 'Condomínio (opcional)'}
                value={condominio}
                onChange={(e) => setCondominio(e.target.value)}
                disabled={readOnly}
                className={campoInputClass}
              />
            </label>
          </div>
          {listagemOnly &&
          condominioInicial.trim() &&
          condominio.trim().toLowerCase() !== condominioInicial.trim().toLowerCase() ? (
            <p className={`${campoTexto} text-stone-500`}>
              Termo na ZAP para &quot;{condominioInicial.trim()}&quot; — ajuste se necessário.
            </p>
          ) : null}
          {zapLoading ? (
            <p className={`rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700 ${campoTexto}`}>
              Buscando imóveis no ZAP via Apify… pode levar até 4 minutos. Não feche a página.
            </p>
          ) : null}
          {zapError ? (
            <div
              className={`rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 ${campoTexto}`}
              role="alert"
            >
              <strong>Erro ao varrer ZAP:</strong> {zapError}
            </div>
          ) : null}
          {zapResult ? (
            zapResult.itemCount === 0 ? (
              <p
                className={`rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 ${campoTexto}`}
              >
                Nenhum imóvel encontrado na ZAP com estes filtros (casas/sobrados acima de R$
                4.000.000). Confira se o termo do condomínio corresponde ao bairro/loteamento na
                ZAP ou cadastre manualmente.
              </p>
            ) : (
              <p className={`${campoTexto} text-green-700`}>
                {zapResult.itemCount} {zapResult.itemCount === 1 ? 'imóvel' : 'imóveis'} na ZAP —
                inseridos: {zapResult.inserted}, atualizados: {zapResult.updated}, marcados
                despublicados: {zapResult.despublicados}.
              </p>
            )
          ) : null}
          <button
            type="button"
            onClick={handleVarrerZap}
            disabled={zapLoading || readOnly}
            className={`btn-primary disabled:cursor-not-allowed disabled:opacity-60 ${
              listagemOnly ? '!px-2.5 !py-1 !text-[11px] !font-normal' : 'text-sm'
            }`}
          >
            {zapLoading ? 'Buscando…' : 'Buscar'}
          </button>
        </section>

        {painelAposBuscar}

        {/* Alerta mensal: validar status das casas manuais */}
        {casasManuais.length > 0 && precisaAlertaValidacao && (
          <div
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4"
            role="alert"
          >
            <p className="text-sm text-amber-900">
              <strong>Validação mensal:</strong> Você tem {casasManuais.length} casa(s)
              cadastrada(s) manualmente. Confira se o status (à venda / despublicado) ainda está
              correto.
              {ultimaValidacaoCasasManuaisEm ? (
                <>
                  {' '}
                  Última validação:{' '}
                  {new Date(ultimaValidacaoCasasManuaisEm).toLocaleDateString('pt-BR')}.
                </>
              ) : (
                ' Nenhuma validação registrada ainda.'
              )}
            </p>
            <button
              type="button"
              onClick={handleValidarStatusCasasManuais}
              disabled={validandoStatus || readOnly}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {validandoStatus ? 'Salvando…' : 'Validar status'}
            </button>
          </div>
        )}

        {/* Seção 1 — Listagem (+ opcional: escolha dos 3 modelos e batalha) */}
        {modoPreBatalha && !listagemOnly && casas.length === 0 ? (
          <div
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            role="status"
          >
            Nenhum anúncio ZAP encontrado. Execute a varredura no Mapa de Competidores primeiro.
          </div>
        ) : null}
        {casas.length > 0 && (
          <section className="overflow-hidden rounded-xl border border-stone-200">
            {modoPreBatalha ? (
              <div className="flex flex-wrap items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2">
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-300">
                  Pré Batalha
                </span>
                <span className="text-xs text-amber-900/90">
                  Ranqueie todos os modelos Moní por compatibilidade com a listagem (alta → baixa)
                  e aplique Atributos do Lote + Preço + Produto. Nota final = soma dos três eixos;
                  desempate: Lote &gt; Preço &gt; Produto.
                </span>
              </div>
            ) : null}
            {modoPreBatalha && !listagemOnly ? (
              <div className="border-b border-stone-200 bg-stone-50 px-4 py-4">
                {atributosLoteVazio ? (
                  <p
                    className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
                    role="status"
                  >
                    Atributos do lote não preenchidos — nota de localização zerada. Preencha a fase
                    Lotes Disponíveis.
                  </p>
                ) : null}
                {carregandoRankingPreBatalha ? (
                  <div className="flex items-center gap-2 text-sm text-stone-500">
                    <span
                      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-stone-300 border-t-amber-600"
                      aria-hidden
                    />
                    Calculando ranking…
                  </div>
                ) : syncPreBatalha ? (
                  <p className="text-sm text-stone-500">Sincronizando ranking…</p>
                ) : rankingPreBatalha.length === 0 ? (
                  <p className="text-sm text-stone-500">Nenhum modelo no catálogo ativo.</p>
                ) : (
                  <PreBatalhaRankingCards
                    ranking={rankingPreBatalha}
                    expandedIds={rankingCardsExpandidos}
                    onToggle={toggleRankingCard}
                  />
                )}
              </div>
            ) : null}
            {/* Escolher 3 do catálogo — Step 2 clássico (não Pré Batalha) */}
            {!listagemOnly && !modoPreBatalha && catalogo.length > 0 && (
              <div className="border-b border-stone-200 bg-stone-50 px-4 py-3">
                <p className="mb-2 text-sm font-medium text-stone-800">
                  Escolher até 3 modelos do catálogo para batalhar com a listagem abaixo:
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  {catalogo.map((mod) => (
                    <label
                      key={mod.id}
                      className="flex cursor-pointer items-center gap-1.5 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCatalogoIds.includes(mod.id)}
                        onChange={() => toggleCatalogoSelected(mod.id)}
                        disabled={
                          !selectedCatalogoIds.includes(mod.id) &&
                          selectedLimit != null &&
                          selectedCatalogoIds.length >= selectedLimit
                        }
                        className="rounded"
                      />
                      <span>{mod.nome ?? mod.id.slice(0, 8)}</span>
                      {mod.preco_venda_m2 != null && (
                        <span className="text-xs text-stone-500">
                          R$ {mod.preco_venda_m2.toLocaleString('pt-BR')}/m²
                        </span>
                      )}
                    </label>
                  ))}
                  <span className="text-sm text-stone-500">
                    {selectedCatalogoIds.length} / {selectedLimit} selecionados
                  </span>
                  <button
                    type="button"
                    onClick={handleConfirmEscolhidas}
                    disabled={selectedCatalogoIds.length === 0}
                    className="btn-primary text-sm disabled:pointer-events-none disabled:opacity-60"
                  >
                    Confirmar seleção
                  </button>
                </div>
              </div>
            )}
            {!listagemOnly && escolhidasComDados.length > 0 && (
              <div className="border-b border-stone-200 bg-stone-50 px-4 py-3">
                <button
                  type="button"
                  onClick={handleSalvarBatalha}
                  className="btn-primary text-sm"
                >
                  Salvar batalha
                </button>
                <button
                  type="button"
                  onClick={handleGerarPdf}
                  disabled={gerandoPdf || pdfRows.length === 0}
                  className="btn-primary ml-2 text-sm"
                >
                  {gerandoPdf ? 'Gerando PDF…' : 'Gerar e guardar PDF'}
                </button>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className={`w-full min-w-[900px] ${tabelaTexto}`}>
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-100">
                    <th className={tabelaTh}>Cidade</th>
                    <th className={tabelaTh}>Fotos</th>
                    <th className={tabelaTh}>Status</th>
                    <th className={tabelaTh}>Condomínio</th>
                    <th className={tabelaTh}>Endereço</th>
                    <th className={tabelaTh}>Quartos</th>
                    <th className={tabelaTh}>Banheiros</th>
                    <th className={tabelaTh}>Vagas</th>
                    <th className={tabelaTh}>Piscina</th>
                    <th className={tabelaTh}>Móveis planej.</th>
                    <th className={tabelaTh}>Preço</th>
                    <th className={tabelaTh}>m²</th>
                    <th className={tabelaTh}>R$/m²</th>
                    <th className={tabelaTh}>Estado</th>
                    <th className={tabelaTh}>Data criação ZAP</th>
                    <th className={tabelaTh}>Duração anúncio</th>
                    <th className={tabelaTh}>Listing</th>
                    {!listagemOnly &&
                      escolhidasComDados.map((ce, idx) => {
                        const cat = ce.catalogoRow as { nome: string | null };
                        const bg = CORES_HEADER_POR_MODELO[idx % CORES_HEADER_POR_MODELO.length];
                        return (
                          <th
                            key={ce.id}
                            colSpan={4}
                            className={`border-l border-stone-200 p-2 text-center ${bg} text-stone-800`}
                            title={`Modelo ${ce.ordem}: ${cat.nome ?? ''}`}
                          >
                            {cat.nome ?? `Casa ${ce.ordem}`}
                          </th>
                        );
                      })}
                  </tr>
                  {!listagemOnly && escolhidasComDados.length > 0 && (
                    <tr className="border-b border-stone-200 bg-stone-100">
                      {/* Espaço embaixo das colunas fixas da listagem */}
                      <th colSpan={17} className="p-0" aria-hidden />
                      {escolhidasComDados.map((ce, idx) => {
                        const bg = CORES_HEADER_POR_MODELO[idx % CORES_HEADER_POR_MODELO.length];
                        return (
                          <React.Fragment key={ce.id}>
                            <th
                              className={`border-l border-stone-200 p-1 px-2 text-center ${bg} min-w-[70px] text-xs font-medium`}
                            >
                              Nota Preço
                            </th>
                            <th
                              className={`min-w-[70px] p-1 px-2 text-center text-xs font-medium ${bg}`}
                            >
                              Nota Produto
                            </th>
                            <th
                              className={`p-1 px-2 text-center ${bg} min-w-[70px] text-xs font-medium`}
                              title="Atributos do Lote"
                            >
                              Atrib. Lote
                            </th>
                            <th
                              className={`p-1 px-2 text-center ${bg} min-w-[70px] text-xs font-medium`}
                            >
                              Nota Final
                            </th>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  )}
                </thead>
                <tbody>
                  {casasPaginated.map((c, idx) => {
                    const prevFaixa = idx > 0 ? casasPaginated[idx - 1]?.faixa : undefined;
                    const showFaixaHeader =
                      listagemOnly && c.faixa != null && (idx === 0 || c.faixa !== prevFaixa);
                    const qtdFaixa =
                      showFaixaHeader && c.faixa && contagemPorFaixa
                        ? (contagemPorFaixa.get(c.faixa) ?? 0)
                        : 0;
                    const colCountListagem = 17;
                    const colCountBatalha =
                      colCountListagem + escolhidasComDados.length * 4;
                    return (
                    <React.Fragment key={c.id}>
                    {showFaixaHeader ? (
                      <tr className="border-b border-stone-200 bg-stone-50/90">
                        <td
                          colSpan={listagemOnly ? colCountListagem : colCountBatalha}
                          className={`${tabelaTd} py-1.5`}
                        >
                          <div className="flex items-center gap-2">
                            <BadgeFaixaMercado faixa={c.faixa} />
                            <span className="font-medium text-stone-600">
                              {qtdFaixa} {qtdFaixa === 1 ? 'casa' : 'casas'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                    <tr className="border-b border-stone-100 hover:bg-stone-50">
                      <td className={tabelaTd}>{c.cidade ?? '—'}</td>
                      <td className={tabelaTd}>
                        {c.foto_url ? (
                          <a
                            href={c.foto_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-moni-accent hover:underline"
                          >
                            Link
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className={tabelaTd}>
                        {c.manual ? (
                          <select
                            value={c.status ?? 'a_venda'}
                            onChange={(e) =>
                              handleStatusChange(c.id, e.target.value as 'a_venda' | 'despublicado')
                            }
                            disabled={readOnly}
                            className={`rounded border border-stone-300 ${campoPadding} ${campoTexto} disabled:cursor-not-allowed disabled:opacity-60`}
                          >
                            <option value="a_venda">À venda</option>
                            <option value="despublicado">Despublicado</option>
                          </select>
                        ) : c.status === 'despublicado' ? (
                          'despublicado'
                        ) : (
                          'a venda'
                        )}
                      </td>
                      <td className={tabelaTd}>{c.condominio ?? '—'}</td>
                      <td
                        className={`${tabelaTd} max-w-[120px] truncate`}
                        title={c.localizacao_condominio ?? undefined}
                      >
                        {c.localizacao_condominio ?? '—'}
                      </td>
                      <td className={tabelaTd}>{c.quartos ?? '—'}</td>
                      <td className={tabelaTd}>{c.banheiros ?? '—'}</td>
                      <td className={tabelaTd}>{c.vagas ?? '—'}</td>
                      <td className={tabelaTd}>{c.piscina ? 'sim' : 'não'}</td>
                      <td className={tabelaTd}>{c.marcenaria ? 'sim' : 'não'}</td>
                      <td className={tabelaTd}>
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          {c.preco != null ? `R$ ${c.preco.toLocaleString('pt-BR')}` : '—'}
                          <BadgeFaixaMercado faixa={c.faixa} />
                        </span>
                      </td>
                      <td className={tabelaTd}>{c.area_casa_m2 ?? '—'}</td>
                      <td className={tabelaTd}>
                        {c.preco_m2 != null ? `R$ ${c.preco_m2.toLocaleString('pt-BR')}` : '—'}
                      </td>
                      <td className={tabelaTd}>{c.estado ?? '—'}</td>
                      <td className={tabelaTd}>{c.data_publicacao ?? '—'}</td>
                      <td className={tabelaTd}>
                        {(() => {
                          const pub = c.data_publicacao ? new Date(c.data_publicacao) : null;
                          if (!pub || isNaN(pub.getTime())) return '—';
                          const hoje = new Date();
                          hoje.setHours(0, 0, 0, 0);
                          if (c.status === 'despublicado' && c.data_despublicado) {
                            const desp = new Date(c.data_despublicado);
                            if (!isNaN(desp.getTime())) {
                              const dias = Math.round(
                                (desp.getTime() - pub.getTime()) / (1000 * 60 * 60 * 24),
                              );
                              return `${dias} dias`;
                            }
                          }
                          pub.setHours(0, 0, 0, 0);
                          const dias = Math.round(
                            (hoje.getTime() - pub.getTime()) / (1000 * 60 * 60 * 24),
                          );
                          return `${dias} dias`;
                        })()}
                      </td>
                      <td className={tabelaTd}>
                        {c.link ? (
                          <a
                            href={c.link}
                            target="_blank"
                            rel="noreferrer"
                            className="text-moni-accent hover:underline"
                          >
                            Abrir anúncio
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      {!listagemOnly &&
                        escolhidasComDados.map((ce, idx) => {
                          const key = `${ce.id}__${c.id}`;
                          const notaAtrib = getNotaAtributosLote(key);
                          const notaPreco = getNotaPrecoCompleta(ce, c);
                          const notaProduto = getNotaProdutoCompleta(ce, c);
                          const notaFinal = calcNotaFinal(notaAtrib, notaPreco, notaProduto);
                          const bg = CORES_POR_MODELO[idx % CORES_POR_MODELO.length];
                          const borderLeft = 'border-l border-stone-200';
                          const isOpenAtrib = openAtributosKey === key;
                          const isOpenPreco = openPrecoKey === key;
                          const isOpenProduto = openProdutoKey === key;
                          const resp = atributosLoteByKey[key] ?? {};
                          const checklistReforma = reformaChecklistByListingId[c.id] ?? {};
                          const prodDados = produtoDadosByKey[key] ?? {};
                          const precoManualPreenchido = Object.values(checklistReforma).some(
                            (m) => !!m?.marked,
                          );
                          const atribManualPreenchido = !isAtributosLoteEmpty(atributosLoteByKey[key]);
                          const produtoManualPreenchido =
                            (prodDados.designId != null && prodDados.designId !== '') ||
                            (prodDados.idade != null && Number.isFinite(prodDados.idade));
                          const catProduto = ce.catalogoRow as {
                            nome: string | null;
                            quartos: number | null;
                            banheiros: number | null;
                            vagas: number | null;
                            area_m2?: number | null;
                          };
                          const banheirosAnuncio = getBanheirosAnuncio(c, prodDados);
                          const vagasAnuncio = getVagasAnuncio(c, prodDados);
                          const notaQ = notaQuartos(catProduto.quartos, c.quartos);
                          const notaB = notaBanheiros(catProduto.banheiros, banheirosAnuncio);
                          const notaV = notaVagas(catProduto.vagas, vagasAnuncio);
                          const refCustoEscolha = custosConstrucaoChecklist[ce.ordem];
                          const custoModelo = custoConstrucaoByCasaEscolhidaId[ce.id];
                          return (
                            <React.Fragment key={ce.id}>
                              <td
                                className={`p-1 px-2 text-center ${borderLeft} ${bg} relative min-w-[70px]`}
                              >
                                <div className="flex items-center justify-center gap-0.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenPrecoKey((k) => (k === key ? null : key));
                                      if (!reformaChecklistByListingId[c.id])
                                        setReformaChecklistByListingId((p) => ({
                                          ...p,
                                          [c.id]: {},
                                        }));
                                    }}
                                    className="min-w-[2rem] rounded border border-stone-300 bg-white px-1 py-0.5 text-xs hover:bg-stone-50"
                                    title="Preço (checklist reforma + 4 sub-itens)"
                                  >
                                    {notaPreco}
                                  </button>
                                  {!precoManualPreenchido && (
                                    <span
                                      className="text-[10px] font-bold leading-none text-amber-600"
                                      title="Nota automática (preço/m²). Preencha o checklist de reforma para refinar."
                                    >
                                      !
                                    </span>
                                  )}
                                </div>
                                {isOpenPreco && (
                                  <>
                                    <div className="absolute left-0 top-full z-30 mt-0.5 max-h-[70vh] w-72 overflow-y-auto rounded-lg border border-stone-200 bg-white p-2 shadow-lg">
                                      <label className="mb-2 block text-xs">
                                        <span className="font-medium text-stone-700">
                                          Custo de construção do modelo (R$)
                                        </span>
                                        <input
                                          type="number"
                                          min={0}
                                          step={1000}
                                          value={custoModelo ?? ''}
                                          onChange={(e) => {
                                            const v =
                                              e.target.value === ''
                                                ? null
                                                : Number(e.target.value);
                                            setCustoConstrucaoByCasaEscolhidaId((p) => ({
                                              ...p,
                                              [ce.id]: v,
                                            }));
                                          }}
                                          className="mt-0.5 w-full rounded border border-stone-300 px-2 py-1 text-xs"
                                        />
                                      </label>
                                      {refCustoEscolha != null &&
                                      Number.isFinite(refCustoEscolha) ? (
                                        <p className="mb-2 text-[11px] text-stone-500">
                                          Referência Escolha (checklist): R${' '}
                                          {refCustoEscolha.toLocaleString('pt-BR')}
                                        </p>
                                      ) : null}
                                      <p className="mb-2 text-xs font-semibold text-stone-800">
                                        Preço — Checklist de reforma (listagem)
                                      </p>
                                      {CATEGORIAS_REFORMA.map((cat) => {
                                        const m = checklistReforma[cat.id];
                                        return (
                                          <div
                                            key={cat.id}
                                            className="flex items-center gap-2 border-b border-stone-100 py-1 last:border-0"
                                          >
                                            <input
                                              type="checkbox"
                                              checked={!!m?.marked}
                                              onChange={(e) => {
                                                setReformaChecklistByListingId((p) => ({
                                                  ...p,
                                                  [c.id]: {
                                                    ...(p[c.id] ?? {}),
                                                    [cat.id]: {
                                                      marked: e.target.checked,
                                                      valor: cat.valor,
                                                    },
                                                  },
                                                }));
                                              }}
                                              className="rounded"
                                            />
                                            <span className="flex-1 text-xs">{cat.nome}</span>
                                            <input
                                              type="number"
                                              value={m?.valor ?? cat.valor}
                                              onChange={(e) => {
                                                const v = e.target.value
                                                  ? Number(e.target.value)
                                                  : undefined;
                                                setReformaChecklistByListingId((p) => ({
                                                  ...p,
                                                  [c.id]: {
                                                    ...(p[c.id] ?? {}),
                                                    [cat.id]: {
                                                      marked: !!p[c.id]?.[cat.id]?.marked,
                                                      valor: v ?? cat.valor,
                                                    },
                                                  },
                                                }));
                                              }}
                                              className="w-20 rounded border border-stone-300 px-1 py-0.5 text-xs"
                                            />
                                          </div>
                                        );
                                      })}
                                      <p className="mt-2 text-xs text-stone-600">
                                        Inv.: R${' '}
                                        {valorInvestimento(checklistReforma).toLocaleString(
                                          'pt-BR',
                                        )}{' '}
                                        — Nota: {notaPreco}
                                      </p>
                                    </div>
                                    <div
                                      className="fixed inset-0 z-20"
                                      aria-hidden
                                      onClick={() => setOpenPrecoKey(null)}
                                    />
                                  </>
                                )}
                              </td>
                              <td
                                className={`p-1 px-2 text-center ${bg} relative min-w-[70px]`}
                              >
                                <div className="flex items-center justify-center gap-0.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenProdutoKey((k) => (k === key ? null : key));
                                      if (!produtoDadosByKey[key])
                                        setProdutoDadosByKey((p) => ({ ...p, [key]: {} }));
                                    }}
                                    className="min-w-[2rem] rounded border border-stone-300 bg-white px-1 py-0.5 text-xs hover:bg-stone-50"
                                    title="Produto (7 sub-itens: tamanho, amenidades, quartos, banheiros, vagas, design, idade)"
                                  >
                                    {notaProduto}
                                  </button>
                                  {!produtoManualPreenchido && (
                                    <span
                                      className="text-[10px] font-bold leading-none text-amber-600"
                                      title="Nota automática (quartos/banheiros/vagas). Preencha design e idade para refinar."
                                    >
                                      !
                                    </span>
                                  )}
                                </div>
                                {isOpenProduto && (
                                  <>
                                    <div className="absolute left-0 top-full z-30 mt-0.5 w-72 rounded-lg border border-stone-200 bg-white p-2 shadow-lg">
                                      <p className="mb-2 text-xs font-semibold text-stone-800">
                                        Produto — 7 sub-itens
                                      </p>
                                      <p className="mb-2 text-[11px] text-stone-500">
                                        Modelo (
                                        {catProduto.nome ?? `Casa ${ce.ordem}`}):{' '}
                                        {catProduto.quartos ?? QUARTOS_PADRAO_NOSSA} quartos,{' '}
                                        {catProduto.banheiros ?? '—'} banh.,{' '}
                                        {catProduto.vagas ?? '—'} vagas
                                      </p>
                                      <div className="space-y-1.5 text-xs">
                                        <p>
                                          Tamanho m²: auto (
                                          {notaTamanhoM2(c.area_casa_m2, catProduto.area_m2 ?? null)}
                                          )
                                        </p>
                                        <p>
                                          Quartos: anúncio {c.quartos ?? '—'} → auto ({notaQ})
                                        </p>
                                        <label className="flex items-center gap-2">
                                          <span className="shrink-0 text-stone-600">Banheiros:</span>
                                          <input
                                            type="number"
                                            min={0}
                                            value={banheirosAnuncio ?? ''}
                                            onChange={(e) => {
                                              const v =
                                                e.target.value === ''
                                                  ? null
                                                  : Number(e.target.value);
                                              setProdutoDadosByKey((p) => ({
                                                ...p,
                                                [key]: { ...p[key], banheiros: v },
                                              }));
                                            }}
                                            className="w-16 rounded border border-stone-300 px-1 py-0.5"
                                          />
                                          <span className="text-stone-500">({notaB})</span>
                                        </label>
                                        <label className="flex items-center gap-2">
                                          <span className="shrink-0 text-stone-600">Vagas:</span>
                                          <input
                                            type="number"
                                            min={0}
                                            value={vagasAnuncio ?? ''}
                                            onChange={(e) => {
                                              const v =
                                                e.target.value === ''
                                                  ? null
                                                  : Number(e.target.value);
                                              setProdutoDadosByKey((p) => ({
                                                ...p,
                                                [key]: { ...p[key], vagas: v },
                                              }));
                                            }}
                                            className="w-16 rounded border border-stone-300 px-1 py-0.5"
                                          />
                                          <span className="text-stone-500">({notaV})</span>
                                        </label>
                                        <p>Amenidades: auto ({notaAmenidades(c)})</p>
                                        <label className="block">
                                          <span className="text-stone-600">Design:</span>
                                          <select
                                            value={prodDados.designId ?? ''}
                                            onChange={(e) =>
                                              setProdutoDadosByKey((p) => ({
                                                ...p,
                                                [key]: {
                                                  ...p[key],
                                                  designId: e.target.value || undefined,
                                                },
                                              }))
                                            }
                                            className="ml-1 w-full rounded border border-stone-300 px-1 py-0.5"
                                          >
                                            <option value="">—</option>
                                            {DESIGN_OPCOES.map((o) => (
                                              <option key={o.id} value={o.id}>
                                                {o.label}
                                              </option>
                                            ))}
                                          </select>
                                        </label>
                                        <label className="block">
                                          <span className="text-stone-600">Idade (anos):</span>
                                          <input
                                            type="number"
                                            min={0}
                                            value={prodDados.idade ?? ''}
                                            onChange={(e) => {
                                              const v =
                                                e.target.value === ''
                                                  ? null
                                                  : Number(e.target.value);
                                              setProdutoDadosByKey((p) => ({
                                                ...p,
                                                [key]: { ...p[key], idade: v },
                                              }));
                                            }}
                                            className="ml-1 w-16 rounded border border-stone-300 px-1 py-0.5"
                                          />
                                        </label>
                                      </div>
                                      <p className="mt-2 text-xs text-stone-600">
                                        Nota produto: {notaProduto}
                                      </p>
                                    </div>
                                    <div
                                      className="fixed inset-0 z-20"
                                      aria-hidden
                                      onClick={() => setOpenProdutoKey(null)}
                                    />
                                  </>
                                )}
                              </td>
                              <td className={`p-1 px-2 text-center ${bg} relative min-w-[70px]`}>
                                <div className="relative inline-block flex items-center justify-center gap-0.5">
                                  <button
                                    type="button"
                                    onClick={() => void handleOpenAtributosLote(key)}
                                    className="min-w-[2rem] rounded border border-stone-300 bg-white px-1 py-0.5 text-xs hover:bg-stone-50"
                                    title="Atributos do Lote (SIM/NÃO)"
                                  >
                                    {notaAtrib}
                                  </button>
                                  {!atribManualPreenchido && (
                                    <span
                                      className="text-[10px] font-bold leading-none text-amber-600"
                                      title="Nota padrão (0). Preencha os atributos do lote (SIM/NÃO) para refinar."
                                    >
                                      !
                                    </span>
                                  )}
                                  {isOpenAtrib && (
                                    <>
                                      <div className="absolute left-0 top-full z-20 mt-0.5 w-56 rounded-lg border border-stone-200 bg-white p-2 shadow-lg">
                                        <p className="mb-1.5 text-xs font-medium text-stone-700">
                                          Atributos do Lote
                                        </p>
                                        {prefillingAtributosKey === key && (
                                          <p className="mb-1 text-[10px] text-stone-500">
                                            Carregando do Step One…
                                          </p>
                                        )}
                                        {ATRIBUTOS_LOTE.map((a) => (
                                          <label
                                            key={a.id}
                                            className="flex items-center gap-2 py-0.5 text-xs"
                                          >
                                            <input
                                              type="checkbox"
                                              checked={!!resp[a.id]}
                                              onChange={(e) =>
                                                handleChangeAtributoLote(
                                                  key,
                                                  a.id,
                                                  e.target.checked,
                                                )
                                              }
                                              className="rounded"
                                            />
                                            <span>{a.label}</span>
                                            <span className="text-stone-400">
                                              ({a.nota >= 0 ? '+' : ''}
                                              {a.nota})
                                            </span>
                                          </label>
                                        ))}
                                        <p className="mt-1 text-xs text-stone-500">
                                          Soma: {notaAtributosLote(resp)}
                                        </p>
                                      </div>
                                      <div
                                        className="fixed inset-0 z-10"
                                        aria-hidden
                                        onClick={() => setOpenAtributosKey(null)}
                                      />
                                    </>
                                  )}
                                </div>
                              </td>
                              <td className={`p-1 px-2 text-center ${bg} min-w-[70px]`}>
                                {notaFinal.toFixed(1)}
                              </td>
                            </React.Fragment>
                          );
                        })}
                    </tr>
                    </React.Fragment>
                  );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
        {casasExibicao.length > ROWS_PER_PAGE && (
          <div
            className={`mt-3 flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 ${listagemOnly ? 'px-3 py-1.5 text-[11px]' : 'px-4 py-2 text-sm'}`}
          >
            <span className="text-stone-600">
              Página {pageCasas} de {totalPages} ({casasExibicao.length} casas)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPageCasas((p) => Math.max(1, p - 1))}
                disabled={pageCasas <= 1}
                className="rounded border border-stone-300 px-3 py-1 text-stone-700 hover:bg-stone-100 disabled:pointer-events-none disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setPageCasas((p) => Math.min(totalPages, p + 1))}
                disabled={pageCasas >= totalPages}
                className="rounded border border-stone-300 px-3 py-1 text-stone-700 hover:bg-stone-100 disabled:pointer-events-none disabled:opacity-50"
              >
                Próxima
              </button>
            </div>
          </div>
        )}

        {/* PDF Score & Batalha — etapa 7: gerar e armazenar na etapa (só na página da batalha, resultadoPortalTargetId = etapa 6) */}
        {resultadoPortalTargetId != null && (
          <section className="mt-6 space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
            <h3 className="text-sm font-semibold text-stone-800">PDF Score & Batalha</h3>
            <p className="text-sm text-stone-600">
              Após salvar a batalha, gere o PDF no formato do relatório. O arquivo ficará armazenado
              nesta etapa (Etapa 7).
            </p>
            {pdfScoreBatalhaUrl ? (
              <p className="text-sm">
                <a
                  href={pdfScoreBatalhaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-moni-accent hover:underline"
                >
                  Baixar PDF armazenado
                </a>
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleGerarPdf}
                disabled={gerandoPdf || pdfRows.length === 0}
                className="btn-primary text-sm"
              >
                {gerandoPdf ? 'Gerando PDF…' : 'Gerar e guardar PDF'}
              </button>
            </div>
            {/* Overlay visível só durante a geração: html2canvas precisa do conteúdo pintado na tela */}
            {gerandoPdf && pdfRows.length > 0 && (
              <div className="fixed inset-0 z-[9999] overflow-auto bg-white p-4" aria-hidden>
                <div
                  ref={pdfRef}
                  className="bg-white"
                  style={{ width: '210mm', minHeight: '297mm' }}
                >
                  <ScoreBatalhaPDFContent rows={pdfRows} omitImages />
                </div>
              </div>
            )}
          </section>
        )}

        {/* Adicionar casa manual — dropdown */}
        {!readOnly ? (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
          <button
            type="button"
            onClick={() => setManualFormOpen((v) => !v)}
            className={`flex w-full items-center justify-between text-left text-stone-800 transition-colors hover:bg-stone-100 ${
              listagemOnly ? 'px-3 py-1.5 text-[11px] font-medium' : 'px-4 py-3 font-medium'
            }`}
            aria-expanded={manualFormOpen}
          >
            <span>Adicionar casa manualmente</span>
            <span className={`leading-none text-stone-500 ${listagemOnly ? 'text-xs' : 'text-lg'}`}>
              {manualFormOpen ? '−' : '+'}
            </span>
          </button>
          {manualFormOpen && (
            <form
              onSubmit={handleSubmitManual}
              className="space-y-3 border-t border-stone-200 p-4 pt-0"
            >
              <p className="text-sm text-stone-600">
                Use somente se alguma casa relevante não tiver sido puxada automaticamente pela ZAP.
                Casas manuais só têm o status editável na tabela.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 sm:col-span-2">
                  <span className="text-sm font-medium text-stone-700">Cidade</span>
                  <input
                    type="text"
                    value={cidadeManual}
                    onChange={(e) => setCidadeManual(e.target.value)}
                    className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-stone-700">Status</span>
                  <select
                    value={statusManual}
                    onChange={(e) => setStatusManual(e.target.value as 'a_venda' | 'despublicado')}
                    className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  >
                    <option value="a_venda">À venda</option>
                    <option value="despublicado">Despublicado</option>
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-stone-700">Condomínio</span>
                  <input
                    type="text"
                    value={condominioManual}
                    onChange={(e) => setCondominioManual(e.target.value)}
                    disabled={readOnly}
                    className={`rounded-lg border border-stone-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60`}
                  />
                </label>
                <label className="grid gap-1 sm:col-span-2">
                  <span className="text-sm font-medium text-stone-700">Endereço</span>
                  <input
                    type="text"
                    value={enderecoManual}
                    onChange={(e) => setEnderecoManual(e.target.value)}
                    className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-stone-700">Quartos</span>
                  <input
                    type="number"
                    min={0}
                    value={quartos}
                    onChange={(e) => setQuartos(e.target.value)}
                    className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-stone-700">Banheiros</span>
                  <input
                    type="number"
                    min={0}
                    value={banheiros}
                    onChange={(e) => setBanheiros(e.target.value)}
                    className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-stone-700">Vagas</span>
                  <input
                    type="number"
                    min={0}
                    value={vagas}
                    onChange={(e) => setVagas(e.target.value)}
                    className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  />
                </label>
                <div className="flex items-end gap-4 pb-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={piscina}
                      onChange={(e) => setPiscina(e.target.checked)}
                      className="rounded"
                    />
                    Piscina
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={marcenaria}
                      onChange={(e) => setMarcenaria(e.target.checked)}
                      className="rounded"
                    />
                    Móveis planej.
                  </label>
                </div>
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-stone-700">Preço</span>
                  <input
                    type="text"
                    placeholder="R$"
                    value={preco}
                    onChange={(e) => setPreco(e.target.value)}
                    className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-stone-700">m²</span>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={areaCasa}
                    onChange={(e) => setAreaCasa(e.target.value)}
                    className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-stone-700">R$/m²</span>
                  <input
                    type="text"
                    value={precoM2Auto}
                    readOnly
                    className="rounded-lg border border-stone-200 bg-stone-100 px-3 py-2 text-sm text-stone-600"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-stone-700">Estado</span>
                  <input
                    type="text"
                    placeholder="UF"
                    value={estadoManual}
                    onChange={(e) => setEstadoManual(e.target.value)}
                    className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
                    maxLength={2}
                  />
                </label>
                {!listagemOnly ? (
                <label className="grid gap-1 sm:col-span-2">
                  <span className="text-sm font-medium text-stone-700">Compat. Moní</span>
                  <input
                    type="text"
                    value={compatibilidadeMoni}
                    onChange={(e) => setCompatibilidadeMoni(e.target.value)}
                    className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  />
                </label>
                ) : null}
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-stone-700">Data levant.</span>
                  <input
                    type="date"
                    value={dataLevantamento}
                    onChange={(e) => setDataLevantamento(e.target.value)}
                    className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="grid gap-1 sm:col-span-2">
                  <span className="text-sm font-medium text-stone-700">Listing</span>
                  <input
                    type="url"
                    placeholder="Link do anúncio"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <button type="submit" disabled={loading} className="btn-primary text-sm">
                {loading ? 'Salvando…' : 'Adicionar casa'}
              </button>
            </form>
          )}
        </div>
        ) : null}
      </div>
    </>
  );
}

function BadgeFaixaMercado({ faixa }: { faixa?: CasaRow['faixa'] }) {
  if (faixa === 'premium_plus3') {
    return (
      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-900">
        Premium+++
      </span>
    );
  }
  if (faixa === 'premium_plus2') {
    return (
      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800">
        Premium++
      </span>
    );
  }
  if (faixa === 'premium_plus') {
    return (
      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">
        Premium+
      </span>
    );
  }
  if (faixa === 'premium') {
    return (
      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
        Premium
      </span>
    );
  }
  if (faixa === 'intermediaria') {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
        Intermediária
      </span>
    );
  }
  if (faixa === 'entrada') {
    return (
      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
        Entrada
      </span>
    );
  }
  return null;
}

function PreBatalhaRankingCards({
  ranking,
  expandedIds,
  onToggle,
}: {
  ranking: ResultadoRankingModelo[];
  expandedIds: Set<string>;
  onToggle: (catalogoId: string) => void;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-700">
        Ranking de modelos Moní
      </h3>
      <div className="space-y-2">
        {ranking.map((item, idx) => {
          const posicao = idx + 1;
          const expandido = expandedIds.has(item.catalogoId);
          const compat = badgeCompatibilidade(item.notaFinal);
          const destaque = posicao === 1;

          return (
            <article
              key={item.catalogoId}
              className={`overflow-hidden rounded-xl border bg-white shadow-sm ${
                destaque ? 'border-amber-300 ring-1 ring-amber-200' : 'border-stone-200'
              }`}
            >
              <button
                type="button"
                onClick={() => onToggle(item.catalogoId)}
                aria-expanded={expandido}
                className="flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors hover:bg-stone-50"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex h-7 min-w-[2rem] items-center justify-center rounded-md px-1.5 text-xs font-bold tabular-nums ${
                      destaque
                        ? 'bg-amber-500 text-white'
                        : 'bg-stone-200 text-stone-700'
                    }`}
                  >
                    #{posicao}
                  </span>
                  <span className="font-semibold text-stone-900">{item.modelo}</span>
                  {item.topografia !== '—' ? (
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600 ring-1 ring-stone-200">
                      {item.topografia}
                    </span>
                  ) : null}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${compat.className}`}
                  >
                    {compat.label}
                  </span>
                  <span className="ml-auto text-stone-400" aria-hidden>
                    {expandido ? '▾' : '▸'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums text-stone-600">
                  <span>
                    <span className="font-medium text-stone-500">Lote:</span> {item.notaLote}
                  </span>
                  <span className="text-stone-300">|</span>
                  <span>
                    <span className="font-medium text-stone-500">Produto:</span>{' '}
                    {item.notaProdutoMedia}
                  </span>
                  <span className="text-stone-300">|</span>
                  <span>
                    <span className="font-medium text-stone-500">Final:</span>{' '}
                    <span className="font-semibold text-stone-800">{item.notaFinal}</span>
                  </span>
                </div>
              </button>

              {expandido ? (
                <div className="border-t border-stone-100 bg-stone-50/80 px-4 py-3">
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
                    Anúncios mais ameaçadores
                  </h4>
                  {item.anunciosAmeacadores.length === 0 ? (
                    <p className="text-xs italic text-stone-500">Nenhum anúncio na listagem.</p>
                  ) : (
                    <ul className="space-y-2">
                      {item.anunciosAmeacadores.map((anuncio) => (
                        <li
                          key={anuncio.id}
                          className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
                        >
                          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                            <span className="font-medium text-stone-800">{anuncio.condominio}</span>
                            <span className="text-xs font-medium text-stone-600">
                              {formatPrecoAnuncio(anuncio.preco)}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                            <span>
                              Nota produto:{' '}
                              <span
                                className={`font-semibold tabular-nums ${
                                  anuncio.notaProduto <= -1
                                    ? 'text-red-700'
                                    : 'text-stone-700'
                                }`}
                              >
                                {anuncio.notaProduto}
                              </span>
                            </span>
                            {anuncio.notaProduto <= -1 ? (
                              <span className="rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-800 ring-1 ring-red-200">
                                ⚠ Concorrente direto
                              </span>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
