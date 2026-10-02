'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { listarVisaoPontosJuridicos, type PontoVisaoRow } from '@/lib/actions/juridico-pontos-actions';
import { hrefAbrirCardNaRota } from '@/lib/kanban/kanban-card-href';
import {
  JURIDICO_PONTO_APLICACAO_LABEL,
  JURIDICO_PONTO_APLICACOES,
  JURIDICO_PONTO_DECISAO_LABEL,
  JURIDICO_PONTO_FAQ_LABEL,
  JURIDICO_PONTO_FAQ_STATUS,
  filtrarPontosVisao,
  rotuloFaqConsulta,
  rotuloRepositorioConsulta,
  statusVisualPontoJuridico,
  type FiltroVisaoPontos,
  type VisaoPontosJuridicos,
} from '@/lib/kanban/juridico-pontos';
import { JURIDICO_TIPO_DOCUMENTO_LABEL, JURIDICO_TIPOS_DOCUMENTO, isJuridicoTipoDocumento } from '@/lib/kanban/juridico-tipo-documento';

const VISÕES: { id: VisaoPontosJuridicos; label: string }[] = [
  { id: 'duvidas', label: 'Dúvidas' },
  { id: 'aceitas', label: 'Alterações Aceitas' },
  { id: 'nao_aceitas', label: 'Alterações Não Aceitas' },
];

const filtroVazio: FiltroVisaoPontos = {
  texto: '',
  tipoDocumento: '',
  rodada: '',
  faqStatus: '',
  decisao: '',
  aplicacao: '',
  repositorio: '',
};

const campo = {
  minHeight: 44,
  borderRadius: 'var(--moni-radius-md)',
  border: 'var(--moni-border-width) solid var(--moni-border-default)',
  background: 'var(--moni-surface-0)',
  color: 'var(--moni-text-primary)',
  fontFamily: 'var(--moni-font-sans)',
  fontSize: 13,
  padding: '8px 10px',
} as const;

function visaoDaUrl(valor: string | null): VisaoPontosJuridicos {
  if (valor === 'aceitas' || valor === 'nao_aceitas') return valor;
  return 'duvidas';
}

function paraFiltro(ponto: PontoVisaoRow) {
  return {
    tipo: ponto.tipo,
    decisao: ponto.decisao,
    aplicacaoFutura: ponto.aplicacao_futura,
    temVersaoRepositorio: ponto.tem_versao_repositorio,
    rodada: ponto.rodada,
    tipoDocumento: ponto.tipo_documento,
    faqStatus: ponto.faq_status,
    duvida: ponto.duvida_recebida,
    resposta: ponto.resposta,
    clausula: ponto.clausula_trecho,
    solicitacao: ponto.solicitacao_alteracao,
    textoFinal: ponto.texto_final_aprovado,
    motivo: ponto.motivo_resposta,
  };
}

function TextoLongo({ texto }: { texto: string | null }) {
  const [aberto, setAberto] = useState(false);
  const valor = texto?.trim() || '';
  if (!valor) return <span style={{ color: 'var(--moni-text-tertiary)' }}>—</span>;
  const longo = valor.length > 160;
  return (
    <span>
      {aberto || !longo ? valor : `${valor.slice(0, 160)}…`}
      {longo ? (
        <button
          type="button"
          onClick={() => setAberto((atual) => !atual)}
          className="ml-1 font-semibold"
          style={{ minHeight: 44, color: 'var(--moni-navy-800)' }}
        >
          {aberto ? 'Recolher' : 'Expandir'}
        </button>
      ) : null}
    </span>
  );
}

function CelulaFaq({ ponto }: { ponto: PontoVisaoRow }) {
  const faq = rotuloFaqConsulta(ponto.faq_status, ponto.faq_pergunta, ponto.faq_artigo_status);
  return (
    <span>
      {faq.rotulo}
      {faq.detalhe ? ` · ${faq.detalhe}` : ''}
      {ponto.faq_slug && ponto.faq_article_id ? (
        <>
          {' '}
          <a
            href={`/universidade/faq/${encodeURIComponent(ponto.faq_slug)}`}
            className="font-semibold"
            style={{ color: 'var(--moni-navy-800)' }}
          >
            Ver FAQ
          </a>
        </>
      ) : null}
    </span>
  );
}

