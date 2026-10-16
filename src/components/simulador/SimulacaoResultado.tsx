'use client';

import { useEffect, useRef, useState } from 'react';
import { CampoNumeroBr } from '@/components/simulador/CampoNumeroBr';
import {
  formatarMoeda,
  type LinhaFluxo,
  type ResultadoCalculo,
} from '@/lib/simulador/calcular-oferta';
import { Secao } from '@/components/simulador/oferta-resultado-ui';

export type ValoresConfirmadosOferta = {
  entrada: number;
  mensal: number;
  unica: number;
};

type Props = {
  resultado: ResultadoCalculo;
  prazoFinanciamentoAnos?: number;
  taxaJurosPct?: number;
  valoresConfirmados?: ValoresConfirmadosOferta | null;
  recalcToken?: number;
  onRecalcular: (valores: ValoresConfirmadosOferta) => void;
  onVerMemorial: () => void;
};

function minimoUnica(entrada: number, mensal: number, base: ResultadoCalculo): number {
  const deltaEntrada = entrada - base.entrada_sugerida;
  const deltaMensais = (mensal - base.parcela_mensal_usada) * base.mes_parcela_unica;
  return Math.max(
    base.parcela_unica_detalhe.min_quitar_lote,
    base.parcela_unica_sugerida - deltaEntrada - deltaMensais,
  );
}

function AvisoMinimo({ minimo, atual }: { minimo: number; atual: number }) {
  const abaixo = atual < minimo - 0.005;
  return (
    <p className={`jornadaSimAvisoMinimo${abaixo ? ' is-abaixo' : ''}`}>
      ⚠ Mínimo sugerido: {formatarMoeda(minimo)}
    </p>
  );
}

function Metrica({ label, valor, sub }: { label: string; valor: string; sub?: string }) {
  return (
    <div className="jornadaSimMetrica">
      <p className="jornadaSimMetricaLabel">{label}</p>
      <p className="jornadaSimMetricaValor">{valor}</p>
      {sub ? <p className="jornadaSimMetricaSub">{sub}</p> : null}
    </div>
  );
}

