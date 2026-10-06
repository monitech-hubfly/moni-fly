'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import {
  adicionarSecao,
  atualizarQuandoUtilizar,
  baixarDocumento,
  criarTipo,
  criarVariacao,
  salvarChecklistTipo,
  subirVersaoPadrao,
  subirVersaoVariacao,
  type SecaoRepositorio,
  type VersaoDocumento,
} from './actions';

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

const botaoSec = {
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

function dataVersao(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  return data.toLocaleString('pt-BR');
}

export function RepositorioClient({
  initialSecoes,
  podeEditar,
}: {
  initialSecoes: SecaoRepositorio[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);

  useEffect(() => {
    const id = window.location.hash.replace(/^#tipo-/, '');
    if (id && id !== window.location.hash) setAberto(id);
  }, []);
  const [historico, setHistorico] = useState<string | null>(null);
  const [baixando, setBaixando] = useState<string | null>(null);

  function refresh() {
    startTransition(() => router.refresh());
  }

  function avisar(res: { ok: boolean; error?: string }, ok: string) {
    if (!res.ok) {
      setErro(res.error ?? 'Não foi possível salvar.');
      setMsg(null);
      return;
    }
    setErro(null);
    setMsg(ok);
    refresh();
  }

  async function baixar(id: string) {
    setBaixando(id);
    const res = await baixarDocumento(id);
    setBaixando(null);
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    window.open(res.url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8" style={{ fontFamily: 'var(--moni-font-sans)' }}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl" style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}>
            Repositório
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
            Documentos oficiais por seção, com padrão, variações e versão vigente.
          </p>
        </div>
        {podeEditar ? <NovaSecao onCriada={() => avisar({ ok: true }, 'Seção criada.')} onErro={setErro} /> : null}
      </div>
      {msg ? <p className="mb-3 text-sm" style={{ color: 'var(--moni-text-secondary)' }}>{msg}</p> : null}
      {erro ? <p className="mb-3 text-sm" style={{ color: 'var(--moni-text-secondary)' }}>{erro}</p> : null}

      <div className="space-y-4">
        {initialSecoes.map((secao) => (
          <section
            key={secao.id}
            className="p-4"
            style={{
              background: 'var(--moni-surface-0)',
              border: 'var(--moni-border-width) solid var(--moni-border-default)',
              borderRadius: 'var(--moni-radius-lg)',
            }}
          >
            <h2 className="text-base font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
              {secao.nome}
            </h2>
            {secao.tipos.length === 0 ? (
              <p className="mt-2 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                Nenhum tipo de documento nesta seção.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {secao.tipos.map((tipo) => {
                  const abertoTipo = aberto === tipo.id;
                  return (
                    <li
                      key={tipo.id}
                      id={`tipo-${tipo.id}`}
                      style={{
                        border: 'var(--moni-border-width) solid var(--moni-border-default)',
                        borderRadius: 'var(--moni-radius-md)',
                      }}
                    >
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-3 text-left"
                        style={{ minHeight: 44 }}
                        aria-expanded={abertoTipo}
                        onClick={() => setAberto(abertoTipo ? null : tipo.id)}
                      >
                        <span className="text-sm font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
                          {tipo.nome}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                          Padrão {tipo.padrao ? 'com arquivo' : 'sem arquivo'} · {tipo.variacoes.length}{' '}
                          {tipo.variacoes.length === 1 ? 'variação' : 'variações'}
                        </span>
                      </button>
                      {abertoTipo ? (
                        <div className="space-y-4 px-3 pb-3">
                          <BlocoArquivo
                            titulo="Documento padrão"
                            vigente={tipo.padrao}
                            anteriores={tipo.anterioresPadrao}
                            historicoAberto={historico === `padrao-${tipo.id}`}
                            baixando={baixando}
                            onHistorico={() =>
                              setHistorico(historico === `padrao-${tipo.id}` ? null : `padrao-${tipo.id}`)
                            }
                            onBaixar={(id) => void baixar(id)}
                          />
                          {podeEditar ? (
                            <form
                              className="flex flex-wrap items-end gap-2"
                              onSubmit={(e) => {
                                e.preventDefault();
                                const form = e.currentTarget;
                                const fd = new FormData(form);
                                fd.set('tipo_id', tipo.id);
                                void subirVersaoPadrao(fd).then((res) => {
                                  avisar(res, 'Nova versão do padrão publicada.');
                                  if (res.ok) form.reset();
                                });
                              }}
                            >
                              <input name="arquivo" type="file" required className="text-xs" />
                              <button type="submit" style={botao}>
                                {tipo.padrao ? '+ Nova versão' : 'Subir arquivo padrão'}
                              </button>
                            </form>
                          ) : null}

                          <Checklist tipoId={tipo.id} itens={tipo.checklist} podeEditar={podeEditar} onSalvo={avisar} />

                          <div>
                            <h3 className="text-xs font-semibold" style={{ color: 'var(--moni-text-secondary)' }}>
                              Variações
                            </h3>
                            <ul className="mt-2 space-y-3">
                              {tipo.variacoes.map((variacao) => (
                                <li
                                  key={variacao.id}
                                  className="space-y-2 p-3"
                                  style={{
                                    background: 'var(--moni-surface-50)',
                                    borderRadius: 'var(--moni-radius-md)',
                                  }}
                                >
                                  <p className="text-sm font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
                                    {variacao.nome}
                                  </p>
                                  <QuandoUtilizar
                                    variacaoId={variacao.id}
                                    texto={variacao.quando_utilizar ?? ''}
                                    podeEditar={podeEditar}
                                    onSalvo={avisar}
                                  />
                                  <BlocoArquivo
                                    titulo="Arquivo vigente"
                                    vigente={variacao.vigente}
                                    anteriores={variacao.anteriores}
                                    historicoAberto={historico === variacao.id}
                                    baixando={baixando}
                                    onHistorico={() => setHistorico(historico === variacao.id ? null : variacao.id)}
                                    onBaixar={(id) => void baixar(id)}
                                  />
                                  {podeEditar ? (
                                    <form
                                      className="flex flex-wrap items-end gap-2"
                                      onSubmit={(e) => {
                                        e.preventDefault();
                                        const form = e.currentTarget;
                                        const fd = new FormData(form);
                                        fd.set('variacao_id', variacao.id);
                                        void subirVersaoVariacao(fd).then((res) => {
                                          avisar(res, 'Nova versão da variação publicada.');
                                          if (res.ok) form.reset();
                                        });
                                      }}
                                    >
                                      <input name="arquivo" type="file" required className="text-xs" />
                                      <button type="submit" style={botaoSec}>
                                        + Nova versão
                                      </button>
                                    </form>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                            {podeEditar ? (
                              <form
                                className="mt-3 space-y-2"
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  const form = e.currentTarget;
                                  const fd = new FormData(form);
                                  fd.set('tipo_id', tipo.id);
                                  void criarVariacao(fd).then((res) => {
                                    avisar(res, 'Variação criada.');
                                    if (res.ok) form.reset();
                                  });
                                }}
                              >
                                <input name="nome" required placeholder="Nome da variação" style={campo} />
                                <textarea
                                  name="quando_utilizar"
                                  required
                                  placeholder="Quando utilizar"
                                  style={{ ...campo, minHeight: 72 }}
                                />
                                <input name="arquivo" type="file" required className="text-xs" />
                                <button type="submit" style={botao}>
                                  + Nova variação
                                </button>
                              </form>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
            {podeEditar ? <NovoTipo secaoId={secao.id} onCriado={avisar} /> : null}
          </section>
        ))}
      </div>
    </div>
  );
}

function BlocoArquivo({
  titulo,
  vigente,
  anteriores,
  historicoAberto,
  baixando,
  onHistorico,
  onBaixar,
}: {
  titulo: string;
  vigente: VersaoDocumento | null;
  anteriores: VersaoDocumento[];
  historicoAberto: boolean;
  baixando: string | null;
  onHistorico: () => void;
  onBaixar: (id: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold" style={{ color: 'var(--moni-text-secondary)' }}>
        {titulo}
      </p>
      {vigente ? (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
            Vigente · {dataVersao(vigente.created_at)}
          </span>
          <button type="button" style={botaoSec} disabled={baixando === vigente.id} onClick={() => onBaixar(vigente.id)}>
            {baixando === vigente.id ? 'Abrindo…' : 'Baixar'}
          </button>
        </div>
      ) : (
        <p className="mt-1 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
          Sem arquivo vigente.
        </p>
      )}
      {anteriores.length > 0 ? (
        <div className="mt-1">
          <button type="button" className="text-xs font-semibold" style={{ minHeight: 44, color: 'var(--moni-navy-800)' }} onClick={onHistorico}>
            {historicoAberto ? 'Ocultar versões anteriores' : 'Ver versões anteriores'}
          </button>
          {historicoAberto ? (
            <ul className="space-y-1">
              {anteriores.map((versao) => (
                <li key={versao.id} className="flex flex-wrap items-center gap-2">
                  <span className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                    {dataVersao(versao.created_at)}
                  </span>
                  <button type="button" style={botaoSec} onClick={() => onBaixar(versao.id)}>
                    Baixar
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function NovaSecao({ onCriada, onErro }: { onCriada: () => void; onErro: (t: string) => void }) {
  const [aberta, setAberta] = useState(false);
  if (!aberta) {
    return (
      <button type="button" style={botao} onClick={() => setAberta(true)}>
        + Seção
      </button>
    );
  }
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const nome = String(new FormData(e.currentTarget).get('nome') ?? '');
        void adicionarSecao(nome).then((res) => {
          if (!res.ok) onErro(res.error);
          else {
            setAberta(false);
            onCriada();
          }
        });
      }}
    >
      <input name="nome" required placeholder="Nome da seção" style={{ ...campo, width: 220 }} />
      <button type="submit" style={botao}>
        Criar
      </button>
    </form>
  );
}

function NovoTipo({
  secaoId,
  onCriado,
}: {
  secaoId: string;
  onCriado: (res: { ok: boolean; error?: string }, ok: string) => void;
}) {
  return (
    <form
      className="mt-3 flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const nome = String(new FormData(e.currentTarget).get('nome') ?? '');
        void criarTipo(secaoId, nome).then((res) => {
          onCriado(res, 'Tipo de documento criado.');
          if (res.ok) e.currentTarget.reset();
        });
      }}
    >
      <input name="nome" required placeholder="Novo tipo de documento" style={{ ...campo, width: 260 }} />
      <button type="submit" style={botaoSec}>
        + Tipo
      </button>
    </form>
  );
}

function Checklist({
  tipoId,
  itens,
  podeEditar,
  onSalvo,
}: {
  tipoId: string;
  itens: string[];
  podeEditar: boolean;
  onSalvo: (res: { ok: boolean; error?: string }, ok: string) => void;
}) {
  const [lista, setLista] = useState(itens);
  const [novo, setNovo] = useState('');
  if (lista.length === 0 && !podeEditar) return null;
  return (
    <div>
      <p className="text-xs font-semibold" style={{ color: 'var(--moni-text-secondary)' }}>
        Checklist
      </p>
      <ul className="mt-1 space-y-1">
        {lista.map((item) => (
          <li key={item} className="flex items-center justify-between gap-2 text-xs" style={{ color: 'var(--moni-text-primary)' }}>
            <span>{item}</span>
            {podeEditar ? (
              <button
                type="button"
                style={botaoSec}
                onClick={() => {
                  const proxima = lista.filter((atual) => atual !== item);
                  setLista(proxima);
                  void salvarChecklistTipo(tipoId, proxima).then((res) => onSalvo(res, 'Checklist atualizado.'));
                }}
              >
                Remover
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {podeEditar ? (
        <form
          className="mt-2 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const item = novo.trim();
            if (!item || lista.includes(item)) return;
            const proxima = [...lista, item];
            setLista(proxima);
            setNovo('');
            void salvarChecklistTipo(tipoId, proxima).then((res) => onSalvo(res, 'Checklist atualizado.'));
          }}
        >
          <input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="Item do checklist" style={{ ...campo, width: 220 }} />
          <button type="submit" style={botaoSec}>
            Adicionar
          </button>
        </form>
      ) : null}
    </div>
  );
}

function QuandoUtilizar({
  variacaoId,
  texto,
  podeEditar,
  onSalvo,
}: {
  variacaoId: string;
  texto: string;
  podeEditar: boolean;
  onSalvo: (res: { ok: boolean; error?: string }, ok: string) => void;
}) {
  const [valor, setValor] = useState(texto);
  return (
    <div>
      <p className="text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
        Quando utilizar
      </p>
      {podeEditar ? (
        <form
          className="mt-1 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void atualizarQuandoUtilizar(variacaoId, valor).then((res) => onSalvo(res, 'Quando utilizar atualizado.'));
          }}
        >
          <textarea value={valor} onChange={(e) => setValor(e.target.value)} style={{ ...campo, minHeight: 72 }} />
          <button type="submit" style={botaoSec}>
            Salvar
          </button>
        </form>
      ) : (
        <p className="text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
          {texto || '—'}
        </p>
      )}
    </div>
  );
}
