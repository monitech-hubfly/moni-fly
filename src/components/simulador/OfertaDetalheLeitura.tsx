import {
  CardResultado,
  Secao,
  TabelaFluxo,
  TabelaSimples,
} from '@/components/simulador/oferta-resultado-ui';
import {
  cardsTotaisResumo,
  linhasComposicaoPreco,
} from '@/lib/simulador/oferta-resultado-helpers';
import {
  formatarMoedaBr,
  rowToTemplateConfig,
  type LoteamentoSimuladorTemplateRow,
  type SimulacaoPagamentoResumo,
} from '@/lib/loteamento-simulador-template';
import {
  calcularOferta,
  formatarMoeda,
  type OfertaConfig,
} from '@/lib/simulador/calcular-oferta';

type Props = {
  oferta: SimulacaoPagamentoResumo;
  template: LoteamentoSimuladorTemplateRow | null;
};

function n(v: number | null | undefined): number {
  return v != null && Number.isFinite(v) ? v : 0;
}

function ofertaParaConfig(oferta: SimulacaoPagamentoResumo): OfertaConfig {
  return {
    valor_lote: n(oferta.valor_lote),
    valor_casa: n(oferta.valor_casa),
    valor_customizacao: n(oferta.valor_customizacao),
    valor_ja_pago: n(oferta.valor_ja_pago),
    prazo_meses: Math.max(1, Math.round(n(oferta.prazo_meses) || 1)),
    parcela_mensal: n(oferta.parcela_mensal_confirmada ?? oferta.parcela_mensal),
    renda_cliente: n(oferta.renda_cliente ?? oferta.renda_informada_cliente),
    prazo_financiamento_anos: Math.max(0, Math.round(n(oferta.prazo_financiamento_anos))),
    taxa_financiamento_anual: oferta.taxa_financiamento_anual ?? undefined,
  };
}

function CampoSomenteLeitura({ label, valor }: { label: string; valor: number | null }) {
  return (
    <div className="block">
      <p
        className="text-xs font-medium"
        style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' }}
      >
        {label}
      </p>
      <p
        className="mt-1 min-h-[44px] rounded-[var(--moni-radius-md)] px-3 py-2 text-sm"
        style={{
          border: 'var(--moni-border-width) solid var(--moni-border-default)',
          background: 'var(--moni-surface-100)',
          color: 'var(--moni-text-primary)',
          fontFamily: 'var(--moni-font-sans)',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {valor != null ? formatarMoedaBr(valor) : '—'}
      </p>
    </div>
  );
}

export function OfertaDetalheLeitura({ oferta, template }: Props) {
  if (!template) {
    return (
      <p
        className="mt-6 text-sm"
        style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}
      >
        Não foi possível carregar o template desta oferta para recalcular o fluxo.
      </p>
    );
  }

  const tpl = rowToTemplateConfig(template);
  const cfg = ofertaParaConfig(oferta);
  const sugerido = calcularOferta(tpl, cfg);

  const entradaConf = oferta.entrada_confirmada;
  const parcelaMensalConf = oferta.parcela_mensal_confirmada ?? oferta.parcela_mensal;
  const parcelaUnicaConf = oferta.parcela_unica_confirmada;
  const temConfirmados =
    entradaConf != null && parcelaMensalConf != null && parcelaUnicaConf != null;

  const fluxoFinal =
    entradaConf != null && parcelaMensalConf != null && parcelaUnicaConf != null
      ? calcularOferta(tpl, {
          ...cfg,
          parcela_mensal: parcelaMensalConf,
          entrada_do_lote_override: Math.max(0, entradaConf - sugerido.comissao_amount),
          parcela_unica_override: parcelaUnicaConf,
          entrada_total_override: entradaConf,
        })
      : null;

  const detalheUnica = fluxoFinal ?? sugerido;
  const parcelaUnicaMostrada =
    temConfirmados && parcelaUnicaConf != null ? parcelaUnicaConf : sugerido.parcela_unica_sugerida;
  const excessoMoni = Math.max(
    0,
    parcelaUnicaMostrada - detalheUnica.parcela_unica_detalhe.min_quitar_lote,
  );
  const composicao = linhasComposicaoPreco(sugerido, cfg);

  return (
    <div className="mt-8 flex flex-col gap-6">
      <div className="print-no-break mx-auto grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2">
        {cardsTotaisResumo(sugerido).map((c) => (
          <CardResultado key={c.label} {...c} />
        ))}
      </div>

      <Secao titulo="Composição do preço" className="print-no-break">
        <TabelaSimples
          linhas={composicao.map((l) => ({
            cols: [l.label, formatarMoeda(l.valor)],
            destaque: l.destaque,
          }))}
        />
      </Secao>

      <Secao titulo="Detalhamento da parcela única" className="print-no-break">
        <p className="mb-3 text-sm" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
          A parcela única de {formatarMoeda(sugerido.parcela_unica_sugerida)} é o maior entre o mínimo
          para quitar o lote ({formatarMoeda(sugerido.parcela_unica_detalhe.min_quitar_lote)}) e o
          mínimo para atingir 30% do VTE (
          {formatarMoeda(sugerido.parcela_unica_detalhe.min_atingir_30pct)}). Isso cobre{' '}
          {sugerido.parcela_unica_detalhe.pct_vte_antes_obra.toLocaleString('pt-BR', {
            maximumFractionDigits: 1,
          })}
          % do valor total antes do início da obra.
        </p>
        <TabelaSimples
          linhas={[
            {
              cols: ['Parcela única calculada', formatarMoeda(sugerido.parcela_unica_sugerida)],
            },
            {
              cols: [
                'Mínimo para quitar o lote',
                formatarMoeda(detalheUnica.parcela_unica_detalhe.min_quitar_lote),
              ],
            },
            {
              cols: [
                'Threshold 30% do VTE',
                formatarMoeda(detalheUnica.parcela_unica_detalhe.min_atingir_30pct),
              ],
            },
            {
              cols: ['Excesso retido pela Moní', formatarMoeda(excessoMoni)],
              destaque: true,
            },
          ]}
        />
      </Secao>

      <Secao titulo="Valores confirmados" className="print-no-break">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <CampoSomenteLeitura label="Entrada confirmada" valor={entradaConf} />
          <CampoSomenteLeitura label="Parcela mensal confirmada" valor={parcelaMensalConf} />
          <CampoSomenteLeitura label="Parcela única confirmada" valor={parcelaUnicaConf} />
        </div>
      </Secao>

      {fluxoFinal ? (
        <Secao titulo="Fluxo de pagamentos final">
          <TabelaFluxo fluxo={fluxoFinal.fluxo} detalheAberto />
          <div
            className="mt-4 flex flex-col gap-1 text-sm"
            style={{ fontFamily: 'var(--moni-font-sans)', color: 'var(--moni-text-secondary)' }}
          >
            <p>Saldo a financiar final: {formatarMoeda(fluxoFinal.saldo_financiar)}</p>
            <p>1ª SAC final: {formatarMoeda(fluxoFinal.parcela_sac_primeira)}</p>
          </div>
        </Secao>
      ) : (
        <Secao titulo="Fluxo de pagamentos final">
          <p className="text-sm" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
            Valores confirmados não preenchidos
          </p>
        </Secao>
      )}
    </div>
  );
}
