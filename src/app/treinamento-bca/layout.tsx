import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Treinamento BCA | Viabilidade Moní',
  description:
    'Manual interativo do Business Case Analysis (BCA) — link público de leitura (/treinamento-bca/leitura).',
};

export default function TreinamentoBcaLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[100dvh] flex-1 flex-col">{children}</div>;
}
