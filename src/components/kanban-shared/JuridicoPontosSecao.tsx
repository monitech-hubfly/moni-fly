'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { searchFaqArticles } from '@/lib/actions/faq-actions';
import {
  enviarPontoParaCentralAjuda,
  excluirPontoJuridico,
  listarCatalogoFaqJuridico,
  listarPontosJuridicos,
  moverPontoJuridico,
  salvarPontoJuridico,
  type PontoJuridicoRow,
} from '@/lib/actions/juridico-pontos-actions';
import { CamposIntencaoRepositorio, ResolverRepositorioPonto } from '@/components/kanban-shared/JuridicoPontoRepositorio';
import {
  JURIDICO_PONTO_APLICACAO_LABEL,
  JURIDICO_PONTO_APLICACOES,
  JURIDICO_PONTO_DECISAO_LABEL,
  JURIDICO_PONTO_DECISOES,
  JURIDICO_PONTO_FAQ_LABEL,
  JURIDICO_PONTO_FAQ_STATUS,
  pendenciasPontoJuridicoConcluido,
  statusVisualPontoJuridico,
  type JuridicoPontoConclusao,
  type JuridicoPontoTipo,
} from '@/lib/kanban/juridico-pontos';
import { gerarRespostaRodada, textoCopiaFinais } from '@/lib/kanban/juridico-resposta-rodada';

type Rascunho = {
  id: string | null;
  tipo: JuridicoPontoTipo;
  duvida_recebida: string;
  resposta: string;
  clausula_trecho: string;
  solicitacao_alteracao: string;
  decisao: string;
  texto_final_aprovado: string;
  aplicacao_futura: string;
  repositorio_tipo_id: string;
  repositorio_variacao_id: string;
  repositorio_nova_variacao_nome: string;
  repositorio_nova_variacao_quando: string;
  tem_versao_repositorio: boolean;
  motivo_resposta: string;
  faq_status: string;
  faq_article_id: string;
  faq_pergunta: string;
  faq_slug: string;
  faq_artigo_status: string;
};

const campoStyle = {
  width: '100%',
  minHeight: 44,
  borderRadius: 'var(--moni-radius-md)',
  border: 'var(--moni-border-width) solid var(--moni-border-default)',
  background: 'var(--moni-surface-0)',
  color: 'var(--moni-text-primary)',
  fontFamily: 'var(--moni-font-sans)',
  fontSize: 13,
  padding: '8px 10px',
} as const;

function rascunhoDe(ponto: PontoJuridicoRow): Rascunho {
  return {
    id: ponto.id,
    tipo: ponto.tipo,
    duvida_recebida: ponto.duvida_recebida ?? '',
    resposta: ponto.resposta ?? '',
    clausula_trecho: ponto.clausula_trecho ?? '',
    solicitacao_alteracao: ponto.solicitacao_alteracao ?? '',
    decisao: ponto.decisao ?? '',
    texto_final_aprovado: ponto.texto_final_aprovado ?? '',
    aplicacao_futura: ponto.aplicacao_futura ?? '',
    repositorio_tipo_id: ponto.repositorio_tipo_id ?? '',
    repositorio_variacao_id: ponto.repositorio_variacao_id ?? '',
    repositorio_nova_variacao_nome: ponto.repositorio_nova_variacao_nome ?? '',
    repositorio_nova_variacao_quando: ponto.repositorio_nova_variacao_quando_utilizar ?? '',
    tem_versao_repositorio: ponto.tem_versao_repositorio,
    motivo_resposta: ponto.motivo_resposta ?? '',
    faq_status: ponto.faq_status ?? '',
    faq_article_id: ponto.faq_article_id ?? '',
    faq_pergunta: ponto.faq_pergunta ?? '',
    faq_slug: ponto.faq_slug ?? '',
    faq_artigo_status: ponto.faq_artigo_status ?? '',
  };
}

function rascunhoNovo(tipo: JuridicoPontoTipo): Rascunho {
  return {
    id: null,
    tipo,
    duvida_recebida: '',
    resposta: '',
    clausula_trecho: '',
    solicitacao_alteracao: '',
    decisao: '',
    texto_final_aprovado: '',
    aplicacao_futura: '',
    repositorio_tipo_id: '',
    repositorio_variacao_id: '',
    repositorio_nova_variacao_nome: '',
    repositorio_nova_variacao_quando: '',
    tem_versao_repositorio: false,
    motivo_resposta: '',
    faq_status: '',
    faq_article_id: '',
    faq_pergunta: '',
    faq_slug: '',
    faq_artigo_status: '',
  };
}

