'use client';

import { KanbanFaseSecaoTabs } from '@/components/kanban-shared/KanbanFaseSecaoTabs';
import { chavePracaCidade, labelPracaCidade, type PracaCidade } from '@/lib/kanban/dados-cidade-praca-multi';

type Props = {
  pracas: PracaCidade[];
  abaAtiva: string;
  onAbaChange: (chave: string) => void;
  children: React.ReactNode;
};

export function DadosCidadePracaTabs({ pracas, abaAtiva, onAbaChange, children }: Props) {
  const tabs = pracas.map((p) => ({
    id: chavePracaCidade(p),
    label: labelPracaCidade(p),
  }));

  return (
    <KanbanFaseSecaoTabs
      tabs={tabs}
      abaAtiva={abaAtiva}
      onAbaChange={onAbaChange}
      ariaLabel="Cidades da área de atuação"
    >
      {children}
    </KanbanFaseSecaoTabs>
  );
}