function CelulaAtendimento({ ponto }: { ponto: PontoVisaoRow }) {
  const status = statusVisualPontoJuridico({
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
  });
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <span>{ponto.card_titulo}</span>
      <span className={status === 'Respondida' ? 'moni-tag-concluido' : 'moni-tag-atencao'}>{status}</span>
      <a
        href={hrefAbrirCardNaRota('/funil-juridico', ponto.card_id)}
        className="inline-flex items-center font-semibold"
        style={{ minHeight: 44, color: 'var(--moni-navy-800)' }}
      >
        Abrir atendimento
      </a>
    </span>
  );
}

function documento(ponto: PontoVisaoRow): string {
  return isJuridicoTipoDocumento(ponto.tipo_documento) ? JURIDICO_TIPO_DOCUMENTO_LABEL[ponto.tipo_documento] : '—';
}

export function PontosJuridicosVisao() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const visao = visaoDaUrl(searchParams.get('visao'));
  const [pontos, setPontos] = useState<PontoVisaoRow[]>([]);
  const [filtro, setFiltro] = useState<FiltroVisaoPontos>(filtroVazio);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setFiltro(filtroVazio);
    let ativo = true;
    setCarregando(true);
    void listarVisaoPontosJuridicos(visao).then((res) => {
      if (!ativo) return;
      setCarregando(false);
      if (!res.ok) {
        setErro(res.error);
        setPontos([]);
        return;
      }
      setErro(null);
      setPontos(res.pontos);
    });
    return () => {
      ativo = false;
    };
  }, [visao]);

  const rodadas = useMemo(
    () => Array.from(new Set(pontos.map((ponto) => ponto.rodada))).sort((a, b) => b - a),
    [pontos],
  );
  const visiveis = useMemo(
    () => filtrarPontosVisao(pontos.map((ponto) => ({ ...paraFiltro(ponto), ponto })), filtro).map((item) => item.ponto),
    [pontos, filtro],
  );

  function abrirVisao(proxima: VisaoPontosJuridicos) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'pontos');
    params.set('visao', proxima);
    router.push(`/funil-juridico?${params.toString()}`);
  }

  return (
    <main className="mx-auto w-full min-w-0 max-w-[1600px] px-4 py-8 sm:px-6">
      <h1 className="text-2xl" style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}>
        Pontos Jurídicos
      </h1>
      <p className="mt-1 text-sm" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
        Consulta dos pontos já registrados nos atendimentos. A edição continua no card.
      </p>

      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Visões dos pontos">
        {VISÕES.map((item) => {
          const ativo = item.id === visao;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={ativo}
              onClick={() => abrirVisao(item.id)}
              style={{
                minHeight: 44,
                borderRadius: 'var(--moni-radius-md)',
                border: 'var(--moni-border-width) solid var(--moni-border-default)',
                background: ativo ? 'var(--moni-navy-800)' : 'var(--moni-surface-0)',
                color: ativo ? 'white' : 'var(--moni-text-primary)',
                fontFamily: 'var(--moni-font-sans)',
                fontSize: 13,
                fontWeight: 600,
                padding: '0 14px',
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input
          value={filtro.texto ?? ''}
          onChange={(e) => setFiltro((atual) => ({ ...atual, texto: e.target.value }))}
          placeholder="Buscar no texto do ponto"
          aria-label="Buscar no texto do ponto"
          style={campo}
        />
        <select
          value={filtro.tipoDocumento ?? ''}
          onChange={(e) => setFiltro((atual) => ({ ...atual, tipoDocumento: e.target.value }))}
          aria-label="Tipo de documento"
          style={campo}
        >
          <option value="">Tipo de documento</option>
          {JURIDICO_TIPOS_DOCUMENTO.map((tipo) => (
            <option key={tipo} value={tipo}>
              {JURIDICO_TIPO_DOCUMENTO_LABEL[tipo]}
            </option>
          ))}
        </select>
        <select
          value={filtro.rodada ?? ''}
          onChange={(e) => setFiltro((atual) => ({ ...atual, rodada: e.target.value }))}
          aria-label="Rodada"
          style={campo}
        >
          <option value="">Rodada</option>
          {rodadas.map((rodada) => (
            <option key={rodada} value={String(rodada)}>
              Rodada {rodada}
            </option>
          ))}
        </select>
        {visao !== 'aceitas' ? (
          <select
            value={filtro.faqStatus ?? ''}
            onChange={(e) => setFiltro((atual) => ({ ...atual, faqStatus: e.target.value }))}
            aria-label="Status FAQ"
            style={campo}
          >
            <option value="">FAQ</option>
            {JURIDICO_PONTO_FAQ_STATUS.map((status) => (
              <option key={status} value={status}>
                {JURIDICO_PONTO_FAQ_LABEL[status]}
              </option>
            ))}
          </select>
        ) : (
          <>
            <select
              value={filtro.decisao ?? ''}
              onChange={(e) => setFiltro((atual) => ({ ...atual, decisao: e.target.value }))}
              aria-label="Decisão"
              style={campo}
            >
              <option value="">Decisão</option>
              <option value="aceita">{JURIDICO_PONTO_DECISAO_LABEL.aceita}</option>
              <option value="aceita_parcialmente">{JURIDICO_PONTO_DECISAO_LABEL.aceita_parcialmente}</option>
            </select>
            <select
              value={filtro.aplicacao ?? ''}
              onChange={(e) => setFiltro((atual) => ({ ...atual, aplicacao: e.target.value }))}
              aria-label="Aplicação futura"
              style={campo}
            >
              <option value="">Aplicação futura</option>
              {JURIDICO_PONTO_APLICACOES.map((aplicacao) => (
                <option key={aplicacao} value={aplicacao}>
                  {JURIDICO_PONTO_APLICACAO_LABEL[aplicacao]}
                </option>
              ))}
            </select>
            <select
              value={filtro.repositorio ?? ''}
              onChange={(e) =>
                setFiltro((atual) => ({
                  ...atual,
                  repositorio: e.target.value as FiltroVisaoPontos['repositorio'],
                }))
              }
              aria-label="Status do Repositório"
              style={campo}
            >
              <option value="">Repositório</option>
              <option value="somente">Somente este documento</option>
              <option value="pendente">Pendente no Repositório</option>
              <option value="concluida">Atualização concluída</option>
            </select>
          </>
        )}
      </div>

      {erro ? (
        <p className="mt-4 text-sm" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
          {erro}
        </p>
      ) : null}
      {carregando ? (
        <p className="mt-4 text-sm" style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}>
          Carregando pontos…
        </p>
      ) : visiveis.length === 0 ? (
        <p className="mt-4 text-sm" style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}>
          Nenhum ponto nesta visão.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-xs" style={{ borderCollapse: 'collapse', fontFamily: 'var(--moni-font-sans)' }}>
            <thead>
              <tr style={{ color: 'var(--moni-text-tertiary)' }}>
                {visao === 'duvidas' ? (
                  <>
                    <th className="px-2 py-2 font-semibold">Dúvida</th>
                    <th className="px-2 py-2 font-semibold">Resposta</th>
                    <th className="px-2 py-2 font-semibold">FAQ</th>
                    <th className="px-2 py-2 font-semibold">Documento</th>
                    <th className="px-2 py-2 font-semibold">Rodada</th>
                    <th className="px-2 py-2 font-semibold">Atendimento</th>
                  </>
                ) : null}
                {visao === 'aceitas' ? (
                  <>
                    <th className="px-2 py-2 font-semibold">Cláusula/Trecho</th>
                    <th className="px-2 py-2 font-semibold">Solicitação</th>
                    <th className="px-2 py-2 font-semibold">Decisão</th>
                    <th className="px-2 py-2 font-semibold">Texto final</th>
                    <th className="px-2 py-2 font-semibold">Aplicação futura</th>
                    <th className="px-2 py-2 font-semibold">Repositório</th>
                    <th className="px-2 py-2 font-semibold">Documento</th>
                    <th className="px-2 py-2 font-semibold">Rodada</th>
                    <th className="px-2 py-2 font-semibold">Atendimento</th>
                  </>
                ) : null}
                {visao === 'nao_aceitas' ? (
                  <>
                    <th className="px-2 py-2 font-semibold">Cláusula/Trecho</th>
                    <th className="px-2 py-2 font-semibold">Solicitação</th>
                    <th className="px-2 py-2 font-semibold">Motivo / resposta</th>
                    <th className="px-2 py-2 font-semibold">FAQ</th>
                    <th className="px-2 py-2 font-semibold">Documento</th>
                    <th className="px-2 py-2 font-semibold">Rodada</th>
                    <th className="px-2 py-2 font-semibold">Atendimento</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {visiveis.map((ponto) => (
                <tr key={ponto.id} style={{ borderTop: 'var(--moni-border-width) solid var(--moni-border-default)', color: 'var(--moni-text-secondary)', verticalAlign: 'top' }}>
                  {visao === 'duvidas' ? (
                    <>
                      <td className="px-2 py-3"><TextoLongo texto={ponto.duvida_recebida} /></td>
                      <td className="px-2 py-3"><TextoLongo texto={ponto.resposta} /></td>
                      <td className="px-2 py-3"><CelulaFaq ponto={ponto} /></td>
                      <td className="px-2 py-3">{documento(ponto)}</td>
                      <td className="px-2 py-3">{ponto.rodada}</td>
                      <td className="px-2 py-3"><CelulaAtendimento ponto={ponto} /></td>
                    </>
                  ) : null}
                  {visao === 'aceitas' ? (
                    <>
                      <td className="px-2 py-3"><TextoLongo texto={ponto.clausula_trecho} /></td>
                      <td className="px-2 py-3"><TextoLongo texto={ponto.solicitacao_alteracao} /></td>
                      <td className="px-2 py-3">{ponto.decisao ? JURIDICO_PONTO_DECISAO_LABEL[ponto.decisao] : '—'}</td>
                      <td className="px-2 py-3"><TextoLongo texto={ponto.texto_final_aprovado} /></td>
                      <td className="px-2 py-3">
                        {ponto.aplicacao_futura ? JURIDICO_PONTO_APLICACAO_LABEL[ponto.aplicacao_futura] : '—'}
                      </td>
                      <td className="px-2 py-3">
                        {rotuloRepositorioConsulta({
                          tipo: ponto.tipo,
                          decisao: ponto.decisao,
                          aplicacaoFutura: ponto.aplicacao_futura,
                          temVersaoRepositorio: ponto.tem_versao_repositorio,
                        })}
                        {ponto.tem_versao_repositorio && ponto.repositorio_tipo_id ? (
                          <>
                            {' '}
                            <a
                              href={`/repositorio#tipo-${ponto.repositorio_tipo_id}`}
                              className="font-semibold"
                              style={{ color: 'var(--moni-navy-800)' }}
                            >
                              Ver no Repositório
                            </a>
                          </>
                        ) : null}
                      </td>
                      <td className="px-2 py-3">{documento(ponto)}</td>
                      <td className="px-2 py-3">{ponto.rodada}</td>
                      <td className="px-2 py-3"><CelulaAtendimento ponto={ponto} /></td>
                    </>
                  ) : null}
                  {visao === 'nao_aceitas' ? (
                    <>
                      <td className="px-2 py-3"><TextoLongo texto={ponto.clausula_trecho} /></td>
                      <td className="px-2 py-3"><TextoLongo texto={ponto.solicitacao_alteracao} /></td>
                      <td className="px-2 py-3"><TextoLongo texto={ponto.motivo_resposta} /></td>
                      <td className="px-2 py-3"><CelulaFaq ponto={ponto} /></td>
                      <td className="px-2 py-3">{documento(ponto)}</td>
                      <td className="px-2 py-3">{ponto.rodada}</td>
                      <td className="px-2 py-3"><CelulaAtendimento ponto={ponto} /></td>
                    </>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
