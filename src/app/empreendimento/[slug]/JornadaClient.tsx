'use client';
// src/app/empreendimento/[slug]/JornadaClient.tsx

import { useState, useCallback, useTransition, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type {
  EmpreendimentoPublico,
  LotePublicoEmp,
  ItemCustomizacao,
  OfertaEmpreendimento,
  JornadaLocal,
} from './types';
import {
  salvarJornadaSessao,
  carregarJornadaSessao,
} from '@/lib/actions/jornada-cliente';

// ─────────────────────────────────────────────────────────────────────────────
// Utilitários
// ─────────────────────────────────────────────────────────────────────────────
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmt = (v: number) => BRL.format(v);

function maskTelefone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

const ETAPAS = [
  'Seus dados',
  'Lote',
  'Oferta',
  'Casa',
  'Simulação',
  'Memorial',
  'Contrato',
];

// ─────────────────────────────────────────────────────────────────────────────
// Estado inicial
// ─────────────────────────────────────────────────────────────────────────────
function estadoInicial(): JornadaLocal {
  return {
    etapa: 1,
    sessaoToken: null,
    nomeCliente: '',
    telefoneCliente: '',
    loteSelecionado: null,
    ofertaSelecionada: null,
    gadgetsSelecionados: new Set(),
    kitSelecionado: false,
    valorAcoplamento: 0,
    valorKit: 0,
    valorGadgets: 0,
    valorCasa: 0,
    valorCustomizacao: 0,
    valorLote: 0,
    simulacaoId: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cálculos do Passo 4
// valorCasa       = valor_avista da oferta (preço da casa definido pela Helena)
// valorAcoplamento = lote.acoplamento (obrigatório, vem da planilha)
// valorKit        = kit moní selecionado
// valorGadgets    = soma dos gadgets selecionados
// valorCustomizacao = acoplamento + kit + gadgets
// ─────────────────────────────────────────────────────────────────────────────
function calcularValoresCasa(
  lote: LotePublicoEmp | null,
  oferta: OfertaEmpreendimento | null,
  itens: ItemCustomizacao[],
  gadgetsSelecionados: Set<string>,
  kitSelecionado: boolean,
): { valorAcoplamento: number; valorKit: number; valorGadgets: number; valorCasa: number; valorCustomizacao: number } {
  const valorAcoplamento = lote?.acoplamento ?? 0;
  const valorCasa = oferta?.valor_avista ?? 0;

  const kitItem = itens.find((i) => i.categoria === 'kit_moni');
  const valorKit = kitSelecionado && kitItem ? kitItem.valor : 0;

  const valorGadgets = itens
    .filter((i) => i.categoria === 'gadget' && gadgetsSelecionados.has(i.id))
    .reduce((acc, i) => acc + i.valor, 0);

  const valorCustomizacao = valorAcoplamento + valorKit + valorGadgets;

  return { valorAcoplamento, valorKit, valorGadgets, valorCasa, valorCustomizacao };
}

// ─────────────────────────────────────────────────────────────────────────────
// Indicador de progresso
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// Passo 1 — Dados do cliente
// ─────────────────────────────────────────────────────────────────────────────
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
          placeholder="(11) 99999-9999"
          value={state.telefoneCliente}
          onChange={(e) => setState({ telefoneCliente: maskTelefone(e.target.value) })}
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

// ─────────────────────────────────────────────────────────────────────────────
// Passo 2 — Escolher lote
// ─────────────────────────────────────────────────────────────────────────────
function Passo2({
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
  return (
    <div className="jornadaCard">
      <h2 className="jornadaCardTitle">Escolha o lote</h2>
      <p className="jornadaCardSub">Selecione o lote que você tem interesse.</p>

      {lotes.length === 0 ? (
        <p className="jornadaEmpty">Nenhum lote disponível no momento.</p>
      ) : (
        <div className="jornadaGrid">
          {lotes.map((l) => (
            <button
              key={l.id}
              className={`jornadaLoteCard ${state.loteSelecionado?.id === l.id ? 'selected' : ''}`}
              onClick={() => setState({ loteSelecionado: l, valorLote: l.valor })}
            >
              <span className="jornadaLoteCodigo">{l.codigo}</span>
              <span className="jornadaLoteValor">{fmt(l.valor)}</span>
            </button>
          ))}
        </div>
      )}

      <div className="jornadaBtnRow">
        <button className="jornadaBtn jornadaBtnSecondary" onClick={onVoltar}>Voltar</button>
        <button
          className="jornadaBtn jornadaBtnPrimary"
          disabled={!state.loteSelecionado || salvando}
          onClick={onAvancar}
        >
          {salvando ? 'Salvando…' : 'Continuar'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Passo 3 — Escolher oferta (a oferta já define o modelo de casa)
// ─────────────────────────────────────────────────────────────────────────────
function Passo3({
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
  return (
    <div className="jornadaCard">
      <h2 className="jornadaCardTitle">Escolha a oferta</h2>
      <p className="jornadaCardSub">Selecione o modelo e condição de pagamento que funciona melhor para você.</p>

      {ofertas.length === 0 ? (
        <p className="jornadaEmpty">Nenhuma oferta disponível no momento.</p>
      ) : (
        <div className="jornadaOfertasList">
          {ofertas.map((o) => (
            <button
              key={o.id}
              className={`jornadaOfertaCard ${state.ofertaSelecionada?.id === o.id ? 'selected' : ''}`}
              onClick={() => setState({ ofertaSelecionada: o })}
            >
              <div className="jornadaOfertaHeader">
                <span className="jornadaOfertaNome">{o.titulo_oferta ?? o.nome ?? `Oferta ${o.ordem + 1}`}</span>
                {o.produto_modelo && <span className="jornadaOfertaModelo">{o.produto_modelo}</span>}
              </div>
              {o.valor_avista && (
                <div className="jornadaOfertaValor">
                  <span className="jornadaOfertaLabel">Casa</span>
                  <span>{fmt(o.valor_avista)}</span>
                </div>
              )}
              {o.descricao && <p className="jornadaOfertaDesc">{o.descricao}</p>}
            </button>
          ))}
        </div>
      )}

      <div className="jornadaBtnRow">
        <button className="jornadaBtn jornadaBtnSecondary" onClick={onVoltar}>Voltar</button>
        <button
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

// ─────────────────────────────────────────────────────────────────────────────
// Passo 4 — Customizar casa
// Modelo já definido pela oferta. Aqui: acoplamento (obrigatório) + kit + gadgets.
// ─────────────────────────────────────────────────────────────────────────────
function Passo4({
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
  // Inicializa acoplamento e valorCasa a partir do lote/oferta ao entrar neste passo
  useEffect(() => {
    const calcs = calcularValoresCasa(
      state.loteSelecionado,
      state.ofertaSelecionada,
      itens,
      state.gadgetsSelecionados,
      state.kitSelecionado,
    );
    setState(calcs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleGadget(id: string) {
    const next = new Set(state.gadgetsSelecionados);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    const calcs = calcularValoresCasa(state.loteSelecionado, state.ofertaSelecionada, itens, next, state.kitSelecionado);
    setState({ gadgetsSelecionados: next, ...calcs });
  }

  function toggleKit(val: boolean) {
    const calcs = calcularValoresCasa(state.loteSelecionado, state.ofertaSelecionada, itens, state.gadgetsSelecionados, val);
    setState({ kitSelecionado: val, ...calcs });
  }

  const kitItem = itens.find((i) => i.categoria === 'kit_moni');
  const gadgets = itens.filter((i) => i.categoria === 'gadget');
  const totalInvestimento = state.valorCasa + state.valorCustomizacao;

  return (
    <div className="jornadaCard passo4">
      <h2 className="jornadaCardTitle">Personalize sua casa</h2>
      <p className="jornadaCardSub">
        {state.ofertaSelecionada?.produto_modelo
          ? `Modelo: ${state.ofertaSelecionada.produto_modelo}. Adicione o que combina com você.`
          : 'Adicione o que combina com você.'}
      </p>

      {/* A: Acoplamento — obrigatório, valor do lote */}
      <section className="jornadaSection">
        <h3 className="jornadaSectionTitle">
          <span className="jornadaSectionBadge">A</span>
          Acoplamento <span className="jornadaIncluido">obrigatório</span>
        </h3>
        <p className="jornadaSectionDesc">
          Valor definido pelo lote escolhido ({state.loteSelecionado?.codigo}).
        </p>
        <div className="jornadaAcoplamentoTotal">
          <span>Acoplamento</span>
          <span>{fmt(state.valorAcoplamento)}</span>
        </div>
      </section>

      {/* B: Kit Moní — opcional */}
      {kitItem && (
        <section className="jornadaSection">
          <h3 className="jornadaSectionTitle">
            <span className="jornadaSectionBadge">B</span>
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

      {/* C: Gadgets — opcionais */}
      {gadgets.length > 0 && (
        <section className="jornadaSection">
          <h3 className="jornadaSectionTitle">
            <span className="jornadaSectionBadge">C</span>
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

      {/* Resumo */}
      <div className="jornadaResumo">
        <div className="jornadaResumoRow">
          <span>
            Casa
            {state.ofertaSelecionada?.produto_modelo ? ` (${state.ofertaSelecionada.produto_modelo})` : ''}
          </span>
          <span>{fmt(state.valorCasa)}</span>
        </div>
        <div className="jornadaResumoRow">
          <span>Acoplamento</span>
          <span>{fmt(state.valorAcoplamento)}</span>
        </div>
        {state.kitSelecionado && state.valorKit > 0 && (
          <div className="jornadaResumoRow">
            <span>Kit Moní</span>
            <span>{fmt(state.valorKit)}</span>
          </div>
        )}
        {state.gadgetsSelecionados.size > 0 && state.valorGadgets > 0 && (
          <div className="jornadaResumoRow">
            <span>Extras</span>
            <span>{fmt(state.valorGadgets)}</span>
          </div>
        )}
        <div className="jornadaResumoTotal">
          <span>Total da casa</span>
          <span>{fmt(totalInvestimento)}</span>
        </div>
      </div>

      <div className="jornadaBtnRow">
        <button className="jornadaBtn jornadaBtnSecondary" onClick={onVoltar}>Voltar</button>
        <button
          className="jornadaBtn jornadaBtnPrimary"
          disabled={salvando}
          onClick={onAvancar}
        >
          {salvando ? 'Calculando…' : 'Ver simulação'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Passo 5 — Simulação de pagamento
// ─────────────────────────────────────────────────────────────────────────────
function Passo5({
  state,
  empreendimento,
  onAvancar,
  onVoltar,
}: {
  state: JornadaLocal;
  empreendimento: EmpreendimentoPublico;
  onAvancar: () => void;
  onVoltar: () => void;
}) {
  const totalCasa = state.valorCasa + state.valorCustomizacao;
  const totalGeral = state.valorLote + totalCasa;

  return (
    <div className="jornadaCard">
      <h2 className="jornadaCardTitle">Sua simulação</h2>
      <p className="jornadaCardSub">
        Resumo do investimento em {empreendimento.titulo}.
      </p>

      <div className="jornadaSimulacaoResumo">
        <div className="jornadaSimRow">
          <span>Lote {state.loteSelecionado?.codigo}</span>
          <span>{fmt(state.valorLote)}</span>
        </div>
        <div className="jornadaSimRow">
          <span>
            Casa
            {state.ofertaSelecionada?.produto_modelo ? ` (${state.ofertaSelecionada.produto_modelo})` : ''}
          </span>
          <span>{fmt(state.valorCasa)}</span>
        </div>
        {state.valorAcoplamento > 0 && (
          <div className="jornadaSimRow">
            <span>Acoplamento</span>
            <span>{fmt(state.valorAcoplamento)}</span>
          </div>
        )}
        {state.valorKit > 0 && (
          <div className="jornadaSimRow">
            <span>Kit Moní</span>
            <span>{fmt(state.valorKit)}</span>
          </div>
        )}
        {state.valorGadgets > 0 && (
          <div className="jornadaSimRow">
            <span>Extras</span>
            <span>{fmt(state.valorGadgets)}</span>
          </div>
        )}
        <div className="jornadaSimTotal">
          <span>Total do investimento</span>
          <span>{fmt(totalGeral)}</span>
        </div>
      </div>

      {state.ofertaSelecionada && (
        <div className="jornadaSimOferta">
          <h3>Condição de pagamento selecionada</h3>
          <p>{state.ofertaSelecionada.titulo_oferta ?? state.ofertaSelecionada.nome}</p>
          {state.ofertaSelecionada.descricao && (
            <p className="jornadaOfertaDesc">{state.ofertaSelecionada.descricao}</p>
          )}
        </div>
      )}

      <p className="jornadaSimNota">
        Um consultor Moní entrará em contato para detalhar as condições de financiamento personalizadas.
      </p>

      <div className="jornadaBtnRow">
        <button className="jornadaBtn jornadaBtnSecondary" onClick={onVoltar}>Voltar</button>
        <button className="jornadaBtn jornadaBtnPrimary" onClick={onAvancar}>
          Ver memorial
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Passo 6 — Memorial descritivo
// ─────────────────────────────────────────────────────────────────────────────
function Passo6({
  state,
  empreendimento,
  onAvancar,
  onVoltar,
}: {
  state: JornadaLocal;
  empreendimento: EmpreendimentoPublico;
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
          <p>Lote {state.loteSelecionado?.codigo} — {state.loteSelecionado ? fmt(state.loteSelecionado.valor) : '—'}</p>
        </div>
        <div className="jornadaMemSection">
          <h3>Casa</h3>
          <p>
            {state.ofertaSelecionada?.produto_modelo ?? state.ofertaSelecionada?.titulo_oferta ?? '—'}
            {state.valorCasa > 0 ? ` — ${fmt(state.valorCasa)}` : ''}
          </p>
          {state.valorAcoplamento > 0 && <p>Acoplamento: {fmt(state.valorAcoplamento)}</p>}
          {state.kitSelecionado && state.valorKit > 0 && <p>Kit Moní: {fmt(state.valorKit)}</p>}
          {state.valorGadgets > 0 && <p>Extras: {fmt(state.valorGadgets)}</p>}
        </div>
        <div className="jornadaMemSection">
          <h3>Condição de pagamento</h3>
          <p>{state.ofertaSelecionada?.titulo_oferta ?? state.ofertaSelecionada?.nome ?? '—'}</p>
        </div>
        <div className="jornadaMemTotal">
          <span>Total do investimento</span>
          <span>{fmt(state.valorLote + state.valorCasa + state.valorCustomizacao)}</span>
        </div>
      </div>

      <div className="jornadaBtnRow">
        <button className="jornadaBtn jornadaBtnSecondary" onClick={onVoltar}>Voltar</button>
        <button className="jornadaBtn jornadaBtnPrimary" onClick={onAvancar}>
          Ir para o contrato
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Passo 7 — Contrato (placeholder)
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────
export default function JornadaClient({
  empreendimento,
}: {
  empreendimento: EmpreendimentoPublico;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setStateRaw] = useState<JornadaLocal>(estadoInicial);
  const [isPending, startTransition] = useTransition();

  const setState = useCallback((partial: Partial<JornadaLocal>) => {
    setStateRaw((prev) => ({ ...prev, ...partial }));
  }, []);

  // Retomada de sessão via ?sessao=token
  useEffect(() => {
    const token = searchParams.get('sessao');
    if (!token) return;
    carregarJornadaSessao(token, empreendimento.card_id).then((sessao) => {
      if (!sessao) return;
      const lote = sessao.lote_codigo
        ? empreendimento.lotes.find((l) => l.codigo === sessao.lote_codigo) ?? null
        : null;
      const oferta = sessao.empreendimento_id
        ? empreendimento.ofertas.find((o) => o.id === sessao.empreendimento_id) ?? null
        : null;
      setStateRaw((prev) => ({
        ...prev,
        etapa: sessao.etapa_atual,
        sessaoToken: sessao.session_token,
        nomeCliente: sessao.nome_cliente ?? '',
        telefoneCliente: sessao.telefone_cliente ?? '',
        loteSelecionado: lote,
        valorLote: sessao.valor_lote ?? (lote?.valor ?? 0),
        ofertaSelecionada: oferta,
        gadgetsSelecionados: new Set(sessao.itens_selecionados ?? []),
        kitSelecionado: (sessao.itens_selecionados ?? []).some((id) => {
          const item = empreendimento.itens_customizacao.find((i) => i.id === id);
          return item?.categoria === 'kit_moni';
        }),
        valorAcoplamento: sessao.valor_acoplamento ?? 0,
        valorKit: sessao.valor_kit ?? 0,
        valorGadgets: sessao.valor_gadgets ?? 0,
        valorCasa: sessao.valor_casa ?? 0,
        valorCustomizacao: sessao.valor_customizacao ?? 0,
        simulacaoId: sessao.simulacao_id,
      }));
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function avancarEtapa(proximaEtapa: number, dadosExtras?: Record<string, unknown>) {
    const dados: Record<string, unknown> = {
      nome_cliente: state.nomeCliente,
      telefone_cliente: state.telefoneCliente,
      lote_codigo: state.loteSelecionado?.codigo ?? null,
      lote_valor: state.valorLote || null,
      empreendimento_id: state.ofertaSelecionada?.id ?? null,
      itens_selecionados: [
        ...state.gadgetsSelecionados,
        ...(state.kitSelecionado
          ? empreendimento.itens_customizacao
              .filter((i) => i.categoria === 'kit_moni')
              .map((i) => i.id)
          : []),
      ],
      valor_acoplamento: state.valorAcoplamento || null,
      valor_kit: state.valorKit || null,
      valor_gadgets: state.valorGadgets || null,
      valor_lote: state.valorLote || null,
      valor_casa: state.valorCasa || null,
      valor_customizacao: state.valorCustomizacao || null,
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
        setState({ sessaoToken: result.session_token, etapa: proximaEtapa });
      } else {
        setState({ etapa: proximaEtapa });
      }
    } else {
      setState({ etapa: proximaEtapa });
    }
  }

  function handleAvancar(proximaEtapa: number, dadosExtras?: Record<string, unknown>) {
    startTransition(() => {
      void avancarEtapa(proximaEtapa, dadosExtras);
    });
  }

  function voltar() {
    setState({ etapa: Math.max(1, state.etapa - 1) });
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
          <Passo2
            lotes={empreendimento.lotes}
            state={state}
            setState={setState}
            onAvancar={() => handleAvancar(3)}
            onVoltar={voltar}
            salvando={isPending}
          />
        )}
        {state.etapa === 3 && (
          <Passo3
            ofertas={empreendimento.ofertas}
            state={state}
            setState={setState}
            onAvancar={() => handleAvancar(4)}
            onVoltar={voltar}
            salvando={isPending}
          />
        )}
        {state.etapa === 4 && (
          <Passo4
            itens={empreendimento.itens_customizacao}
            state={state}
            setState={setState}
            onAvancar={() => handleAvancar(5)}
            onVoltar={voltar}
            salvando={isPending}
          />
        )}
        {state.etapa === 5 && (
          <Passo5
            state={state}
            empreendimento={empreendimento}
            onAvancar={() => handleAvancar(6)}
            onVoltar={voltar}
          />
        )}
        {state.etapa === 6 && (
          <Passo6
            state={state}
            empreendimento={empreendimento}
            onAvancar={() => handleAvancar(7, { concluida: 'true' })}
            onVoltar={voltar}
          />
        )}
        {state.etapa === 7 && <Passo7 nomeCliente={state.nomeCliente} />}
      </main>
    </div>
  );
}
