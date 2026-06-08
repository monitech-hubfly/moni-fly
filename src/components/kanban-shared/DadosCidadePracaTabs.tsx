'use client';

import { labelPracaCidade, type PracaCidade } from '@/lib/kanban/dados-cidade-praca-multi';

type Props = {
  pracas: PracaCidade[];
  abaAtiva: string;
  onAbaChange: (chave: string) => void;
  children: React.ReactNode;
};

export function DadosCidadePracaTabs({ pracas, abaAtiva, onAbaChange, children }: Props) {
  if (pracas.length <= 1) {
    return <div className="space-y-4">{children}</div>;
  }

  return (
    <div className="space-y-4">
      <div
        className="flex flex-wrap gap-1 border-b pb-0.5"
        style={{ borderColor: 'var(--moni-border-default)' }}
        role="tablist"
        aria-label="Cidades da área de atuação"
      >
        {pracas.map((p) => {
          const chave = `${p.uf}::${p.cidade}`;
          const ativa = abaAtiva === chave;
          return (
            <button
              key={chave}
              type="button"
              role="tab"
              aria-selected={ativa}
              onClick={() => onAbaChange(chave)}
              className="rounded-t-md px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                color: ativa ? 'var(--moni-primary-700)' : 'var(--moni-text-secondary)',
                background: ativa ? 'var(--moni-surface-100)' : 'transparent',
                borderBottom: ativa ? '2px solid var(--moni-primary-500)' : '2px solid transparent',
              }}
            >
              {labelPracaCidade(p)}
            </button>
          );
        })}
      </div>
      <div role="tabpanel">{children}</div>
    </div>
  );
}
