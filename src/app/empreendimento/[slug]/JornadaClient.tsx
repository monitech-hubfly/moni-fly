'use client';
// src/app/empreendimento/[slug]/JornadaClient.tsx

import { useState, useCallback, useTransition, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type {
  EmpreendimentoPublico,
  LotePublicoEmp,
  ItemCustomizacaoCasa,
  ItemCustomizacaoEscolhido,
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
  calcularParcelaUnicaMinimaConfirmada,
  formatarMoedaCentavos,
  parcelaUnicaAbaixoDoMinimo,
  sugerirParcelaMensal,
  type OfertaConfig,
  type ResultadoCalculo,
} from '@/lib/simulador/calcular-oferta';
import { montarTemplateParaEngine } from '@/lib/simulador/montar-template-jornada';
import { inferirCondicaoLote } from '@/lib/loteamento-simulador-template';
import { maskTelefoneCelular } from '@/lib/br-docs';
import {
  LOG_JORNADA_CUSTOMIZACAO,
  itensCustomizacaoDoModelo,
  itensCustomizacaoEscolhidos,
} from '@/lib/empreendimento/customizacao-itens';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmt = (v: number) => BRL.format(v);

/** Única fonte da sequência. ids = state.etapa. */
const JORNADA_STEPS = [
  { id: 1, slug: 'dados', label: 'Seus dados' },
  { id: 2, slug: 'oferta', label: 'Oferta' },
  { id: 3, slug: 'terreno', label: 'Terreno' },
  { id: 4, slug: 'casa', label: 'Casa' },
  { id: 5, slug: 'simulacao', label: 'Simulação' },
  { id: 6, slug: 'memorial', label: 'Memorial' },
  { id: 7, slug: 'contrato', label: 'Contrato' },
] as const;

const ETAPA = {
  dados: 1,
  oferta: 2,
  terreno: 3,
  casa: 4,
  simulacao: 5,
  memorial: 6,
  contrato: 7,
} as const;

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

/** valor_customizacao do motor = acompanhamento de arquiteto (se marcado) + itens marcados. */
function calcularCustomizacao(
  oferta: OfertaEmpreendimento | null,
  itens: ItemCustomizacaoCasa[],
  selecionados: Set<string>,
  acabamentosArquiteto = false,
): {
  valorCasa: number;
  valorCustomizacao: number;
  customizacaoEscolhidos: ItemCustomizacaoEscolhido[];
} {
  const valorCasa = Math.max(0, Number(oferta?.valor_base_casa) || 0);
  const customizacaoEscolhidos = itensCustomizacaoEscolhidos(
    itens,
    oferta?.produto_modelo,
    selecionados,
  );
  const valorItens = customizacaoEscolhidos.reduce((acc, i) => acc + i.valor, 0);
  const valorAcabamentos = acabamentosArquiteto ? VALOR_ACABAMENTOS_ARQUITETO : 0;

  return {
    valorCasa,
    valorCustomizacao: valorItens + valorAcabamentos,
    customizacaoEscolhidos,
  };
}

function montarOfertaJornada(
  state: JornadaLocal,
  tpl: TemplateConfigPublico | null,
  itens: ItemCustomizacaoCasa[],
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
    state.customizacaoSelecionados,
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
    customizacaoSelecionados: new Set(),
    acabamentosArquiteto: false,
    valorAcoplamento: 0,
    customizacaoEscolhidos: [],
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
    <div className="jornadaProgress" data-jornada-layout="oferta-terreno">
      {JORNADA_STEPS.map((step, i) => {
        const status = step.id < etapa ? 'done' : step.id === etapa ? 'active' : 'pending';
        return (
          <div key={step.slug} className={`jornadaStep ${status}`} data-step={step.slug}>
            <div className="jornadaStepDot">
              {status === 'done' ? (
                <svg viewBox="0 0 16 16" fill="none" width={10} height={10}>
                  <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <span>{step.id}</span>
              )}
            </div>
            <span className="jornadaStepLabel">{step.label}</span>
            {i < JORNADA_STEPS.length - 1 && <div className={`jornadaStepLine ${status === 'done' ? 'done' : ''}`} />}
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
            const avista = valorAvistaOferta(o);
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
                {avista != null ? (
                  <div className="jornadaOfertaValor">
                    <span className="jornadaOfertaLabel">Valor total à vista</span>
                    <span>{fmt(avista)}</span>
                  </div>
                ) : (
                  <p className="jornadaOfertaDesc">
                    Valor à vista ainda não preenchido na oferta.
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

function SeletorLote({
  id,
  label,
  lotes,
  selecionado,
  vazio,
  onEscolher,
}: {
  id: string;
  label: string;
  lotes: LotePublicoEmp[];
  selecionado: LotePublicoEmp | null;
  vazio: string;
  onEscolher: (lote: LotePublicoEmp) => void;
}) {
  if (lotes.length === 0) return <p className="jornadaEmpty">{vazio}</p>;
  const atual = selecionado && lotes.some((l) => l.id === selecionado.id) ? selecionado : null;
  return (
    <div className="jornadaField">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={atual?.id ?? ''}
        onChange={(e) => {
          const lote = lotes.find((l) => l.id === e.target.value);
          if (lote) onEscolher(lote);
        }}
      >
        <option value="" disabled>
          Selecione o lote
        </option>
        {lotes.map((l) => (
          <option key={l.id} value={l.id}>
            Lote {l.rotulo}
          </option>
        ))}
      </select>
      {atual && atual.valor > 0 ? (
        <span className="jornadaKitDesc">Valor do lote: {fmt(atual.valor)}</span>
      ) : null}
    </div>
  );
}

function PassoTerreno({
  lotes,
  lotesErro,
  state,
  setState,
  onAvancar,
  onVoltar,
  salvando,
}: {
  lotes: LotePublicoEmp[];
  lotesErro: string | null;
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
          Number.isFinite(state.valorLote) &&
          state.valorLote > 0 &&
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
      valorLote: keep ? state.valorLote : 0,
      valorJaPago: keep ? state.valorJaPago : 0,
    });
  }

  function escolherLote(lote: LotePublicoEmp, modo: ModoTerrenoJornada) {
    setState({
      modoTerreno: modo,
      loteSelecionado: lote,
      valorLote: modo === 'informar' ? state.valorLote : lote.valor,
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

      {lotesErro && state.modoTerreno ? (
        <p className="jornadaEmpty" role="alert">{lotesErro}</p>
      ) : null}

      {state.modoTerreno === 'disponivel' && !lotesErro ? (
        <SeletorLote
          id="lote-disponivel"
          label="Lote disponível"
          lotes={lotesVenda}
          selecionado={state.loteSelecionado}
          vazio="Nenhum lote disponível no momento."
          onEscolher={(l) => escolherLote(l, 'disponivel')}
        />
      ) : null}

      {state.modoTerreno === 'informar' && !lotesErro ? (
        <>
          <SeletorLote
            id="lote-adquirido"
            label="Seu lote"
            lotes={lotesOcupados}
            selecionado={state.loteSelecionado}
            vazio="Nenhum lote vendido encontrado na planilha."
            onEscolher={(l) => escolherLote(l, 'informar')}
          />
          <div className="jornadaField">
            <label htmlFor="valor-total-terreno">Valor total do terreno (R$)</label>
            <CampoNumeroBr
              id="valor-total-terreno"
              valor={state.valorLote}
              onChange={(n) => setState({ valorLote: n ?? 0 })}
              inteiro
              placeholder="0"
            />
          </div>
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
  erroItens,
  state,
  setState,
  onAvancar,
  onVoltar,
  salvando,
}: {
  itens: ItemCustomizacaoCasa[];
  erroItens: string | null;
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
      state.customizacaoSelecionados,
      state.acabamentosArquiteto,
    );
    setState(calcs);
    if (erroItens) {
      console.error(LOG_JORNADA_CUSTOMIZACAO, 'lista de itens indisponível no step 4');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleItem(id: string) {
    const next = new Set(state.customizacaoSelecionados);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    const calcs = calcularCustomizacao(
      state.ofertaSelecionada,
      itens,
      next,
      state.acabamentosArquiteto,
    );
    setState({ customizacaoSelecionados: next, ...calcs });
  }

  function toggleAcabamentos(val: boolean) {
    const calcs = calcularCustomizacao(
      state.ofertaSelecionada,
      itens,
      state.customizacaoSelecionados,
      val,
    );
    setState({ acabamentosArquiteto: val, ...calcs });
  }

  const itensDoModelo = itensCustomizacaoDoModelo(itens, state.ofertaSelecionada?.produto_modelo);

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
        <div className="jornadaAcoplamentoTotal">
          <strong>Valor do acoplamento</strong>
          <span>{fmt(state.valorAcoplamento)}</span>
        </div>
        <p className="jornadaKitDesc">
          {state.loteSelecionado
            ? `Valor da tabela do lote ${state.loteSelecionado.rotulo}.`
            : 'Sem valor na tabela de lotes.'}
        </p>
      </section>

      <section className="jornadaSection">
        <h3 className="jornadaSectionTitle">
          <span className="jornadaSectionBadge">B</span>
          Customização
        </h3>
        <div className="jornadaCustomizacaoLista">
          <label className="jornadaKitToggle">
            <input
              type="checkbox"
              checked={state.acabamentosArquiteto}
              onChange={(e) => toggleAcabamentos(e.target.checked)}
            />
            <div className="jornadaKitInfo">
              <span className="jornadaKitNome">Quero definir acabamentos com arquiteto parceiro</span>
              <span className="jornadaKitDesc">
                Após a assinatura do contrato, você será contactado pelo escritório Studio Arquitetura
                e Design, parceiro Moní neste empreendimento. A definição dos acabamentos ocorre antes
                do início da obra, em sessões de design personalizadas.
              </span>
            </div>
            <span className="jornadaKitValor">{fmt(VALOR_ACABAMENTOS_ARQUITETO)}</span>
          </label>
          {!erroItens &&
            itensDoModelo.map((i) => (
              <label key={i.id} className="jornadaKitToggle">
                <input
                  type="checkbox"
                  checked={state.customizacaoSelecionados.has(i.id)}
                  onChange={() => toggleItem(i.id)}
                />
                <div className="jornadaKitInfo">
                  <span className="jornadaKitNome">{i.item}</span>
                  {i.descricao && <span className="jornadaKitDesc">{i.descricao}</span>}
                </div>
                <span className="jornadaKitValor">{fmt(i.preco)}</span>
              </label>
            ))}
        </div>
        {erroItens ? (
          <p className="jornadaEmpty" role="alert">{erroItens}</p>
        ) : itensDoModelo.length === 0 ? (
          <p className="jornadaEmpty">Nenhum outro item de customização disponível para este modelo.</p>
        ) : null}
        {state.valorCustomizacao > 0 ? (
          <div className="jornadaAcoplamentoTotal">
            <strong>Total da customização</strong>
            <span>{fmt(state.valorCustomizacao)}</span>
          </div>
        ) : null}
      </section>

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
  minimoParcelaUnica,
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
  minimoParcelaUnica: (entrada: number, mensal: number) => number;
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
  if (state.acabamentosArquiteto) {
    extrasCustom.push(`Acabamentos com arquiteto ${fmt(VALOR_ACABAMENTOS_ARQUITETO)}`);
  }
  for (const i of state.customizacaoEscolhidos) extrasCustom.push(`${i.item} ${fmt(i.valor)}`);

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
            minimoParcelaUnica={minimoParcelaUnica}
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
              ? valorLoteParaCalculo(state) > 0
                ? `Lote ${state.loteSelecionado.rotulo} — ${fmt(valorLoteParaCalculo(state))}`
                : `Lote ${state.loteSelecionado.rotulo}`
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
          {state.customizacaoEscolhidos.map((i) => (
            <p key={i.id}>
              {i.item}: {fmt(i.valor)}
            </p>
          ))}
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
  const corretorIdRef = useRef(searchParams.get('corretor_id')?.trim() ?? '');
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
      const idsCatalogo = new Set(empreendimento.customizacao_itens.map((i) => i.id));
      const customizacaoSelecionados = new Set(
        [...itensIds, ...(sessao.customizacao_itens ?? []).map((i) => i.id)].filter((id) =>
          idsCatalogo.has(id),
        ),
      );
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
        empreendimento.customizacao_itens,
        customizacaoSelecionados,
        acabamentosArquiteto,
      );
      const preview = oferta ? valorAvistaOferta(oferta) : null;
      const temOferta = Boolean(oferta);
      let etapa = Math.max(ETAPA.dados, Math.round(Number(sessao.etapa_atual) || ETAPA.dados));
      if (!temOferta && etapa >= ETAPA.terreno) etapa = ETAPA.oferta;
      setStateRaw((prev) => ({
        ...prev,
        etapa,
        sessaoToken: sessao.session_token,
        nomeCliente: sessao.nome_cliente ?? '',
        telefoneCliente: maskTelefoneCelular(sessao.telefone_cliente ?? ''),
        loteSelecionado: lote,
        modoTerreno,
        valorJaPago: sessao.valor_ja_pago ?? 0,
        valorLote: sessao.valor_lote ?? (lote?.valor ?? 0),
        ofertaSelecionada: oferta,
        previewVteAvista: preview,
        customizacaoSelecionados,
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
      empreendimento.customizacao_itens,
      state.customizacaoSelecionados,
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
        ...calcs.customizacaoEscolhidos.map((i) => i.id),
        ...(state.acabamentosArquiteto ? [ID_ACABAMENTOS_ARQUITETO] : []),
      ],
      customizacao_itens: calcs.customizacaoEscolhidos,
      valor_acoplamento: state.valorAcoplamento || null,
      valor_lote: valorLoteParaCalculo(state) || null,
      valor_casa: calcs.valorCasa || null,
      valor_customizacao: calcs.valorCustomizacao,
      simulacao_id: state.simulacaoId ?? null,
      slug_empreendimento: empreendimento.slug,
      ...(corretorIdRef.current ? { corretor_id: corretorIdRef.current } : {}),
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
        const params = new URLSearchParams(searchParams.toString());
        params.set('sessao', result.session_token);
        if (corretorIdRef.current) params.set('corretor_id', corretorIdRef.current);
        router.replace(`?${params.toString()}`, { scroll: false });
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
    if (state.etapa === ETAPA.simulacao) {
      setResultadoSimulacao(null);
      setValoresConfirmados(null);
    }
    setState({ etapa: Math.max(ETAPA.dados, state.etapa - 1) });
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
    const prazoObra = Math.max(1, Math.round(state.prazoObraMeses || 12));
    const stateCalc: JornadaLocal = { ...state, prazoObraMeses: prazoObra };
    const oferta = montarOfertaJornada(
      stateCalc,
      empreendimento.template,
      empreendimento.customizacao_itens,
    );
    startTransition(() => {
      void gravarSimulacaoJornada({
        templateId,
        cardId: empreendimento.card_id,
        sessaoToken: state.sessaoToken as string,
        valorLote: oferta.valor_lote,
        valorCasa: oferta.valor_casa,
        valorCustomizacao: oferta.valor_customizacao,
        customizacaoItens: calcularCustomizacao(
          stateCalc.ofertaSelecionada,
          empreendimento.customizacao_itens,
          stateCalc.customizacaoSelecionados,
          stateCalc.acabamentosArquiteto,
        ).customizacaoEscolhidos,
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

  function minimoParcelaUnicaJornada(entrada: number, mensal: number): number {
    return calcularParcelaUnicaMinimaConfirmada(
      montarTemplateParaEngine(empreendimento.template),
      montarOfertaJornada(state, empreendimento.template, empreendimento.customizacao_itens),
      entrada,
      mensal,
      state.valorAcoplamento,
    );
  }

  function handleRecalcularSimulacao(valores: ValoresConfirmadosOferta) {
    setErroSimulacao(null);
    try {
      const minimo = minimoParcelaUnicaJornada(valores.entrada, valores.mensal);
      if (parcelaUnicaAbaixoDoMinimo(valores.unica, minimo)) {
        setErroSimulacao(
          `A parcela única precisa ser de pelo menos ${formatarMoedaCentavos(minimo)} para quitar o lote.`,
        );
        return;
      }
      const calc = calcularOferta(
        montarTemplateParaEngine(empreendimento.template),
        {
          ...montarOfertaJornada(
            state,
            empreendimento.template,
            empreendimento.customizacao_itens,
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
        {state.etapa === ETAPA.dados && (
          <Passo1
            state={state}
            setState={setState}
            onAvancar={() => handleAvancar(ETAPA.oferta)}
            salvando={isPending}
          />
        )}
        {state.etapa === ETAPA.oferta && (
          <PassoOferta
            ofertas={empreendimento.ofertas}
            state={state}
            setState={setState}
            onAvancar={() => handleAvancar(ETAPA.terreno)}
            onVoltar={voltar}
            salvando={isPending}
          />
        )}
        {state.etapa === ETAPA.terreno && (
          <PassoTerreno
            lotes={empreendimento.lotes}
            lotesErro={empreendimento.lotes_erro}
            state={state}
            setState={setState}
            onAvancar={() => handleAvancar(ETAPA.casa)}
            onVoltar={voltar}
            salvando={isPending}
          />
        )}
        {state.etapa === ETAPA.casa && (
          <PassoCasa
            itens={empreendimento.customizacao_itens}
            erroItens={empreendimento.customizacao_erro}
            state={state}
            setState={setState}
            onAvancar={() => handleAvancar(ETAPA.simulacao)}
            onVoltar={voltar}
            salvando={isPending}
          />
        )}
        {state.etapa === ETAPA.simulacao && (
          <PassoSimulacao
            state={state}
            setState={setState}
            empreendimento={empreendimento}
            resultadoSimulacao={resultadoSimulacao}
            resultadoKey={resultadoKey}
            valoresConfirmados={valoresConfirmados}
            recalcToken={recalcToken}
            onAvancar={() => handleAvancar(ETAPA.memorial)}
            onVoltar={voltar}
            onVerSimulacao={handleVerSimulacao}
            onRecalcular={handleRecalcularSimulacao}
            minimoParcelaUnica={minimoParcelaUnicaJornada}
            salvando={isPending}
            erroSimulacao={erroSimulacao}
          />
        )}
        {state.etapa === ETAPA.memorial && (
          <Passo6
            state={state}
            empreendimento={empreendimento}
            resultadoSimulacao={resultadoSimulacao}
            onAvancar={() => handleAvancar(ETAPA.contrato, { concluida: 'true' })}
            onVoltar={voltar}
          />
        )}
        {state.etapa === ETAPA.contrato && <Passo7 nomeCliente={state.nomeCliente} />}
      </main>
    </div>
  );
}