function conclusaoDoPonto(ponto: {
  tipo: string;
  duvida_recebida?: string | null;
  resposta?: string | null;
  faq_status?: string | null;
  faq_article_id?: string | null;
  clausula_trecho?: string | null;
  solicitacao_alteracao?: string | null;
  decisao?: string | null;
  texto_final_aprovado?: string | null;
  aplicacao_futura?: string | null;
  motivo_resposta?: string | null;
  repositorio_tipo_id?: string | null;
  repositorio_variacao_id?: string | null;
  repositorio_nova_variacao_nome?: string | null;
  repositorio_nova_variacao_quando?: string | null;
  repositorio_nova_variacao_quando_utilizar?: string | null;
}): JuridicoPontoConclusao {
  return {
    tipo: ponto.tipo,
    duvidaRecebida: ponto.duvida_recebida,
    resposta: ponto.resposta,
    faqStatus: ponto.faq_status,
    faqArticleId: ponto.faq_article_id,
    clausulaTrecho: ponto.clausula_trecho,
    solicitacaoAlteracao: ponto.solicitacao_alteracao,
    decisao: ponto.decisao,
    textoFinalAprovado: ponto.texto_final_aprovado,
    aplicacaoFutura: ponto.aplicacao_futura,
    motivoResposta: ponto.motivo_resposta,
    repositorioTipoId: ponto.repositorio_tipo_id,
    repositorioVariacaoId: ponto.repositorio_variacao_id,
    novaVariacaoNome: ponto.repositorio_nova_variacao_nome,
    novaVariacaoQuando: ponto.repositorio_nova_variacao_quando ?? ponto.repositorio_nova_variacao_quando_utilizar,
  };
}

function textoCopia(ponto: PontoJuridicoRow): string | null {
  if (ponto.tipo === 'duvida') return ponto.resposta;
  if (ponto.decisao === 'aceita' || ponto.decisao === 'aceita_parcialmente') return ponto.texto_final_aprovado;
  if (ponto.decisao === 'nao_aceita') return ponto.motivo_resposta;
  return null;
}

function rotuloCopia(ponto: PontoJuridicoRow): string | null {
  if (!textoCopia(ponto)) return null;
  if (ponto.tipo === 'alteracao' && (ponto.decisao === 'aceita' || ponto.decisao === 'aceita_parcialmente')) {
    return 'Copiar nova redação';
  }
  return 'Copiar resposta';
}

