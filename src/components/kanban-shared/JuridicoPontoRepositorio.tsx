'use client';

import { useEffect, useState } from 'react';
import {
  listarCatalogoRepositorioJuridico,
  resolverPendenciaRepositorioPonto,
  type CatalogoRepositorioJuridico,
  type PontoJuridicoRow,
} from '@/lib/actions/juridico-pontos-actions';
import { pendenciaRepositorioPonto, rotuloPendenciaRepositorio } from '@/lib/kanban/juridico-pontos';

const campo = {
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

const botao = {
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

export type IntencaoRepositorioRascunho = {
  id: string | null;
  tipo: string;
  decisao: string;
  aplicacao_futura: string;
  repositorio_tipo_id: string;
  repositorio_variacao_id: string;
  repositorio_nova_variacao_nome: string;
  repositorio_nova_variacao_quando: string;
  tem_versao_repositorio: boolean;
};

function precisaCatalogo(aplicacao: string): boolean {
  return aplicacao === 'alterar_documento_padrao' || aplicacao === 'criar_nova_variacao' || aplicacao === 'alterar_variacao_existente';
}

export function CamposIntencaoRepositorio({
  rascunho,
  onChange,
}: {
  rascunho: IntencaoRepositorioRascunho;
  onChange: (parcial: {
    repositorio_tipo_id?: string;
    repositorio_variacao_id?: string;
    repositorio_nova_variacao_nome?: string;
    repositorio_nova_variacao_quando?: string;
  }) => void;
}) {
  const [secoes, setSecoes] = useState<CatalogoRepositorioJuridico>([]);
  const [secaoId, setSecaoId] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const aplicacao = rascunho.aplicacao_futura;
  const aceita = rascunho.decisao === 'aceita' || rascunho.decisao === 'aceita_parcialmente';
  const rotulo = rotuloPendenciaRepositorio({
    tipo: rascunho.tipo,
    decisao: rascunho.decisao,
    aplicacaoFutura: aplicacao,
    temVersaoRepositorio: rascunho.tem_versao_repositorio,
  });

  useEffect(() => {
    if (!aceita || !precisaCatalogo(aplicacao)) return;
    let ativo = true;
    void listarCatalogoRepositorioJuridico().then((res) => {
      if (!ativo) return;
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setSecoes(res.secoes);
      const atual = res.secoes.find((secao) => secao.tipos.some((tipo) => tipo.id === rascunho.repositorio_tipo_id));
      if (atual) setSecaoId(atual.id);
    });
    return () => {
      ativo = false;
    };
  }, [aceita, aplicacao, rascunho.repositorio_tipo_id]);

  if (!aceita || aplicacao === 'somente_este_documento' || !aplicacao) return null;

  const secao = secoes.find((item) => item.id === secaoId) ?? null;
  const tipos = secao?.tipos ?? [];
  const tipo = tipos.find((item) => item.id === rascunho.repositorio_tipo_id) ?? null;
  const bloqueado = rascunho.tem_versao_repositorio;

  return (
    <div className="space-y-2">
      <label className="block text-[11px]" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
        Seção
        <select
          value={secaoId}
          disabled={bloqueado}
          onChange={(e) => {
            setSecaoId(e.target.value);
            onChange({ repositorio_tipo_id: '', repositorio_variacao_id: '' });
          }}
          style={{ ...campo, display: 'block', marginTop: 4 }}
        >
          <option value="">Selecione</option>
          {secoes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.nome}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-[11px]" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
        Tipo de documento
        <select
          value={rascunho.repositorio_tipo_id}
          disabled={bloqueado || !secaoId}
          onChange={(e) => onChange({ repositorio_tipo_id: e.target.value, repositorio_variacao_id: '' })}
          style={{ ...campo, display: 'block', marginTop: 4 }}
        >
          <option value="">Selecione</option>
          {tipos.map((item) => (
            <option key={item.id} value={item.id}>
              {item.nome}
            </option>
          ))}
        </select>
      </label>
      {aplicacao === 'criar_nova_variacao' ? (
        <>
          <label className="block text-[11px]" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
            Nome da variação
            <input
              value={rascunho.repositorio_nova_variacao_nome}
              disabled={bloqueado}
              onChange={(e) => onChange({ repositorio_nova_variacao_nome: e.target.value })}
              style={{ ...campo, display: 'block', marginTop: 4 }}
            />
          </label>
          <label className="block text-[11px]" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
            Quando utilizar
            <textarea
              value={rascunho.repositorio_nova_variacao_quando}
              disabled={bloqueado}
              onChange={(e) => onChange({ repositorio_nova_variacao_quando: e.target.value })}
              style={{ ...campo, minHeight: 72, display: 'block', marginTop: 4 }}
            />
          </label>
        </>
      ) : null}
      {aplicacao === 'alterar_variacao_existente' ? (
        <label className="block text-[11px]" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
          Variação
          <select
            value={rascunho.repositorio_variacao_id}
            disabled={bloqueado || !tipo}
            onChange={(e) => onChange({ repositorio_variacao_id: e.target.value })}
            style={{ ...campo, display: 'block', marginTop: 4 }}
          >
            <option value="">Selecione</option>
            {(tipo?.variacoes ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {rotulo ? (
        <p className="text-[11px]" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
          {rotulo}
        </p>
      ) : null}
      {erro ? (
        <p className="text-[11px]" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
          {erro}
        </p>
      ) : null}
    </div>
  );
}

export function ResolverRepositorioPonto({
  ponto,
  podeEditar,
  sujo,
  nome,
  quando,
  onResolvido,
}: {
  ponto: PontoJuridicoRow;
  podeEditar: boolean;
  sujo: boolean;
  nome: string;
  quando: string;
  onResolvido: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [nomeConfirmado, setNomeConfirmado] = useState(nome);
  const [quandoConfirmado, setQuandoConfirmado] = useState(quando);
  const estado = pendenciaRepositorioPonto({
    tipo: ponto.tipo,
    decisao: ponto.decisao,
    aplicacaoFutura: ponto.aplicacao_futura,
    temVersaoRepositorio: ponto.tem_versao_repositorio,
  });
  const rotulo = rotuloPendenciaRepositorio({
    tipo: ponto.tipo,
    decisao: ponto.decisao,
    aplicacaoFutura: ponto.aplicacao_futura,
    temVersaoRepositorio: ponto.tem_versao_repositorio,
  });

  useEffect(() => {
    setNomeConfirmado(nome);
    setQuandoConfirmado(quando);
  }, [nome, quando]);

  if (!rotulo) return null;

  async function enviar(form: HTMLFormElement) {
    if (enviando) return;
    setEnviando(true);
    setErro(null);
    const dados = new FormData(form);
    dados.set('ponto_id', ponto.id);
    if (ponto.aplicacao_futura === 'criar_nova_variacao') {
      dados.set('nome', nomeConfirmado);
      dados.set('quando_utilizar', quandoConfirmado);
    }
    const res = await resolverPendenciaRepositorioPonto(dados);
    setEnviando(false);
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    setAberto(false);
    onResolvido();
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px]" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
        {rotulo}
        {ponto.repositorio_tipo_nome ? ` · ${ponto.repositorio_tipo_nome}` : ''}
      </p>
      {estado === 'concluida' && ponto.repositorio_tipo_id ? (
        <a
          href={`/repositorio#tipo-${ponto.repositorio_tipo_id}`}
          className="inline-flex items-center text-[12px] font-semibold"
          style={{ minHeight: 44, color: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-sans)' }}
        >
          Abrir no Repositório
        </a>
      ) : null}
      {estado === 'pendente' && podeEditar ? (
        sujo ? (
          <p className="text-[11px]" style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}>
            Salve o ponto para resolver no Repositório.
          </p>
        ) : (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              void enviar(e.currentTarget);
            }}
          >
            {aberto ? (
              <>
                {ponto.aplicacao_futura === 'criar_nova_variacao' ? (
                  <>
                    <label className="block text-[11px]" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
                      Nome da variação
                      <input
                        value={nomeConfirmado}
                        onChange={(e) => setNomeConfirmado(e.target.value)}
                        style={{ ...campo, display: 'block', marginTop: 4 }}
                      />
                    </label>
                    <label className="block text-[11px]" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
                      Quando utilizar
                      <textarea
                        value={quandoConfirmado}
                        onChange={(e) => setQuandoConfirmado(e.target.value)}
                        style={{ ...campo, minHeight: 72, display: 'block', marginTop: 4 }}
                      />
                    </label>
                  </>
                ) : null}
                <label className="block text-[11px]" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
                  Arquivo oficial
                  <input name="arquivo" type="file" required style={{ ...campo, display: 'block', marginTop: 4 }} />
                </label>
                <button type="submit" style={botao} disabled={enviando}>
                  {enviando ? 'Enviando…' : 'Enviar arquivo'}
                </button>
              </>
            ) : (
              <button type="button" style={botao} onClick={() => setAberto(true)}>
                Resolver no Repositório
              </button>
            )}
            {erro ? (
              <p className="text-[11px]" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
                {erro}
              </p>
            ) : null}
          </form>
        )
      ) : null}
    </div>
  );
}
