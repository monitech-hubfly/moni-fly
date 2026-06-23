'use client';

export type PipelineFunilRedeVisao = 'mes' | 'provisionado';

type Props = {
  value: PipelineFunilRedeVisao;
  onChange: (value: PipelineFunilRedeVisao) => void;
};

const btnStyle = (active: boolean): React.CSSProperties => ({
  height: '28px',
  minHeight: '28px',
  padding: '4px 10px',
  fontSize: '11px',
  border: '0.5px solid var(--moni-border-default)',
  borderRadius: 'var(--moni-radius-md)',
  background: active ? 'var(--moni-navy-800)' : 'var(--moni-surface-0)',
  color: active ? 'var(--moni-text-inverse, #fff)' : 'var(--moni-text-primary)',
  fontFamily: 'var(--moni-font-sans)',
  cursor: 'pointer',
  flexShrink: 0,
});

export function PipelineFunilRedeVisaoToggle({ value, onChange }: Props) {
  return (
    <div className="flex shrink-0 gap-1" role="group" aria-label="Tipo de funil">
      <button
        type="button"
        onClick={() => onChange('mes')}
        style={btnStyle(value === 'mes')}
        aria-pressed={value === 'mes'}
      >
        Funil mês
      </button>
      <button
        type="button"
        onClick={() => onChange('provisionado')}
        style={btnStyle(value === 'provisionado')}
        aria-pressed={value === 'provisionado'}
      >
        Provisionado
      </button>
    </div>
  );
}
