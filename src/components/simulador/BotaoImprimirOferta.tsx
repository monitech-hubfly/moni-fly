'use client';

import { Printer } from 'lucide-react';
import './oferta-detalhe-print.css';

export function BotaoImprimirOferta() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      title="Salvar como PDF"
      className="fixed bottom-6 right-6 z-50 flex items-center justify-center rounded-full shadow-lg"
      style={{
        width: 48,
        height: 48,
        background: 'var(--moni-navy-800)',
        color: 'var(--moni-text-inverse)',
      }}
    >
      <Printer className="h-5 w-5" aria-hidden />
      <span className="sr-only">Salvar como PDF</span>
    </button>
  );
}
