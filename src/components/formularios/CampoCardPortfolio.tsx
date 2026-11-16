'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { CardPortfolioFormulario } from '@/lib/formularios/card-portfolio';

type Props = {
  token: string;
  label: ReactNode;
  cardId: string;
  rotulo: string;
  onSelecionar: (card: CardPortfolioFormulario) => void;
  onLimpar: () => void;
};

const campoStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 44,
  borderRadius: 'var(--moni-radius-md)',
  border: 'var(--moni-border-width) solid var(--moni-border-default)',
  background: 'var(--moni-surface-0)',
  color: 'var(--moni-text-primary)',
  fontFamily: 'var(--moni-font-sans)',
  fontSize: 15,
  padding: '8px 12px',
};

export function CampoCardPortfolio({ token, label, cardId, rotulo, onSelecionar, onLimpar }: Props) {
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<CardPortfolioFormulario[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [consultou, setConsultou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const termo = busca.trim();
    if (cardId || termo.length < 2) {
      setResultados([]);
      setCarregando(false);
      setConsultou(false);
      setErro(null);
      return;
    }
    setCarregando(true);
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => {
      setErro(null);
      const params = new URLSearchParams({ token, q: termo });
      void fetch(`/api/formularios/cards-portfolio?${params}`, { signal: ctrl.signal })
        .then(async (res) => {
          const json = (await res.json()) as { ok?: boolean; error?: string; cards?: CardPortfolioFormulario[] };
          if (!res.ok || !json.ok) throw new Error(json.error || 'Não foi possível buscar os cards.');
          if (!ctrl.signal.aborted) setResultados(json.cards ?? []);
        })
        .catch((falha: unknown) => {
          if (ctrl.signal.aborted) return;
          setResultados([]);
          setErro(falha instanceof Error ? falha.message : 'Não foi possível buscar os cards.');
        })
        .finally(() => {
          if (!ctrl.signal.aborted) {
            setCarregando(false);
            setConsultou(true);
          }
        });
    }, 300);
    return () => {
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, [busca, cardId, token]);

  if (cardId) {
    return (
      <div>
        {label}
        <div
          className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
          style={{
            background: 'var(--moni-surface-100)',
            border: 'var(--moni-border-width) solid var(--moni-border-default)',
            borderRadius: 'var(--moni-radius-md)',
          }}
        >
          <p className="text-sm leading-relaxed" style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' }}>
            {rotulo || 'Card vinculado'}
          </p>
          <button
            type="button"
            onClick={onLimpar}
            className="shrink-0"
            style={{
              minHeight: 44,
              borderRadius: 'var(--moni-radius-md)',
              background: 'transparent',
              color: 'var(--moni-text-primary)',
              fontFamily: 'var(--moni-font-sans)',
              fontSize: 14,
              fontWeight: 600,
              padding: '0 14px',
              border: 'var(--moni-border-width) solid var(--moni-border-default)',
            }}
          >
            Trocar
          </button>
        </div>
      </div>
    );
  }

  const termo = busca.trim();

  return (
    <div>
      {label}
      <input
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar franqueado, condomínio, cidade, quadra ou lote"
        aria-label="Buscar card do Funil Portfólio"
        style={campoStyle}
      />
      {carregando ? (
        <p className="mt-2 text-xs" style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}>
          Buscando…
        </p>
      ) : null}
      {erro ? (
        <p className="mt-2 text-sm" style={{ color: 'var(--moni-status-overdue-text)', fontFamily: 'var(--moni-font-sans)' }}>
          {erro}
        </p>
      ) : null}
      {consultou && !carregando && !erro && termo.length >= 2 && resultados.length === 0 ? (
        <p className="mt-2 text-xs" style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}>
          Nenhum card do Funil Portfólio encontrado.
        </p>
      ) : null}
      {resultados.length > 0 ? (
        <ul
          className="mt-2 overflow-hidden"
          style={{
            border: 'var(--moni-border-width) solid var(--moni-border-default)',
            borderRadius: 'var(--moni-radius-md)',
            background: 'var(--moni-surface-0)',
          }}
        >
          {resultados.map((card, index) => (
            <li
              key={card.id}
              style={index === 0 ? undefined : { borderTop: 'var(--moni-border-width) solid var(--moni-border-default)' }}
            >
              <button
                type="button"
                onClick={() => onSelecionar(card)}
                className="w-full px-3 text-left text-sm leading-relaxed"
                style={{
                  minHeight: 44,
                  background: 'transparent',
                  color: 'var(--moni-text-primary)',
                  fontFamily: 'var(--moni-font-sans)',
                  border: 'none',
                }}
              >
                {card.rotulo}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
