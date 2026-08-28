'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { criarSimuladorOfertaDoCard } from '@/lib/actions/loteamento-simulador-template';
import {
  fracaoParaPercentualUi,
  numeroParaInputBr,
} from '@/lib/loteamento-simulador-template';
import { CampoNumeroBr } from '@/components/simulador/CampoNumeroBr';
import {
  calcularOferta,
  formatarMoeda,
  sugerirParcelaMensal,
  type LinhaFluxo,
  type OfertaConfig,
  type ResultadoCalculo,
  type TemplateConfig,
} from '@/lib/simulador/calcular-oferta';
import {
  formatarNumeroInput,
  parsearNumeroInput,
} from '@/lib/simulador/formatar-numero-input';

type Props = {
  template: TemplateConfig;
  loteadorId: string;
  kanbanCardId?: string;
};

type CardResultadoItem = {
  label: string;
  valor: string;
  sublabel?: string;
  destaque?: boolean;
};

const fieldCls =
  'mt-1 min-h-[44px] w-full rounded-[var(--moni-radius-md)] px-3 py-2 text-sm outline-none';
const fieldStyle = {
  border: 'var(--moni-border-width) solid var(--moni-border-default)',
  background: 'var(--moni-surface-0)',
  color: 'var(--moni-text-primary)',
  fontFamily: 'var(--moni-font-sans)',
} as const;
const labelCls = 'text-xs font-medium';
const labelStyle = { color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' } as const;
const hintStyle = { color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' } as const;

const FASE_LABEL: Record<string, string> = {
  mes0: 'Mês 0',
  fase1: 'Fase 1',
  parcela_unica: 'Parcela única',
  fase2: 'Fase 2',
  entrega: 'Entrega',
};

export function CalculadoraOferta({ template, loteadorId, kanbanCardId }: Props) {
  const router = useRouter();
  const cardId = kanbanCardId || loteadorId;

  const prazoObraMeses = Math.max(0, Math.round(template.prazo_obra_meses));
  const [valorLote, setValorLote] = useState<number | null>(null);
  const [valorCasa, setValorCasa] = useState<number | null>(null);
  const [valorCustomizacao, setValorCustomizacao] = useState<number | null>(0);
  const [valorJaPago, setValorJaPago] = useState<number | null>(0);
  const [prazoTotal, setPrazoTotal] = useState<number | null>(12 + prazoObraMeses);
  const [parcelaMensal, setParcelaMensal] = useState<number | null>(null);
  const [parcelaEditada, setParcelaEditada] = useState(false);
  const [rendaCliente, setRendaCliente] = useState<number | null>(null);
  const [prazoFinanciamentoAnos, setPrazoFinanciamentoAnos] = useState<number | null>(30);
  const [taxaFinanciamento, setTaxaFinanciamento] = useState<number | null>(() => {
    const ui = fracaoParaPercentualUi(template.taxa_juros_financiamento_anual);
    return ui ? parsearNumeroInput(ui) : 10;
  });

  const [resultado, setResultado] = useState<ResultadoCalculo | null>(null);
  const [ultimaOferta, setUltimaOferta] = useState<OfertaConfig | null>(null);
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);
  const [detalheAberto, setDetalheAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [entradaConf, setEntradaConf] = useState(0);
  const [parcelaMensalConf, setParcelaMensalConf] = useState(0);
  const [parcelaUnicaConf, setParcelaUnicaConf] = useState(0);
  const [fluxoFinalResultado, setFluxoFinalResultado] = useState<ResultadoCalculo | null>(null);
  const [detalheFinalAberto, setDetalheFinalAberto] = useState(false);

  const loteAtual = valorLote ?? 0;
  const sugestaoParcela = sugerirParcelaMensal(loteAtual);
  const prazoFase1 = prazoTotal != null ? prazoTotal - prazoObraMeses : null;
  const prazoTotalInvalido = prazoTotal != null && prazoTotal <= prazoObraMeses;

  function onValorLoteChange(n: number | null) {
    setValorLote(n);
    setResultado(null);
    if (!parcelaEditada && n != null && n > 0) {
      setParcelaMensal(sugerirParcelaMensal(n));
    }
  }

  function onCalcular() {
    setErro(null);
    setMensagem(null);
    const lote = valorLote;
    const casa = valorCasa;
    if (lote == null || lote <= 0) {
      setErro('Informe o valor do lote à vista.');
      return;
    }
    if (casa == null || casa < 0) {
      setErro('Informe o valor da casa.');
      return;
    }
    const custom = valorCustomizacao ?? 0;
    const jaPago = valorJaPago ?? 0;
    const prazoTotalInformado = prazoTotal;
    if (prazoTotalInformado == null || prazoTotalInformado < 1) {
      setErro('Informe o prazo total do contrato (meses).');
      return;
    }
    const prazoFase1Calc = prazoTotalInformado - prazoObraMeses;
    if (prazoFase1Calc < 1) {
      setErro(`O prazo total deve ser maior que o prazo de obra (${prazoObraMeses} meses).`);
      return;
    }
    const parcela = parcelaMensal;
    if (parcela == null || parcela < 0) {
      setErro('Informe a parcela mensal.');
      return;
    }
    const renda = rendaCliente ?? 0;
    const prazoFin = prazoFinanciamentoAnos;
    if (prazoFin == null || prazoFin < 1) {
      setErro('Informe o prazo do financiamento em anos.');
      return;
    }
    const taxaFrac =
      taxaFinanciamento == null
        ? template.taxa_juros_financiamento_anual
        : taxaFinanciamento / 100;
    if (taxaFrac < 0) {
      setErro('Taxa do financiamento inválida.');
      return;
    }

    const oferta: OfertaConfig = {
      valor_lote: lote,
      valor_casa: casa,
      valor_customizacao: custom,
      valor_ja_pago: jaPago,
      prazo_meses: prazoFase1Calc,
      parcela_mensal: parcela,
      renda_cliente: renda,
      prazo_financiamento_anos: prazoFin,
      taxa_financiamento_anual: taxaFrac,
    };
    const calc = calcularOferta(template, oferta);
    setUltimaOferta(oferta);
    setResultado(calc);
    setEntradaConf(calc.entrada_sugerida);
    setParcelaMensalConf(calc.parcela_mensal_usada);
    setParcelaUnicaConf(calc.parcela_unica_sugerida);
  }

  useEffect(() => {
    if (!resultado) {
      setFluxoFinalResultado(null);
      return;
    }
    setEntradaConf(resultado.entrada_sugerida);
    setParcelaMensalConf(resultado.parcela_mensal_usada);
    setParcelaUnicaConf(resultado.parcela_unica_sugerida);
    setFluxoFinalResultado(null);
    setDetalheFinalAberto(false);
  }, [resultado]);

  async function onSalvar() {
    if (!resultado || !ultimaOferta) return;
    setSalvando(true);
    setErro(null);
    setMensagem(null);
    const res = await criarSimuladorOfertaDoCard(cardId, {
      valor_lote: numeroParaInputBr(ultimaOferta.valor_lote),
      valor_casa: numeroParaInputBr(ultimaOferta.valor_casa),
      valor_customizacao: numeroParaInputBr(ultimaOferta.valor_customizacao),
      valor_ja_pago: numeroParaInputBr(ultimaOferta.valor_ja_pago),
      prazo_meses: String(ultimaOferta.prazo_meses),
      parcela_mensal: numeroParaInputBr(parcelaMensalConf),
      renda_cliente: numeroParaInputBr(ultimaOferta.renda_cliente),
      prazo_financiamento_anos: String(ultimaOferta.prazo_financiamento_anos),
      taxa_financiamento_anual:
        taxaFinanciamento == null ? '' : numeroParaInputBr(taxaFinanciamento),
      entrada_confirmada: numeroParaInputBr(entradaConf),
      parcela_unica_confirmada: numeroParaInputBr(parcelaUnicaConf),
    });
    setSalvando(false);
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    setMensagem('Oferta salva como rascunho!');
    router.refresh();
  }

  function gerarFluxoFinal() {
    if (!resultado || !ultimaOferta) return;
    const entrada_do_lote_conf = Math.max(0, entradaConf - resultado.comissao_amount);
    const ofertaConfirmada: OfertaConfig = {
      ...ultimaOferta,
      parcela_mensal: parcelaMensalConf,
      entrada_do_lote_override: entrada_do_lote_conf,
      parcela_unica_override: parcelaUnicaConf,
    };
    setFluxoFinalResultado(calcularOferta(template, ofertaConfirmada));
  }

  function onValorConfirmado(setter: (n: number) => void) {
    return (n: number) => {
      setter(n);
      setFluxoFinalResultado(null);
    };
  }

  const avisosSalvar = useMemo(() => {
    const vazio = { entrada: [] as string[], parcela: [] as string[], unica: [] as string[] };
    if (!resultado || !ultimaOferta) return vazio;
    const entrada: string[] = [];
    const parcela: string[] = [];
    const unica: string[] = [];

    if (entradaConf < resultado.entrada_sugerida) {
      entrada.push(
        `⚠ Entrada abaixo do sugerido (${formatarMoeda(resultado.entrada_sugerida)}). A loteadora pode exigir o valor mínimo.`,
      );
    }
    const entrada_do_lote_conf = Math.max(0, entradaConf - resultado.comissao_amount);
    if (entrada_do_lote_conf < resultado.entrada_do_lote) {
      entrada.push('⚠ Entrada do lote insuficiente para cumprir a entrada mínima da loteadora.');
    }

    if (parcelaMensalConf < resultado.parcela_mensal_usada) {
      parcela.push(
        `⚠ Parcela mensal abaixo do sugerido (${formatarMoeda(resultado.parcela_mensal_usada)}).`,
      );
    }

    const prazo_meses = ultimaOferta.prazo_meses;
    let saldo = ultimaOferta.valor_lote - ultimaOferta.valor_ja_pago - entrada_do_lote_conf;
    for (let m = 1; m < prazo_meses; m += 1) {
      saldo = Math.max(0, saldo * (1 + template.taxa_juros_parcelado_mes) - parcelaMensalConf);
    }
    const saldo_ultimo = saldo * (1 + template.taxa_juros_parcelado_mes);
    const min_quitar_conf = Math.max(0, saldo_ultimo - parcelaMensalConf);
    if (parcelaUnicaConf < min_quitar_conf) {
      unica.push(
        `⚠ Parcela única insuficiente para quitar o lote (mínimo: ${formatarMoeda(min_quitar_conf)}).`,
      );
    } else if (parcelaUnicaConf < resultado.parcela_unica_sugerida) {
      unica.push(
        '⚠ Parcela única abaixo do sugerido. O cliente cobrirá menos de 30% do valor antes da obra.',
      );
    }

    return { entrada, parcela, unica };
  }, [
    entradaConf,
    parcelaMensalConf,
    parcelaUnicaConf,
    resultado,
    template.taxa_juros_parcelado_mes,
    ultimaOferta,
  ]);

  const cardsTotais = useMemo((): CardResultadoItem[] => {
    if (!resultado) return [];
    return [
      {
        label: 'Valor total à vista',
        valor: formatarMoeda(resultado.vte_avista),
        sublabel: 'sem juros do crédito-ponte',
        destaque: true,
      },
      {
        label: 'Valor total à prazo',
        valor: formatarMoeda(resultado.vte),
        sublabel: 'com financiamento da obra',
        destaque: true,
      },
    ];
  }, [resultado]);

  const cardsSugeridos = useMemo((): CardResultadoItem[] => {
    if (!resultado) return [];
    return [
      { label: 'Entrada sugerida', valor: formatarMoeda(resultado.entrada_sugerida) },
      {
        label: 'Parcela mensal sugerida',
        valor: `${formatarMoeda(resultado.parcela_mensal_usada)} × ${resultado.quantidade_parcelas_total} meses`,
      },
      {
        label: 'Parcela única sugerida',
        valor: `${formatarMoeda(resultado.parcela_unica_sugerida)} no mês ${resultado.mes_parcela_unica}`,
      },
      { label: 'Saldo a financiar estimado', valor: formatarMoeda(resultado.saldo_financiar) },
      {
        label: '1ª parcela SAC estimada',
        valor: formatarMoeda(resultado.parcela_sac_primeira),
      },
      {
        label: 'Última parcela SAC estimada',
        valor: formatarMoeda(resultado.parcela_sac_ultima),
      },
    ];
  }, [resultado]);

  const linhasCascata =
    resultado && ultimaOferta
      ? [
          {
            label: 'Custo da casa + customização',
            valor: ultimaOferta.valor_casa + ultimaOferta.valor_customizacao,
          },
          { label: 'Custo do lote', valor: ultimaOferta.valor_lote },
          { label: 'ITBI', valor: resultado.itbi_amount },
          { label: 'Taxa plataforma', valor: resultado.taxa_plataforma_amount },
          { label: 'Taxa gestão', valor: resultado.taxa_gestao_amount },
          { label: 'Lucro loteadora', valor: resultado.lucro_loteadora_amount },
          { label: 'Lucro Moní', valor: resultado.lucro_moni_amount },
          { label: 'Lucro franqueado', valor: resultado.lucro_franqueado_amount },
          { label: 'Juros da obra (crédito-ponte)', valor: resultado.juros_obra_total },
          { label: 'Impostos', valor: resultado.impostos_amount },
          { label: 'Comissão corretor', valor: resultado.comissao_amount },
          { label: '= VALOR TOTAL À VISTA', valor: resultado.vte_avista, destaque: true },
          { label: '= VALOR TOTAL À PRAZO', valor: resultado.vte, destaque: true },
        ]
      : [];

  const saldoFinalDiferente = Boolean(
    resultado &&
      fluxoFinalResultado &&
      Math.round(fluxoFinalResultado.saldo_financiar) !== Math.round(resultado.saldo_financiar),
  );

  return (
    <div className="flex flex-col gap-6">
      {erro ? (
        <div
          className="moni-tag-atrasado px-4 py-3 text-sm"
          role="alert"
          style={{ borderRadius: 'var(--moni-radius-md)' }}
        >
          {erro}
        </div>
      ) : null}
      {mensagem ? (
        <div
          className="moni-tag-concluido px-4 py-3 text-sm"
          role="status"
          style={{ borderRadius: 'var(--moni-radius-md)' }}
        >
          {mensagem}
        </div>
      ) : null}

      <form
        className="rounded-[var(--moni-radius-lg)] p-4 sm:p-5"
        style={{
          border: 'var(--moni-border-width) solid var(--moni-border-default)',
          background: 'var(--moni-surface-0)',
          boxShadow: 'var(--moni-shadow-card)',
        }}
        onSubmit={(e) => {
          e.preventDefault();
          onCalcular();
        }}
      >
        <h2
          className="text-lg"
          style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
        >
          Calculadora da oferta
        </h2>
        <p className="mt-1 text-sm" style={hintStyle}>
          O cálculo roda neste navegador, com as premissas do template.
        </p>
        <QuadroPremissasTemplate template={template} />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo
            label="Valor do lote à vista (R$)"
            value={valorLote}
            onChange={onValorLoteChange}
            placeholder="180.000"
          />
          <Campo
            label="Valor da casa (R$)"
            value={valorCasa}
            onChange={(v) => {
              setValorCasa(v);
              setResultado(null);
            }}
            placeholder="320.000"
          />
          <Campo
            label="Valor da customização (R$)"
            value={valorCustomizacao}
            onChange={(v) => {
              setValorCustomizacao(v);
              setResultado(null);
            }}
            placeholder="0"
          />
          <Campo
            label="Valor já pago à loteadora (R$)"
            value={valorJaPago}
            onChange={(v) => {
              setValorJaPago(v);
              setResultado(null);
            }}
            placeholder="0"
          />
          <label className="block" htmlFor="prazo_total_contrato">
            <span className={labelCls} style={labelStyle}>
              Prazo total do contrato (meses)
            </span>
            <CampoNumeroBr
              id="prazo_total_contrato"
              name="prazo_total_contrato"
              className={fieldCls}
              style={fieldStyle}
              valor={prazoTotal}
              inteiro
              onChange={(n) => {
                setPrazoTotal(n);
                setResultado(null);
              }}
              placeholder={String(12 + prazoObraMeses)}
              aria-invalid={prazoTotalInvalido}
              aria-describedby="prazo_total_contrato_hint"
            />
            <span
              id="prazo_total_contrato_hint"
              className="mt-1 block text-[11px]"
              style={hintStyle}
            >
              Fase 1: {prazoFase1 != null ? prazoFase1 : '—'} meses · Obra: {prazoObraMeses} meses
            </span>
            {prazoTotalInvalido ? (
              <span
                className="mt-1 block text-[11px]"
                role="alert"
                style={{
                  color: 'var(--moni-status-overdue-text)',
                  fontFamily: 'var(--moni-font-sans)',
                }}
              >
                O prazo total deve ser maior que o prazo de obra ({prazoObraMeses} meses).
              </span>
            ) : null}
          </label>
          <label className="block">
            <span className={labelCls} style={labelStyle}>
              Parcela mensal · sugestão por faixa: {formatarMoeda(sugestaoParcela)}
            </span>
            <CampoNumeroBr
              className={fieldCls}
              style={fieldStyle}
              valor={parcelaMensal}
              onChange={(n) => {
                setParcelaMensal(n);
                setParcelaEditada(true);
                setResultado(null);
              }}
              placeholder={formatarNumeroInput(sugestaoParcela)}
            />
          </label>
          <Campo
            label="Renda do cliente (R$/mês)"
            value={rendaCliente}
            onChange={(v) => {
              setRendaCliente(v);
              setResultado(null);
            }}
            placeholder="12.000"
          />
          <Campo
            label="Prazo do financiamento (anos)"
            value={prazoFinanciamentoAnos}
            onChange={(v) => {
              setPrazoFinanciamentoAnos(v);
              setResultado(null);
            }}
            placeholder="30"
            inteiro
          />
          <Campo
            label="Taxa do financiamento (% ao ano)"
            value={taxaFinanciamento}
            onChange={(v) => {
              setTaxaFinanciamento(v);
              setResultado(null);
            }}
            placeholder="10"
          />
        </div>
        <button
          type="submit"
          className="mt-6 min-h-[44px] rounded-[var(--moni-radius-md)] px-5 text-sm font-medium text-white"
          style={{ background: 'var(--moni-navy-800)' }}
        >
          Calcular
        </button>
      </form>

      {resultado ? (
        <>
          <div className="flex flex-col gap-3">
            <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2">
              {cardsTotais.map((c) => (
                <CardResultado key={c.label} {...c} />
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cardsSugeridos.map((c) => (
                <CardResultado key={c.label} {...c} />
              ))}
            </div>
          </div>

          {resultado.alertas.map((a) => (
            <div
              key={a.tipo}
              className="moni-tag-atrasado px-4 py-3 text-sm"
              role="status"
              style={{ borderRadius: 'var(--moni-radius-md)' }}
            >
              {a.mensagem}
            </div>
          ))}

          <div>
            <button
              type="button"
              onClick={() => setDetalhesAbertos((v) => !v)}
              className="min-h-[44px] rounded-[var(--moni-radius-md)] px-4 text-sm font-medium"
              style={{
                border: 'var(--moni-border-width) solid var(--moni-border-default)',
                background: 'var(--moni-surface-0)',
                color: 'var(--moni-text-primary)',
              }}
            >
              {detalhesAbertos ? 'Ocultar detalhes' : 'Ver detalhes'}
            </button>
          </div>

          {detalhesAbertos ? (
            <div className="flex flex-col gap-6">
              <Secao titulo="Composição do preço">
                <TabelaSimples
                  linhas={linhasCascata.map((l) => ({
                    cols: [l.label, formatarMoeda(l.valor)],
                    destaque: l.destaque,
                  }))}
                />
              </Secao>
              <Secao titulo="Fluxo mês a mês sugerido">
                <TabelaFluxo
                  fluxo={resultado.fluxo}
                  detalheAberto={detalheAberto}
                  onToggleDetalhe={() => setDetalheAberto((v) => !v)}
                />
              </Secao>
              <Secao titulo="Detalhamento da parcela única">
                <p className="text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
                  A parcela única de {formatarMoeda(resultado.parcela_unica_sugerida)} é o maior entre o
                  mínimo para quitar o lote (
                  {formatarMoeda(resultado.parcela_unica_detalhe.min_quitar_lote)}) e o mínimo para
                  atingir 30% do VTE (
                  {formatarMoeda(resultado.parcela_unica_detalhe.min_atingir_30pct)}). Isso cobre{' '}
                  {resultado.parcela_unica_detalhe.pct_vte_antes_obra.toLocaleString('pt-BR', {
                    maximumFractionDigits: 1,
                  })}
                  % do valor total antes do início da obra.
                </p>
              </Secao>
            </div>
          ) : null}

          <div
            className="rounded-[var(--moni-radius-lg)] p-4 sm:p-5"
            style={{
              border: 'var(--moni-border-width) solid var(--moni-border-default)',
              background: 'var(--moni-surface-0)',
              boxShadow: 'var(--moni-shadow-card)',
            }}
          >
            <h3
              className="text-lg"
              style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
            >
              Salvar oferta
            </h3>
            <p className="mt-1 text-sm" style={hintStyle}>
              Ajuste o que vai constar no contrato e grave como rascunho.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <CampoMoedaConfirmado
                label="Entrada confirmada (R$)"
                valor={entradaConf}
                onValorChange={onValorConfirmado(setEntradaConf)}
                avisos={avisosSalvar.entrada}
              />
              <CampoMoedaConfirmado
                label="Parcela mensal confirmada (R$)"
                valor={parcelaMensalConf}
                onValorChange={onValorConfirmado(setParcelaMensalConf)}
                avisos={avisosSalvar.parcela}
              />
              <CampoMoedaConfirmado
                label="Parcela única confirmada (R$)"
                valor={parcelaUnicaConf}
                onValorChange={onValorConfirmado(setParcelaUnicaConf)}
                avisos={avisosSalvar.unica}
              />
            </div>
            <div className="mt-6 flex flex-col gap-4">
            <button
              type="button"
              onClick={gerarFluxoFinal}
              className="min-h-[44px] self-start rounded-[var(--moni-radius-md)] px-5 text-sm font-medium"
              style={{
                border: 'var(--moni-border-width) solid var(--moni-border-default)',
                background: 'var(--moni-surface-0)',
                color: 'var(--moni-text-primary)',
              }}
            >
              Gerar fluxo de pagamentos final
            </button>
            {fluxoFinalResultado ? (
              <div
                className="rounded-[var(--moni-radius-md)] p-4"
                style={{
                  border: 'var(--moni-border-width) solid var(--moni-border-default)',
                  background: 'var(--moni-surface-100)',
                }}
              >
                <h4
                  className="mb-3 text-sm font-semibold"
                  style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' }}
                >
                  Fluxo de pagamentos final
                </h4>
                <TabelaFluxo
                  fluxo={fluxoFinalResultado.fluxo}
                  detalheAberto={detalheFinalAberto}
                  onToggleDetalhe={() => setDetalheFinalAberto((v) => !v)}
                />
                <div className="mt-4 flex flex-col gap-1 text-sm" style={{ fontFamily: 'var(--moni-font-sans)' }}>
                  <p
                    style={{
                      color: saldoFinalDiferente
                        ? 'var(--moni-status-overdue-text)'
                        : 'var(--moni-text-secondary)',
                      fontWeight: saldoFinalDiferente ? 600 : 400,
                    }}
                  >
                    Saldo a financiar final: {formatarMoeda(fluxoFinalResultado.saldo_financiar)}
                    {saldoFinalDiferente ? (
                      <span>
                        {' '}
                        ({fluxoFinalResultado.saldo_financiar > resultado.saldo_financiar ? '+' : ''}
                        {formatarMoeda(fluxoFinalResultado.saldo_financiar - resultado.saldo_financiar)}{' '}
                        vs. sugerido {formatarMoeda(resultado.saldo_financiar)})
                      </span>
                    ) : null}
                  </p>
                  <p style={{ color: 'var(--moni-text-secondary)' }}>
                    1ª SAC final: {formatarMoeda(fluxoFinalResultado.parcela_sac_primeira)}
                  </p>
                </div>
              </div>
            ) : null}
            <button
              type="button"
              disabled={salvando}
              onClick={() => void onSalvar()}
              className="min-h-[44px] self-start rounded-[var(--moni-radius-md)] px-5 text-sm font-medium text-white disabled:opacity-50"
              style={{ background: 'var(--moni-navy-800)' }}
            >
              {salvando ? 'Salvando…' : 'Salvar oferta'}
            </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function pctLabel(fracao: number, casas = 2): string {
  return `${(Number(fracao) * 100).toFixed(casas)}%`;
}

function textoEntradaMinima(entrada: TemplateConfig['entrada_minima_loteadora']): string {
  if (!entrada) return 'Não configurada';
  if (entrada.tipo === 'percentual') {
    return `${(entrada.valor * 100).toFixed(0)}% do valor do lote`;
  }
  return formatarMoeda(entrada.valor);
}

function QuadroPremissasTemplate({ template }: { template: TemplateConfig }) {
  const linhas: Array<{ label: string; valor: string }> = [
    { label: 'ITBI', valor: pctLabel(template.percentual_itbi) },
    { label: 'Impostos', valor: pctLabel(template.percentual_impostos) },
    { label: 'Taxa de plataforma', valor: pctLabel(template.percentual_taxa_plataforma) },
    { label: 'Taxa de gestão', valor: pctLabel(template.percentual_taxa_gestao) },
    { label: 'Lucro loteadora', valor: pctLabel(template.percentual_lucro_loteadora) },
    { label: 'Lucro Moní', valor: pctLabel(template.percentual_lucro_moni) },
    { label: 'Lucro Franqueado', valor: pctLabel(template.percentual_lucro_franqueado) },
    { label: 'Comissão corretor', valor: pctLabel(template.percentual_comissao_corretor) },
    { label: 'Prazo de obra', valor: `${template.prazo_obra_meses} meses` },
    {
      label: 'Juros crédito-ponte',
      valor: `${pctLabel(template.taxa_juros_credito_ponte)} ao mês`,
    },
    {
      label: 'Juros parcelado (lote)',
      valor: `${pctLabel(template.taxa_juros_parcelado_mes)} ao mês`,
    },
    {
      label: 'Taxa de financiamento padrão',
      valor: `${pctLabel(template.taxa_juros_financiamento_anual)} ao ano`,
    },
    {
      label: 'Entrada mínima loteadora',
      valor: textoEntradaMinima(template.entrada_minima_loteadora),
    },
  ];

  return (
    <div
      className="mt-4 rounded-[var(--moni-radius-md)] p-3 sm:p-4"
      style={{
        border: 'var(--moni-border-width) solid var(--moni-border-default)',
        background: 'var(--moni-surface-100)',
      }}
    >
      <h3
        className="text-xs font-medium"
        style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' }}
      >
        Premissas do template
      </h3>
      <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {linhas.map((l) => (
          <div key={l.label} className="flex items-baseline justify-between gap-3">
            <dt className="text-[11px]" style={hintStyle}>
              {l.label}
            </dt>
            <dd
              className="text-[11px] font-medium"
              style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}
            >
              {l.valor}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function CampoMoedaConfirmado({
  label,
  valor,
  onValorChange,
  avisos,
}: {
  label: string;
  valor: number;
  onValorChange: (n: number) => void;
  avisos?: string[];
}) {
  return (
    <label className="block">
      <span className={labelCls} style={labelStyle}>
        {label}
      </span>
      <CampoNumeroBr
        className={fieldCls}
        style={fieldStyle}
        valor={valor}
        onChange={(n) => onValorChange(n ?? 0)}
      />
      {avisos?.map((a) => (
        <span
          key={a}
          className="mt-1 block text-[11px]"
          role="alert"
          style={{
            color: 'var(--moni-status-overdue-text)',
            fontFamily: 'var(--moni-font-sans)',
          }}
        >
          {a}
        </span>
      ))}
    </label>
  );
}

function Campo({
  label,
  value,
  onChange,
  placeholder,
  inteiro,
  avisos,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  inteiro?: boolean;
  avisos?: string[];
}) {
  return (
    <label className="block">
      <span className={labelCls} style={labelStyle}>
        {label}
      </span>
      <CampoNumeroBr
        className={fieldCls}
        style={fieldStyle}
        valor={value}
        onChange={onChange}
        inteiro={inteiro}
        placeholder={placeholder}
      />
      {avisos?.map((a) => (
        <span
          key={a}
          className="mt-1 block text-[11px]"
          role="alert"
          style={{
            color: 'var(--moni-status-overdue-text)',
            fontFamily: 'var(--moni-font-sans)',
          }}
        >
          {a}
        </span>
      ))}
    </label>
  );
}

function CardResultado({ label, valor, sublabel, destaque }: CardResultadoItem) {
  return (
    <div
      className="rounded-[var(--moni-radius-lg)] p-4"
      style={
        destaque
          ? {
              border: 'var(--moni-border-width) solid var(--moni-gold-400)',
              background: 'var(--moni-gold-50)',
              boxShadow: 'var(--moni-shadow-card)',
            }
          : {
              border: 'var(--moni-border-width) solid var(--moni-border-default)',
              background: 'var(--moni-surface-0)',
              boxShadow: 'var(--moni-shadow-card)',
            }
      }
    >
      <p
        className="text-xs"
        style={
          destaque
            ? {
                ...hintStyle,
                color: 'var(--moni-gold-800)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                fontWeight: 600,
              }
            : hintStyle
        }
      >
        {label}
      </p>
      <p
        className="mt-1 text-base font-medium"
        style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' }}
      >
        {valor}
      </p>
      {sublabel ? (
        <p className="mt-1 text-xs" style={hintStyle}>
          {sublabel}
        </p>
      ) : null}
    </div>
  );
}

function TabelaFluxo({
  fluxo,
  detalheAberto,
  onToggleDetalhe,
}: {
  fluxo: LinhaFluxo[];
  detalheAberto: boolean;
  onToggleDetalhe: () => void;
}) {
  const celVisivel = { background: 'var(--moni-surface-50)' } as const;
  const celDetalhe = { background: 'var(--moni-surface-0)' } as const;

  return (
    <div className="overflow-x-auto">
      <table
        className="min-w-full text-left text-xs sm:text-sm"
        style={{ fontFamily: 'var(--moni-font-sans)' }}
      >
        <thead>
          <tr style={{ color: 'var(--moni-text-tertiary)' }}>
            <th className="whitespace-nowrap px-2 py-2 font-medium" style={celVisivel}>
              Mês
            </th>
            <th className="whitespace-nowrap px-2 py-2 font-medium" style={celVisivel}>
              Fase
            </th>
            <th className="whitespace-nowrap px-2 py-2 font-medium" style={celVisivel}>
              Entradas do cliente
            </th>
            <th className="px-1 py-2" style={celVisivel}>
              <button
                type="button"
                onClick={onToggleDetalhe}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center text-base transition-colors"
                style={{ color: 'var(--moni-text-tertiary)' }}
                title={detalheAberto ? 'Ocultar detalhes' : 'Mostrar detalhes'}
                aria-expanded={detalheAberto}
                aria-label={detalheAberto ? 'Ocultar detalhes' : 'Mostrar detalhes'}
              >
                {detalheAberto ? '−' : '+'}
              </button>
            </th>
            {detalheAberto ? (
              <th className="whitespace-nowrap px-2 py-2 font-medium" style={celDetalhe}>
                Pagamentos à loteadora
              </th>
            ) : null}
            {detalheAberto ? (
              <th className="whitespace-nowrap px-2 py-2 font-medium" style={celDetalhe}>
                Saldo do lote
              </th>
            ) : null}
            {detalheAberto ? (
              <th className="whitespace-nowrap px-2 py-2 font-medium" style={celDetalhe}>
                Juros do lote
              </th>
            ) : null}
            {detalheAberto ? (
              <th className="whitespace-nowrap px-2 py-2 font-medium" style={celDetalhe}>
                Desembolso de obra
              </th>
            ) : null}
            {detalheAberto ? (
              <th className="whitespace-nowrap px-2 py-2 font-medium" style={celDetalhe}>
                Juros de obra
              </th>
            ) : null}
            {detalheAberto ? (
              <th className="whitespace-nowrap px-2 py-2 font-medium" style={celDetalhe}>
                Saldo CP
              </th>
            ) : null}
            <th className="whitespace-nowrap px-2 py-2 font-medium" style={celVisivel}>
              Saídas
            </th>
          </tr>
        </thead>
        <tbody>
          {fluxo.map((l) => (
            <tr
              key={`${l.mes}-${l.fase}-${l.etapa_obra ?? ''}`}
              style={{
                borderTop: 'var(--moni-border-width) solid var(--moni-border-default)',
                color: 'var(--moni-text-secondary)',
              }}
            >
              <td className="px-2 py-2" style={celVisivel}>
                {l.mes}
              </td>
              <td className="whitespace-nowrap px-2 py-2" style={celVisivel}>
                {FASE_LABEL[l.fase] ?? l.fase}
              </td>
              <td className="whitespace-nowrap px-2 py-2" style={celVisivel}>
                {formatarMoeda(l.entrada_cliente)}
              </td>
              <td className="px-1 py-2" style={celVisivel} aria-hidden="true" />
              {detalheAberto ? (
                <td className="whitespace-nowrap px-2 py-2 text-right" style={celDetalhe}>
                  {l.pagamento_loteadora > 0 ? formatarMoeda(l.pagamento_loteadora) : '—'}
                </td>
              ) : null}
              {detalheAberto ? (
                <td className="whitespace-nowrap px-2 py-2" style={celDetalhe}>
                  {formatarMoeda(l.saldo_lote)}
                </td>
              ) : null}
              {detalheAberto ? (
                <td className="whitespace-nowrap px-2 py-2" style={celDetalhe}>
                  {formatarMoeda(l.juros_lote_mes)}
                </td>
              ) : null}
              {detalheAberto ? (
                <td className="whitespace-nowrap px-2 py-2 text-right" style={celDetalhe}>
                  {l.saidas_obra > 0 ? formatarMoeda(l.saidas_obra) : '—'}
                </td>
              ) : null}
              {detalheAberto ? (
                <td className="whitespace-nowrap px-2 py-2" style={celDetalhe}>
                  {formatarMoeda(l.juros_obra_mes)}
                </td>
              ) : null}
              {detalheAberto ? (
                <td className="whitespace-nowrap px-2 py-2" style={celDetalhe}>
                  {formatarMoeda(l.saldo_credito_ponte)}
                </td>
              ) : null}
              <td className="whitespace-nowrap px-2 py-2" style={celVisivel}>
                {formatarMoeda(l.saidas_total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section
      className="rounded-[var(--moni-radius-lg)] p-4 sm:p-5"
      style={{
        border: 'var(--moni-border-width) solid var(--moni-border-default)',
        background: 'var(--moni-surface-0)',
        boxShadow: 'var(--moni-shadow-card)',
      }}
    >
      <h3
        className="mb-3 text-base"
        style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
      >
        {titulo}
      </h3>
      {children}
    </section>
  );
}

function TabelaSimples({
  linhas,
}: {
  linhas: Array<{ cols: string[]; destaque?: boolean; informativo?: boolean; sublabel?: string }>;
}) {
  return (
    <table className="w-full text-left text-sm" style={{ fontFamily: 'var(--moni-font-sans)' }}>
      <tbody>
        {linhas.map((l) => (
          <tr
            key={l.cols[0]}
            style={{
              borderTop: 'var(--moni-border-width) solid var(--moni-border-default)',
              color: l.informativo
                ? 'var(--moni-text-tertiary)'
                : l.destaque
                  ? 'var(--moni-text-primary)'
                  : 'var(--moni-text-secondary)',
              fontWeight: l.destaque && !l.informativo ? 600 : 400,
            }}
          >
            <td className={l.informativo ? 'py-1 pl-3 pr-3' : 'py-2 pr-3'}>
              {l.cols[0]}
              {l.sublabel ? (
                <span className="ml-1 text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
                  {l.sublabel}
                </span>
              ) : null}
            </td>
            <td className={`whitespace-nowrap text-right ${l.informativo ? 'py-1' : 'py-2'}`}>
              {l.cols[1]}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
