import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Calculadora de fases · Moní',
  robots: { index: false, follow: false },
};

export default function CalculadoraPublicaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
