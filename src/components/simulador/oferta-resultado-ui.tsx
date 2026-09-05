'use client';

import type { ReactNode } from 'react';
import { formatarMoeda, type LinhaFluxo } from '@/lib/simulador/calcular-oferta';
import type { CardResultadoItem } from '@/lib/simulador/oferta-resultado-helpers';

export type { CardResultadoItem };

const FASE_LABEL: Record<string, string> = {
  mes0: 'Mês 0',
  fase1: 'Fase 1',
  parcela_unica: 'Parcela única',
  fase2: 'Fase 2',
  entrega: 'Entrega',
};

const hintStyle = { color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' } as const;

export function Secao({
  titulo,
  children,
  className,
}: {
  titulo: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[var(--moni-radius-lg)] p-4 sm:p-5${className ? ` ${className}` : ''}`}
      style={{
        border: 'var(--moni-border-width) solid var(--moni-border-default)',
        background: 'var(--moni-surface-0)',
        boxShadow: 'var(--moni-shadow-card)',
      }}
    >
      <h3
        className="mb-3 text-base"
        style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
      >
        {titulo}
      </h3>
      {children}
    </section>
  );
}

export function CardResultado({ label, valor, sublabel, destaque }: CardResultadoItem) {
  return (
    <div
      className="rounded-[var(--moni-radius-lg)] p-4"
      style={
        destaque
          ? {
              border: 'var(--moni-border-width) solid var(--moni-gold-400)',
              background: 'var(--moni-gold-50)',
              boxShadow: 'var(--moni-shadow-card)',
            }
          : {
              border: 'var(--moni-border-width) solid var(--moni-border-default)',
              background: 'var(--moni-surface-0)',
              boxShadow: 'var(--moni-shadow-card)',
            }
      }
    >
      <p
        className="text-xs"
        style={
          destaque
            ? {
                ...hintStyle,
                color: 'var(--moni-gold-800)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                fontWeight: 600,
              }
            : hintStyle
        }
      >
        {label}
      </p>
      <p
        className="mt-1 text-base font-medium"
        style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' }}
      >
        {valor}
      </p>
      {sublabel ? (
        <p className="mt-1 text-xs" style={hintStyle}>
          {sublabel}
        </p>
      ) : null}
    </div>
  );
}

export function TabelaSimples({
  linhas,
}: {
  linhas: Array<{ cols: string[]; destaque?: boolean; informativo?: boolean; sublabel?: string }>;
}) {
  return (
    <table className="w-full text-left text-sm" style={{ fontFamily: 'var(--moni-font-sans)' }}>
      <tbody>
        {linhas.map((l) => (
          <tr
            key={l.cols[0]}
            style={{
              borderTop: 'var(--moni-border-width) solid var(--moni-border-default)',
              color: l.informativo
                ? 'var(--moni-text-tertiary)'
                : l.destaque
                  ? 'var(--moni-text-primary)'
                  : 'var(--moni-text-secondary)',
              fontWeight: l.destaque && !l.informativo ? 600 : 400,
            }}
          >
            <td className={l.informativo ? 'py-1 pl-3 pr-3' : 'py-2 pr-3'}>
              {l.cols[0]}
              {l.sublabel ? (
                <span className="ml-1 text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
                  {l.sublabel}
                </span>
              ) : null}
            </td>
            <td className={`whitespace-nowrap text-right ${l.informativo ? 'py-1' : 'py-2'}`}>
              {l.cols[1]}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TabelaFluxo({
  fluxo,
  detalheAberto,
  onToggleDetalhe,
}: {
  fluxo: LinhaFluxo[];
  detalheAberto: boolean;
  onToggleDetalhe?: () => void;
}) {
  const celVisivel = { background: 'var(--moni-surface-50)' } as const;
  const celDetalhe = { background: 'var(--moni-surface-0)' } as const;
  const mostrarToggle = typeof onToggleDetalhe === 'function';

  return (
    <div className="overflow-x-auto">
      <table
        className="min-w-full text-left text-xs sm:text-sm"
        style={{ fontFamily: 'var(--moni-font-sans)' }}
      >
        <thead>
          <tr style={{ color: 'var(--moni-text-tertiary)' }}>
            <th className="whitespace-nowrap px-2 py-2 font-medium" style={celVisivel}>
              Mês
            </th>
            <th className="whitespace-nowrap px-2 py-2 font-medium" style={celVisivel}>
              Fase
            </th>
            <th className="whitespace-nowrap px-2 py-2 font-medium" style={celVisivel}>
              Entradas do cliente
            </th>
            {mostrarToggle ? (
              <th className="px-1 py-2" style={celVisivel}>
                <button
                  type="button"
                  onClick={onToggleDetalhe}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center text-base transition-colors"
                  style={{ color: 'var(--moni-text-tertiary)' }}
                  title={detalheAberto ? 'Ocultar detalhes' : 'Mostrar detalhes'}
                  aria-expanded={detalheAberto}
                  aria-label={detalheAberto ? 'Ocultar detalhes' : 'Mostrar detalhes'}
                >
                  {detalheAberto ? '−' : '+'}
                </button>
              </th>
            ) : null}
            {detalheAberto ? (
              <th className="whitespace-nowrap px-2 py-2 font-medium" style={celDetalhe}>
                Pagamentos à loteadora
              </th>
            ) : null}
            {detalheAberto ? (
              <th className="whitespace-nowrap px-2 py-2 font-medium" style={celDetalhe}>
                Saldo do lote
              </th>
            ) : null}
            {detalheAberto ? (
              <th className="whitespace-nowrap px-2 py-2 font-medium" style={celDetalhe}>
                Juros do lote
              </th>
            ) : null}
            {detalheAberto ? (
              <th className="whitespace-nowrap px-2 py-2 font-medium" style={celDetalhe}>
                Desembolso de obra
              </th>
            ) : null}
            {detalheAberto ? (
              <th className="whitespace-nowrap px-2 py-2 font-medium" style={celDetalhe}>
                Juros de obra
              </th>
            ) : null}
            {detalheAberto ? (
              <th className="whitespace-nowrap px-2 py-2 font-medium" style={celDetalhe}>
                Saldo CP
              </th>
            ) : null}
            <th className="whitespace-nowrap px-2 py-2 font-medium" style={celVisivel}>
              Saídas
            </th>
          </tr>
        </thead>
        <tbody>
          {fluxo.map((l) => (
            <tr
              key={`${l.mes}-${l.fase}-${l.etapa_obra ?? ''}`}
              style={{
                borderTop: 'var(--moni-border-width) solid var(--moni-border-default)',
                color: 'var(--moni-text-secondary)',
              }}
            >
              <td className="px-2 py-2" style={celVisivel}>
                {l.mes}
              </td>
              <td className="whitespace-nowrap px-2 py-2" style={celVisivel}>
                {FASE_LABEL[l.fase] ?? l.fase}
              </td>
              <td className="whitespace-nowrap px-2 py-2" style={celVisivel}>
                {formatarMoeda(l.entrada_cliente)}
              </td>
              {mostrarToggle ? (
                <td className="px-1 py-2" style={celVisivel} aria-hidden="true" />
              ) : null}
              {detalheAberto ? (
                <td className="whitespace-nowrap px-2 py-2 text-right" style={celDetalhe}>
                  {l.pagamento_loteadora > 0 ? formatarMoeda(l.pagamento_loteadora) : '—'}
                </td>
              ) : null}
              {detalheAberto ? (
                <td className="whitespace-nowrap px-2 py-2" style={celDetalhe}>
                  {formatarMoeda(l.saldo_lote)}
                </td>
              ) : null}
              {detalheAberto ? (
                <td className="whitespace-nowrap px-2 py-2" style={celDetalhe}>
                  {formatarMoeda(l.juros_lote_mes)}
                </td>
              ) : null}
              {detalheAberto ? (
                <td className="whitespace-nowrap px-2 py-2 text-right" style={celDetalhe}>
                  {l.saidas_obra > 0 ? formatarMoeda(l.saidas_obra) : '—'}
                </td>
              ) : null}
              {detalheAberto ? (
                <td className="whitespace-nowrap px-2 py-2" style={celDetalhe}>
                  {formatarMoeda(l.juros_obra_mes)}
                </td>
              ) : null}
              {detalheAberto ? (
                <td className="whitespace-nowrap px-2 py-2" style={celDetalhe}>
                  {formatarMoeda(l.saldo_credito_ponte)}
                </td>
              ) : null}
              <td className="whitespace-nowrap px-2 py-2" style={celVisivel}>
                {formatarMoeda(l.saidas_total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
