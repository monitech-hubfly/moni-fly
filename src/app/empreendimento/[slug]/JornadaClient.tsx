'use client';
// src/app/empreendimento/[slug]/JornadaClient.tsx

import { useState, useCallback, useTransition, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type {
  EmpreendimentoPublico,
  LotePublicoEmp,
  ItemCustomizacao,
  OfertaEmpreendimento,
  JornadaLocal,
  TemplateConfigPublico,
  ModoTerrenoJornada,
} from './types';
import {
  salvarJornadaSessao,
  carregarJornadaSessao,
  gravarSimulacaoJornada,
} from '@/lib/actions/jornada-cliente';
import { CampoNumeroBr } from '@/components/simulador/CampoNumeroBr';
import {
  SimulacaoResultado,
  type ValoresConfirmadosOferta,
} from '@/components/simulador/SimulacaoResultado';
import {
  calcularOferta,
  sugerirParcelaMensal,
  type OfertaConfig,
  type ResultadoCalculo,
} from '@/lib/simulador/calcular-oferta';
import { montarTemplateParaEngine } from '@/lib/simulador/montar-template-jornada';
import { inferirCondicaoLote } from '@/lib/loteamento-simulador-template';
import { maskTelefoneCelular } from '@/lib/br-docs';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmt = (v: number) => BRL.format(v);

const ETAPAS = [
  'Seus dados',
  'Oferta',
  'Terreno',
  'Casa',
  'Simulação',
  'Memorial',
  'Contrato',
];

const ID_ACABAMENTOS_ARQUITETO = 'acabamentos-arquiteto';
const VALOR_ACABAMENTOS_ARQUITETO = 50_000;

function valorAcoplamentoDoLote(lote: LotePublicoEmp | null | undefined): number {
  const n = Number(lote?.acoplamento);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function fracaoDePercentualPublico(
  raw: number | null | undefined,
  fallback: number,
): number {
  if (raw == null || !Number.isFinite(Number(raw))) return fallback;
  const n = Number(raw);
  if (n < 0) return fallback;
  if (n >= 1) return n / 100;
  return n;
}

function valorLoteParaCalculo(state: JornadaLocal): number {
  if (state.modoTerreno === 'informar') return Math.max(0, state.valorLote);
  return Math.max(0, state.loteSelecionado?.valor ?? state.valorLote);
}

function condicaoLoteJornada(state: JornadaLocal): 'nao_pago' | 'parcial' | 'quitado' {
  const lote = valorLoteParaCalculo(state);
  if (state.modoTerreno === 'informar' && lote > 0 && state.valorJaPago >= lote) {
    return 'quitado';
  }
  return inferirCondicaoLote(state.valorJaPago);
}

function calcularCustomizacao(
  oferta: OfertaEmpreendimento | null,
  itens: ItemCustomizacao[],
  gadgetsSelecionados: Set<string>,
  kitSelecionado: boolean,
  acabamentosArquiteto = false,
): { valorKit: number; valorGadgets: number; valorCasa: number; valorCustomizacao: number } {
  const valorCasa = Math.max(0, Number(oferta?.valor_base_casa) || 0);

  const kitItem = itens.find((i) => i.categoria === 'kit_moni');
  const valorKit = kitSelecionado && kitItem ? kitItem.valor : 0;

  const valorGadgets = itens
    .filter((i) => i.categoria === 'gadget' && gadgetsSelecionados.has(i.id))
    .reduce((acc, i) => acc + i.valor, 0);

  const valorAcabamentos = acabamentosArquiteto ? VALOR_ACABAMENTOS_ARQUITETO : 0;

  return {
    valorKit,
    valorGadgets,
    valorCasa,
    valorCustomizacao: valorKit + valorGadgets + valorAcabamentos,
  };
}

function montarOfertaJornada(
  state: JornadaLocal,
  tpl: TemplateConfigPublico | null,
  itens: ItemCustomizacao[],
): OfertaConfig {
  const prazoEntrega = Math.max(1, Math.round(state.prazoObraMeses || 12));
  const nObra = Math.min(
    7,
    Math.max(3, Math.round(state.prazoObraMeses || tpl?.prazo_obra_meses || 7)),
  );
  const prazoFase1 =
    prazoEntrega > nObra ? prazoEntrega - nObra : Math.max(1, prazoEntrega);
  const valorLote = valorLoteParaCalculo(state);
  const percMensal = fracaoDePercentualPublico(tpl?.perc_parcela_mensal, 0);
  const parcelaMensal =
    percMensal > 0 ? percMensal * valorLote : sugerirParcelaMensal(valorLote);
  const calcs = calcularCustomizacao(
    state.ofertaSelecionada,
    itens,
    state.gadgetsSelecionados,
    state.kitSelecionado,
    state.acabamentosArquiteto,
  );

  return {
    valor_lote: valorLote,
    valor_casa: calcs.valorCasa,
    valor_customizacao: calcs.valorCustomizacao,
    valor_acoplamento: Math.max(0, state.valorAcoplamento),
    valor_ja_pago: Math.max(0, state.valorJaPago),
    prazo_meses: prazoFase1,
    parcela_mensal: parcelaMensal,
    renda_cliente: state.rendaMensal ?? 0,
    prazo_financiamento_anos: Math.max(1, Math.round(state.prazoFinanciamento || 30)),
    taxa_financiamento_anual: (state.taxaJuros || 10) / 100,
  };
}

/** Valor total à vista da oferta da Helenna (sem recálculo no cliente). */
function valorAvistaOferta(oferta: OfertaEmpreendimento): number | null {
  const n = Number(oferta.valor_avista);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function estadoInicial(_empreendimento?: EmpreendimentoPublico): JornadaLocal {
  return {
    etapa: 1,
    sessaoToken: null,
    nomeCliente: '',
    telefoneCliente: '',
    ofertaSelecionada: null,
    previewVteAvista: null,
    modoTerreno: null,
    loteSelecionado: null,
    valorJaPago: 0,
    gadgetsSelecionados: new Set(),
    kitSelecionado: false,
    acabamentosArquiteto: false,
    valorAcoplamento: 0,
    valorKit: 0,
    valorGadgets: 0,
    valorCasa: 0,
    valorCustomizacao: 0,
    valorLote: 0,
    simulacaoId: null,
    rendaMensal: null,
    prazoObraMeses: 12,
    prazoFinanciamento: 30,
    taxaJuros: 10,
  };
}

function ProgressBar({ etapa }: { etapa: number }) {
  return (
    <div className="jornadaProgress">
      {ETAPAS.map((nome, i) => {
        const num = i + 1;
        const status = num < etapa ? 'done' : num === etapa ? 'active' : 'pending';
        return (
          <div key={num} className={`jornadaStep ${status}`}>
            <div className="jornadaStepDot">
              {status === 'done' ? (
                <svg viewBox="0 0 16 16" fill="none" width={10} height={10}>
                  <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <span>{num}</span>
              )}
            </div>
            <span className="jornadaStepLabel">{nome}</span>
            {i < ETAPAS.length - 1 && <div className={`jornadaStepLine ${status === 'done' ? 'done' : ''}`} />}
          </div>
        );
      })}
    </div>
  );
}

function Passo1({
  state,
  setState,
  onAvancar,
  salvando,
}: {
  state: JornadaLocal;
  setState: (s: Partial<JornadaLocal>) => void;
  onAvancar: () => void;
  salvando: boolean;
}) {
  const valido = state.nomeCliente.trim().length >= 2 && state.telefoneCliente.replace(/\D/g, '').length >= 10;
  return (
    <div className="jornadaCard">
      <h2 className="jornadaCardTitle">Seus dados</h2>
      <p className="jornadaCardSub">Para começar, nos conte quem você é.</p>
      <div className="jornadaField">
        <label htmlFor="nome">Nome completo</label>
        <input
          id="nome"
          type="text"
          placeholder="João da Silva"
          value={state.nomeCliente}
          onChange={(e) => setState({ nomeCliente: e.target.value })}
          autoComplete="name"
        />
      </div>
      <div className="jornadaField">
        <label htmlFor="tel">WhatsApp</label>
        <input
          id="tel"
          type="tel"
          inputMode="numeric"
          placeholder="(11) 99999-9999"
          value={state.telefoneCliente}
          onChange={(e) => setState({ telefoneCliente: maskTelefoneCelular(e.target.value) })}
          maxLength={16}
          autoComplete="tel"
        />
      </div>
      <button
        className="jornadaBtn jornadaBtnPrimary"
        disabled={!valido || salvando}
        onClick={onAvancar}
      >
        {salvando ? 'Salvando…' : 'Continuar'}
      </button>
    </div>
  );
}

function PassoOferta({
  ofertas,
  state,
  setState,
  onAvancar,
  onVoltar,
  salvando,
}: {
  ofertas: OfertaEmpreendimento[];
  state: JornadaLocal;
  setState: (s: Partial<JornadaLocal>) => void;
  onAvancar: () => void;
  onVoltar: () => void;
  salvando: boolean;
}) {
  function escolher(o: OfertaEmpreendimento) {
    setState({
      ofertaSelecionada: o,
      valorCasa: Math.max(0, Number(o.valor_base_casa) || 0),
      previewVteAvista: valorAvistaOferta(o),
    });
  }

  return (
    <div className="jornadaCard">
      <h2 className="jornadaCardTitle">Escolha a oferta</h2>
      <p className="jornadaCardSub">Selecione o modelo e a condição que funcionam melhor para você.</p>

      {ofertas.length === 0 ? (
        <p className="jornadaEmpty">Nenhuma oferta disponível no momento.</p>
      ) : (
        <div className="jornadaOfertasList">
          {ofertas.map((o) => {
            const preview = valorAvistaOferta(o);
            return (
              <button
                key={o.id}
                type="button"
                className={`jornadaOfertaCard ${state.ofertaSelecionada?.id === o.id ? 'selected' : ''}`}
                onClick={() => escolher(o)}
              >
                <div className="jornadaOfertaHeader">
                  <span className="jornadaOfertaNome">
                    {o.nome ?? o.titulo_oferta ?? `Oferta ${o.ordem + 1}`}
                  </span>
                  {o.produto_modelo && <span className="jornadaOfertaModelo">{o.produto_modelo}</span>}
                </div>
                {preview != null ? (
                  <div className="jornadaOfertaValor">
                    <span className="jornadaOfertaLabel">Valor total à vista</span>
                    <span>{fmt(preview)}</span>
                  </div>
                ) : (
                  <p className="jornadaOfertaDesc">
                    Valor da oferta da Helenna ainda não disponível.
                  </p>
                )}
                {o.descricao && <p className="jornadaOfertaDesc">{o.descricao}</p>}
              </button>
            );
          })}
        </div>
      )}

      <div className="jornadaBtnRow">
        <button type="button" className="jornadaBtn jornadaBtnSecondary" onClick={onVoltar}>Voltar</button>
        <button
          type="button"
          className="jornadaBtn jornadaBtnPrimary"
          disabled={!state.ofertaSelecionada || salvando}
          onClick={onAvancar}
        >
          {salvando ? 'Salvando…' : 'Continuar'}
        </button>
      </div>
    </div>
  );
}

function PassoTerreno({
  lotes,
  state,
  setState,
  onAvancar,
  onVoltar,
  salvando,
}: {
  lotes: LotePublicoEmp[];
  state: JornadaLocal;
  setState: (s: Partial<JornadaLocal>) => void;
  onAvancar: () => void;
  onVoltar: () => void;
  salvando: boolean;
}) {
  const lotesVenda = lotes.filter((l) => l.disponivel);
  const lotesOcupados = lotes.filter((l) => !l.disponivel);
  const podeAvancar =
    state.modoTerreno === 'disponivel'
      ? Boolean(state.loteSelecionado?.disponivel)
      : state.modoTerreno === 'informar'
        ? Boolean(state.loteSelecionado) &&
          !state.loteSelecionado?.disponivel &&
          Number.isFinite(state.valorJaPago) &&
          state.valorJaPago >= 0
        : false;

  function escolherModo(modo: ModoTerrenoJornada) {
    const atual = state.loteSelecionado;
    if (modo === 'disponivel') {
      const keep = atual?.disponivel ? atual : null;
      setState({
        modoTerreno: 'disponivel',
        loteSelecionado: keep,
        valorLote: keep?.valor ?? 0,
        valorJaPago: 0,
        valorAcoplamento: valorAcoplamentoDoLote(keep),
      });
      return;
    }
    const keep = atual && !atual.disponivel ? atual : null;
    setState({
      modoTerreno: 'informar',
      loteSelecionado: keep,
      valorAcoplamento: valorAcoplamentoDoLote(keep),
      valorLote: keep?.valor ?? 0,
      valorJaPago: keep ? state.valorJaPago : 0,
    });
  }

  function escolherLote(lote: LotePublicoEmp, modo: ModoTerrenoJornada) {
    setState({
      modoTerreno: modo,
      loteSelecionado: lote,
      valorLote: lote.valor,
      valorAcoplamento: valorAcoplamentoDoLote(lote),
      valorJaPago: modo === 'informar' ? state.valorJaPago : 0,
    });
  }

  return (
    <div className="jornadaCard">
      <h2 className="jornadaCardTitle">Seu terreno</h2>
      <p className="jornadaCardSub">Escolha um lote disponível ou informe o terreno que você já tem.</p>

      <div className="jornadaTerrenoTabs" role="tablist" aria-label="Tipo de terreno">
        <button
          type="button"
          role="tab"
          className={`jornadaToggleBtn ${state.modoTerreno === 'disponivel' ? 'selected' : ''}`}
          aria-selected={state.modoTerreno === 'disponivel'}
          onClick={() => escolherModo('disponivel')}
        >
          Não tenho lote
        </button>
        <button
          type="button"
          role="tab"
          className={`jornadaToggleBtn ${state.modoTerreno === 'informar' ? 'selected' : ''}`}
          aria-selected={state.modoTerreno === 'informar'}
          onClick={() => escolherModo('informar')}
        >
          Já tenho lote
        </button>
      </div>

      {state.modoTerreno === 'disponivel' ? (
        lotesVenda.length === 0 ? (
          <p className="jornadaEmpty">Nenhum lote disponível no momento.</p>
        ) : (
          <div className="jornadaGrid" role="list">
            {lotesVenda.map((l) => (
              <button
                key={l.id}
                type="button"
                role="listitem"
                className={`jornadaLoteCard ${state.loteSelecionado?.id === l.id ? 'selected' : ''}`}
                onClick={() => escolherLote(l, 'disponivel')}
              >
                <span className="jornadaLoteCodigo">Lote {l.codigo}</span>
                <span className="jornadaLoteValor">{fmt(l.valor)}</span>
              </button>
            ))}
          </div>
        )
      ) : null}

      {state.modoTerreno === 'informar' ? (
        <>
          {lotesOcupados.length === 0 ? (
            <p className="jornadaEmpty">Nenhum lote ocupado encontrado na planilha.</p>
          ) : (
            <div className="jornadaGrid" role="list">
              {lotesOcupados.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  role="listitem"
                  className={`jornadaLoteCard ${state.loteSelecionado?.id === l.id ? 'selected' : ''}`}
                  onClick={() => escolherLote(l, 'informar')}
                >
                  <span className="jornadaLoteCodigo">Lote {l.codigo}</span>
                  <span className="jornadaLoteValor">{fmt(l.valor)}</span>
                </button>
              ))}
            </div>
          )}
          <div className="jornadaField">
            <label htmlFor="valor-ja-pago-terreno">Valor já pago (R$)</label>
            <CampoNumeroBr
              id="valor-ja-pago-terreno"
              valor={state.valorJaPago}
              onChange={(n) => setState({ valorJaPago: n ?? 0 })}
              inteiro
              placeholder="0"
            />
          </div>
        </>
      ) : null}

      <div className="jornadaBtnRow">
        <button type="button" className="jornadaBtn jornadaBtnSecondary" onClick={onVoltar}>Voltar</button>
        <button
          type="button"
          className="jornadaBtn jornadaBtnPrimary"
          disabled={!podeAvancar || salvando}
          onClick={onAvancar}
        >
          {salvando ? 'Salvando…' : 'Continuar'}
        </button>
      </div>
    </div>
  );
}

function PassoCasa({
  itens,
  state,
  setState,
  onAvancar,
  onVoltar,
  salvando,
}: {
  itens: ItemCustomizacao[];
  state: JornadaLocal;
  setState: (s: Partial<JornadaLocal>) => void;
  onAvancar: () => void;
  onVoltar: () => void;
  salvando: boolean;
}) {
  useEffect(() => {
    const calcs = calcularCustomizacao(
      state.ofertaSelecionada,
      itens,
      state.gadgetsSelecionados,
      state.kitSelecionado,
      state.acabamentosArquiteto,
    );
    setState(calcs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleGadget(id: string) {
    const next = new Set(state.gadgetsSelecionados);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    const calcs = calcularCustomizacao(
      state.ofertaSelecionada,
      itens,
      next,
      state.kitSelecionado,
      state.acabamentosArquiteto,
    );
    setState({ gadgetsSelecionados: next, ...calcs });
  }

  function toggleKit(val: boolean) {
    const calcs = calcularCustomizacao(
      state.ofertaSelecionada,
      itens,
      state.gadgetsSelecionados,
      val,
      state.acabamentosArquiteto,
    );
    setState({ kitSelecionado: val, ...calcs });
  }

  function toggleAcabamentos(val: boolean) {
    const calcs = calcularCustomizacao(
      state.ofertaSelecionada,
      itens,
      state.gadgetsSelecionados,
      state.kitSelecionado,
      val,
    );
    setState({ acabamentosArquiteto: val, ...calcs });
  }

  const kitItem = itens.find((i) => i.categoria === 'kit_moni');
  const gadgets = itens.filter((i) => i.categoria === 'gadget');
  const letraKit = 'C';
  const letraExtras = kitItem ? 'D' : 'C';

  return (
    <div className="jornadaCard passo4">
      <h2 className="jornadaCardTitle">Personalize sua casa</h2>
      <p className="jornadaCardSub">
        {state.ofertaSelecionada?.produto_modelo
          ? `Modelo: ${state.ofertaSelecionada.produto_modelo}. Adicione o que combina com você.`
          : 'Adicione o que combina com você.'}
      </p>

      <section className="jornadaSection">
        <h3 className="jornadaSectionTitle">
          <span className="jornadaSectionBadge">A</span>
          Acoplamento
        </h3>
        <div className="jornadaField">
          <label htmlFor="valor-acoplamento">Valor do acoplamento (R$)</label>
          <CampoNumeroBr
            id="valor-acoplamento"
            valor={state.valorAcoplamento}
            onChange={() => undefined}
            inteiro
            placeholder="0"
            disabled
          />
        </div>
        <p className="jornadaKitDesc">
          {state.modoTerreno === 'disponivel' && state.loteSelecionado
            ? `Valor da tabela do lote ${state.loteSelecionado.codigo}.`
            : state.loteSelecionado
              ? `Valor da tabela do lote ${state.loteSelecionado.codigo}.`
              : 'Definido pelo lote selecionado no terreno.'}
        </p>
      </section>

      <section className="jornadaSection">
        <h3 className="jornadaSectionTitle">
          <span className="jornadaSectionBadge">B</span>
          Customização
        </h3>
        <label className="jornadaKitToggle">
          <input
            type="checkbox"
            checked={state.acabamentosArquiteto}
            onChange={(e) => toggleAcabamentos(e.target.checked)}
          />
          <div className="jornadaKitInfo">
            <span className="jornadaKitNome">Acabamentos com arquiteto</span>
            <span className="jornadaKitDesc">Pacote de acabamentos com acompanhamento de arquiteto.</span>
          </div>
          <span className="jornadaKitValor">{fmt(VALOR_ACABAMENTOS_ARQUITETO)}</span>
        </label>
      </section>

      {kitItem && (
        <section className="jornadaSection">
          <h3 className="jornadaSectionTitle">
            <span className="jornadaSectionBadge">{letraKit}</span>
            Kit Moní
          </h3>
          <label className="jornadaKitToggle">
            <input
              type="checkbox"
              checked={state.kitSelecionado}
              onChange={(e) => toggleKit(e.target.checked)}
            />
            <div className="jornadaKitInfo">
              <span className="jornadaKitNome">{kitItem.nome}</span>
              {kitItem.descricao && <span className="jornadaKitDesc">{kitItem.descricao}</span>}
            </div>
            <span className="jornadaKitValor">{fmt(kitItem.valor)}</span>
          </label>
        </section>
      )}

      {gadgets.length > 0 && (
        <section className="jornadaSection">
          <h3 className="jornadaSectionTitle">
            <span className="jornadaSectionBadge">{letraExtras}</span>
            Extras
          </h3>
          <ul className="jornadaGadgetList">
            {gadgets.map((g) => (
              <li key={g.id}>
                <label className="jornadaGadgetLabel">
                  <input
                    type="checkbox"
                    checked={state.gadgetsSelecionados.has(g.id)}
                    onChange={() => toggleGadget(g.id)}
                  />
                  <span className="jornadaGadgetNome">{g.nome}</span>
                  <span className="jornadaGadgetValor">{fmt(g.valor)}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="jornadaBtnRow">
        <button type="button" className="jornadaBtn jornadaBtnSecondary" onClick={onVoltar}>Voltar</button>
        <button
          type="button"
          className="jornadaBtn jornadaBtnPrimary"
          disabled={salvando}
          onClick={onAvancar}
        >
          {salvando ? 'Salvando…' : 'Continuar'}
        </button>
      </div>
    </div>
  );
}

function PassoSimulacao({
  state,
  setState,
  empreendimento,
  resultadoSimulacao,
  resultadoKey,
  valoresConfirmados,
  recalcToken,
  onAvancar,
  onVoltar,
  onVerSimulacao,
  onRecalcular,
  salvando,
  erroSimulacao,
}: {
  state: JornadaLocal;
  setState: (s: Partial<JornadaLocal>) => void;
  empreendimento: EmpreendimentoPublico;
  resultadoSimulacao: ResultadoCalculo | null;
  resultadoKey: number;
  valoresConfirmados: ValoresConfirmadosOferta | null;
  recalcToken: number;
  onAvancar: () => void;
  onVoltar: () => void;
  onVerSimulacao: () => void;
  onRecalcular: (valores: ValoresConfirmadosOferta) => void;
  salvando: boolean;
  erroSimulacao: string | null;
}) {
  const podeSimular =
    Boolean(empreendimento.template?.id) &&
    state.prazoFinanciamento > 0 &&
    Number.isFinite(state.taxaJuros);

  const jaRolouResultado = useRef(false);
  useEffect(() => {
    if (!resultadoSimulacao) {
      jaRolouResultado.current = false;
      return;
    }
    if (jaRolouResultado.current) return;
    jaRolouResultado.current = true;
    document
      .getElementById('jornada-resultado-simulacao')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [resultadoSimulacao]);

  const extrasCustom: string[] = [];
  if (state.acabamentosArquiteto) extrasCustom.push(`Acabamentos com arquiteto ${fmt(VALOR_ACABAMENTOS_ARQUITETO)}`);
  if (state.kitSelecionado && state.valorKit > 0) extrasCustom.push(`Kit Moní ${fmt(state.valorKit)}`);
  if (state.valorGadgets > 0) extrasCustom.push(`Extras ${fmt(state.valorGadgets)}`);

  return (
    <div className="jornadaCard">
      <h2 className="jornadaCardTitle">Sua simulação</h2>
      <p className="jornadaCardSub">
        Confira os valores e complete o que falta para calcular.
      </p>

      <div className="jornadaSimOferta">
        <h3>Resumo</h3>
        <div className="jornadaSimResumo">
          <div className="jornadaResumoRow">
            <span>Valor total do terreno</span>
            <span>{fmt(valorLoteParaCalculo(state))}</span>
          </div>
          <div className="jornadaResumoRow">
            <span>Valor já pago pelo terreno</span>
            <span>{fmt(state.valorJaPago)}</span>
          </div>
          <div className="jornadaResumoRow">
            <span>Acoplamento</span>
            <span>{fmt(state.valorAcoplamento)}</span>
          </div>
          <div className="jornadaResumoRow">
            <span>Customização</span>
            <span>
              {state.valorCustomizacao > 0
                ? extrasCustom.length > 0
                  ? `${fmt(state.valorCustomizacao)} (${extrasCustom.join(' · ')})`
                  : fmt(state.valorCustomizacao)
                : fmt(0)}
            </span>
          </div>
        </div>
      </div>

      <div className="jornadaSimOferta">
        <h3>Outras informações</h3>
        <div className="jornadaField">
          <label htmlFor="sim-prazo-obra">Prazo de entrega da obra (meses)</label>
          <CampoNumeroBr
            id="sim-prazo-obra"
            valor={state.prazoObraMeses}
            onChange={(n) => setState({ prazoObraMeses: n != null && n > 0 ? Math.round(n) : 12 })}
            inteiro
            placeholder="12"
          />
        </div>
        <div className="jornadaField">
          <label htmlFor="sim-renda-mensal">Renda mensal (R$/mês)</label>
          <CampoNumeroBr
            id="sim-renda-mensal"
            valor={state.rendaMensal}
            onChange={(n) => setState({ rendaMensal: n })}
            inteiro
            placeholder="0"
          />
        </div>
        <div className="jornadaField">
          <label htmlFor="sim-prazo-financiamento">Prazo do financiamento (anos)</label>
          <CampoNumeroBr
            id="sim-prazo-financiamento"
            valor={state.prazoFinanciamento}
            onChange={(n) => setState({ prazoFinanciamento: n != null && n > 0 ? Math.round(n) : 30 })}
            inteiro
            placeholder="30"
          />
        </div>
        <div className="jornadaField">
          <label htmlFor="sim-taxa-juros">Taxa de juros estimada para financiamento pós entrega da casa (% aa)</label>
          <CampoNumeroBr
            id="sim-taxa-juros"
            valor={state.taxaJuros}
            onChange={(n) => setState({ taxaJuros: n ?? 10 })}
            placeholder="10"
          />
        </div>
        {erroSimulacao && <p className="jornadaSimNota">{erroSimulacao}</p>}
        <div className="jornadaBtnRow">
          <button type="button" className="jornadaBtn jornadaBtnSecondary" onClick={onVoltar}>
            Voltar
          </button>
          <button
            type="button"
            className="jornadaBtn jornadaBtnPrimary"
            disabled={!podeSimular || salvando}
            onClick={onVerSimulacao}
          >
            {salvando ? 'Calculando…' : 'Ver minha simulação'}
          </button>
        </div>
      </div>

      {resultadoSimulacao ? (
        <div id="jornada-resultado-simulacao">
          <SimulacaoResultado
            key={resultadoKey}
            resultado={resultadoSimulacao}
            prazoFinanciamentoAnos={state.prazoFinanciamento}
            taxaJurosPct={state.taxaJuros}
            valoresConfirmados={valoresConfirmados}
            recalcToken={recalcToken}
            onRecalcular={onRecalcular}
            onVerMemorial={onAvancar}
          />
        </div>
      ) : null}
    </div>
  );
}

function Passo6({
  state,
  empreendimento,
  resultadoSimulacao,
  onAvancar,
  onVoltar,
}: {
  state: JornadaLocal;
  empreendimento: EmpreendimentoPublico;
  resultadoSimulacao: ResultadoCalculo | null;
  onAvancar: () => void;
  onVoltar: () => void;
}) {
  return (
    <div className="jornadaCard">
      <h2 className="jornadaCardTitle">Memorial descritivo</h2>
      <p className="jornadaCardSub">Aqui está o resumo completo da sua proposta.</p>

      <div className="jornadaMemorial">
        <div className="jornadaMemSection">
          <h3>Cliente</h3>
          <p>{state.nomeCliente}</p>
          <p>{state.telefoneCliente}</p>
        </div>
        <div className="jornadaMemSection">
          <h3>Empreendimento</h3>
          <p>{empreendimento.titulo}</p>
          <p>
            {state.loteSelecionado
              ? `Lote ${state.loteSelecionado.codigo} — ${fmt(state.loteSelecionado.valor)}`
              : `Terreno — ${fmt(valorLoteParaCalculo(state))}`}
          </p>
        </div>
        <div className="jornadaMemSection">
          <h3>Casa</h3>
          <p>
            {state.ofertaSelecionada?.produto_modelo ?? state.ofertaSelecionada?.titulo_oferta ?? state.ofertaSelecionada?.nome ?? '—'}
          </p>
          {state.valorAcoplamento > 0 && <p>Acoplamento: {fmt(state.valorAcoplamento)}</p>}
          {state.acabamentosArquiteto && (
            <p>Acabamentos com arquiteto: {fmt(VALOR_ACABAMENTOS_ARQUITETO)}</p>
          )}
          {state.kitSelecionado && state.valorKit > 0 && <p>Kit Moní: {fmt(state.valorKit)}</p>}
          {state.valorGadgets > 0 && <p>Extras: {fmt(state.valorGadgets)}</p>}
        </div>
        {resultadoSimulacao ? (
          <div className="jornadaMemTotal">
            <span>Valor total à vista</span>
            <span>{fmt(resultadoSimulacao.vte_avista)}</span>
          </div>
        ) : null}
      </div>

      <div className="jornadaBtnRow">
        <button type="button" className="jornadaBtn jornadaBtnSecondary" onClick={onVoltar}>Voltar</button>
        <button type="button" className="jornadaBtn jornadaBtnPrimary" onClick={onAvancar}>
          Ir para o contrato
        </button>
      </div>
    </div>
  );
}

function Passo7({ nomeCliente }: { nomeCliente: string }) {
  return (
    <div className="jornadaCard jornadaCardConcluido">
      <div className="jornadaConcluidoIcon">
        <svg viewBox="0 0 48 48" fill="none" width={48} height={48}>
          <circle cx="24" cy="24" r="22" fill="var(--j-gold)" opacity="0.15" />
          <circle cx="24" cy="24" r="22" stroke="var(--j-gold)" strokeWidth="2" />
          <path d="M14 24l7 7 13-14" stroke="var(--j-gold)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h2 className="jornadaCardTitle">Proposta enviada!</h2>
      <p className="jornadaCardSub">
        Obrigado, {nomeCliente.split(' ')[0]}! Nossa equipe vai entrar em contato em breve para finalizar os detalhes.
      </p>
      <div className="jornadaConcluidoNota">
        <p>📋 A área de contratos está sendo preparada. Em breve você poderá assinar tudo aqui mesmo.</p>
      </div>
    </div>
  );
}

export default function JornadaClient({
  empreendimento,
}: {
  empreendimento: EmpreendimentoPublico;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setStateRaw] = useState<JornadaLocal>(() => estadoInicial(empreendimento));
  const [isPending, startTransition] = useTransition();
  const [erroSimulacao, setErroSimulacao] = useState<string | null>(null);
  const [resultadoSimulacao, setResultadoSimulacao] = useState<ResultadoCalculo | null>(null);
  const [resultadoKey, setResultadoKey] = useState(0);
  const [valoresConfirmados, setValoresConfirmados] = useState<ValoresConfirmadosOferta | null>(null);
  const [recalcToken, setRecalcToken] = useState(0);

  const setState = useCallback((partial: Partial<JornadaLocal>) => {
    setStateRaw((prev) => ({ ...prev, ...partial }));
  }, []);

  useEffect(() => {
    const token = searchParams.get('sessao');
    if (!token) return;
    carregarJornadaSessao(token, empreendimento.card_id).then((sessao) => {
      if (!sessao) return;
      const lote = sessao.lote_codigo
        ? empreendimento.lotes.find((l) => l.codigo === sessao.lote_codigo) ?? null
        : null;
      const oferta = sessao.empreendimento_id
        ? empreendimento.ofertas.find((o) => o.id === sessao.empreendimento_id) ??
          empreendimento.ofertas.find((o) => o.imob_empreendimento_id === sessao.empreendimento_id) ??
          null
        : null;
      const itensIds = sessao.itens_selecionados ?? [];
      const acabamentosArquiteto = itensIds.includes(ID_ACABAMENTOS_ARQUITETO);
      const gadgetsSelecionados = new Set(itensIds.filter((id) => id !== ID_ACABAMENTOS_ARQUITETO));
      const kitSelecionado = itensIds.some((id) => {
        const item = empreendimento.itens_customizacao.find((i) => i.id === id);
        return item?.categoria === 'kit_moni';
      });
      const modoTerreno: ModoTerrenoJornada | null =
        sessao.lote_ja_adquirido === true
          ? 'informar'
          : lote
            ? 'disponivel'
            : sessao.lote_ja_adquirido === false
              ? 'disponivel'
              : null;
      const calcs = calcularCustomizacao(
        oferta,
        empreendimento.itens_customizacao,
        gadgetsSelecionados,
        kitSelecionado,
        acabamentosArquiteto,
      );
      const preview = oferta ? valorAvistaOferta(oferta) : null;
      setStateRaw((prev) => ({
        ...prev,
        etapa: sessao.etapa_atual,
        sessaoToken: sessao.session_token,
        nomeCliente: sessao.nome_cliente ?? '',
        telefoneCliente: maskTelefoneCelular(sessao.telefone_cliente ?? ''),
        loteSelecionado: lote,
        modoTerreno,
        valorJaPago: sessao.valor_ja_pago ?? 0,
        valorLote: sessao.valor_lote ?? (lote?.valor ?? 0),
        ofertaSelecionada: oferta,
        previewVteAvista: preview,
        gadgetsSelecionados,
        kitSelecionado,
        acabamentosArquiteto,
        valorAcoplamento: valorAcoplamentoDoLote(lote),
        ...calcs,
        simulacaoId: sessao.simulacao_id,
      }));
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function avancarEtapa(proximaEtapa: number, dadosExtras?: Record<string, unknown>) {
    const calcs = calcularCustomizacao(
      state.ofertaSelecionada,
      empreendimento.itens_customizacao,
      state.gadgetsSelecionados,
      state.kitSelecionado,
      state.acabamentosArquiteto,
    );
    const dados: Record<string, unknown> = {
      nome_cliente: state.nomeCliente,
      telefone_cliente: state.telefoneCliente,
      lote_codigo: state.loteSelecionado?.codigo ?? null,
      lote_valor: valorLoteParaCalculo(state) || null,
      lote_ja_adquirido: state.modoTerreno === 'informar',
      valor_ja_pago: state.valorJaPago,
      empreendimento_id: state.ofertaSelecionada?.imob_empreendimento_id ?? null,
      itens_selecionados: [
        ...state.gadgetsSelecionados,
        ...(state.kitSelecionado
          ? empreendimento.itens_customizacao
              .filter((i) => i.categoria === 'kit_moni')
              .map((i) => i.id)
          : []),
        ...(state.acabamentosArquiteto ? [ID_ACABAMENTOS_ARQUITETO] : []),
      ],
      valor_acoplamento: state.valorAcoplamento || null,
      valor_kit: calcs.valorKit || null,
      valor_gadgets: calcs.valorGadgets || null,
      valor_lote: valorLoteParaCalculo(state) || null,
      valor_casa: calcs.valorCasa || null,
      valor_customizacao: calcs.valorCustomizacao || null,
      simulacao_id: state.simulacaoId ?? null,
      ...dadosExtras,
    };

    const result = await salvarJornadaSessao({
      token: state.sessaoToken,
      cardId: empreendimento.card_id,
      etapa: proximaEtapa,
      dados,
    });

    if (result.ok) {
      if (result.session_token !== state.sessaoToken) {
        router.replace(`?sessao=${result.session_token}`, { scroll: false });
        setState({ sessaoToken: result.session_token, etapa: proximaEtapa, ...calcs });
      } else {
        setState({ etapa: proximaEtapa, ...calcs });
      }
    } else {
      setState({ etapa: proximaEtapa, ...calcs });
    }
  }

  function handleAvancar(proximaEtapa: number, dadosExtras?: Record<string, unknown>) {
    startTransition(() => {
      void avancarEtapa(proximaEtapa, dadosExtras);
    });
  }

  function voltar() {
    if (state.etapa === 5) {
      setResultadoSimulacao(null);
      setValoresConfirmados(null);
    }
    setState({ etapa: Math.max(1, state.etapa - 1) });
  }

  function handleVerSimulacao() {
    const templateId = empreendimento.template?.id;
    if (!templateId) {
      setErroSimulacao('Simulação indisponível para este empreendimento.');
      return;
    }
    if (!state.sessaoToken) {
      setErroSimulacao('Sessão não encontrada. Volte um passo e avance novamente.');
      return;
    }
    const valorBaseCasa = Number(state.ofertaSelecionada?.valor_base_casa);
    if (!Number.isFinite(valorBaseCasa) || valorBaseCasa <= 0) {
      setErroSimulacao(
        'Esta oferta não tem valor base da casa. Preencha o custo de construção no card da Helenna.',
      );
      return;
    }
    setErroSimulacao(null);
    setValoresConfirmados(null);
    setRecalcToken(0);
    const stateCalc: JornadaLocal = state;
    const oferta = montarOfertaJornada(
      stateCalc,
      empreendimento.template,
      empreendimento.itens_customizacao,
    );
    startTransition(() => {
      void gravarSimulacaoJornada({
        templateId,
        cardId: empreendimento.card_id,
        sessaoToken: state.sessaoToken as string,
        valorLote: oferta.valor_lote,
        valorCasa: oferta.valor_casa,
        valorCustomizacao: oferta.valor_customizacao,
        valorJaPago: oferta.valor_ja_pago,
        rendaCliente: state.rendaMensal,
        prazoObraMeses: stateCalc.prazoObraMeses,
        prazoFinanciamentoAnos: state.prazoFinanciamento,
        taxaFinanciamentoAnual: state.taxaJuros,
        nomeCliente: state.nomeCliente,
        telefoneCliente: state.telefoneCliente,
        condicaoLote: condicaoLoteJornada(stateCalc),
      }).then((result) => {
        if (result.ok) setState({ simulacaoId: result.simulacaoId, prazoObraMeses: stateCalc.prazoObraMeses });
        else setErroSimulacao(result.error);
      }).catch(() => {
        setErroSimulacao('Não foi possível gravar a simulação.');
      }).finally(() => {
        const calc = calcularOferta(
          montarTemplateParaEngine(empreendimento.template),
          oferta,
          state.valorAcoplamento,
        );
        setResultadoSimulacao(calc);
        setResultadoKey((n) => n + 1);
      });
    });
  }

  function handleRecalcularSimulacao(valores: ValoresConfirmadosOferta) {
    setErroSimulacao(null);
    try {
      const calc = calcularOferta(
        montarTemplateParaEngine(empreendimento.template),
        {
          ...montarOfertaJornada(
            state,
            empreendimento.template,
            empreendimento.itens_customizacao,
          ),
          entrada_confirmada: valores.entrada,
          mensal_confirmada: valores.mensal,
          parcela_unica_confirmada: valores.unica,
        },
        state.valorAcoplamento,
      );
      setValoresConfirmados(valores);
      setResultadoSimulacao(calc);
      setRecalcToken((n) => n + 1);
    } catch {
      setErroSimulacao('Não foi possível recalcular a simulação.');
    }
  }

  return (
    <div className="jornadaWrap">
      <header className="jornadaHeader">
        <h1 className="jornadaTitulo">{empreendimento.titulo}</h1>
        {empreendimento.descricao && (
          <p className="jornadaDescricao">{empreendimento.descricao}</p>
        )}
      </header>

      <ProgressBar etapa={state.etapa} />

      <main className="jornadaMain">
        {state.etapa === 1 && (
          <Passo1
            state={state}
            setState={setState}
            onAvancar={() => handleAvancar(2)}
            salvando={isPending}
          />
        )}
        {state.etapa === 2 && (
          <PassoOferta
            ofertas={empreendimento.ofertas}
            state={state}
            setState={setState}
            onAvancar={() => handleAvancar(3)}
            onVoltar={voltar}
            salvando={isPending}
          />
        )}
        {state.etapa === 3 && (
          <PassoTerreno
            lotes={empreendimento.lotes}
            state={state}
            setState={setState}
            onAvancar={() => handleAvancar(4)}
            onVoltar={voltar}
            salvando={isPending}
          />
        )}
        {state.etapa === 4 && (
          <PassoCasa
            itens={empreendimento.itens_customizacao}
            state={state}
            setState={setState}
            onAvancar={() => handleAvancar(5)}
            onVoltar={voltar}
            salvando={isPending}
          />
        )}
        {state.etapa === 5 && (
          <PassoSimulacao
            state={state}
            setState={setState}
            empreendimento={empreendimento}
            resultadoSimulacao={resultadoSimulacao}
            resultadoKey={resultadoKey}
            valoresConfirmados={valoresConfirmados}
            recalcToken={recalcToken}
            onAvancar={() => handleAvancar(6)}
            onVoltar={voltar}
            onVerSimulacao={handleVerSimulacao}
            onRecalcular={handleRecalcularSimulacao}
            salvando={isPending}
            erroSimulacao={erroSimulacao}
          />
        )}
        {state.etapa === 6 && (
          <Passo6
            state={state}
            empreendimento={empreendimento}
            resultadoSimulacao={resultadoSimulacao}
            onAvancar={() => handleAvancar(7, { concluida: 'true' })}
            onVoltar={voltar}
          />
        )}
        {state.etapa === 7 && <Passo7 nomeCliente={state.nomeCliente} />}
      </main>
    </div>
  );
}
