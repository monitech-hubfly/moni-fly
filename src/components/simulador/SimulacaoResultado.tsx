'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { CampoNumeroBr } from '@/components/simulador/CampoNumeroBr';
import {
  entradaAbaixoDoMinimo,
  entradaMinimaOferta,
  formatarMoeda,
  mensagemEntradaMinima,
  mensagemPagamentoAMaior,
  mensagemParcelaUnicaMinima,
  pagamentoAMaiorBloqueia,
  parcelaUnicaAbaixoDoMinimo,
  type LinhaFluxo,
  type OfertaConfig,
  type ResultadoCalculo,
  type TemplateConfig,
} from '@/lib/simulador/calcular-oferta';
import {
  definirModoReguasRp,
  estadoInicialReguasRp,
  moverReguaRp,
  type CampoReguaRp,
  type ReguasAplicadas,
} from '@/lib/simulador/personalizar-recursos-proprios';
import { Secao } from '@/components/simulador/oferta-resultado-ui';

export type ValoresConfirmadosOferta = {
  entrada: number;
  mensal: number;
  unica: number;
  modoParcelasObra?: 'variavel' | 'fixa';
  parcelaFixaObra?: number | null;
  ancoraCobertura?: 'parcela_fixa' | 'parcela_unica' | null;
};

type Props = {
  resultado: ResultadoCalculo;
  prazoFinanciamentoAnos?: number;
  taxaJurosPct?: number;
  valoresConfirmados?: ValoresConfirmadosOferta | null;
  recalcToken?: number;
  onRecalcular: (valores: ValoresConfirmadosOferta) => void;
  /** Mínimo da parcela única recalculado pelo motor para a entrada/mensal informadas. */
  minimoParcelaUnica: (entrada: number, mensal: number) => number;
  /** Quanto as parcelas passam do valor total, com os valores digitados. */
  avaliarPagamentoAMaior?: (valores: ValoresConfirmadosOferta) => number;
  modalidade?: 'financiamento' | 'recursos_proprios';
  templateEngine?: TemplateConfig;
  ofertaBase?: OfertaConfig;
  onVerMemorial: () => void;
};

function ErroOuMinimo({ id, erro, minimo, atual }: { id: string; erro: string | null; minimo: number; atual: number }) {
  if (erro) {
    return (
      <p id={id} className="jornadaFieldErro" role="alert">
        {erro}
      </p>
    );
  }
  return <AvisoMinimo minimo={minimo} atual={atual} />;
}

