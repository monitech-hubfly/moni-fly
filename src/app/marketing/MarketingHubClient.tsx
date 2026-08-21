'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { HUB_FUNIS_GRUPOS } from '@/components/hub-funis/hub-funis-config';

const MARKETING_TITULO = 'Marketing';

function badgeTipo(tipo?: 'pontual' | 'recorrente' | 'temporada') {
  if (tipo === 'recorrente') {
    return {
      label: 'recorrente',
      bg: 'var(--moni-kanban-portfolio-light)',
      color: 'var(--moni-kanban-portfolio)',
    };
  }
  if (tipo === 'temporada') {
    return {
      label: 'temporada',
      bg: 'var(--moni-gold-50)',
      color: 'var(--moni-gold-800)',
    };
  }
  return {
    label: 'pontual',
    bg: 'var(--moni-kanban-marketing-light)',
    color: 'var(--moni-kanban-marketing)',
  };
}

export function MarketingHubClient({
  sessaoInicial = MARKETING_TITULO,
}: {
  sessaoInicial?: string;
}) {
  const [sessao, setSessao] = useState(sessaoInicial);
  const grupo = useMemo(
    () => HUB_FUNIS_GRUPOS.find((g) => g.titulo === sessao) ?? HUB_FUNIS_GRUPOS[0],
    [sessao],
  );

  return (
    <div className="min-h-[70vh] bg-[var(--moni-surface-50)]">
      <header
        className="flex items-center gap-3 px-6 py-5"
        style={{ borderBottom: '0.5px solid var(--moni-border-default)', background: 'var(--moni-surface-0)' }}
      >
        <span
          className="inline-flex h-9 w-9 items-center justify-center text-sm font-semibold text-white"
          style={{
            borderRadius: 'var(--moni-radius-md)',
            background: 'var(--moni-navy-800)',
            fontFamily: 'var(--moni-font-sans)',
          }}
          aria-hidden
        >
          HF
        </span>
        <div>
          <h1
            className="text-2xl leading-tight"
            style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-display)' }}
          >
            Hub de Funis
          </h1>
          <p className="text-sm" style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}>
            {sessao === 'Manutenções'
              ? 'Sessão Manutenções — pós-entrega e revisões programadas'
              : sessao === MARKETING_TITULO
                ? 'Sessão Marketing — produção de conteúdo e gravação'
                : `Sessão ${sessao}`}
          </p>
        </div>
      </header>

      <div className="moni-painel-grid mx-auto grid max-w-[1600px] grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[240px_1fr]">
        <aside
          className="h-fit p-3"
          style={{
            borderRadius: 'var(--moni-radius-lg)',
            border: '0.5px solid var(--moni-border-default)',
            background: 'var(--moni-surface-0)',
            boxShadow: 'var(--moni-shadow-card)',
          }}
        >
          <p
            className="mb-2 px-2 text-xs font-medium uppercase tracking-wide"
            style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}
          >
            Sessões
          </p>
          <nav className="flex flex-col gap-1">
            {HUB_FUNIS_GRUPOS.map((g) => {
              const active = g.titulo === sessao;
              return (
                <button
                  key={g.titulo}
                  type="button"
                  onClick={() => setSessao(g.titulo)}
                  className="px-3 text-left text-sm"
                  style={{
                    minHeight: 44,
                    borderRadius: 'var(--moni-radius-md)',
                    fontFamily: 'var(--moni-font-sans)',
                    background: active ? 'var(--moni-kanban-marketing-light)' : 'transparent',
                    color: active ? 'var(--moni-kanban-marketing)' : 'var(--moni-text-secondary)',
                    border: active
                      ? '0.5px solid var(--moni-kanban-marketing-accent)'
                      : '0.5px solid transparent',
                  }}
                >
                  {g.titulo}
                </button>
              );
            })}
          </nav>
        </aside>

        <section>
          <h2
            className="mb-4 text-xl"
            style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-display)' }}
          >
            {grupo?.titulo}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {(grupo?.funis ?? []).map((funil) => {
              const badge = badgeTipo(funil.tipo);
              return (
                <article
                  key={funil.id}
                  className="flex flex-col p-5"
                  style={{
                    borderRadius: 'var(--moni-radius-lg)',
                    border: '0.5px solid var(--moni-border-default)',
                    background: 'var(--moni-surface-0)',
                    boxShadow: 'var(--moni-shadow-card)',
                  }}
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <h3
                      className="text-base font-medium"
                      style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' }}
                    >
                      {funil.label}
                    </h3>
                    {funil.tipo ? (
                      <span
                        className="shrink-0 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide"
                        style={{
                          borderRadius: 'var(--moni-radius-md)',
                          background: badge.bg,
                          color: badge.color,
                          border: '0.5px solid currentColor',
                          fontFamily: 'var(--moni-font-sans)',
                        }}
                      >
                        {badge.label}
                      </span>
                    ) : null}
                  </div>
                  {funil.descricao ? (
                    <p
                      className="mb-2 text-sm"
                      style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}
                    >
                      {funil.descricao}
                    </p>
                  ) : null}
                  {typeof funil.nFases === 'number' ? (
                    <p
                      className="mb-4 text-sm"
                      style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}
                    >
                      {funil.nFases} fase{funil.nFases === 1 ? '' : 's'}
                    </p>
                  ) : (
                    <p
                      className="mb-4 text-sm"
                      style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}
                    >
                      Abrir esteira do funil
                    </p>
                  )}
                  <Link
                    href={funil.href}
                    className="mt-auto inline-flex items-center justify-center px-4 text-sm text-white"
                    style={{
                      minHeight: 44,
                      borderRadius: 'var(--moni-radius-md)',
                      background: 'var(--moni-navy-800)',
                      fontFamily: 'var(--moni-font-sans)',
                    }}
                  >
                    Abrir Kanban
                  </Link>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
