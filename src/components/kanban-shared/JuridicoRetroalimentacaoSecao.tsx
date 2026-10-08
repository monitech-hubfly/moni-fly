'use client';

import { useCallback, useEffect, useState } from 'react';
import { ResolverRepositorioPonto } from '@/components/kanban-shared/JuridicoPontoRepositorio';
import {
  confirmarDocumentoFinalAssinado,
  type PontoJuridicoRow,
} from '@/lib/actions/juridico-pontos-actions';
import {
  avaliarPendenciasAtendimentoJuridico,
  type PendenciasAtendimentoJuridico,
} from '@/lib/kanban/juridico-atendimento-pendencias';
import {
  JURIDICO_PONTO_APLICACAO_LABEL,
  type JuridicoPontoAplicacao,
} from '@/lib/kanban/juridico-pontos';
import { lerDocumentoFinalAssinadoNoCard, lerPontosJuridicosNoCard } from '@/lib/kanban/juridico-pontos-leitura';

const titulo =
  'text-[11px] font-semibold tracking-wide uppercase';
const texto = {
  color: 'var(--moni-text-secondary)',
  fontFamily: 'var(--moni-font-sans)',
  fontSize: 12,
} as const;

function LinhaStatus({ ok, children }: { ok: boolean; children: string }) {
  return (
    <p style={texto}>
      <span aria-hidden>{ok ? '✓ ' : '⚠ '}</span>
      {children}
    </p>
  );
}

