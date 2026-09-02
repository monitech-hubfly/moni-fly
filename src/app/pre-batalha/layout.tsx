import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pré Batalha de Casas | Hub Fly Moní',
  description:
    'Guia interativo da Pré Batalha de Casas — link público de leitura (/pre-batalha/leitura).',
};

export default function PreBatalhaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
  );
}
