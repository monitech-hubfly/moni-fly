'use client';

import { useEffect, useRef, useState } from 'react';
import { gerarTokenFormulario, listarFranqueadosParaSelect } from '@/lib/actions/formulario-actions';

interface Franqueado {
  id: string;
  numero_franquia: string | null;
  nome: string | null;
}

const campo: React.CSSProperties = {
  width: '100%',
  minHeight: 44,
  borderRadius: 'var(--moni-radius-md)',
  border: 'var(--moni-border-width) solid var(--moni-border-default)',
  background: 'var(--moni-surface-0)',
  color: 'var(--moni-text-primary)',
  fontFamily: 'var(--moni-font-sans)',
  fontSize: 14,
  padding: '8px 12px',
};

const botao: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 'var(--moni-radius-md)',
  background: 'var(--moni-navy-800)',
  color: 'white',
  fontFamily: 'var(--moni-font-sans)',
  fontSize: 13,
  fontWeight: 600,
  padding: '0 14px',
  border: 'none',
};

const botaoSecundario: React.CSSProperties = {
  ...botao,
  background: 'transparent',
  color: 'var(--moni-text-primary)',
  border: 'var(--moni-border-width) solid var(--moni-border-default)',
};

export function GerarLinkFormularioButton({
  formularioId,
  cardId,
  redeFranqueadoId,
  rotulo = 'Gerar link público',
  compacto = false,
}: {
  formularioId: string;
  formularioNome?: string;
  cardId?: string | null;
  redeFranqueadoId?: string | null;
  rotulo?: string;
  compacto?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [card, setCard] = useState(cardId ?? '');
  const [franqueadoId, setFranqueadoId] = useState(redeFranqueadoId ?? '');
  const [busca, setBusca] = useState('');
  const [franqueados, setFranqueados] = useState<Franqueado[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [gerandoLink, setGerandoLink] = useState(false);
  const [linkGerado, setLinkGerado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickFora(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownAberto(false);
      }
    }
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, []);

  useEffect(() => {
    if (!aberto) return;
    let ativo = true;
    setCarregando(true);
    void listarFranqueadosParaSelect()
      .then((lista) => {
        if (ativo) setFranqueados(lista);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [aberto]);

  const textoBusca = busca.trim().toLowerCase();
  const franqueadosFiltrados = franqueados.filter((f) => {
    if (!textoBusca) return true;
    return (
      (f.numero_franquia ?? '').toLowerCase().includes(textoBusca) ||
      (f.nome ?? '').toLowerCase().includes(textoBusca)
    );
  });

  const franqueadoSelecionado = franqueados.find((f) => f.id === franqueadoId);
  const labelSelecionado = franqueadoSelecionado
    ? `${franqueadoSelecionado.numero_franquia ?? ''} — ${franqueadoSelecionado.nome ?? ''}`.replace(/^ — | — $/g, '').trim()
    : '';

  async function handleGerar() {
    setGerandoLink(true);
    setErro(null);
    setLinkGerado(null);
    const res = await gerarTokenFormulario({
      formularioId,
      cardId: card.trim() || null,
      redeFranqueadoId: franqueadoId || null,
    });
    setGerandoLink(false);
    if (!res.token) {
      setErro(res.error ?? 'Erro ao gerar link.');
      return;
    }
    setLinkGerado(`${window.location.origin}/f/${res.token}`);
  }

  function handleFechar() {
    setAberto(false);
    setCard(cardId ?? '');
    setFranqueadoId(redeFranqueadoId ?? '');
    setBusca('');
    setLinkGerado(null);
    setErro(null);
    setDropdownAberto(false);
  }

  function selecionarFranqueado(f: Franqueado) {
    setFranqueadoId(f.id);
    setBusca('');
    setDropdownAberto(false);
  }

  function limparFranqueado() {
    setFranqueadoId('');
    setBusca('');
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setAberto(true);
          setLinkGerado(null);
          setErro(null);
        }}
        style={
          compacto
            ? { ...botao, width: '100%', fontSize: 10, minHeight: 36, padding: '6px 8px' }
            : botao
        }
      >
        {rotulo}
      </button>

      {aberto ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center"
          style={{ background: 'color-mix(in srgb, var(--moni-navy-800) 45%, transparent)' }}
        >
          <div
            className="w-full max-w-md space-y-4 p-5"
            style={{
              background: 'var(--moni-surface-0)',
              borderRadius: 'var(--moni-radius-lg)',
              border: 'var(--moni-border-width) solid var(--moni-border-default)',
            }}
          >
            <h2 className="text-lg" style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}>
              Link público
            </h2>

            <label className="block text-sm" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
              Card <span style={{ color: 'var(--moni-text-tertiary)', fontWeight: 400 }}>(opcional)</span>
              <input
                value={card}
                onChange={(e) => setCard(e.target.value)}
                placeholder="ID do card"
                style={{ ...campo, display: 'block', marginTop: 4 }}
              />
            </label>

            <div className="space-y-1">
              <p className="text-sm" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
                Franqueado <span style={{ color: 'var(--moni-text-tertiary)', fontWeight: 400 }}>(opcional)</span>
              </p>

              {franqueadoId ? (
                <div
                  className="flex items-center gap-2 px-3"
                  style={{ ...campo, minHeight: 44 }}
                >
                  <span className="min-w-0 flex-1 truncate text-sm" style={{ color: 'var(--moni-text-primary)' }}>
                    {labelSelecionado || (carregando ? 'Carregando…' : 'Franqueado selecionado')}
                  </span>
                  <button
                    type="button"
                    onClick={limparFranqueado}
                    className="shrink-0 text-xs"
                    style={{ color: 'var(--moni-text-tertiary)', minHeight: 44, minWidth: 44 }}
                    title="Limpar"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="relative" ref={dropdownRef}>
                  <input
                    type="text"
                    placeholder={carregando ? 'Carregando…' : 'Buscar por número ou nome'}
                    value={busca}
                    disabled={carregando}
                    onChange={(e) => {
                      setBusca(e.target.value);
                      setDropdownAberto(true);
                    }}
                    onFocus={() => setDropdownAberto(true)}
                    style={campo}
                  />
                  {dropdownAberto && !carregando ? (
                    <ul
                      className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto text-sm"
                      style={{
                        background: 'var(--moni-surface-0)',
                        border: 'var(--moni-border-width) solid var(--moni-border-default)',
                        borderRadius: 'var(--moni-radius-md)',
                        boxShadow: 'var(--moni-shadow-card)',
                      }}
                    >
                      {franqueadosFiltrados.length === 0 ? (
                        <li className="px-3 py-2" style={{ color: 'var(--moni-text-tertiary)' }}>
                          Nenhum resultado
                        </li>
                      ) : (
                        franqueadosFiltrados.map((f) => (
                          <li key={f.id}>
                            <button
                              type="button"
                              onClick={() => selecionarFranqueado(f)}
                              className="flex w-full items-baseline gap-2 px-3 py-2 text-left"
                              style={{ minHeight: 44, color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' }}
                            >
                              <span className="font-medium">{f.numero_franquia}</span>
                              {f.nome ? <span style={{ color: 'var(--moni-text-secondary)' }}>{f.nome}</span> : null}
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  ) : null}
                </div>
              )}

              <p className="text-xs" style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}>
                Sem card e sem franqueado, quem preencher informa o número e o nome da franquia.
              </p>
            </div>

            {linkGerado ? (
              <div className="space-y-1 rounded-lg p-3" style={{ background: 'var(--moni-green-50)', border: 'var(--moni-border-width) solid var(--moni-green-400)' }}>
                <p className="text-xs font-medium" style={{ color: 'var(--moni-green-800)' }}>
                  Link gerado
                </p>
                <p className="break-all font-mono text-xs" style={{ color: 'var(--moni-text-primary)' }}>
                  {linkGerado}
                </p>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(linkGerado)}
                  className="text-xs underline"
                  style={{ color: 'var(--moni-green-800)', minHeight: 44 }}
                >
                  Copiar
                </button>
              </div>
            ) : null}

            {erro ? (
              <p className="text-xs" style={{ color: 'var(--moni-status-overdue-text)', fontFamily: 'var(--moni-font-sans)' }}>
                {erro}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-1">
              <button type="button" onClick={() => void handleGerar()} disabled={gerandoLink} style={botao}>
                {gerandoLink ? 'Gerando…' : 'Gerar'}
              </button>
              <button type="button" onClick={handleFechar} style={botaoSecundario}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default GerarLinkFormularioButton;
