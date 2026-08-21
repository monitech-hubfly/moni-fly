'use client';

import type { PainelQualidadeMotivoArquivamento } from '@/lib/kanban/painel-performance-types';

type Props = {
  qualidade: PainelQualidadeMotivoArquivamento;
  formatInt: (n: number) => string;
  formatPct: (n: number | null) => string;
};

export function PainelQualidadeMotivoAlert({ qualidade, formatInt, formatPct }: Props) {
  const atencao = qualidade.alertaAtencao;

  return (
    <section
      id="qualidade-dados-motivo"
      className="scroll-mt-6 rounded-xl px-4 py-4 sm:px-5 sm:py-5"
      role="status"
      style={{
        borderRadius: 'var(--moni-radius-lg)',
        border: atencao
          ? '0.5px solid var(--moni-status-attention-border)'
          : '0.5px solid var(--moni-border-default)',
        background: atencao ? 'var(--moni-status-attention-bg)' : 'var(--moni-surface-100)',
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              className="text-base font-semibold tracking-tight"
              style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
            >
              Qualidade dos dados — motivo de arquivamento
            </h2>
            {atencao ? (
              <span className="moni-tag-atencao text-xs">Atenção</span>
            ) : (
              <span className="moni-tag-arquivado text-xs">Informativo</span>
            )}
          </div>
          <p
            className="mt-2 text-sm leading-relaxed"
            style={{ color: atencao ? 'var(--moni-status-attention-text)' : 'var(--moni-text-secondary)' }}
          >
            {qualidade.mensagem}
          </p>
          {atencao ? (
            <p className="mt-1 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
              Mais de 20% dos arquivamentos no recorte estão sem motivo — priorize registrar o motivo ao
              arquivar cards no Kanban.
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 gap-3">
          <div
            className="min-w-[96px] rounded-lg px-3 py-2 text-center"
            style={{
              border: '0.5px solid var(--moni-border-subtle)',
              borderRadius: 'var(--moni-radius-md)',
              background: 'var(--moni-surface-0)',
            }}
          >
            <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
              Sem motivo
            </p>
            <p
              className="mt-1 text-xl font-semibold tabular-nums"
              style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-navy-800)' }}
            >
              {formatPct(qualidade.pctSemMotivo)}
            </p>
          </div>
          <div
            className="min-w-[96px] rounded-lg px-3 py-2 text-center"
            style={{
              border: '0.5px solid var(--moni-border-subtle)',
              borderRadius: 'var(--moni-radius-md)',
              background: 'var(--moni-surface-0)',
            }}
          >
            <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
              Quantidade
            </p>
            <p
              className="mt-1 text-xl font-semibold tabular-nums"
              style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-navy-800)' }}
            >
              {formatInt(qualidade.semMotivoInformado)}
            </p>
          </div>
        </div>
      </div>

      {(qualidade.fasesMaiorSemMotivo.length > 0 || qualidade.responsaveisMaiorSemMotivo.length > 0) && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {qualidade.fasesMaiorSemMotivo.length > 0 ? (
            <div
              className="rounded-lg px-3 py-3"
              style={{
                border: '0.5px solid var(--moni-border-subtle)',
                borderRadius: 'var(--moni-radius-md)',
                background: 'var(--moni-surface-0)',
              }}
            >
              <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
                Fases com mais arquivamentos sem motivo
              </h3>
              <ul className="mt-2 space-y-1.5">
                {qualidade.fasesMaiorSemMotivo.map((f) => (
                  <li key={f.faseId} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate" style={{ color: 'var(--moni-text-secondary)' }}>
                      {f.faseNome}
                    </span>
                    <span className="shrink-0 tabular-nums font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                      {formatInt(f.total)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {qualidade.responsaveisMaiorSemMotivo.length > 0 ? (
            <div
              className="rounded-lg px-3 py-3"
              style={{
                border: '0.5px solid var(--moni-border-subtle)',
                borderRadius: 'var(--moni-radius-md)',
                background: 'var(--moni-surface-0)',
              }}
            >
              <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
                Responsáveis com mais arquivamentos sem motivo
              </h3>
              <ul className="mt-2 space-y-1.5">
                {qualidade.responsaveisMaiorSemMotivo.map((r) => (
                  <li
                    key={r.responsavelId ?? r.responsavelNome}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="min-w-0 truncate" style={{ color: 'var(--moni-text-secondary)' }}>
                      {r.responsavelNome}
                    </span>
                    <span className="shrink-0 tabular-nums font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                      {formatInt(r.total)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
