'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  addCasaListing,
  updateCasaStatus,
  validarStatusCasasManuais,
} from './actions';
import {
  ordenarCasasPorFaixaMercado,
  type FaixaMercado,
} from '@/lib/kanban/mapa-competidores-condominio';
import { notifyListingsCasasMutated } from '@/lib/kanban/listings-casas-events';
import type { CasaRow } from './Etapa4Casas';

export type { CasaRow };

type Props = {
  processoId: string;
  cardId?: string;
  casas: CasaRow[];
  cidadeInicial: string;
  estadoInicial: string;
  ultimaValidacaoCasasManuaisEm: string | null;
  readOnly?: boolean;
  condominioInicial?: string;
  painelAposBuscar?: React.ReactNode;
  onMutate?: () => void | Promise<void>;
};

/** Listagem ZAP + cadastro manual — usado no Mapa de Competidores (sem catálogo/batalha). */
export function Etapa4CasasListagem({
  processoId,
  cardId,
  casas,
  cidadeInicial,
  estadoInicial,
  ultimaValidacaoCasasManuaisEm,
  readOnly = false,
  condominioInicial = '',
  painelAposBuscar,
  onMutate,
}: Props) {
  const casasManuais = useMemo(() => casas.filter((c) => c.manual === true), [casas]);
  const precisaAlertaValidacao = useMemo(() => {
    if (casasManuais.length === 0) return false;
    if (!ultimaValidacaoCasasManuaisEm) return true;
    const ultima = new Date(ultimaValidacaoCasasManuaisEm);
    const hoje = new Date();
    const diffDays = Math.floor((hoje.getTime() - ultima.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays > 30;
  }, [casasManuais.length, ultimaValidacaoCasasManuaisEm]);

  const [cidade, setCidade] = useState(cidadeInicial);
  const [estado, setEstado] = useState(estadoInicial);
  const [condominio, setCondominio] = useState(condominioInicial);
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
  const [dataLevantamento, setDataLevantamento] = useState('');
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [manualFormOpen, setManualFormOpen] = useState(false);
  const [validandoStatus, setValidandoStatus] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importando, setImportando] = useState(false);
  const [importErro, setImportErro] = useState('');
  const [resultadoImport, setResultadoImport] = useState<{
    inserted: number;
    updated: number;
    erros: string[];
    validacao?: {
      verificados: number;
      despublicados: number;
      republicados: number;
      indeterminados: number;
    };
  } | null>(null);
  const [validacaoFeedback, setValidacaoFeedback] = useState('');

  const [linkZap, setLinkZap] = useState('');
  const [mostrarCampoLink, setMostrarCampoLink] = useState(false);
  const [zapLinkLoading, setZapLinkLoading] = useState(false);
  const [zapLinkError, setZapLinkError] = useState('');
  const [zapLinkResult, setZapLinkResult] = useState<{
    inserted: number;
    updated: number;
    itemCount: number;
  } | null>(null);

  const precoM2Auto = useMemo(() => {
    const p = preco ? parseFloat(String(preco).replace(/\D/g, '').replace(',', '.')) : NaN;
    const a = areaCasa ? parseFloat(areaCasa.replace(',', '.')) : NaN;
    if (Number.isFinite(p) && Number.isFinite(a) && a > 0) return (p / a).toFixed(2);
    return '';
  }, [preco, areaCasa]);

  useEffect(() => {
    setCidade(cidadeInicial);
    setEstado(estadoInicial);
    setCidadeManual(cidadeInicial);
    setEstadoManual(estadoInicial);
  }, [cidadeInicial, estadoInicial]);

  useEffect(() => {
    const c = condominioInicial.trim();
    setCondominio(c);
    setCondominioManual(c);
  }, [condominioInicial]);

  const campoTexto = 'text-[11px] leading-tight';
  const campoPadding = 'px-2 py-1';
  const campoInputClass = `rounded-lg border border-stone-300 ${campoPadding} ${campoTexto} disabled:cursor-not-allowed disabled:opacity-60`;
  const campoLabelClass = 'text-[10px] font-medium leading-tight text-stone-600';
  const tabelaTexto = 'text-[11px] leading-snug';
  const tabelaTh = 'px-1.5 py-1 text-left font-medium';
  const tabelaTd = 'px-1.5 py-1';
  const btnAcaoMapaClass =
    'btn-primary !px-2.5 !py-1 !text-[11px] !font-normal disabled:cursor-not-allowed disabled:opacity-60';

  function precoM2Exibicao(c: CasaRow): number | null {
    if (c.preco_m2 != null && Number.isFinite(c.preco_m2)) return c.preco_m2;
    if (c.preco != null && c.area_casa_m2 != null && c.area_casa_m2 > 0) {
      return c.preco / c.area_casa_m2;
    }
    return null;
  }

  function cidadeExibicao(c: CasaRow): string {
    return c.cidade?.trim() || cidadeInicial.trim() || '—';
  }

  const ROWS_PER_PAGE = 15;
  const casasExibicao = useMemo(() => {
    if (!casas.some((c) => c.preco != null)) return casas;
    return ordenarCasasPorFaixaMercado(casas);
  }, [casas]);
  const contagemPorFaixa = useMemo(() => {
    const m = new Map<FaixaMercado, number>();
    for (const c of casasExibicao) {
      if (c.faixa) m.set(c.faixa, (m.get(c.faixa) ?? 0) + 1);
    }
    return m;
  }, [casasExibicao]);
  const totalPages = Math.max(1, Math.ceil(casasExibicao.length / ROWS_PER_PAGE));
  const [pageCasas, setPageCasas] = useState(1);
  const casasPaginated = useMemo(() => {
    const start = (pageCasas - 1) * ROWS_PER_PAGE;
    return casasExibicao.slice(start, start + ROWS_PER_PAGE);
  }, [casasExibicao, pageCasas]);
  useEffect(() => setPageCasas(1), [casasExibicao.length]);

  async function sincronizarListagensAposMutacao() {
    await onMutate?.();
    notifyListingsCasasMutated(cardId);
  }

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
          processoId: processoId?.trim() || undefined,
          cardId: cardId?.trim() || undefined,
          ...(condominioInicial.trim() ? { condominioVinculo: condominioInicial.trim() } : {}),
        }),
      });
      const data = await res.json();

      if (!data.ok) {
        setZapError(data.error ?? 'Erro ao buscar listagens.');
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
        await sincronizarListagensAposMutacao();
      } else {
        setZapError('Resposta inesperada da API (dados não salvos).');
      }
    } catch (err) {
      setZapError(err instanceof Error ? err.message : 'Falha ao chamar a API.');
    } finally {
      setZapLoading(false);
    }
  };

  const handleBuscarPorLink = async () => {
    setZapLinkError('');
    setZapLinkResult(null);
    setZapLinkLoading(true);

    const url = linkZap.trim();
    if (!url) {
      setZapLinkError('Cole o link da pesquisa ZAP.');
      setZapLinkLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/buscar-casas-por-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          linkZap: url,
          processoId: processoId?.trim() || undefined,
          cardId: cardId?.trim() || undefined,
          ...(condominioInicial.trim() ? { condominioVinculo: condominioInicial.trim() } : {}),
        }),
      });
      const data = await res.json();

      if (!data.ok) {
        setZapLinkError(data.error ?? 'Erro ao buscar pelo link.');
        setZapLinkLoading(false);
        return;
      }

      setZapLinkResult({
        inserted: data.inserted ?? 0,
        updated: data.updated ?? 0,
        itemCount: data.itemCount ?? 0,
      });
      await sincronizarListagensAposMutacao();
    } catch (err) {
      setZapLinkError(err instanceof Error ? err.message : 'Falha ao chamar a API.');
    } finally {
      setZapLinkLoading(false);
    }
  };

  const baixarTemplate = () => {
    const headers = [
      'Condomínio',
      'Preço',
      'Quartos',
      'Banheiros',
      'Vagas',
      'Área (m²)',
      'Preço/m²',
      'Piscina',
      'Móveis Planejados',
      'Link',
      'Endereço',
    ];
    const exemplo = [
      '',
      '4500000',
      '4',
      '5',
      '4',
      '380',
      '11842',
      'sim',
      'sim',
      'https://exemplo.com/anuncio',
      'Rua Exemplo, 100',
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, exemplo]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Casas');
    XLSX.writeFile(wb, 'template-casas-mapa-competidores.xlsx');
  };

  const handleImportarPlanilha = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const vinculo = condominioInicial.trim();
    if (!vinculo) {
      setImportErro('Condomínio da aba não definido.');
      return;
    }

    setImportando(true);
    setImportErro('');
    setResultadoImport(null);

    try {
      const formData = new FormData();
      formData.append('arquivo', file);
      formData.append('processoId', processoId.trim());
      if (cardId?.trim()) formData.append('cardId', cardId.trim());
      formData.append('condominioVinculo', vinculo);
      if (cidadeInicial.trim()) formData.append('cidadePadrao', cidadeInicial.trim());
      if (estadoInicial.trim()) formData.append('estadoPadrao', estadoInicial.trim());

      const res = await fetch('/api/importar-casas-planilha', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = await res.json();

      if (!data.ok) {
        setImportErro(data.error ?? 'Erro ao importar planilha.');
        return;
      }

      setResultadoImport({
        inserted: data.inserted ?? 0,
        updated: data.updated ?? 0,
        erros: Array.isArray(data.erros) ? data.erros : [],
        validacao: data.validacao ?? undefined,
      });
      await sincronizarListagensAposMutacao();
    } catch (err) {
      setImportErro(err instanceof Error ? err.message : 'Falha ao importar planilha.');
    } finally {
      setImportando(false);
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
      data_coleta: dataLevantamento || undefined,
      link: link || undefined,
    });
    setLoading(false);
    if (result.ok) {
      await sincronizarListagensAposMutacao();
      setCidadeManual(cidadeInicial);
      setEstadoManual(estadoInicial);
      setCondominioManual(condominioInicial.trim());
      setEnderecoManual('');
      setQuartos('');
      setBanheiros('');
      setVagas('');
      setPreco('');
      setAreaCasa('');
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
      await sincronizarListagensAposMutacao();
    }
  };

  const handleValidarStatusCasasManuais = async () => {
    setValidacaoFeedback('');
    setValidandoStatus(true);
    const result = await validarStatusCasasManuais(processoId);
    setValidandoStatus(false);
    if (result.ok) {
      const partes = [
        `${result.verificados} link(s) verificado(s)`,
        result.despublicados > 0 ? `${result.despublicados} marcado(s) como despublicado` : null,
        result.republicados > 0 ? `${result.republicados} republicado(s)` : null,
        result.indeterminados > 0 ? `${result.indeterminados} indeterminado(s)` : null,
        result.bloqueados > 0
          ? `${result.bloqueados} bloqueado(s) pelo portal (tente novamente em instantes)`
          : null,
      ].filter(Boolean);
      setValidacaoFeedback(partes.join(' · '));
      await sincronizarListagensAposMutacao();
    } else {
      setValidacaoFeedback(result.error);
    }
  };

  return (
    <div className="space-y-4 p-3 sm:p-4">
      <section className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-3">
        <p className="text-sm font-medium" style={{ color: 'var(--moni-text-primary)' }}>
          Buscar listagens
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
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
              placeholder="Nome do condomínio"
              value={condominio}
              onChange={(e) => setCondominio(e.target.value)}
              disabled={readOnly}
              className={campoInputClass}
            />
          </label>
        </div>
        {condominioInicial.trim() &&
        condominio.trim().toLowerCase() !== condominioInicial.trim().toLowerCase() ? (
          <p className={`${campoTexto} text-stone-500`}>
            Termo de busca para &quot;{condominioInicial.trim()}&quot; — ajuste se necessário.
          </p>
        ) : null}
        {zapLoading ? (
          <p
            className={`rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700 ${campoTexto}`}
          >
            Buscando imóveis online… pode levar até 4 minutos. Não feche a página.
          </p>
        ) : null}
        {zapError ? (
          <div
            className={`rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 ${campoTexto}`}
            role="alert"
          >
            <strong>Erro na busca:</strong> {zapError}
          </div>
        ) : null}
        {zapResult ? (
          zapResult.itemCount === 0 ? (
            <p
              className={`rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 ${campoTexto}`}
            >
              Nenhum imóvel encontrado com estes filtros (casas/sobrados acima de R$
              4.000.000). Confira se o termo do condomínio corresponde ao bairro/loteamento na busca
              ou cadastre manualmente.
            </p>
          ) : (
            <p className={`${campoTexto} text-green-700`}>
              {zapResult.itemCount} {zapResult.itemCount === 1 ? 'imóvel' : 'imóveis'} encontrado(s) —
              inseridos: {zapResult.inserted}, atualizados: {zapResult.updated}, marcados
              despublicados: {zapResult.despublicados}.
            </p>
          )
        ) : null}
        {mostrarCampoLink ? (
          <div className="space-y-1.5">
            <label className="grid gap-1">
              <span className={campoLabelClass}>Link da pesquisa ZAP</span>
              <input
                type="url"
                placeholder="https://www.zapimoveis.com.br/venda/casas/..."
                value={linkZap}
                onChange={(e) => setLinkZap(e.target.value)}
                disabled={readOnly || zapLinkLoading}
                className={campoInputClass}
              />
            </label>
            <p className={`${campoTexto} text-stone-400`}>
              Faça a pesquisa na ZAP, copie a URL e cole aqui. Funciona sem Apify — usa conexão
              direta com a ZAP.
            </p>
            {zapLinkError ? (
              <p
                className={`rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 ${campoTexto}`}
                role="alert"
              >
                {zapLinkError}
              </p>
            ) : null}
            {zapLinkResult ? (
              <p className={`${campoTexto} text-green-700`}>
                {zapLinkResult.itemCount} imóvel(is) encontrado(s) — inseridos:{' '}
                {zapLinkResult.inserted}, atualizados: {zapLinkResult.updated}.
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={handleVarrerZap}
            disabled={zapLoading || readOnly}
            className={btnAcaoMapaClass}
          >
            {zapLoading ? 'Buscando…' : 'Buscar'}
          </button>
          {!readOnly ? (
            <>
              <input
                type="file"
                accept=".xlsx,.csv"
                ref={fileInputRef}
                onChange={handleImportarPlanilha}
                className="hidden"
              />
              <button type="button" onClick={baixarTemplate} className={btnAcaoMapaClass}>
                Exportar template
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={importando}
                className={btnAcaoMapaClass}
              >
                {importando ? 'Importando…' : 'Importar planilha'}
              </button>
              {casasManuais.length > 0 ? (
                <button
                  type="button"
                  onClick={handleValidarStatusCasasManuais}
                  disabled={validandoStatus || importando}
                  className={btnAcaoMapaClass}
                >
                  {validandoStatus ? 'Validando…' : 'Validar status'}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setMostrarCampoLink((v) => !v)}
                className={btnAcaoMapaClass}
              >
                {mostrarCampoLink ? 'Ocultar link' : 'Buscar por link ZAP'}
              </button>
              {mostrarCampoLink ? (
                <button
                  type="button"
                  onClick={handleBuscarPorLink}
                  disabled={!linkZap.trim() || zapLinkLoading || readOnly}
                  className={btnAcaoMapaClass}
                >
                  {zapLinkLoading ? 'Buscando…' : 'Buscar link'}
                </button>
              ) : null}
            </>
          ) : null}
        </div>
        {!readOnly && precisaAlertaValidacao && casasManuais.length > 0 ? (
          <p className={`${campoTexto}`} style={{ color: 'var(--moni-text-tertiary)' }} role="status">
            Validação mensal pendente ({casasManuais.length}{' '}
            {casasManuais.length === 1 ? 'casa' : 'casas'} manual/planilha).
            {ultimaValidacaoCasasManuaisEm
              ? ` Última: ${new Date(ultimaValidacaoCasasManuaisEm).toLocaleDateString('pt-BR')}.`
              : ' Nenhuma validação registrada ainda.'}
          </p>
        ) : null}
        {!readOnly && validacaoFeedback ? (
          <p className="text-[11px]" style={{ color: 'var(--moni-text-secondary)' }} role="status">
            {validacaoFeedback}
          </p>
        ) : null}
        {!readOnly && importErro ? (
          <p className="text-[11px] text-red-600" role="alert">
            {importErro}
          </p>
        ) : null}
        {!readOnly && resultadoImport ? (
          <p className="text-[11px]" style={{ color: 'var(--moni-text-secondary)' }}>
            Importação concluída — inseridos: {resultadoImport.inserted}, atualizados:{' '}
            {resultadoImport.updated}
            {resultadoImport.validacao
              ? `. Status verificado em ${resultadoImport.validacao.verificados} link(s)${
                  resultadoImport.validacao.despublicados > 0
                    ? `; ${resultadoImport.validacao.despublicados} despublicado(s)`
                    : ''
                }`
              : ''}
            {resultadoImport.erros.length > 0
              ? `. Avisos: ${resultadoImport.erros.slice(0, 3).join(' ')}`
              : ''}
          </p>
        ) : null}
      </section>

      {painelAposBuscar}

      {casas.length === 0 ? (
        <p
          className="rounded-lg border px-3 py-3 text-[11px] italic"
          style={{
            borderColor: 'var(--moni-border-default)',
            color: 'var(--moni-text-tertiary)',
            background: 'var(--moni-surface-50)',
          }}
        >
          Nenhuma listagem neste condomínio. Importe a planilha, busque online ou cadastre manualmente
          abaixo.
        </p>
      ) : null}

      {casas.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-stone-200">
          <div className="overflow-x-auto">
            <table className={`w-full min-w-[900px] ${tabelaTexto}`}>
              <thead>
                <tr className="border-b border-stone-200 bg-stone-100">
                  <th className={tabelaTh}>Cidade</th>
                  <th className={tabelaTh}>Fotos</th>
                  <th className={tabelaTh}>Status</th>
                  <th className={tabelaTh}>Origem</th>
                  <th className={tabelaTh}>Condomínio</th>
                  <th className={tabelaTh}>Endereço</th>
                  <th className={tabelaTh}>Quartos</th>
                  <th className={tabelaTh}>Banheiros</th>
                  <th className={tabelaTh}>Vagas</th>
                  <th className={tabelaTh}>Piscina</th>
                  <th className={tabelaTh}>Móveis planej.</th>
                  <th className={tabelaTh}>Preço</th>
                  <th className={tabelaTh}>m²</th>
                  <th className={tabelaTh}>Preço/m²</th>
                  <th className={tabelaTh}>Estado</th>
                  <th className={tabelaTh}>Data publicação</th>
                  <th className={tabelaTh}>Duração anúncio</th>
                  <th className={tabelaTh}>Listing</th>
                </tr>
              </thead>
              <tbody>
                {casasPaginated.map((c, idx) => {
                  const prevFaixa = idx > 0 ? casasPaginated[idx - 1]?.faixa : undefined;
                  const showFaixaHeader =
                    c.faixa != null && (idx === 0 || c.faixa !== prevFaixa);
                  const qtdFaixa =
                    showFaixaHeader && c.faixa ? (contagemPorFaixa.get(c.faixa) ?? 0) : 0;
                  const colCountListagem = 18;
                  return (
                    <React.Fragment key={c.id}>
                      {showFaixaHeader ? (
                        <tr className="border-b border-stone-200 bg-stone-50/90">
                          <td colSpan={colCountListagem} className={`${tabelaTd} py-1.5`}>
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
                        <td className={tabelaTd}>{cidadeExibicao(c)}</td>
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
                        <td className={tabelaTd}>
                          <BadgeOrigemAnuncio casa={c} />
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
                          {(() => {
                            const pm2 = precoM2Exibicao(c);
                            return pm2 != null ? `R$ ${pm2.toLocaleString('pt-BR')}` : '—';
                          })()}
                        </td>
                        <td className={tabelaTd}>{c.estado ?? estadoInicial ?? '—'}</td>
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
        <div className="mt-3 flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-[11px]">
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

      {!readOnly ? (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
          <button
            type="button"
            onClick={() => setManualFormOpen((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-1.5 text-left text-[11px] font-medium text-stone-800 transition-colors hover:bg-stone-100"
            aria-expanded={manualFormOpen}
          >
            <span>Adicionar casa manualmente</span>
            <span className="text-xs leading-none text-stone-500">{manualFormOpen ? '−' : '+'}</span>
          </button>
          {manualFormOpen && (
            <form
              onSubmit={handleSubmitManual}
              className="space-y-3 border-t border-stone-200 p-4 pt-0"
            >
              <p className="text-sm text-stone-600">
                Use somente se alguma casa relevante não tiver sido puxada automaticamente na busca.
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
                    className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
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
                  <span className="text-sm font-medium text-stone-700">Preço/m²</span>
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
  );
}

function BadgeOrigemAnuncio({ casa }: { casa: CasaRow }) {
  if (casa.importado) {
    return (
      <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 ring-1 ring-emerald-200">
        Planilha
      </span>
    );
  }
  if (casa.manual) {
    return (
      <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-700 ring-1 ring-stone-200">
        Manual
      </span>
    );
  }
  return (
    <span className="rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-800 ring-1 ring-sky-200">
      Busca
    </span>
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