function AvisoBloqueio({ erros }: { erros: string[] }) {
  if (erros.length === 0) return null;
  return (
    <div className="jornadaAvisoBloqueio" role="alert">
      <AlertTriangle aria-hidden />
      <div>
        <strong>Ajuste os valores para recalcular:</strong>
        <ul>
          {erros.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </div>
    </div>
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

const ROTULO_REGUA: Record<CampoReguaRp, string> = {
  entrada: 'Entrada',
  mensal: 'Parcela mensal até o início da obra',
  unica: 'Parcela única',
  fixa: 'Parcela mensal durante a obra',
};

function PainelReguasRecursosProprios({
  template,
  oferta,
  aplicado,
  onChange,
  onAtualizar,
  onFechar,
}: {
  template: TemplateConfig;
  oferta: OfertaConfig;
  aplicado: ReguasAplicadas;
  onChange: (proximo: ReguasAplicadas) => void;
  onAtualizar: () => void;
  onFechar: () => void;
}) {
  const modo = aplicado.estado.modo;
  return (
    <div className="jornadaReguas">
      <h3 className="jornadaReguasTitulo">Ajuste as parcelas</h3>
      <p className="jornadaReguasRotulo">Parcelas da obra</p>
      <div className="jornadaReguasModo" role="group" aria-label="Parcelas da obra">
        <button
          type="button"
          aria-pressed={modo === 'variavel'}
          onClick={() => onChange(definirModoReguasRp(template, oferta, aplicado.estado, 'variavel'))}
        >
          Valor da parcela Fase 2 variando com a obra
        </button>
        <button
          type="button"
          aria-pressed={modo === 'fixa'}
          onClick={() => onChange(definirModoReguasRp(template, oferta, aplicado.estado, 'fixa'))}
        >
          Valor da parcela Fase 2 fixo
        </button>
      </div>
      <p className="jornadaReguasModoTexto">
        {modo === 'fixa'
          ? 'Você paga o mesmo valor todo mês, e a última parcela fecha a conta.'
          : 'As parcelas acompanham o andamento da construção.'}
      </p>
      {aplicado.limites.map((limite) => {
        const minimo = Math.floor(limite.minimo);
        const maximo = Math.ceil(limite.maximo);
        const teto = Math.max(minimo, maximo);
        const atual = Math.min(Math.max(limite.valor, minimo), teto);
        const pct = teto <= minimo ? 0 : ((atual - minimo) / (teto - minimo)) * 100;
        return (
          <div key={limite.campo} className="jornadaRegua">
            <div className="jornadaReguaTop">
              <p className="jornadaReguaNome">{ROTULO_REGUA[limite.campo]}</p>
              <div className="jornadaReguaValor">
                <span className="jornadaReguaPrefixo">R$</span>
                <CampoNumeroBr
                  id={`regua-${limite.campo}`}
                  valor={limite.valor}
                  inteiro
                  onChange={(n) =>
                    onChange(moverReguaRp(template, oferta, aplicado.estado, limite.campo, n ?? minimo))
                  }
                />
              </div>
            </div>
            <input
              type="range"
              min={minimo}
              max={teto}
              step={1000}
              value={atual}
              disabled={maximo - minimo < 1}
              aria-label={ROTULO_REGUA[limite.campo]}
              style={{ ['--regua-pct' as string]: `${pct}%` }}
              onChange={(e) =>
                onChange(
                  moverReguaRp(template, oferta, aplicado.estado, limite.campo, Number(e.target.value)),
                )
              }
            />
            <div className="jornadaReguaLimites">
              <span>mín. {formatarMoeda(limite.minimo)}</span>
              <span>máx. {formatarMoeda(limite.maximo)}</span>
            </div>
            {limite.aviso ? <p className="jornadaReguaAviso">{limite.aviso}</p> : null}
            {limite.campo === 'fixa' ? (
              <p className="jornadaReguaAviso">Última parcela: {formatarMoeda(aplicado.ultimaParcela)}</p>
            ) : null}
          </div>
        );
      })}
      <div className="jornadaReguasAcoes">
        <button type="button" className="jornadaBtn jornadaBtnSecondary" onClick={onFechar}>
          Fechar personalização
        </button>
        <button type="button" className="jornadaBtn jornadaBtnPrimary" onClick={onAtualizar}>
          Atualizar simulação
        </button>
      </div>
    </div>
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
              <td>{l.fase === 'pre_contrato' ? 'Já pago' : l.mes}</td>
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
  minimoParcelaUnica,
  avaliarPagamentoAMaior,
  modalidade = 'financiamento',
  templateEngine,
  ofertaBase,
  onVerMemorial,
}: Props) {
  const [fluxoAberto, setFluxoAberto] = useState(false);
  const [personalizarAberto, setPersonalizarAberto] = useState(false);
  const [reguasRp, setReguasRp] = useState<ReguasAplicadas | null>(null);
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
  const unicaMinima = minimoParcelaUnica(entradaConf, mensalConf);
  const unicaAbaixo = parcelaUnicaAbaixoDoMinimo(unicaConf, unicaMinima);
  const entradaMinima = entradaMinimaOferta(resultado);
  const entradaAbaixo = entradaAbaixoDoMinimo(entradaConf, entradaMinima);
  const erroEntrada = entradaAbaixo ? mensagemEntradaMinima(entradaMinima) : null;
  const erroUnica = unicaAbaixo ? mensagemParcelaUnicaMinima(unicaMinima) : null;
  const pagoAMaior = avaliarPagamentoAMaior?.({
    entrada: entradaConf,
    mensal: mensalConf,
    unica: unicaConf,
  }) ?? 0;
  const erroPagoAMaior = pagamentoAMaiorBloqueia(pagoAMaior)
    ? mensagemPagamentoAMaior(pagoAMaior)
    : null;
  const errosMinimos = [erroEntrada, erroUnica, erroPagoAMaior].filter((m): m is string => m != null);

  const recursosProprios = modalidade === 'recursos_proprios';
  const reguasVivas = recursosProprios && personalizarAberto ? reguasRp : null;
  const entradaRp = reguasVivas
    ? reguasVivas.estado.entrada
    : valoresConfirmados?.entrada ?? resultado.entrada_sugerida;
  const mensalRp = reguasVivas
    ? reguasVivas.estado.mensal
    : valoresConfirmados?.mensal ?? resultado.parcela_mensal_usada;
  const unicaRp = reguasVivas
    ? reguasVivas.estado.unica
    : valoresConfirmados?.unica ?? resultado.parcela_unica_sugerida;
  const totalRp = reguasVivas ? reguasVivas.resultado.vte : resultado.vte;
  const fluxoExibido = reguasVivas ? reguasVivas.resultado.fluxo : resultado.fluxo;
  const modoFase2 =
    reguasVivas?.estado.modo ??
    valoresConfirmados?.modoParcelasObra ??
    resultado.personalizacao_rp?.modo ??
    'variavel';
  const valorFase2 =
    reguasVivas?.estado.fixa ??
    valoresConfirmados?.parcelaFixaObra ??
    resultado.personalizacao_rp?.parcela_fixa ??
    0;
  const textoFase2 = modoFase2 === 'fixa' ? `${formatarMoeda(Number(valorFase2))} por mês` : 'Varia com a obra';
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
    const unica = minimoParcelaUnica(v, mensalConf);
    setEntradaConf(v);
    setUnicaConf(unica);
    valoresRef.current = { entrada: v, mensal: mensalConf, unica };
  }

  function onMensalChange(n: number | null) {
    const v = n ?? 0;
    const unica = minimoParcelaUnica(entradaConf, v);
    setMensalConf(v);
    setUnicaConf(unica);
    valoresRef.current = { entrada: entradaConf, mensal: v, unica };
  }

  function handleRecalcular() {
    const v = valoresRef.current;
    if (entradaAbaixoDoMinimo(v.entrada, entradaMinima)) return;
    if (parcelaUnicaAbaixoDoMinimo(v.unica, minimoParcelaUnica(v.entrada, v.mensal))) return;
    const maior = avaliarPagamentoAMaior?.(v) ?? 0;
    if (pagamentoAMaiorBloqueia(maior)) return;
    onRecalcular(v);
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
        {recursosProprios ? (
          <>
            <div className="jornadaSimHero">
              <p className="jornadaSimHeroLabel">Valor total</p>
              <p className="jornadaSimHeroValor">{formatarMoeda(totalRp)}</p>
            </div>
            <div className="jornadaSimMetricas is-quatro">
              <Metrica label="Entrada" valor={formatarMoeda(entradaRp)} />
              <Metrica label="Parcela mensal desejada" valor={formatarMoeda(mensalRp)} />
              <Metrica label="Parcela única" valor={formatarMoeda(unicaRp)} />
              <Metrica label="Mensal na Fase 2" valor={textoFase2} />
            </div>
            <p className="jornadaSimCardHint">
              Pagamento com recursos próprios — sem financiamento
            </p>
          </>
        ) : (
          <>
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
              {resultado.saldo_financiar <= 0 ? (
                'Sem saldo a financiar'
              ) : (
                <>
                  Saldo a financiar {formatarMoeda(resultado.saldo_financiar)}
                  {prazoFinanciamentoAnos != null ? ` · ${prazoFinanciamentoAnos} anos` : ''}
                  {taxaPctLabel ? ` · ${taxaPctLabel}% aa` : ''}
                  {' · '}
                  1ª parcela do financiamento estimada{' '}
                  {formatarMoeda(resultado.parcela_sac_primeira)}
                  /mês*
                </>
              )}
            </p>
          </>
        )}
      </section>

      {recursosProprios ? null : (
        <p className="jornadaSimNotaAsterisco">
          * Estimativa baseada nos dados informados. Condições reais sujeitas à análise
          de crédito e às taxas vigentes na data do financiamento.
        </p>
      )}

      {resultado.alertas.map((a) => (
        <p key={a.tipo} className="jornadaSimAlerta" role="status">
          {a.mensagem}
        </p>
      ))}

      {recursosProprios && !personalizarAberto ? (
        <button
          type="button"
          className="jornadaSimLinkPersonalizar"
          onClick={() => {
            if (!templateEngine || !ofertaBase) return;
            setReguasRp(estadoInicialReguasRp(templateEngine, ofertaBase));
            setPersonalizarAberto(true);
          }}
        >
          Deseja personalizar o valor das parcelas?
        </button>
      ) : recursosProprios ? null : (
        <button
          type="button"
          className="jornadaSimLinkPersonalizar"
          onClick={() => setPersonalizarAberto((v) => !v)}
        >
          {personalizarAberto
            ? 'Fechar personalização'
            : 'Deseja personalizar o valor das parcelas?'}
        </button>
      )}

      {!recursosProprios && personalizarAberto ? (
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
              className={erroEntrada ? 'is-erro' : undefined}
              aria-invalid={erroEntrada ? true : undefined}
              aria-describedby={erroEntrada ? 'jornada-entrada-erro' : undefined}
              valor={entradaConf}
              onChange={onEntradaChange}
            />
            <ErroOuMinimo
              id="jornada-entrada-erro"
              erro={erroEntrada}
              minimo={entradaMinima}
              atual={entradaConf}
            />
          </div>
          <div className="jornadaField">
            <label htmlFor="jornada-mensal-conf">Parcela mensal confirmada (R$)</label>
            <CampoNumeroBr
              id="jornada-mensal-conf"
              className={erroPagoAMaior ? 'is-erro' : undefined}
              aria-invalid={erroPagoAMaior ? true : undefined}
              aria-describedby={erroPagoAMaior ? 'jornada-mensal-erro' : undefined}
              valor={mensalConf}
              onChange={onMensalChange}
            />
            {erroPagoAMaior ? (
              <p id="jornada-mensal-erro" className="jornadaFieldErro" role="alert">
                {erroPagoAMaior}
              </p>
            ) : null}
            <AvisoMinimo minimo={resultado.parcela_mensal_usada} atual={mensalConf} />
          </div>
          <div className="jornadaField">
            <label htmlFor="jornada-unica-conf">Parcela única confirmada (R$)</label>
            <CampoNumeroBr
              id="jornada-unica-conf"
              className={erroUnica ? 'is-erro' : undefined}
              aria-invalid={erroUnica ? true : undefined}
              aria-describedby={erroUnica ? 'jornada-unica-erro' : undefined}
              valor={unicaConf}
              onChange={(n) => {
                const v = n ?? 0;
                setUnicaConf(v);
                valoresRef.current = { ...valoresRef.current, unica: v };
              }}
            />
            <ErroOuMinimo
              id="jornada-unica-erro"
              erro={erroUnica}
              minimo={unicaMinima}
              atual={unicaConf}
            />
          </div>
          <AvisoBloqueio erros={errosMinimos} />
          <button type="submit" className="jornadaSimBtnRecalc" disabled={errosMinimos.length > 0}>
            Recalcular simulação
          </button>
        </form>
      ) : null}

      {reguasVivas && templateEngine && ofertaBase ? (
        <PainelReguasRecursosProprios
          template={templateEngine}
          oferta={ofertaBase}
          aplicado={reguasVivas}
          onChange={setReguasRp}
          onFechar={() => setPersonalizarAberto(false)}
          onAtualizar={() =>
            onRecalcular({
              entrada: reguasVivas.estado.entrada,
              mensal: reguasVivas.estado.mensal,
              unica: reguasVivas.estado.unica,
              modoParcelasObra: reguasVivas.estado.modo,
              parcelaFixaObra: reguasVivas.estado.modo === 'fixa' ? reguasVivas.estado.fixa : null,
              ancoraCobertura: reguasVivas.estado.ancora === 'fixa' ? 'parcela_fixa' : 'parcela_unica',
            })
          }
        />
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
          <TabelaFluxoCliente fluxo={fluxoExibido} />
        </Secao>
      ) : null}
    </div>
  );
}
