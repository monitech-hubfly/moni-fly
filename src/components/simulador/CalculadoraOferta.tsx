'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { criarSimuladorOfertaDoCard } from '@/lib/actions/loteamento-simulador-template';
import {
  fracaoParaPercentualUi,
  numeroParaInputBr,
} from '@/lib/loteamento-simulador-template';
import { CampoNumeroBr } from '@/components/simulador/CampoNumeroBr';
import {
  CardResultado,
  Secao,
  TabelaFluxo,
  TabelaSimples,
} from '@/components/simulador/oferta-resultado-ui';
import {
  cardsTotaisResumo,
  linhasComposicaoPreco,
  type CardResultadoItem,
} from '@/lib/simulador/oferta-resultado-helpers';
import {
  calcularOferta,
  formatarMoeda,
  sugerirParcelaMensal,
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

const dicaConfStyle = {
  color: 'var(--moni-status-attention-text)',
  fontFamily: 'var(--moni-font-sans)',
} as const;

function calcularMinimosConfirmados(params: {
  valorLote: number;
  valorJaPago: number;
  comissao: number;
  entradaConf: number;
  parcelaMensalConf: number;
  prazoFase1: number;
  taxaJurosParcelado: number;
  vtp: number;
}): { parcelaUnicaNecessaria: number; parcelaUnicaMinima: number } {
  const entrada_do_lote = Math.max(0, params.entradaConf - params.comissao);
  let saldo = Math.max(0, params.valorLote - params.valorJaPago - entrada_do_lote);
  const nMensaisAntes = Math.max(0, params.prazoFase1 - 1);
  for (let m = 1; m <= nMensaisAntes; m += 1) {
    saldo = Math.max(0, saldo * (1 + params.taxaJurosParcelado) - params.parcelaMensalConf);
  }
  const saldoAposMensal = saldo * (1 + params.taxaJurosParcelado) - params.parcelaMensalConf;
  const parcelaUnicaNecessaria = Math.max(0, saldoAposMensal);
  const pagamentosAcumulados = params.entradaConf + params.prazoFase1 * params.parcelaMensalConf;
  const threshold30 = params.vtp * 0.3 - pagamentosAcumulados;
  const parcelaUnicaMinima = Math.max(parcelaUnicaNecessaria, Math.max(0, threshold30));
  return { parcelaUnicaNecessaria, parcelaUnicaMinima };
}

export function CalculadoraOferta({ template, loteadorId, kanbanCardId }: Props) {
  const router = useRouter();
  const cardId = kanbanCardId || loteadorId;

  const prazoObraMeses = Math.max(0, Math.round(template.prazo_obra_meses));
  const [valorLote, setValorLote] = useState<number | null>(null);
  const [valorCasa, setValorCasa] = useState<number | null>(null);
  const [valorCustomizacao, setValorCustomizacao] = useState<number | null>(0);
  const [valorJaPago, setValorJaPago] = useState<number | null>(0);
  const [prazoTotal, setPrazoTotal] = useState<number | null>(12);
  const [parcelaMensal, setParcelaMensal] = useState<number | null>(null);
  const [parcelaEditada, setParcelaEditada] = useState(false);
  const [rendaCliente, setRendaCliente] = useState<number | null>(null);
  const [prazoFinanciamentoAnos, setPrazoFinanciamentoAnos] = useState<number | null>(30);
  const [taxaFinanciamento, setTaxaFinanciamento] = useState<number | null>(() => {
    const ui = fracaoParaPercentualUi(template.taxa_juros_financiamento_anual);
    return ui ? parsearNumeroInput(ui) : 10;
  });
  const [nomeOferta, setNomeOferta] = useState('');

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
    const unicaMinima = calcularMinimosConfirmados({
      valorLote: oferta.valor_lote,
      valorJaPago: oferta.valor_ja_pago,
      comissao: calc.comissao_amount,
      entradaConf: calc.entrada_sugerida,
      parcelaMensalConf: calc.parcela_mensal_usada,
      prazoFase1: oferta.prazo_meses,
      taxaJurosParcelado: template.taxa_juros_parcelado_mes,
      vtp: calc.vtp,
    }).parcelaUnicaMinima;
    setUltimaOferta(oferta);
    setResultado(calc);
    setEntradaConf(calc.entrada_sugerida);
    setParcelaMensalConf(calc.parcela_mensal_usada);
    setParcelaUnicaConf(Math.max(calc.parcela_unica_sugerida, unicaMinima));
  }

  useEffect(() => {
    if (!resultado) {
      setFluxoFinalResultado(null);
      return;
    }
    setEntradaConf(resultado.entrada_sugerida);
    setParcelaMensalConf(resultado.parcela_mensal_usada);
    setParcelaUnicaConf(
      aplicarMinimoParcelaUnica(
        resultado.entrada_sugerida,
        resultado.parcela_mensal_usada,
        resultado.parcela_unica_sugerida,
      ),
    );
    setFluxoFinalResultado(null);
    setDetalheFinalAberto(false);
  }, [resultado]);

  async function onSalvar() {
    if (!resultado || !ultimaOferta) return;
    const nome = nomeOferta.trim();
    if (!nome) {
      setErro('Informe o nome da oferta.');
      return;
    }
    setSalvando(true);
    setErro(null);
    setMensagem(null);
    const res = await criarSimuladorOfertaDoCard(cardId, {
      nome,
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

  const minimosConf = useMemo(() => {
    if (!resultado || !ultimaOferta) {
      return { parcelaUnicaNecessaria: 0, parcelaUnicaMinima: 0 };
    }
    return calcularMinimosConfirmados({
      valorLote: ultimaOferta.valor_lote,
      valorJaPago: ultimaOferta.valor_ja_pago,
      comissao: resultado.comissao_amount,
      entradaConf,
      parcelaMensalConf,
      prazoFase1: ultimaOferta.prazo_meses,
      taxaJurosParcelado: template.taxa_juros_parcelado_mes,
      vtp: resultado.vtp,
    });
  }, [
    entradaConf,
    parcelaMensalConf,
    resultado,
    template.taxa_juros_parcelado_mes,
    ultimaOferta,
  ]);

  function aplicarMinimoParcelaUnica(entrada: number, parcela: number, unicaAtual: number): number {
    if (!resultado || !ultimaOferta) return unicaAtual;
    const { parcelaUnicaMinima } = calcularMinimosConfirmados({
      valorLote: ultimaOferta.valor_lote,
      valorJaPago: ultimaOferta.valor_ja_pago,
      comissao: resultado.comissao_amount,
      entradaConf: entrada,
      parcelaMensalConf: parcela,
      prazoFase1: ultimaOferta.prazo_meses,
      taxaJurosParcelado: template.taxa_juros_parcelado_mes,
      vtp: resultado.vtp,
    });
    return unicaAtual < parcelaUnicaMinima ? parcelaUnicaMinima : unicaAtual;
  }

  function onEntradaConfirmada(n: number) {
    setEntradaConf(n);
    setParcelaUnicaConf((u) => aplicarMinimoParcelaUnica(n, parcelaMensalConf, u));
    setFluxoFinalResultado(null);
  }

  function onParcelaMensalConfirmada(n: number) {
    setParcelaMensalConf(n);
    setParcelaUnicaConf((u) => aplicarMinimoParcelaUnica(entradaConf, n, u));
    setFluxoFinalResultado(null);
  }

  function onParcelaUnicaConfirmada(n: number) {
    setParcelaUnicaConf(n);
    setFluxoFinalResultado(null);
  }

  const avisosSalvar = useMemo(() => {
    const vazio = { entrada: [] as string[], parcela: [] as string[], unica: [] as string[] };
    if (!resultado || !ultimaOferta) return vazio;
    const entrada: string[] = [];
    const parcela: string[] = [];
    const unica: string[] = [];

    if (entradaConf < resultado.entrada_sugerida) {
      entrada.push('⚠ Entrada abaixo do mínimo sugerido. A loteadora pode exigir o valor mínimo.');
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

    if (parcelaUnicaConf < minimosConf.parcelaUnicaNecessaria) {
      unica.push('⚠ Parcela única insuficiente para quitar o lote.');
    } else if (parcelaUnicaConf < resultado.parcela_unica_sugerida) {
      unica.push(
        '⚠ Parcela única abaixo do sugerido. O cliente cobrirá menos de 30% do valor antes da obra.',
      );
    }

    return { entrada, parcela, unica };
  }, [
    entradaConf,
    minimosConf.parcelaUnicaNecessaria,
    parcelaMensalConf,
    parcelaUnicaConf,
    resultado,
    ultimaOferta,
  ]);

  const cardsTotais = useMemo((): CardResultadoItem[] => {
    if (!resultado) return [];
    return cardsTotaisResumo(resultado);
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
      ? linhasComposicaoPreco(resultado, ultimaOferta)
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
        <label className="mt-4 block">
          <span className={labelCls} style={labelStyle}>
            Nome da oferta
          </span>
          <input
            className={fieldCls}
            style={fieldStyle}
            type="text"
            required
            placeholder='Ex.: "Oferta João Silva — Lote 12"'
            value={nomeOferta}
            onChange={(e) => setNomeOferta(e.target.value)}
          />
        </label>
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
              placeholder="12"
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
                onValorChange={onEntradaConfirmada}
                dica={
                  resultado
                    ? `⚠ Mínimo sugerido: ${formatarMoeda(resultado.entrada_sugerida)}`
                    : undefined
                }
                avisos={avisosSalvar.entrada}
              />
              <CampoMoedaConfirmado
                label="Parcela mensal confirmada (R$)"
                valor={parcelaMensalConf}
                onValorChange={onParcelaMensalConfirmada}
                avisos={avisosSalvar.parcela}
              />
              <CampoMoedaConfirmado
                label="Parcela única confirmada (R$)"
                valor={parcelaUnicaConf}
                onValorChange={onParcelaUnicaConfirmada}
                dica={`⚠ Mínimo para quitar o lote: ${formatarMoeda(minimosConf.parcelaUnicaNecessaria)}`}
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
  dica,
  avisos,
}: {
  label: string;
  valor: number;
  onValorChange: (n: number) => void;
  dica?: string;
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
      {dica ? (
        <span className="mt-1 block text-[11px]" style={dicaConfStyle}>
          {dica}
        </span>
      ) : null}
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
