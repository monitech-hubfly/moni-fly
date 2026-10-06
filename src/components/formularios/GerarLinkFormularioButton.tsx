'use client';

import { useState } from 'react';
import { gerarTokenFormulario } from '@/lib/actions/formulario-actions';

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
  const [rede, setRede] = useState(redeFranqueadoId ?? '');
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);

  async function gerar() {
    setGerando(true);
    setErro(null);
    const res = await gerarTokenFormulario({
      formularioId,
      cardId: card.trim() || null,
      redeFranqueadoId: rede.trim() || null,
    });
    setGerando(false);
    if (!res.token) {
      setErro(res.error ?? 'Erro ao gerar link.');
      return;
    }
    setUrl(`${window.location.origin}/f/${res.token}`);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setAberto(true);
          setUrl(null);
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
          className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
          style={{ background: 'color-mix(in srgb, var(--moni-navy-800) 45%, transparent)' }}
        >
          <div
            className="w-full max-w-md space-y-3 p-5"
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
              Card (opcional)
              <input value={card} onChange={(e) => setCard(e.target.value)} placeholder="ID do card" style={{ ...campo, display: 'block', marginTop: 4 }} />
            </label>
            <label className="block text-sm" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
              Franqueado (opcional)
              <input value={rede} onChange={(e) => setRede(e.target.value)} placeholder="ID em rede_franqueados" style={{ ...campo, display: 'block', marginTop: 4 }} />
            </label>
            <p className="text-xs" style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}>
              Sem card e sem franqueado, quem preencher informa o número e o nome da franquia.
            </p>
            {url ? (
              <p className="break-all text-sm" style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' }}>
                {url}
              </p>
            ) : null}
            {erro ? (
              <p className="text-sm" style={{ color: 'var(--moni-status-overdue-text)', fontFamily: 'var(--moni-font-sans)' }}>
                {erro}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={gerando} onClick={() => void gerar()} style={botao}>
                {gerando ? 'Gerando…' : 'Gerar'}
              </button>
              {url ? (
                <button
                  type="button"
                  style={{ ...botao, background: 'transparent', color: 'var(--moni-text-primary)', border: 'var(--moni-border-width) solid var(--moni-border-default)' }}
                  onClick={() => void navigator.clipboard.writeText(url)}
                >
                  Copiar
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setAberto(false)}
                style={{ ...botao, background: 'transparent', color: 'var(--moni-text-primary)', border: 'var(--moni-border-width) solid var(--moni-border-default)' }}
              >
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
