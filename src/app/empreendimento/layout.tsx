// src/app/empreendimento/layout.tsx
import type { CSSProperties, ReactNode } from 'react';
import type { Metadata } from 'next';
import { Cormorant_Garamond, Inter, Playfair_Display } from 'next/font/google';
import './empreendimento.css';

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-cormorant',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
  variable: '--font-playfair',
});

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Casa Moní',
  description: 'Encontre e personalize o empreendimento ideal para você.',
};

export default function EmpreendimentoLayout({ children }: { children: ReactNode }) {
  const style = {
    fontFamily: 'var(--font-inter), var(--j-font-sans)',
    ['--j-font-display']: 'var(--font-cormorant), Georgia, serif',
    ['--j-font-hero']: 'var(--font-playfair), Georgia, serif',
    ['--j-font-sans']: 'var(--font-inter), system-ui, sans-serif',
  } as CSSProperties;

  return (
    <div className={`${cormorant.variable} ${playfair.variable} ${inter.variable}`} style={style}>
      {children}
    </div>
  );
}