function TabelaFluxoCliente({ fluxo }: { fluxo: LinhaFluxo[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="jornadaFluxoCliente">
        <thead>
          <tr>
            <th>Mês</th>
            <th>Entradas do cliente</th>
          </tr>
        </thead>
        <tbody>
          {fluxo.map((l) => (
            <tr key={`${l.mes}-${l.fase}-${l.etapa_obra ?? ''}`}>
              <td>{l.fase === 'pre_contrato' ? '—' : l.mes}</td>
              <td>{formatarMoeda(l.entrada_cliente)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SimulacaoResultado({
  resultado,
  prazoFinanciamentoAnos,
  taxaJurosPct,
  valoresConfirmados,
  recalcToken = 0,
  onRecalcular,
  onVerMemorial,
}: Props) {
  const [fluxoAberto, setFluxoAberto] = useState(false);
  const [personalizarAberto, setPersonalizarAberto] = useState(false);
  const [entradaConf, setEntradaConf] = useState(
    valoresConfirmados?.entrada ?? resultado.entrada_sugerida,
  );
  const [mensalConf, setMensalConf] = useState(
    valoresConfirmados?.mensal ?? resultado.parcela_mensal_usada,
  );
  const [unicaConf, setUnicaConf] = useState(
    valoresConfirmados?.unica ?? resultado.parcela_unica_sugerida,
  );
  const [mostrarFeedback, setMostrarFeedback] = useState(false);
  const valoresRef = useRef({
    entrada: entradaConf,
    mensal: mensalConf,
    unica: unicaConf,
  });
  valoresRef.current = { entrada: entradaConf, mensal: mensalConf, unica: unicaConf };

  const aplicado = valoresConfirmados != null;
  const entradaCard = aplicado ? valoresConfirmados.entrada : resultado.entrada_sugerida;
  const mensalCard = aplicado ? valoresConfirmados.mensal : resultado.parcela_mensal_usada;
  const unicaCard = aplicado ? valoresConfirmados.unica : resultado.parcela_unica_sugerida;
  const unicaMinima = minimoUnica(entradaConf, mensalConf, resultado);

  const taxaPctLabel =
    taxaJurosPct != null ? String(taxaJurosPct).replace('.', ',') : null;

  useEffect(() => {
    if (recalcToken === 0) return;
    setMostrarFeedback(true);
    document
      .getElementById('jornada-sim-card')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [recalcToken]);

  function onEntradaChange(n: number | null) {
    const v = n ?? 0;
    const unica = minimoUnica(v, mensalConf, resultado);
    setEntradaConf(v);
    setUnicaConf(unica);
    valoresRef.current = { entrada: v, mensal: mensalConf, unica };
  }

  function onMensalChange(n: number | null) {
    const v = n ?? 0;
    const unica = minimoUnica(entradaConf, v, resultado);
    setMensalConf(v);
    setUnicaConf(unica);
    valoresRef.current = { entrada: entradaConf, mensal: v, unica };
  }

  function handleRecalcular() {
    onRecalcular(valoresRef.current);
  }

  return (
    <div className="jornadaSimulacaoCompleta flex flex-col gap-4">
      <section
        id="jornada-sim-card"
        className={`jornadaSimCard${aplicado ? ' is-recalculada' : ''}`}
      >
        {mostrarFeedback ? (
          <p className="jornadaSimFeedback" role="status">
            Simulação atualizada com os valores personalizados.
          </p>
        ) : null}
        <div className="jornadaSimHero">
          <p className="jornadaSimHeroLabel">Valor total à vista</p>
          <p className="jornadaSimHeroValor">{formatarMoeda(resultado.vte_avista)}</p>
        </div>
        <div className="jornadaSimMetricas">
          <Metrica
            label={aplicado ? 'Entrada' : 'Entrada sugerida'}
            valor={formatarMoeda(entradaCard)}
          />
          <Metrica
            label="Parcela mensal"
            valor={formatarMoeda(mensalCard)}
            sub={`${resultado.quantidade_parcelas_total} parcelas`}
          />
          <Metrica label="Parcela única" valor={formatarMoeda(unicaCard)} />
        </div>
        <p className="jornadaSimCardHint">
          Saldo a financiar {formatarMoeda(resultado.saldo_financiar)}
          {prazoFinanciamentoAnos != null ? ` · ${prazoFinanciamentoAnos} anos` : ''}
          {taxaPctLabel ? ` · ${taxaPctLabel}% aa` : ''}
          {' · '}
          1ª parcela do financiamento estimada{' '}
          {formatarMoeda(resultado.parcela_sac_primeira)}
          /mês*
        </p>
      </section>

      <p className="jornadaSimNotaAsterisco">
        * Estimativa baseada nos dados informados. Condições reais sujeitas à análise
        de crédito e às taxas vigentes na data do financiamento.
      </p>

      {resultado.alertas.map((a) => (
        <p key={a.tipo} className="jornadaSimAlerta" role="status">
          {a.mensagem}
        </p>
      ))}

      <button
        type="button"
        className="jornadaSimLinkPersonalizar"
        onClick={() => setPersonalizarAberto((v) => !v)}
      >
        {personalizarAberto
          ? 'Fechar personalização'
          : 'Deseja personalizar o valor das parcelas?'}
      </button>

      {personalizarAberto ? (
        <form
          className="jornadaPersonalizar"
          onSubmit={(e) => {
            e.preventDefault();
            handleRecalcular();
          }}
        >
          <h3>Personalizar oferta</h3>
          <p>
            Ajuste os valores da simulação. Os números do card acima atualizam ao
            recalcular.
          </p>
          <div className="jornadaField">
            <label htmlFor="jornada-entrada-conf">Entrada confirmada (R$)</label>
            <CampoNumeroBr
              id="jornada-entrada-conf"
              valor={entradaConf}
              onChange={onEntradaChange}
            />
            <AvisoMinimo minimo={resultado.entrada_sugerida} atual={entradaConf} />
          </div>
          <div className="jornadaField">
            <label htmlFor="jornada-mensal-conf">Parcela mensal confirmada (R$)</label>
            <CampoNumeroBr
              id="jornada-mensal-conf"
              valor={mensalConf}
              onChange={onMensalChange}
            />
            <AvisoMinimo minimo={resultado.parcela_mensal_usada} atual={mensalConf} />
          </div>
          <div className="jornadaField">
            <label htmlFor="jornada-unica-conf">Parcela única confirmada (R$)</label>
            <CampoNumeroBr
              id="jornada-unica-conf"
              valor={unicaConf}
              onChange={(n) => {
                const v = n ?? 0;
                setUnicaConf(v);
                valoresRef.current = { ...valoresRef.current, unica: v };
              }}
            />
            <AvisoMinimo minimo={unicaMinima} atual={unicaConf} />
          </div>
          <button type="submit" className="jornadaSimBtnRecalc">
            Recalcular simulação
          </button>
        </form>
      ) : null}

      <div className="jornadaSimAcoes">
        <button
          type="button"
          className="jornadaSimBtnOutline"
          onClick={() => setFluxoAberto((v) => !v)}
        >
          {fluxoAberto ? 'Ocultar fluxo mês a mês' : 'Ver fluxo mês a mês'}
        </button>
        <button type="button" className="jornadaSimBtnGold" onClick={onVerMemorial}>
          Ver memorial
        </button>
      </div>

      {fluxoAberto ? (
        <Secao titulo="Fluxo mês a mês">
          <TabelaFluxoCliente fluxo={resultado.fluxo} />
        </Secao>
      ) : null}
    </div>
  );
}
