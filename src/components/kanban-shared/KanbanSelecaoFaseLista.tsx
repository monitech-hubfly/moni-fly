'use client';

type FaseOpcao = {
  id: string;
  nome: string;
  slug?: string | null;
  ordem?: number;
};

type Props = {
  titulo: string;
  hint?: string;
  fases: FaseOpcao[];
  disabled?: boolean;
  onSelect: (fase: FaseOpcao) => void;
  onCancel: () => void;
};

/** Lista compacta para escolher qualquer fase anterior ou futura do funil. */
export function KanbanSelecaoFaseLista({
  titulo,
  hint,
  fases,
  disabled = false,
  onSelect,
  onCancel,
}: Props) {
  return (
    <div
      className="space-y-1.5 rounded-lg p-2"
      style={{
        border: 'var(--moni-border-width) solid var(--moni-border-default)',
        borderRadius: 'var(--moni-radius-md)',
        background: 'var(--moni-surface-0)',
        fontFamily: 'var(--moni-font-sans)',
      }}
      role="listbox"
      aria-label={titulo}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className="text-[11px] font-semibold"
            style={{ color: 'var(--moni-text-primary)' }}
          >
            {titulo}
          </p>
          {hint ? (
            <p className="mt-0.5 text-[10px] leading-snug" style={{ color: 'var(--moni-text-tertiary)' }}>
              {hint}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled}
          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium transition disabled:opacity-50"
          style={{
            border: 'var(--moni-border-width) solid var(--moni-border-default)',
            borderRadius: 'var(--moni-radius-md)',
            color: 'var(--moni-text-secondary)',
            background: 'var(--moni-surface-0)',
            minHeight: 28,
          }}
        >
          Cancelar
        </button>
      </div>

      {fases.length === 0 ? (
        <p className="py-2 text-center text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
          Nenhuma fase disponível.
        </p>
      ) : (
        <ul className="max-h-48 space-y-1 overflow-y-auto pr-0.5">
          {fases.map((fase, idx) => (
            <li key={fase.id}>
              <button
                type="button"
                role="option"
                disabled={disabled}
                onClick={() => onSelect(fase)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] transition disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  border: 'var(--moni-border-width) solid var(--moni-border-default)',
                  borderRadius: 'var(--moni-radius-md)',
                  background: 'var(--moni-surface-0)',
                  color: 'var(--moni-text-primary)',
                  minHeight: 36,
                }}
              >
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold tabular-nums"
                  style={{
                    background: 'var(--moni-navy-50)',
                    color: 'var(--moni-navy-800)',
                  }}
                  aria-hidden
                >
                  {idx + 1}
                </span>
                <span className="min-w-0 flex-1 font-medium leading-snug">{fase.nome}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
