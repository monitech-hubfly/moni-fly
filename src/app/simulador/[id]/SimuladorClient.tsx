'use client';

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { BarChart3, CheckCircle2, Download, X } from 'lucide-react';
import { CampoNumeroBr } from '@/components/simulador/CampoNumeroBr';
import { TabelaFluxo } from '@/components/simulador/oferta-resultado-ui';
import {
  calcularOferta,
  formatarMoeda,
  sugerirParcelaMensal,
  type OfertaConfig,
  type ResultadoCalculo,
} from '@/lib/simulador/calcular-oferta';
import { fracaoParaPercentualUi } from '@/lib/loteamento-simulador-template';
import { montarPropostaPdfPayload, type PropostaPdfPayload } from '@/lib/simulador/proposta-pdf-data';
import { refProposta } from '@/lib/simulador/fluxo-proposta';
import { salvarOfertaCorretor } from './actions';
import type { SimuladorPublicoView } from './types';

type Props = { view: SimuladorPublicoView };

const fieldCls =
  'mt-1 min-h-[44px] w-full rounded-[var(--moni-radius-md)] px-3 py-2 text-sm outline-none';
const fieldStyle: CSSProperties = {
  border: 'var(--moni-border-width) solid var(--moni-border-default)',
  background: 'var(--moni-surface-0)',
  color: 'var(--moni-text-primary)',
  fontFamily: 'var(--moni-font-sans)',
};
const labelCls = 'text-xs font-medium';
const labelStyle: CSSProperties = {
  color: 'var(--moni-text-primary)',
  fontFamily: 'var(--moni-font-sans)',
};
const hintStyle: CSSProperties = {
  color: 'var(--moni-text-tertiary)',
  fontFamily: 'var(--moni-font-sans)',
};

function Card({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section
      className="rounded-[var(--moni-radius-lg)] p-4 sm:p-5"
      style={{
        border: 'var(--moni-border-width) solid var(--moni-border-default)',
        background: 'var(--moni-surface-0)',
        boxShadow: 'var(--moni-shadow-card)',
      }}
    >
      <h2
        className="mb-4 text-lg"
        style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
      >
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span
      className="ml-2 inline-flex items-center rounded-[var(--moni-radius-md)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
      style={{
        background: 'var(--moni-gold-50)',
        color: 'var(--moni-gold-800)',
        border: 'var(--moni-border-width) solid var(--moni-gold-200)',
        fontFamily: 'var(--moni-font-sans)',
      }}
    >
      {children}
    </span>
  );
}

function AvisoMinimo({ minimo, atual }: { minimo: number; atual: number }) {
  const abaixo = atual < minimo - 0.005;
  return (
    <p
      className="mt-1 text-[11px]"
      style={{
        color: abaixo ? 'var(--moni-status-overdue-text)' : 'var(--moni-status-attention-text)',
        fontFamily: 'var(--moni-font-sans)',
      }}
    >
      ⚠ Mínimo sugerido: {formatarMoeda(minimo)}
    </p>
  );
}

