import type { CSSProperties, ReactNode } from 'react';
import type { Metadata } from 'next';
import { Playfair_Display, DM_Sans } from 'next/font/google';

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
  variable: '--font-playfair',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-dm-sans',
});

export const metadata: Metadata = {
  title: 'Simulador | Casa Moní',
  description: 'Simule o investimento do seu cliente e gere uma proposta de pagamento.',
};

export default function SimuladorPublicoLayout({ children }: { children: ReactNode }) {
  const wrapStyle = {
    fontFamily: 'var(--font-dm-sans), var(--moni-font-sans)',
    ['--moni-font-display']: 'var(--font-playfair), Georgia, serif',
    ['--moni-font-sans']: 'var(--font-dm-sans), Inter, sans-serif',
  } as CSSProperties;
  return (
    <div className={`${playfair.variable} ${dmSans.variable}`} style={wrapStyle}>
      {children}
    </div>
  );
}
