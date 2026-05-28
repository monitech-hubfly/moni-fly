import type { PastelariaColuna } from '@/lib/pastelaria/types';

const LABELS: Record<PastelariaColuna, string> = {
  inbox: 'Direcionados p/ Tratativas',
  mapped: 'Mapeados',
  doing: 'Em Andamento',
  done: 'Concluídos',
};

export function labelPastelariaColuna(coluna: string): string {
  const key = coluna as PastelariaColuna;
  return LABELS[key] ?? coluna;
}