function dispararDownload(blob: Blob, ref: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `proposta-moni-${ref}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function SimuladorClient({ view }: Props) {
  const { config, lotes, nomeLoteamento, prazoObraMeses } = view;
  const taxaUi = fracaoParaPercentualUi(view.taxaFinanciamentoAnual);

  const [clienteNome, setClienteNome] = useState('');
  const [clienteTelefone, setClienteTelefone] = useState('');
  const [clienteEmail, setClienteEmail] = useState('');
  const [loteAdquirido, setLoteAdquirido] = useState(false);
  const [loteId, setLoteId] = useState('');
  const [valorLoteManual, setValorLoteManual] = useState<number | null>(null);
  const [valorCasa, setValorCasa] = useState<number | null>(null);
  const [valorCustomizacao, setValorCustomizacao] = useState<number | null>(null);
  const [valorJaPago, setValorJaPago] = useState<number | null>(0);
  const [prazoTotal, setPrazoTotal] = useState<number | null>(12);
  const [parcelaMensal, setParcelaMensal] = useState<number | null>(null);
  const [parcelaEditada, setParcelaEditada] = useState(false);
  const [renda, setRenda] = useState<number | null>(null);
  const [prazoFinanciamento, setPrazoFinanciamento] = useState<number | null>(30);
  const [taxaJurosPct, setTaxaJurosPct] = useState<number | null>(
    taxaUi ? Number(taxaUi.replace(',', '.')) : 10,
  );

  const [resultado, setResultado] = useState<ResultadoCalculo | null>(null);
  const [ultimaOferta, setUltimaOferta] = useState<OfertaConfig | null>(null);
  const [entradaConf, setEntradaConf] = useState(0);
  const [mensalConf, setMensalConf] = useState(0);
  const [unicaConf, setUnicaConf] = useState(0);
  const [fluxoPersonalizado, setFluxoPersonalizado] = useState<ResultadoCalculo | null>(null);
  const [focadoConf, setFocadoConf] = useState<string | null>(null);

  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvoNome, setSalvoNome] = useState<string | null>(null);
  const [salvoId, setSalvoId] = useState<string | null>(null);
  const [pdfSugerida, setPdfSugerida] = useState(false);
  const [pdfPersonalizada, setPdfPersonalizada] = useState(false);
  const [personalizarAberto, setPersonalizarAberto] = useState(false);
  const [fluxoModalAberto, setFluxoModalAberto] = useState(false);
  const [fluxoModalPersonalizado, setFluxoModalPersonalizado] = useState(false);
  const [detalheModal, setDetalheModal] = useState(false);
  const [baixandoPdf, setBaixandoPdf] = useState(false);

  const loteSelecionado = lotes.find((l) => l.id === loteId) ?? null;
  const valorLote = loteAdquirido ? valorLoteManual : loteSelecionado?.valor ?? null;
  const sugestaoParcela = sugerirParcelaMensal(valorLote ?? 0);
  const prazoFase1 = prazoTotal != null ? prazoTotal - prazoObraMeses : null;

  const watermarkStyle = useMemo(
    () => (campo: string): CSSProperties => ({
      ...fieldStyle,
      color:
        focadoConf === campo ? 'var(--moni-text-primary)' : 'var(--moni-text-tertiary)',
    }),
    [focadoConf],
  );

  function aplicarValorLoteESugestao(n: number | null) {
    if (!parcelaEditada && n != null && n > 0) {
      setParcelaMensal(sugerirParcelaMensal(n));
    }
  }

  function onToggleLoteAdquirido(adquirido: boolean) {
    setLoteAdquirido(adquirido);
    setResultado(null);
    setFluxoPersonalizado(null);
    if (adquirido) {
      setLoteId('');
      aplicarValorLoteESugestao(valorLoteManual);
    } else {
      setValorLoteManual(null);
      aplicarValorLoteESugestao(lotes.find((l) => l.id === loteId)?.valor ?? null);
    }
  }

  function onSelectLote(id: string) {
    setLoteId(id);
    setResultado(null);
    const lote = lotes.find((l) => l.id === id);
    aplicarValorLoteESugestao(lote?.valor ?? null);
  }

  function minimoUnica(entrada: number, mensal: number, base: ResultadoCalculo) {
    const deltaEntrada = entrada - base.entrada_sugerida;
    const deltaMensais = (mensal - base.parcela_mensal_usada) * base.mes_parcela_unica;
    return Math.max(
      base.parcela_unica_detalhe.min_quitar_lote,
      base.parcela_unica_sugerida - deltaEntrada - deltaMensais,
    );
  }

  function onCalcular() {
    setErro(null);
    setFluxoPersonalizado(null);
    if (!clienteNome.trim()) {
      setErro('Informe o nome completo do cliente.');
      return;
    }
    const lote = valorLote;
    if (lote == null || lote <= 0) {
      setErro(loteAdquirido ? 'Informe o valor do lote.' : 'Selecione um lote disponível.');
      return;
    }
    if (valorCasa == null || valorCasa < 0) {
      setErro('Informe o valor da casa.');
      return;
    }
    if (prazoTotal == null || prazoTotal < 1) {
      setErro('Informe o prazo total (meses).');
      return;
    }
    if (prazoTotal <= prazoObraMeses) {
      setErro(`O prazo total deve ser maior que o prazo de obra (${prazoObraMeses} meses).`);
      return;
    }
    if (parcelaMensal == null || parcelaMensal < 0) {
      setErro('Informe a parcela mensal.');
      return;
    }
    if (prazoFinanciamento == null || prazoFinanciamento < 1) {
      setErro('Informe o prazo do financiamento.');
      return;
    }
    const taxaFrac = (taxaJurosPct ?? 10) / 100;
    const oferta: OfertaConfig = {
      valor_lote: lote,
      valor_casa: valorCasa,
      valor_customizacao: valorCustomizacao ?? 0,
      valor_ja_pago: valorJaPago ?? 0,
      prazo_meses: prazoTotal - prazoObraMeses,
      parcela_mensal: parcelaMensal,
      renda_cliente: renda ?? 0,
      prazo_financiamento_anos: prazoFinanciamento,
      taxa_financiamento_anual: taxaFrac,
    };
    const calc = calcularOferta(config, oferta);
    setUltimaOferta(oferta);
    setResultado(calc);
    setEntradaConf(calc.entrada_sugerida);
    setMensalConf(calc.parcela_mensal_usada);
    setUnicaConf(calc.parcela_unica_sugerida);
    setPersonalizarAberto(false);
    setSalvoNome(null);
    setSalvoId(null);
    setPdfSugerida(false);
    setPdfPersonalizada(false);
  }

  function onEntradaConfChange(n: number | null) {
    const v = n ?? 0;
    setEntradaConf(v);
    if (resultado) setUnicaConf(minimoUnica(v, mensalConf, resultado));
    setFluxoPersonalizado(null);
  }

  function onMensalConfChange(n: number | null) {
    const v = n ?? 0;
    setMensalConf(v);
    if (resultado) setUnicaConf(minimoUnica(entradaConf, v, resultado));
    setFluxoPersonalizado(null);
  }

  async function onSalvar(personalizada: boolean) {
    if (!resultado || !ultimaOferta) return;
    setSalvando(true);
    setErro(null);
    const res = await salvarOfertaCorretor(view.token, {
      clienteNome,
      clienteTelefone,
      clienteEmail,
      loteId: loteAdquirido ? null : loteId || null,
      loteValorManual: loteAdquirido ? valorLoteManual : null,
      valorCasa: ultimaOferta.valor_casa,
      valorCustomizacao: ultimaOferta.valor_customizacao,
      valorJaPago: ultimaOferta.valor_ja_pago,
      prazoMesesTotal: prazoTotal ?? ultimaOferta.prazo_meses + prazoObraMeses,
      parcelaMensal: personalizada ? mensalConf : ultimaOferta.parcela_mensal,
      renda: ultimaOferta.renda_cliente,
      prazoFinanciamentoAnos: ultimaOferta.prazo_financiamento_anos,
      taxaJurosAnualFracao: ultimaOferta.taxa_financiamento_anual ?? view.taxaFinanciamentoAnual,
      entradaConfirmada: personalizada ? entradaConf : resultado.entrada_sugerida,
      mensalConfirmada: personalizada ? mensalConf : resultado.parcela_mensal_usada,
      parcelaUnicaConfirmada: personalizada ? unicaConf : resultado.parcela_unica_sugerida,
      personalizada,
    });
    setSalvando(false);
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    setSalvoNome(res.nome);
    setSalvoId(res.ofertaId);
    if (personalizada) setPdfPersonalizada(true);
    else setPdfSugerida(true);
  }

  function abrirFluxoSugerido() {
    if (!resultado) return;
    setFluxoModalPersonalizado(false);
    setFluxoModalAberto(true);
  }

  function abrirFluxoPersonalizado() {
    if (!resultado || !ultimaOferta) return;
    setFluxoPersonalizado(
      calcularOferta(config, {
        ...ultimaOferta,
        entrada_confirmada: entradaConf,
        mensal_confirmada: mensalConf,
        parcela_unica_confirmada: unicaConf,
      }),
    );
    setFluxoModalPersonalizado(true);
    setFluxoModalAberto(true);
  }

  const unicaMinima = resultado ? minimoUnica(entradaConf, mensalConf, resultado) : 0;
  const rendaMinima = resultado ? resultado.parcela_sac_primeira * 3 : 0;
  const taxaPctLabel = taxaJurosPct != null ? String(taxaJurosPct).replace('.', ',') : '10';
  const fluxoDoModal = fluxoModalPersonalizado ? (fluxoPersonalizado ?? resultado) : resultado;

  function montarPayloadPdf(simulacaoId: string): PropostaPdfPayload | null {
    const base = fluxoPersonalizado ?? resultado;
    if (!base || !ultimaOferta) return null;
    return montarPropostaPdfPayload({
      simulacaoId,
      loteamento: nomeLoteamento,
      loteCodigo: loteAdquirido ? null : loteSelecionado?.codigo ?? null,
      clienteNome,
      clienteTelefone,
      clienteEmail,
      valorLote: ultimaOferta.valor_lote,
      valorCasa: ultimaOferta.valor_casa,
      valorCustomizacao: ultimaOferta.valor_customizacao,
      resultado: base,
      entradaConfirmada: fluxoPersonalizado ? entradaConf : base.entrada_sugerida,
      mensalConfirmada: fluxoPersonalizado ? mensalConf : base.parcela_mensal_usada,
      parcelaUnicaConfirmada: fluxoPersonalizado ? unicaConf : base.parcela_unica_sugerida,
      qtdParcelasMensais: prazoTotal ?? base.mes_parcela_unica,
      prazoFinanciamentoAnos: ultimaOferta.prazo_financiamento_anos,
      taxaJurosAnualPct: taxaJurosPct ?? 10,
    });
  }

  async function baixarPdf(simulacaoId?: string | null) {
    const id = simulacaoId ?? salvoId;
    if (!id) {
      setErro('Salve a oferta antes de baixar o PDF.');
      return;
    }
    setBaixandoPdf(true);
    setErro(null);
    try {
      const res = await fetch(
        `/simulador/${encodeURIComponent(view.token)}/pdf-route?simulacaoId=${encodeURIComponent(id)}`,
      );
      if (res.ok) {
        const blob = await res.blob();
        dispararDownload(blob, refProposta(id));
        return;
      }
      const payload = montarPayloadPdf(id);
      if (!payload) {
        setErro('Não foi possível gerar o PDF.');
        return;
      }
      const fallback = await fetch(`/simulador/${encodeURIComponent(view.token)}/pdf-route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!fallback.ok) {
        const body = (await fallback.json().catch(() => null)) as { error?: string } | null;
        setErro(body?.error || 'Não foi possível gerar o PDF.');
        return;
      }
      const blob = await fallback.blob();
      dispararDownload(blob, refProposta(payload.simulacaoId));
    } catch {
      setErro('Não foi possível gerar o PDF.');
    } finally {
      setBaixandoPdf(false);
    }
  }

  useEffect(() => {
    if (!fluxoModalAberto) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setFluxoModalAberto(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fluxoModalAberto]);

  return (
    <div className="min-h-[100dvh]" style={{ background: 'var(--moni-surface-50)' }}>
      <Header nome={nomeLoteamento} />

      <main className="mx-auto flex max-w-[560px] flex-col gap-5 px-4 py-8 pb-16">
        <section>
          <p
            className="text-[11px] font-medium uppercase tracking-[0.14em]"
            style={{ color: 'var(--moni-gold-400)', fontFamily: 'var(--moni-font-sans)' }}
          >
            {nomeLoteamento}
          </p>
          <h1
            className="mt-2 text-[1.75rem] leading-tight sm:text-[2rem]"
            style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
          >
            Simule o investimento do seu cliente.
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
            Preencha os dados para gerar uma proposta completa de pagamento.
          </p>
        </section>

        <Card titulo="Dados do cliente">
          <label className="block">
            <span className={labelCls} style={labelStyle}>
              Nome completo
            </span>
            <input
              className={fieldCls}
              style={fieldStyle}
              value={clienteNome}
              onChange={(e) => setClienteNome(e.target.value)}
              autoComplete="name"
            />
          </label>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelCls} style={labelStyle}>
                Telefone
              </span>
              <input
                className={fieldCls}
                style={fieldStyle}
                type="tel"
                placeholder="(11) 99999-9999"
                value={clienteTelefone}
                onChange={(e) => {
                  let v = e.target.value.replace(/\D/g, '').slice(0, 11);
                  if (v.length > 6) {
                    v = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
                  } else if (v.length > 2) {
                    v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
                  } else if (v.length > 0) {
                    v = `(${v}`;
                  }
                  setClienteTelefone(v);
                }}
                autoComplete="tel"
              />
            </label>
            <label className="block">
              <span className={labelCls} style={labelStyle}>
                E-mail
              </span>
              <input
                className={fieldCls}
                style={fieldStyle}
                type="email"
                value={clienteEmail}
                onChange={(e) => setClienteEmail(e.target.value)}
                autoComplete="email"
              />
            </label>
          </div>
        </Card>

        <Card titulo="Seleção do lote">
          <p className="mb-3 text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
            O lote já foi adquirido?
          </p>
          <div className="grid grid-cols-2 gap-2">
            <TogglePill ativo={!loteAdquirido} onClick={() => onToggleLoteAdquirido(false)}>
              Não
            </TogglePill>
            <TogglePill ativo={loteAdquirido} onClick={() => onToggleLoteAdquirido(true)}>
              Sim
            </TogglePill>
          </div>
          {!loteAdquirido ? (
            <>
              <label className="mt-4 block">
                <span className={labelCls} style={labelStyle}>
                  Lote disponível
                </span>
                <select
                  className={fieldCls}
                  style={fieldStyle}
                  value={loteId}
                  onChange={(e) => onSelectLote(e.target.value)}
                >
                  <option value="">Selecione o lote</option>
                  {lotes.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.codigo} — {formatarMoeda(l.valor)}
                    </option>
                  ))}
                </select>
                {lotes.length === 0 ? (
                  <p className="mt-1 text-[11px]" style={hintStyle}>
                    Nenhum lote cadastrado neste template.
                  </p>
                ) : null}
              </label>
              <label className="mt-3 block">
                <span className={labelCls} style={labelStyle}>
                  Valor do lote
                </span>
                <CampoNumeroBr
                  valor={valorLote}
                  onChange={() => undefined}
                  disabled
                  className={fieldCls}
                  style={fieldStyle}
                />
              </label>
            </>
          ) : (
            <label className="mt-4 block">
              <span className={labelCls} style={labelStyle}>
                Valor do lote (R$)
              </span>
              <CampoNumeroBr
                valor={valorLoteManual}
                onChange={(n) => {
                  setValorLoteManual(n);
                  setResultado(null);
                  aplicarValorLoteESugestao(n);
                }}
                className={fieldCls}
                style={fieldStyle}
              />
            </label>
          )}
        </Card>

        <Card titulo="Sobre a casa">
          <label className="block">
            <span className={labelCls} style={labelStyle}>
              Valor da casa (R$)
              <Badge>Editável</Badge>
            </span>
            <CampoNumeroBr
              valor={valorCasa}
              onChange={(n) => {
                setValorCasa(n);
                setResultado(null);
              }}
              className={fieldCls}
              style={fieldStyle}
            />
            <p className="mt-1 text-[11px]" style={hintStyle}>
              Será integrado à página de personalização em breve
            </p>
          </label>
          <label className="mt-3 block">
            <span className={labelCls} style={labelStyle}>
              Valor da customização (R$)
              <Badge>Editável</Badge>
            </span>
            <CampoNumeroBr
              valor={valorCustomizacao}
              onChange={(n) => {
                setValorCustomizacao(n);
                setResultado(null);
              }}
              className={fieldCls}
              style={fieldStyle}
            />
            <p className="mt-1 text-[11px]" style={hintStyle}>
              Será integrado à página de personalização em breve
            </p>
          </label>
        </Card>

        <Card titulo="Outras informações">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelCls} style={labelStyle}>
                Valor já pago à loteadora (R$)
              </span>
              <CampoNumeroBr
                valor={valorJaPago}
                onChange={(n) => {
                  setValorJaPago(n);
                  setResultado(null);
                }}
                className={fieldCls}
                style={fieldStyle}
              />
            </label>
            <label className="block">
              <span className={labelCls} style={labelStyle}>
                Prazo total (meses)
              </span>
              <CampoNumeroBr
                valor={prazoTotal}
                inteiro
                onChange={(n) => {
                  setPrazoTotal(n);
                  setResultado(null);
                }}
                className={fieldCls}
                style={fieldStyle}
              />
            </label>
            <label className="block">
              <span className={labelCls} style={labelStyle}>
                Parcela mensal (R$)
                <Badge>Sugestão</Badge>
              </span>
              <CampoNumeroBr
                valor={parcelaMensal}
                onChange={(n) => {
                  setParcelaMensal(n);
                  setParcelaEditada(true);
                  setResultado(null);
                }}
                className={fieldCls}
                style={fieldStyle}
              />
              {valorLote ? (
                <p className="mt-1 text-[11px]" style={hintStyle}>
                  Sugestão: {formatarMoeda(sugestaoParcela)}
                </p>
              ) : null}
            </label>
            <label className="block">
              <span className={labelCls} style={labelStyle}>
                Renda mensal do cliente (R$/mês)
              </span>
              <CampoNumeroBr
                valor={renda}
                onChange={setRenda}
                className={fieldCls}
                style={fieldStyle}
              />
            </label>
            <label className="block">
              <span className={labelCls} style={labelStyle}>
                Prazo do financiamento
              </span>
              <CampoNumeroBr
                valor={prazoFinanciamento}
                inteiro
                onChange={setPrazoFinanciamento}
                className={fieldCls}
                style={fieldStyle}
              />
            </label>
            <label className="block">
              <span className={labelCls} style={labelStyle}>
                Taxa de juros (% aa)
              </span>
              <CampoNumeroBr
                valor={taxaJurosPct}
                onChange={setTaxaJurosPct}
                className={fieldCls}
                style={fieldStyle}
              />
            </label>
          </div>
        </Card>

        {erro ? (
          <p className="text-sm" style={{ color: 'var(--moni-status-overdue-text)' }} role="alert">
            {erro}
          </p>
        ) : null}

        <button
          type="button"
          onClick={onCalcular}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[var(--moni-radius-md)] text-sm font-medium"
          style={{
            background: 'var(--moni-green-800)',
            color: 'var(--moni-surface-0)',
            fontFamily: 'var(--moni-font-sans)',
          }}
        >
          <BarChart3 className="h-4 w-4" aria-hidden />
          Calcular simulação
        </button>

        {resultado && prazoFase1 != null ? (
          <>
            <section
              className="overflow-hidden rounded-[var(--moni-radius-lg)]"
              style={{
                border: 'var(--moni-border-width) solid var(--moni-border-default)',
                background: 'var(--moni-surface-0)',
                boxShadow: 'var(--moni-shadow-card)',
              }}
            >
              <div
                className="px-4 py-3 text-center"
                style={{ background: 'var(--moni-green-800)', color: 'var(--moni-surface-0)' }}
              >
                <p className="text-[11px] uppercase tracking-wide" style={{ fontFamily: 'var(--moni-font-sans)' }}>
                  Valor total à vista
                </p>
                <p className="text-xl" style={{ fontFamily: 'var(--moni-font-display)' }}>
                  {formatarMoeda(resultado.vte_avista)}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-0">
                <Metrica label="Entrada sugerida" valor={formatarMoeda(resultado.entrada_sugerida)} />
                <Metrica
                  label="Parcela mensal"
                  valor={formatarMoeda(resultado.parcela_mensal_usada)}
                  sub={`${prazoTotal} parcelas`}
                />
                <Metrica label="Parcela única" valor={formatarMoeda(resultado.parcela_unica_sugerida)} />
              </div>
              <p className="px-4 py-3 text-[11px] leading-relaxed" style={hintStyle}>
                Saldo a financiar {formatarMoeda(resultado.saldo_financiar)} · {ultimaOferta?.prazo_financiamento_anos}{' '}
                anos · {taxaPctLabel}% aa · Parcela do financiamento estimada{' '}
                {formatarMoeda(resultado.parcela_sac_primeira)}/mês · Renda mínima necessária{' '}
                {formatarMoeda(rendaMinima)}/mês
              </p>
            </section>

            {salvoNome ? (
              <div
                className="flex items-start gap-3 rounded-[var(--moni-radius-lg)] px-4 py-3"
                style={{
                  border: 'var(--moni-border-width) solid var(--moni-border-default)',
                  background: 'var(--moni-surface-0)',
                  boxShadow: 'var(--moni-shadow-card)',
                }}
              >
                <CheckCircle2
                  className="mt-0.5 h-5 w-5 shrink-0"
                  style={{ color: 'var(--moni-green-800)' }}
                  aria-hidden
                />
                <p className="text-sm" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
                  A proposta <strong style={{ color: 'var(--moni-text-primary)' }}>{salvoNome}</strong>{' '}
                  foi gravada como rascunho e já aparece na listagem do loteamento.
                </p>
              </div>
            ) : null}

            <BotoesAcoesOferta
              gerarLabel="Gerar Fluxo de pagamentos"
              salvarLabel={salvando ? 'Salvando…' : 'Salvar Oferta'}
              onGerar={abrirFluxoSugerido}
              onSalvar={() => void onSalvar(false)}
              salvando={salvando}
              salvarDourado
              mostrarPdf={pdfSugerida}
              baixandoPdf={baixandoPdf}
              onBaixarPdf={() => void baixarPdf(salvoId)}
            />

            <button
              type="button"
              onClick={() => setPersonalizarAberto((v) => !v)}
              className="self-start"
              style={{
                background: 'transparent',
                color: 'var(--moni-gold-600)',
                border: 'var(--moni-border-width) solid color-mix(in srgb, var(--moni-gold-600) 50%, transparent)',
                borderRadius: 'var(--moni-radius-md)',
                fontFamily: 'var(--moni-font-sans)',
                fontSize: 14,
                fontWeight: 400,
                padding: '8px 16px',
                width: 'auto',
              }}
            >
              {personalizarAberto ? 'Fechar personalização' : 'Deseja personalizar o valor das parcelas?'}
            </button>

            {personalizarAberto ? (
            <section>
              <h2
                className="text-2xl"
                style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
              >
                Personalizar oferta
              </h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
                Ajuste os valores que constarão no contrato. Se o cliente aceitar os valores sugeridos, use o
                botão &apos;Salvar Oferta&apos; acima.
              </p>

              <div className="mt-4 flex flex-col gap-3">
                <label className="block">
                  <span className={labelCls} style={labelStyle}>
                    Entrada confirmada (R$)
                  </span>
                  <div
                    onFocus={() => setFocadoConf('entrada')}
                    onBlur={() => setFocadoConf(null)}
                  >
                    <CampoNumeroBr
                      valor={entradaConf}
                      onChange={onEntradaConfChange}
                      className={fieldCls}
                      style={watermarkStyle('entrada')}
                    />
                  </div>
                  <AvisoMinimo minimo={resultado.entrada_sugerida} atual={entradaConf} />
                </label>
                <label className="block">
                  <span className={labelCls} style={labelStyle}>
                    Parcela mensal confirmada (R$)
                  </span>
                  <div
                    onFocus={() => setFocadoConf('mensal')}
                    onBlur={() => setFocadoConf(null)}
                  >
                    <CampoNumeroBr
                      valor={mensalConf}
                      onChange={onMensalConfChange}
                      className={fieldCls}
                      style={watermarkStyle('mensal')}
                    />
                  </div>
                  <AvisoMinimo minimo={resultado.parcela_mensal_usada} atual={mensalConf} />
                </label>
                <label className="block">
                  <span className={labelCls} style={labelStyle}>
                    Parcela única confirmada (R$)
                  </span>
                  <div
                    onFocus={() => setFocadoConf('unica')}
                    onBlur={() => setFocadoConf(null)}
                  >
                    <CampoNumeroBr
                      valor={unicaConf}
                      onChange={(n) => {
                        setUnicaConf(n ?? 0);
                        setFluxoPersonalizado(null);
                      }}
                      className={fieldCls}
                      style={watermarkStyle('unica')}
                    />
                  </div>
                  <AvisoMinimo minimo={unicaMinima} atual={unicaConf} />
                </label>
              </div>

              <div className="mt-4">
                <BotoesAcoesOferta
                  gerarLabel="Gerar Fluxo personalizado"
                  salvarLabel={salvando ? 'Salvando…' : 'Salvar Oferta Personalizada'}
                  onGerar={abrirFluxoPersonalizado}
                  onSalvar={() => void onSalvar(true)}
                  salvando={salvando}
                  salvarDourado={false}
                  mostrarPdf={pdfPersonalizada}
                  baixandoPdf={baixandoPdf}
                  onBaixarPdf={() => void baixarPdf(salvoId)}
                />
              </div>
            </section>
            ) : null}
          </>
        ) : null}
      </main>

      {fluxoModalAberto && fluxoDoModal ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
          onClick={() => setFluxoModalAberto(false)}
          role="presentation"
        >
          <div
            className="absolute inset-0"
            style={{ background: 'var(--moni-navy-900)', opacity: 0.45 }}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="fluxo-modal-titulo"
            className="relative flex max-h-[92dvh] w-full max-w-[920px] flex-col rounded-t-[var(--moni-radius-lg)] sm:rounded-[var(--moni-radius-lg)]"
            style={{
              background: 'var(--moni-surface-0)',
              boxShadow: 'var(--moni-shadow-card)',
              border: 'var(--moni-border-width) solid var(--moni-border-default)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between gap-3 px-4 py-3"
              style={{ borderBottom: 'var(--moni-border-width) solid var(--moni-border-default)' }}
            >
              <h2
                id="fluxo-modal-titulo"
                className="text-lg"
                style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
              >
                Fluxo de pagamentos
              </h2>
              <button
                type="button"
                onClick={() => setFluxoModalAberto(false)}
                className="flex h-11 w-11 items-center justify-center rounded-[var(--moni-radius-md)]"
                style={{ color: 'var(--moni-text-secondary)' }}
                aria-label="Fechar"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-3 py-3 sm:px-4">
              <TabelaFluxo
                fluxo={fluxoDoModal.fluxo}
                detalheAberto={detalheModal}
                onToggleDetalhe={() => setDetalheModal((v) => !v)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BotoesAcoesOferta({
  gerarLabel,
  salvarLabel,
  onGerar,
  onSalvar,
  salvando,
  salvarDourado,
  mostrarPdf,
  baixandoPdf,
  onBaixarPdf,
}: {
  gerarLabel: string;
  salvarLabel: string;
  onGerar: () => void;
  onSalvar: () => void;
  salvando: boolean;
  salvarDourado: boolean;
  mostrarPdf: boolean;
  baixandoPdf: boolean;
  onBaixarPdf: () => void;
}) {
  const btnBase =
    'flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-[var(--moni-radius-md)] px-3 text-center text-sm font-medium';
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <button
        type="button"
        onClick={onGerar}
        className={btnBase}
        style={{
          background: 'transparent',
          color: 'var(--moni-green-800)',
          border: 'var(--moni-border-width) solid var(--moni-green-800)',
          fontFamily: 'var(--moni-font-sans)',
        }}
      >
        {gerarLabel}
      </button>
      <button
        type="button"
        disabled={salvando}
        onClick={onSalvar}
        className={btnBase}
        style={{
          background: salvarDourado ? 'var(--moni-gold-400)' : 'var(--moni-green-800)',
          color: salvarDourado ? 'var(--moni-navy-800)' : 'var(--moni-surface-0)',
          fontFamily: 'var(--moni-font-sans)',
        }}
      >
        {salvarLabel}
      </button>
      {mostrarPdf ? (
        <button
          type="button"
          disabled={baixandoPdf}
          onClick={onBaixarPdf}
          className={btnBase}
          style={{
            background: 'var(--moni-green-800)',
            color: 'var(--moni-surface-0)',
            fontFamily: 'var(--moni-font-sans)',
          }}
        >
          <Download className="h-4 w-4 shrink-0" aria-hidden />
          {baixandoPdf ? 'Gerando PDF…' : 'Baixar proposta em PDF'}
        </button>
      ) : null}
    </div>
  );
}

function Header({ nome }: { nome: string }) {
  return (
    <header
      className="flex items-center justify-between px-4 py-3"
      style={{ background: 'var(--moni-green-800)', color: 'var(--moni-surface-0)' }}
    >
      <img
        src="/logo-moni-branco-crop.png"
        alt="Moní"
        style={{ height: '32px', display: 'block' }}
      />
      <span className="max-w-[60%] truncate text-[11px] opacity-80" style={{ fontFamily: 'var(--moni-font-sans)' }}>
        {nome}
      </span>
    </header>
  );
}

function TogglePill({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[44px] rounded-full text-sm font-medium"
      style={{
        background: ativo ? 'var(--moni-green-800)' : 'var(--moni-surface-0)',
        color: ativo ? 'var(--moni-surface-0)' : 'var(--moni-text-primary)',
        border: 'var(--moni-border-width) solid var(--moni-green-800)',
        fontFamily: 'var(--moni-font-sans)',
      }}
    >
      {children}
    </button>
  );
}

function Metrica({ label, valor, sub }: { label: string; valor: string; sub?: string }) {
  return (
    <div
      className="px-2 py-3 text-center"
      style={{ borderTop: 'var(--moni-border-width) solid var(--moni-border-default)' }}
    >
      <p className="text-[10px] uppercase tracking-wide" style={hintStyle}>
        {label}
      </p>
      <p className="mt-1 text-sm font-medium" style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' }}>
        {valor}
      </p>
      {sub ? (
        <p className="text-[10px]" style={hintStyle}>
          {sub}
        </p>
      ) : null}
    </div>
  );
}