export function JuridicoPontosSecao({
  cardId,
  podeEditar,
  exibirGerarResposta = false,
}: {
  cardId: string;
  podeEditar: boolean;
  exibirGerarResposta?: boolean;
}) {
  const [rodadaAtual, setRodadaAtual] = useState(1);
  const [pontos, setPontos] = useState<PontoJuridicoRow[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [escolhendo, setEscolhendo] = useState(false);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [abertas, setAbertas] = useState<Record<number, boolean>>({});
  const [artigos, setArtigos] = useState<{ id: string; question: string }[]>([]);
  const [buscaFaq, setBuscaFaq] = useState('');
  const [respostaAberta, setRespostaAberta] = useState(false);
  const [avisoResposta, setAvisoResposta] = useState<string | null>(null);
  const [copiaAviso, setCopiaAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const res = await listarPontosJuridicos(cardId);
    if (!res.ok) {
      setErro(res.error);
      setPontos([]);
      return;
    }
    setErro(null);
    setRodadaAtual(res.rodadaAtual);
    setPontos(res.pontos);
  }, [cardId]);

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    void listarPontosJuridicos(cardId).then((res) => {
      if (!vivo) return;
      if (!res.ok) setErro(res.error);
      else {
        setErro(null);
        setRodadaAtual(res.rodadaAtual);
        setPontos(res.pontos);
      }
      setCarregando(false);
    });
    return () => {
      vivo = false;
    };
  }, [cardId]);

  useEffect(() => {
    function aoEditar(evento: Event) {
      const id = String((evento as CustomEvent<string>).detail ?? '');
      const ponto = pontos.find((item) => item.id === id);
      if (!ponto) return;
      setAbertas((prev) => ({ ...prev, [ponto.rodada]: true }));
      setEscolhendo(false);
      setRascunho(rascunhoDe(ponto));
      setBuscaFaq('');
      setArtigos([]);
    }
    window.addEventListener('juridico-editar-ponto', aoEditar);
    return () => window.removeEventListener('juridico-editar-ponto', aoEditar);
  }, [pontos]);

  const porRodada = useMemo(() => {
    const mapa = new Map<number, PontoJuridicoRow[]>();
    for (const ponto of pontos) {
      const lista = mapa.get(ponto.rodada) ?? [];
      lista.push(ponto);
      mapa.set(ponto.rodada, lista);
    }
    return [...mapa.entries()].sort((a, b) => b[0] - a[0]);
  }, [pontos]);

  const anteriores = porRodada.filter(([rodada]) => rodada !== rodadaAtual);
  const atuais = pontos.filter((p) => p.rodada === rodadaAtual).sort((a, b) => a.ordem - b.ordem);
  const respostaRodada = useMemo(
    () =>
      gerarRespostaRodada(
        pontos.map((ponto) => ({ ...conclusaoDoPonto(ponto), rodada: ponto.rodada, ordem: ponto.ordem })),
        rodadaAtual,
      ),
    [pontos, rodadaAtual],
  );

  function abrirResposta() {
    if (!respostaRodada.ok) {
      setRespostaAberta(false);
      setAvisoResposta(respostaRodada.mensagem);
      return;
    }
    setAvisoResposta(null);
    setCopiaAviso(null);
    setRespostaAberta(true);
  }

  async function copiar(texto: string, aviso: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiaAviso(aviso);
    } catch {
      setCopiaAviso('Não foi possível copiar.');
    }
  }

  async function salvar() {
    if (!rascunho) return;
    setSalvando(true);
    setErro(null);
    const res = await salvarPontoJuridico({ cardId, ...rascunho });
    setSalvando(false);
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    setRascunho(null);
    setEscolhendo(false);
    setArtigos([]);
    setBuscaFaq('');
    await carregar();
  }

  async function buscarFaq(termo: string) {
    setBuscaFaq(termo);
    if (termo.trim().length < 2) {
      setArtigos([]);
      return;
    }
    try {
      const lista = await searchFaqArticles(termo);
      setArtigos(lista.map((artigo) => ({ id: artigo.id, question: artigo.pergunta })));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível buscar a Central de Ajuda.');
    }
  }

  async function enviarFaq(dados: { pergunta: string; resposta: string; categoryId: string; area: string }) {
    if (!rascunho) return;
    setSalvando(true);
    setErro(null);
    let pontoId = rascunho.id;
    if (!pontoId) {
      const salvo = await salvarPontoJuridico({ cardId, ...rascunho, faq_status: 'retroalimentar' });
      if (!salvo.ok) {
        setSalvando(false);
        setErro(salvo.error);
        return;
      }
      pontoId = salvo.id;
    }
    const res = await enviarPontoParaCentralAjuda({
      cardId,
      pontoId,
      pergunta: dados.pergunta,
      resposta: dados.resposta,
      categoryId: dados.categoryId,
      responsibleArea: dados.area,
    });
    setSalvando(false);
    if (!res.ok) {
      setErro(res.error);
      await carregar();
      return;
    }
    setRascunho(null);
    setEscolhendo(false);
    await carregar();
  }

  return (
    <section className="mb-6" aria-label="Pontos Jurídicos">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
          Pontos Jurídicos
        </h4>
        <span className="text-xs" style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}>
          Rodada {rodadaAtual}
        </span>
      </div>

      {erro ? (
        <p className="mb-2 text-xs" style={{ color: 'var(--moni-text-secondary)' }}>
          {erro}
        </p>
      ) : null}

      <div
        className="space-y-3 p-3"
        style={{
          background: 'var(--moni-surface-50)',
          border: 'var(--moni-border-width) solid var(--moni-border-default)',
          borderRadius: 'var(--moni-radius-lg)',
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold" style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' }}>
            Rodada {rodadaAtual}
          </p>
          {exibirGerarResposta ? (
            <button type="button" style={botaoSecundario} onClick={abrirResposta}>
              Gerar resposta da rodada
            </button>
          ) : null}
        </div>
        {avisoResposta ? (
          <p className="text-xs" role="status" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
            {avisoResposta}
          </p>
        ) : null}
        {carregando ? (
          <p className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
            Carregando pontos…
          </p>
        ) : (
          atuais.map((ponto, indice) => (
            <CardPonto
              key={ponto.id}
              ponto={ponto}
              numero={indice + 1}
              podeEditar={podeEditar}
              podeSubir={indice > 0}
              podeDescer={indice < atuais.length - 1}
              editando={rascunho?.id === ponto.id}
              rascunho={rascunho?.id === ponto.id ? rascunho : null}
              artigos={artigos}
              buscaFaq={buscaFaq}
              salvando={salvando}
              onEditar={() => {
                setEscolhendo(false);
                setRascunho(rascunhoDe(ponto));
                setBuscaFaq('');
                setArtigos([]);
              }}
              onChange={setRascunho}
              onBuscaFaq={(termo) => void buscarFaq(termo)}
              onSalvar={() => void salvar()}
              onEnviarFaq={(dados) => void enviarFaq(dados)}
              onCancelar={() => setRascunho(null)}
              onResolvido={() => void carregar()}
              onExcluir={async () => {
                const res = await excluirPontoJuridico(cardId, ponto.id);
                if (!res.ok) setErro(res.error);
                else await carregar();
              }}
              onMover={async (direcao) => {
                const res = await moverPontoJuridico(cardId, ponto.id, direcao);
                if (!res.ok) setErro(res.error);
                else await carregar();
              }}
            />
          ))
        )}
        {!carregando && atuais.length === 0 && !rascunho ? (
          <p className="text-xs" style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}>
            Nenhum ponto nesta rodada.
          </p>
        ) : null}

        {podeEditar && rascunho && !rascunho.id ? (
          <FormularioPonto
            rascunho={rascunho}
            artigos={artigos}
            buscaFaq={buscaFaq}
            salvando={salvando}
            onChange={setRascunho}
            onBuscaFaq={(termo) => void buscarFaq(termo)}
            onSalvar={() => void salvar()}
            onEnviarFaq={(dados) => void enviarFaq(dados)}
            onCancelar={() => {
              setRascunho(null);
              setEscolhendo(false);
            }}
            ponto={null}
            onResolvido={() => void carregar()}
          />
        ) : null}

        {podeEditar && !rascunho ? (
          escolhendo ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" style={botaoSecundario} onClick={() => setRascunho(rascunhoNovo('duvida'))}>
                Dúvida
              </button>
              <button type="button" style={botaoSecundario} onClick={() => setRascunho(rascunhoNovo('alteracao'))}>
                Alteração
              </button>
              <button type="button" style={botaoSecundario} onClick={() => setEscolhendo(false)}>
                Cancelar
              </button>
            </div>
          ) : (
            <button type="button" style={botaoPrimario} onClick={() => setEscolhendo(true)}>
              + Adicionar ponto
            </button>
          )
        ) : null}
      </div>

      {respostaAberta && respostaRodada.ok ? (
        <ModalRespostaRodada
          texto={respostaRodada.texto}
          textosFinais={respostaRodada.textosFinais}
          copiaAviso={copiaAviso}
          onCopiarResposta={() => void copiar(respostaRodada.texto, 'Resposta copiada.')}
          onCopiarFinais={() => void copiar(textoCopiaFinais(respostaRodada.textosFinais), 'Textos finais copiados.')}
          onFechar={() => setRespostaAberta(false)}
        />
      ) : null}

      {anteriores.map(([rodada, lista]) => {
        const aberta = Boolean(abertas[rodada]);
        return (
          <div
            key={rodada}
            className="mt-2"
            style={{
              border: 'var(--moni-border-width) solid var(--moni-border-default)',
              borderRadius: 'var(--moni-radius-md)',
            }}
          >
            <button
              type="button"
              className="flex w-full items-center justify-between px-3 text-left text-xs font-semibold"
              style={{ minHeight: 44, color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' }}
              aria-expanded={aberta}
              onClick={() => setAbertas((prev) => ({ ...prev, [rodada]: !prev[rodada] }))}
            >
              <span>Rodada {rodada}</span>
              <span style={{ color: 'var(--moni-text-tertiary)', fontWeight: 500 }}>
                {lista.length} {lista.length === 1 ? 'ponto' : 'pontos'}
              </span>
            </button>
            {aberta ? (
              <div className="space-y-2 px-3 pb-3">
                {lista
                  .slice()
                  .sort((a, b) => a.ordem - b.ordem)
                  .map((ponto, indice) => (
                    <CardPonto
                      key={ponto.id}
                      ponto={ponto}
                      numero={indice + 1}
                      podeEditar={podeEditar}
                      podeSubir={indice > 0}
                      podeDescer={indice < lista.length - 1}
                      editando={rascunho?.id === ponto.id}
                      rascunho={rascunho?.id === ponto.id ? rascunho : null}
                      artigos={artigos}
                      buscaFaq={buscaFaq}
                      salvando={salvando}
                      onEditar={() => setRascunho(rascunhoDe(ponto))}
                      onChange={setRascunho}
                      onBuscaFaq={(termo) => void buscarFaq(termo)}
                      onSalvar={() => void salvar()}
                      onEnviarFaq={(dados) => void enviarFaq(dados)}
                      onCancelar={() => setRascunho(null)}
                      onResolvido={() => void carregar()}
                      onExcluir={async () => {
                        const res = await excluirPontoJuridico(cardId, ponto.id);
                        if (!res.ok) setErro(res.error);
                        else await carregar();
                      }}
                      onMover={async (direcao) => {
                        const res = await moverPontoJuridico(cardId, ponto.id, direcao);
                        if (!res.ok) setErro(res.error);
                        else await carregar();
                      }}
                    />
                  ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

const botaoPrimario = {
  minHeight: 44,
  borderRadius: 'var(--moni-radius-md)',
  background: 'var(--moni-navy-800)',
  color: 'white',
  fontFamily: 'var(--moni-font-sans)',
  fontSize: 13,
  fontWeight: 600,
  padding: '0 14px',
  border: 'none',
} as const;

const botaoSecundario = {
  minHeight: 44,
  borderRadius: 'var(--moni-radius-md)',
  background: 'var(--moni-surface-0)',
  color: 'var(--moni-text-primary)',
  fontFamily: 'var(--moni-font-sans)',
  fontSize: 12,
  fontWeight: 600,
  padding: '0 12px',
  border: 'var(--moni-border-width) solid var(--moni-border-default)',
} as const;

function ModalRespostaRodada({
  texto,
  textosFinais,
  copiaAviso,
  onCopiarResposta,
  onCopiarFinais,
  onFechar,
}: {
  texto: string;
  textosFinais: string[];
  copiaAviso: string | null;
  onCopiarResposta: () => void;
  onCopiarFinais: () => void;
  onFechar: () => void;
}) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[230] flex items-end justify-center bg-[color-mix(in_srgb,var(--moni-navy-800)_45%,transparent)] p-3 sm:items-center"
      role="presentation"
      onClick={onFechar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Resposta da rodada"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col"
        style={{
          background: 'var(--moni-surface-0)',
          border: 'var(--moni-border-width) solid var(--moni-border-default)',
          borderRadius: 'var(--moni-radius-lg)',
          boxShadow: 'var(--moni-shadow-card)',
        }}
        onClick={(evento) => evento.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <h3 className="text-base" style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-display)' }}>
            Resposta da rodada
          </h3>
          <button type="button" style={botaoSecundario} onClick={onFechar}>
            Fechar
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
          <pre
            className="whitespace-pre-wrap text-sm"
            style={{
              minHeight: 280,
              margin: 0,
              padding: 16,
              color: 'var(--moni-text-primary)',
              fontFamily: 'var(--moni-font-sans)',
              background: 'var(--moni-surface-50)',
              border: 'var(--moni-border-width) solid var(--moni-border-default)',
              borderRadius: 'var(--moni-radius-md)',
            }}
          >
            {texto}
          </pre>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" style={botaoPrimario} onClick={onCopiarResposta}>
              Copiar resposta
            </button>
            {copiaAviso ? (
              <span className="text-xs" role="status" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
                {copiaAviso}
              </span>
            ) : null}
          </div>
          {textosFinais.length > 0 ? (
            <div
              className="space-y-3 p-3"
              style={{
                border: 'var(--moni-border-width) solid var(--moni-border-default)',
                borderRadius: 'var(--moni-radius-md)',
              }}
            >
              <p className="text-xs font-semibold" style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' }}>
                Textos finais aprovados
              </p>
              {textosFinais.map((final, indice) => (
                <div key={`${indice}-${final.slice(0, 24)}`}>
                  <p className="text-xs font-semibold" style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}>
                    Ponto {indice + 1}
                  </p>
                  <p className="whitespace-pre-wrap text-sm" style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' }}>
                    {final}
                  </p>
                </div>
              ))}
              <button type="button" style={botaoSecundario} onClick={onCopiarFinais}>
                Copiar textos finais
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function CardPonto({
  ponto,
  numero,
  podeEditar,
  podeSubir,
  podeDescer,
  editando,
  rascunho,
  artigos,
  buscaFaq,
  salvando,
  onEditar,
  onChange,
  onBuscaFaq,
  onSalvar,
  onEnviarFaq,
  onCancelar,
  onResolvido,
  onExcluir,
  onMover,
}: {
  ponto: PontoJuridicoRow;
  numero: number;
  podeEditar: boolean;
  podeSubir: boolean;
  podeDescer: boolean;
  editando: boolean;
  rascunho: Rascunho | null;
  artigos: { id: string; question: string }[];
  buscaFaq: string;
  salvando: boolean;
  onEditar: () => void;
  onChange: (r: Rascunho) => void;
  onBuscaFaq: (termo: string) => void;
  onSalvar: () => void;
  onEnviarFaq: (dados: { pergunta: string; resposta: string; categoryId: string; area: string }) => void;
  onCancelar: () => void;
  onResolvido: () => void;
  onExcluir: () => Promise<void>;
  onMover: (direcao: 'subir' | 'descer') => Promise<void>;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const status = statusVisualPontoJuridico(conclusaoDoPonto(ponto));
  const copia = textoCopia(ponto);
  const rotulo = rotuloCopia(ponto);
  const titulo = ponto.tipo === 'duvida' ? `Dúvida #${numero}` : `Alteração #${numero}`;
  const resumo =
    ponto.tipo === 'duvida'
      ? ponto.duvida_recebida || 'Dúvida sem texto'
      : ponto.clausula_trecho || ponto.solicitacao_alteracao || 'Alteração sem texto';

  if (editando && rascunho) {
    return (
      <FormularioPonto
        rascunho={rascunho}
        artigos={artigos}
        buscaFaq={buscaFaq}
        salvando={salvando}
        onChange={onChange}
        onBuscaFaq={onBuscaFaq}
        onSalvar={onSalvar}
        onEnviarFaq={onEnviarFaq}
        onCancelar={onCancelar}
        ponto={ponto}
        onResolvido={onResolvido}
      />
    );
  }

  return (
    <article
      id={`juridico-ponto-${ponto.id}`}
      className="space-y-1.5 p-3"
      style={{
        background: 'var(--moni-surface-0)',
        border: 'var(--moni-border-width) solid var(--moni-border-default)',
        borderRadius: 'var(--moni-radius-md)',
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <strong className="text-[11px] tracking-wide" style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' }}>
          {titulo}
        </strong>
        <span className={status === 'Respondida' ? 'moni-tag-concluido' : 'moni-tag-atencao'}>{status}</span>
      </div>
      <p className="text-xs" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
        {resumo}
      </p>
      {ponto.tipo === 'alteracao' && ponto.decisao ? (
        <p className="text-[11px]" style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}>
          Decisão: {JURIDICO_PONTO_DECISAO_LABEL[ponto.decisao]}
          {ponto.aplicacao_futura ? ` · Aplicação: ${JURIDICO_PONTO_APLICACAO_LABEL[ponto.aplicacao_futura]}` : ''}
        </p>
      ) : null}
      {ponto.faq_status ? (
        <p className="text-[11px]" style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}>
          FAQ: {JURIDICO_PONTO_FAQ_LABEL[ponto.faq_status]}
          {ponto.faq_status === 'retroalimentar' && ponto.faq_article_id ? ' · Enviado para Central de Ajuda' : ''}
          {ponto.faq_pergunta ? ` · ${ponto.faq_pergunta}` : ''}
        </p>
      ) : null}
      <ResolverRepositorioPonto
        ponto={ponto}
        podeEditar={podeEditar}
        sujo={false}
        nome={ponto.repositorio_nova_variacao_nome ?? ''}
        quando={ponto.repositorio_nova_variacao_quando_utilizar ?? ''}
        onResolvido={onResolvido}
      />
      {ponto.faq_slug && ponto.faq_article_id ? (
        <a
          href={`/universidade/faq/${encodeURIComponent(ponto.faq_slug)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-[12px] font-semibold"
          style={{ minHeight: 44, color: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-sans)' }}
        >
          Ver na Central de Ajuda
        </a>
      ) : null}
      <div className="flex flex-wrap gap-2 pt-1">
        {podeEditar ? (
          <button type="button" style={botaoSecundario} onClick={onEditar}>
            Editar
          </button>
        ) : null}
        {podeEditar && podeSubir ? (
          <button type="button" style={botaoSecundario} onClick={() => void onMover('subir')}>
            Subir
          </button>
        ) : null}
        {podeEditar && podeDescer ? (
          <button type="button" style={botaoSecundario} onClick={() => void onMover('descer')}>
            Descer
          </button>
        ) : null}
        {rotulo && copia ? (
          <button
            type="button"
            style={botaoSecundario}
            onClick={() => void navigator.clipboard.writeText(copia)}
          >
            {rotulo}
          </button>
        ) : null}
        {podeEditar ? (
          confirmando ? (
            <>
              <button
                type="button"
                style={botaoSecundario}
                onClick={() => {
                  setConfirmando(false);
                  void onExcluir();
                }}
              >
                Confirmar exclusão
              </button>
              <button type="button" style={botaoSecundario} onClick={() => setConfirmando(false)}>
                Manter
              </button>
            </>
          ) : (
            <button type="button" style={botaoSecundario} onClick={() => setConfirmando(true)}>
              Excluir
            </button>
          )
        ) : null}
      </div>
    </article>
  );
}

function FormularioPonto({
  rascunho,
  artigos,
  buscaFaq,
  salvando,
  onChange,
  onBuscaFaq,
  onSalvar,
  onEnviarFaq,
  onCancelar,
  ponto,
  onResolvido,
}: {
  rascunho: Rascunho;
  artigos: { id: string; question: string }[];
  buscaFaq: string;
  salvando: boolean;
  onChange: (r: Rascunho) => void;
  onBuscaFaq: (termo: string) => void;
  onSalvar: () => void;
  onEnviarFaq: (dados: { pergunta: string; resposta: string; categoryId: string; area: string }) => void;
  onCancelar: () => void;
  ponto: PontoJuridicoRow | null;
  onResolvido: () => void;
}) {
  const set = (parcial: Partial<Rascunho>) => onChange({ ...rascunho, ...parcial });
  const mostraFaq =
    rascunho.tipo === 'duvida' || (rascunho.tipo === 'alteracao' && rascunho.decisao === 'nao_aceita');
  const aceita = rascunho.decisao === 'aceita' || rascunho.decisao === 'aceita_parcialmente';
  const avisos =
    statusVisualPontoJuridico(conclusaoDoPonto(rascunho)) === 'Incompleta'
      ? pendenciasPontoJuridicoConcluido(conclusaoDoPonto(rascunho))
      : [];

  return (
    <div
      id={ponto?.id ? `juridico-ponto-${ponto.id}` : undefined}
      className="space-y-2 p-3"
      style={{
        background: 'var(--moni-surface-0)',
        border: 'var(--moni-border-width) solid var(--moni-border-default)',
        borderRadius: 'var(--moni-radius-md)',
      }}
    >
      <p className="text-[11px] font-semibold" style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' }}>
        {rascunho.tipo === 'duvida' ? 'Dúvida' : 'Alteração'}
      </p>
      {rascunho.tipo === 'duvida' ? (
        <>
          <label className="block text-[11px]" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
            Dúvida recebida
            <textarea
              value={rascunho.duvida_recebida}
              onChange={(e) => set({ duvida_recebida: e.target.value })}
              style={{ ...campoStyle, minHeight: 72, display: 'block', marginTop: 4 }}
            />
          </label>
          <label className="block text-[11px]" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
            Resposta
            <textarea
              value={rascunho.resposta}
              onChange={(e) => set({ resposta: e.target.value })}
              style={{ ...campoStyle, minHeight: 72, display: 'block', marginTop: 4 }}
            />
          </label>
        </>
      ) : (
        <>
          <label className="block text-[11px]" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
            Cláusula / trecho
            <textarea
              value={rascunho.clausula_trecho}
              onChange={(e) => set({ clausula_trecho: e.target.value })}
              style={{ ...campoStyle, minHeight: 72, display: 'block', marginTop: 4 }}
            />
          </label>
          <label className="block text-[11px]" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
            Solicitação de alteração
            <textarea
              value={rascunho.solicitacao_alteracao}
              onChange={(e) => set({ solicitacao_alteracao: e.target.value })}
              style={{ ...campoStyle, minHeight: 72, display: 'block', marginTop: 4 }}
            />
          </label>
          <label className="block text-[11px]" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
            Decisão
            <select
              value={rascunho.decisao}
              onChange={(e) => set({ decisao: e.target.value })}
              style={{ ...campoStyle, display: 'block', marginTop: 4 }}
            >
              <option value="">Selecione</option>
              {JURIDICO_PONTO_DECISOES.map((d) => (
                <option key={d} value={d}>
                  {JURIDICO_PONTO_DECISAO_LABEL[d]}
                </option>
              ))}
            </select>
          </label>
          {aceita ? (
            <>
              <label className="block text-[11px]" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
                Texto final aprovado
                <textarea
                  value={rascunho.texto_final_aprovado}
                  onChange={(e) => set({ texto_final_aprovado: e.target.value })}
                  style={{ ...campoStyle, minHeight: 72, display: 'block', marginTop: 4 }}
                />
              </label>
              <label className="block text-[11px]" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
                Aplicação futura
                <select
                  value={rascunho.aplicacao_futura}
                  disabled={rascunho.tem_versao_repositorio}
                  onChange={(e) => {
                    const aplicacao = e.target.value;
                    set({
                      aplicacao_futura: aplicacao,
                      repositorio_tipo_id: aplicacao === 'somente_este_documento' ? '' : rascunho.repositorio_tipo_id,
                      repositorio_variacao_id: aplicacao === 'alterar_variacao_existente' ? rascunho.repositorio_variacao_id : '',
                      repositorio_nova_variacao_nome: aplicacao === 'criar_nova_variacao' ? rascunho.repositorio_nova_variacao_nome : '',
                      repositorio_nova_variacao_quando:
                        aplicacao === 'criar_nova_variacao' ? rascunho.repositorio_nova_variacao_quando : '',
                    });
                  }}
                  style={{ ...campoStyle, display: 'block', marginTop: 4 }}
                >
                  <option value="">Selecione</option>
                  {JURIDICO_PONTO_APLICACOES.map((a) => (
                    <option key={a} value={a}>
                      {JURIDICO_PONTO_APLICACAO_LABEL[a]}
                    </option>
                  ))}
                </select>
              </label>
              <CamposIntencaoRepositorio rascunho={rascunho} onChange={set} />
            </>
          ) : null}
          {rascunho.decisao === 'nao_aceita' ? (
            <label className="block text-[11px]" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
              Motivo / resposta
              <textarea
                value={rascunho.motivo_resposta}
                onChange={(e) => set({ motivo_resposta: e.target.value })}
                style={{ ...campoStyle, minHeight: 72, display: 'block', marginTop: 4 }}
              />
            </label>
          ) : null}
        </>
      )}
      {mostraFaq ? (
        <FaqCampo
          rascunho={rascunho}
          artigos={artigos}
          buscaFaq={buscaFaq}
          salvando={salvando}
          onChange={set}
          onBuscaFaq={onBuscaFaq}
          onEnviarFaq={onEnviarFaq}
        />
      ) : null}
      {ponto && rascunho.id ? (
        <ResolverRepositorioPonto
          ponto={ponto}
          podeEditar
          sujo={
            rascunho.aplicacao_futura !== (ponto.aplicacao_futura ?? '') ||
            rascunho.repositorio_tipo_id !== (ponto.repositorio_tipo_id ?? '') ||
            rascunho.repositorio_variacao_id !== (ponto.repositorio_variacao_id ?? '') ||
            rascunho.repositorio_nova_variacao_nome !== (ponto.repositorio_nova_variacao_nome ?? '') ||
            rascunho.repositorio_nova_variacao_quando !== (ponto.repositorio_nova_variacao_quando_utilizar ?? '')
          }
          nome={rascunho.repositorio_nova_variacao_nome}
          quando={rascunho.repositorio_nova_variacao_quando}
          onResolvido={onResolvido}
        />
      ) : null}
      {avisos.length > 0 ? (
        <p className="text-[11px]" style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}>
          Para considerar completa: {avisos.join(' ')}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2 pt-1">
        <button type="button" style={botaoPrimario} disabled={salvando} onClick={onSalvar}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
        <button type="button" style={botaoSecundario} onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

function FaqCampo({
  rascunho,
  artigos,
  buscaFaq,
  salvando,
  onChange,
  onBuscaFaq,
  onEnviarFaq,
}: {
  rascunho: Rascunho;
  artigos: { id: string; question: string }[];
  buscaFaq: string;
  salvando: boolean;
  onChange: (parcial: Partial<Rascunho>) => void;
  onBuscaFaq: (termo: string) => void;
  onEnviarFaq: (dados: { pergunta: string; resposta: string; categoryId: string; area: string }) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-[11px]" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
        FAQ
        <select
          value={rascunho.faq_status}
          onChange={(e) => {
            const next = e.target.value;
            const mesmo = next === rascunho.faq_status;
            onChange({
              faq_status: next,
              faq_article_id: mesmo ? rascunho.faq_article_id : '',
              faq_pergunta: mesmo ? rascunho.faq_pergunta : '',
              faq_slug: mesmo ? rascunho.faq_slug : '',
              faq_artigo_status: mesmo ? rascunho.faq_artigo_status : '',
            });
          }}
          style={{ ...campoStyle, display: 'block', marginTop: 4 }}
        >
          <option value="">Selecione</option>
          {JURIDICO_PONTO_FAQ_STATUS.map((s) => (
            <option key={s} value={s}>
              {JURIDICO_PONTO_FAQ_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      {rascunho.faq_status === 'ja_existe' ? (
        <div>
          <input
            value={buscaFaq}
            onChange={(e) => onBuscaFaq(e.target.value)}
            placeholder="Buscar artigo da Central de Ajuda"
            style={campoStyle}
          />
          {rascunho.faq_pergunta ? (
            <p className="mt-1 text-[11px]" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
              Artigo: {rascunho.faq_pergunta}
            </p>
          ) : null}
          {artigos.length > 0 ? (
            <ul className="mt-1 space-y-1">
              {artigos.map((artigo) => (
                <li key={artigo.id}>
                  <button
                    type="button"
                    className="w-full text-left text-[12px]"
                    style={{ ...botaoSecundario, height: 'auto', minHeight: 44, padding: '8px 10px' }}
                    onClick={() => onChange({ faq_article_id: artigo.id, faq_pergunta: artigo.question })}
                  >
                    {artigo.question}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {rascunho.faq_status === 'retroalimentar' && rascunho.faq_article_id ? (
        <div className="space-y-1">
          <p className="text-[11px]" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
            Enviado para Central de Ajuda
            {rascunho.faq_pergunta ? ` · ${rascunho.faq_pergunta}` : ''}
            {rascunho.faq_artigo_status === 'draft' ? ' · Rascunho' : ''}
          </p>
          {rascunho.faq_slug ? (
            <a
              href={`/universidade/faq/${encodeURIComponent(rascunho.faq_slug)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-[12px] font-semibold"
              style={{ minHeight: 44, color: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-sans)' }}
            >
              Ver na Central de Ajuda
            </a>
          ) : null}
        </div>
      ) : null}
      {rascunho.faq_status === 'retroalimentar' && !rascunho.faq_article_id ? (
        <FormRetroalimentar rascunho={rascunho} salvando={salvando} onEnviarFaq={onEnviarFaq} />
      ) : null}
    </div>
  );
}

function FormRetroalimentar({
  rascunho,
  salvando,
  onEnviarFaq,
}: {
  rascunho: Rascunho;
  salvando: boolean;
  onEnviarFaq: (dados: { pergunta: string; resposta: string; categoryId: string; area: string }) => void;
}) {
  const sugestaoDireta = rascunho.tipo === 'duvida';
  const [pergunta, setPergunta] = useState(sugestaoDireta ? rascunho.duvida_recebida : '');
  const [resposta, setResposta] = useState(sugestaoDireta ? rascunho.resposta : '');
  const [categoryId, setCategoryId] = useState('');
  const [area, setArea] = useState('');
  const [categorias, setCategorias] = useState<{ id: string; name: string }[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void listarCatalogoFaqJuridico().then((res) => {
      if (!vivo) return;
      if (!res.ok) {
        setErroLocal(res.error);
        return;
      }
      setCategorias(res.categorias);
      setAreas(res.areas);
      if (res.areaSugerida) setArea(res.areaSugerida);
    });
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <div className="space-y-2">
      <label className="block text-[11px]" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
        Pergunta
        <textarea
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value)}
          style={{ ...campoStyle, minHeight: 72, display: 'block', marginTop: 4 }}
        />
      </label>
      <label className="block text-[11px]" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
        Resposta
        <textarea
          value={resposta}
          onChange={(e) => setResposta(e.target.value)}
          style={{ ...campoStyle, minHeight: 72, display: 'block', marginTop: 4 }}
        />
      </label>
      <label className="block text-[11px]" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
        Categoria
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          style={{ ...campoStyle, display: 'block', marginTop: 4 }}
        >
          <option value="">Selecione</option>
          {categorias.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-[11px]" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
        Área responsável
        <select
          value={area}
          onChange={(e) => setArea(e.target.value)}
          style={{ ...campoStyle, display: 'block', marginTop: 4 }}
        >
          <option value="">Selecione</option>
          {areas.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      {erroLocal ? (
        <p className="text-[11px]" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
          {erroLocal}
        </p>
      ) : null}
      <button
        type="button"
        style={botaoPrimario}
        disabled={salvando}
        onClick={() => onEnviarFaq({ pergunta, resposta, categoryId, area })}
      >
        {salvando ? 'Enviando…' : 'Enviar para Central de Ajuda'}
      </button>
    </div>
  );
}
