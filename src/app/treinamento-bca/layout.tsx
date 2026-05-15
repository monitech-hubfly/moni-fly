import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Treinamento BCA | Viabilidade Moní',
  description:
    'Manual interativo do Business Case Analysis (BCA) para franqueados Moní — acesso compartilhável, com ou sem login.',
};

export default function TreinamentoBcaLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full min-h-0 flex-1 flex-col">{children}</div>;
}