function abrirPonto(id: string) {
  window.dispatchEvent(new CustomEvent('juridico-editar-ponto', { detail: id }));
  document.getElementById(`juridico-ponto-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

export function JuridicoRetroalimentacaoSecao({
  cardId,
  podeEditar,
}: {
  cardId: string;
  podeEditar: boolean;
}) {
  const [pendencias, setPendencias] = useState<PendenciasAtendimentoJuridico | null>(null);
  const [pontos, setPontos] = useState<PontoJuridicoRow[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvandoDoc, setSalvandoDoc] = useState(false);

  const carregar = useCallback(async () => {
    const [pontosRes, docRes] = await Promise.all([
      lerPontosJuridicosNoCard(cardId),
      lerDocumentoFinalAssinadoNoCard(cardId),
    ]);
    if (!pontosRes.ok) {
      setErro(pontosRes.error);
      setPendencias(null);
      return;
    }
    if (!docRes.ok) {
      setErro(docRes.error);
      setPendencias(null);
      return;
    }
    setErro(null);
    setPontos(pontosRes.pontos);
    setPendencias(
      avaliarPendenciasAtendimentoJuridico(
        docRes.registrado,
        pontosRes.pontos.map((ponto) => ({
          id: ponto.id,
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
          novaVariacaoQuando: ponto.repositorio_nova_variacao_quando_utilizar,
          temVersaoRepositorio: ponto.tem_versao_repositorio,
        })),
      ),
    );
  }, [cardId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function confirmarDocumento(marcado: boolean) {
    if (!podeEditar || salvandoDoc) return;
    setSalvandoDoc(true);
    setErro(null);
    const res = await confirmarDocumentoFinalAssinado(cardId, marcado);
    setSalvandoDoc(false);
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    await carregar();
  }

  const porId = new Map(pontos.map((ponto) => [ponto.id, ponto]));

  return (
    <section className="mb-6" aria-label="Retroalimentação">
      <h4
        className="mb-3 text-sm font-semibold"
        style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}
      >
        Retroalimentação
      </h4>
      <div
        className="space-y-4 p-3"
        style={{
          background: 'var(--moni-surface-50)',
          border: 'var(--moni-border-width) solid var(--moni-border-default)',
          borderRadius: 'var(--moni-radius-lg)',
        }}
      >
        {erro ? <p style={texto}>{erro}</p> : null}
        {!pendencias ? (
          <p style={texto}>Carregando pendências…</p>
        ) : (
          <>
            <div className="space-y-1">
              <p className={titulo} style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' }}>
                Documento final assinado
              </p>
              <LinhaStatus ok={pendencias.documentoFinalAssinado}>
                {pendencias.documentoFinalAssinado ? 'Anexado' : 'Pendente'}
              </LinhaStatus>
              {podeEditar ? (
                <label className="flex items-center gap-2" style={{ ...texto, minHeight: 44 }}>
                  <input
                    type="checkbox"
                    checked={pendencias.documentoFinalAssinado}
                    disabled={salvandoDoc}
                    onChange={(e) => void confirmarDocumento(e.target.checked)}
                  />
                  Confirmar documento final assinado
                </label>
              ) : null}
            </div>

            <div className="space-y-2">
              <p className={titulo} style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' }}>
                Central de Ajuda
              </p>
              <LinhaStatus ok={pendencias.faqPendentes.length === 0}>
                {pendencias.faqResolvidas === 1
                  ? '1 resolvida'
                  : `${pendencias.faqResolvidas} resolvidas`}
              </LinhaStatus>
              {pendencias.faqPendentes.length > 0 ? (
                <LinhaStatus ok={false}>
                  {pendencias.faqPendentes.length === 1
                    ? '1 pendente'
                    : `${pendencias.faqPendentes.length} pendentes`}
                </LinhaStatus>
              ) : null}
              {pendencias.faqPendentes.map((item) => (
                <div key={item.id} className="space-y-1">
                  <p style={texto}>{item.origem}</p>
                  <p style={texto}>{item.acao}</p>
                  {podeEditar ? (
                    <button
                      type="button"
                      onClick={() => abrirPonto(item.id)}
                      style={{
                        minHeight: 44,
                        borderRadius: 'var(--moni-radius-md)',
                        border: 'var(--moni-border-width) solid var(--moni-border-default)',
                        background: 'var(--moni-surface-0)',
                        color: 'var(--moni-text-primary)',
                        fontFamily: 'var(--moni-font-sans)',
                        fontSize: 12,
                        fontWeight: 600,
                        padding: '0 12px',
                      }}
                    >
                      Editar ponto
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <p className={titulo} style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' }}>
                Repositório
              </p>
              <LinhaStatus ok>
                {pendencias.repositorioConcluidas === 1
                  ? '1 concluída'
                  : `${pendencias.repositorioConcluidas} concluídas`}
              </LinhaStatus>
              {pendencias.repositorioPendentes.length > 0 ? (
                <LinhaStatus ok={false}>
                  {pendencias.repositorioPendentes.length === 1
                    ? '1 pendente'
                    : `${pendencias.repositorioPendentes.length} pendentes`}
                </LinhaStatus>
              ) : null}
              {pendencias.repositorioPendentes.map((item) => {
                const ponto = porId.get(item.id);
                const aplicacao = item.aplicacao as JuridicoPontoAplicacao | null;
                return (
                  <div key={item.id} className="space-y-1">
                    <p style={texto}>{item.origem}</p>
                    {aplicacao && JURIDICO_PONTO_APLICACAO_LABEL[aplicacao] ? (
                      <p style={texto}>{JURIDICO_PONTO_APLICACAO_LABEL[aplicacao]}</p>
                    ) : null}
                    <p style={texto}>{item.acao}</p>
                    {ponto ? (
                      <ResolverRepositorioPonto
                        ponto={ponto}
                        podeEditar={podeEditar}
                        sujo={false}
                        nome={ponto.repositorio_nova_variacao_nome ?? ''}
                        quando={ponto.repositorio_nova_variacao_quando_utilizar ?? ''}
                        onResolvido={() => void carregar()}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>

            {pendencias.pontosIncompletos.length > 0 ? (
              <div className="space-y-2">
                <p className={titulo} style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' }}>
                  Pontos incompletos
                </p>
                <LinhaStatus ok={false}>
                  {pendencias.pontosIncompletos.length === 1
                    ? '1 pendente'
                    : `${pendencias.pontosIncompletos.length} pendentes`}
                </LinhaStatus>
                {pendencias.pontosIncompletos.map((item) => (
                  <div key={item.id} className="space-y-1">
                    <p style={texto}>{item.origem}</p>
                    <p style={texto}>{item.acao}</p>
                    {podeEditar ? (
                      <button
                        type="button"
                        onClick={() => abrirPonto(item.id)}
                        style={{
                          minHeight: 44,
                          borderRadius: 'var(--moni-radius-md)',
                          border: 'var(--moni-border-width) solid var(--moni-border-default)',
                          background: 'var(--moni-surface-0)',
                          color: 'var(--moni-text-primary)',
                          fontFamily: 'var(--moni-font-sans)',
                          fontSize: 12,
                          fontWeight: 600,
                          padding: '0 12px',
                        }}
                      >
                        Editar ponto
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
