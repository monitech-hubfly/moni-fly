'use client';

import { useState } from 'react';
import {
  Calculator,
  ClipboardList,
  DollarSign,
  FileSignature,
  Flag,
  GraduationCap,
  Handshake,
  HardHat,
  Home,
  Landmark,
  LayoutDashboard,
  LifeBuoy,
  MapPin,
  Package,
  Repeat,
  Scale,
  Settings,
  Stamp,
  TrendingUp,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import type { FaqArticle, FaqCategory } from '@/types/faq';

const LUCIDE: Record<string, LucideIcon> = {
  Calculator,
  ClipboardList,
  DollarSign,
  FileSignature,
  Flag,
  GraduationCap,
  Handshake,
  HardHat,
  Home,
  Landmark,
  LayoutDashboard,
  LifeBuoy,
  MapPin,
  Package,
  Repeat,
  Scale,
  Settings,
  Stamp,
  TrendingUp,
  Truck,
};

const EMOJI_POR_CHAVE: Array<[RegExp, string]> = [
  [/terreno/, '🏗️'],
  [/aprovac|pre-obra|pre obra/, '📋'],
  [/(^|[^a-z])obra([^a-z]|$)/, '🏠'],
  [/hub-fly|hub fly|tecnologia/, '💻'],
  [/entrega|pos-obra|pos obra/, '🔑'],
  [/monicare|moni-care|moni care|pos-venda/, '🛡️'],
  [/licenciamento|marca/, '®️'],
  [/suporte|comunidade/, '🤝'],
  [/contrato|garantia/, '📝'],
  [/permuta/, '🔄'],
];

function chave(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function emojiFallback(nome: string, slug: string): string {
  const alvo = `${chave(slug)} ${chave(nome)}`;
  for (const [regra, emoji] of EMOJI_POR_CHAVE) {
    if (regra.test(alvo)) return emoji;
  }
  return '📘';
}

function IconeCategoria({ categoria }: { categoria: FaqCategory }) {
  const salvo = categoria.icone?.trim() ?? '';
  const Lucide = salvo ? LUCIDE[salvo] : undefined;
  if (Lucide) {
    return <Lucide className="h-5 w-5 shrink-0 text-[var(--moni-navy-800)]" aria-hidden />;
  }
  const emoji = salvo && /[^\w-]/.test(salvo) ? salvo : emojiFallback(categoria.nome, categoria.slug);
  return (
    <span className="text-lg leading-none" aria-hidden>
      {emoji}
    </span>
  );
}

const LIMITE = 4;

export function FaqCategoryCard({
  categoria,
  artigos,
  onAbrir,
}: {
  categoria: FaqCategory;
  artigos: FaqArticle[];
  onAbrir: (artigo: FaqArticle) => void;
}) {
  const [expandido, setExpandido] = useState(false);
  const visiveis = expandido ? artigos : artigos.slice(0, LIMITE);
  const restantes = artigos.length - LIMITE;

  return (
    <article className="group flex h-full flex-col rounded-[var(--moni-radius-lg)] border-[length:var(--moni-border-width)] border-solid border-[var(--moni-border-default)] bg-[var(--moni-surface-0)] p-5 shadow-[var(--moni-shadow-card)] transition-shadow duration-200 hover:shadow-[var(--moni-shadow-lg)]">
      <header className="mb-3 flex items-center gap-2">
        <IconeCategoria categoria={categoria} />
        <h2 className="min-w-0 flex-1 font-[family-name:var(--moni-font-display)] text-[length:var(--moni-text-lg)] font-semibold leading-tight text-[var(--moni-text-primary)]">
          {categoria.nome}
        </h2>
        <span
          className="text-[var(--moni-text-tertiary)] transition-transform duration-200 group-hover:translate-x-1"
          aria-hidden
        >
          →
        </span>
      </header>
      <ul className="flex flex-1 flex-col gap-1">
        {visiveis.map((artigo) => (
          <li key={artigo.id}>
            <button
              type="button"
              onClick={() => onAbrir(artigo)}
              className="flex min-h-11 w-full items-center gap-2 rounded-[var(--moni-radius-md)] px-2 text-left font-[family-name:var(--moni-font-sans)] text-[length:var(--moni-text-sm)] text-[var(--moni-text-secondary)] transition-colors duration-200 hover:bg-[var(--moni-surface-100)]"
            >
              <span className="min-w-0 flex-1 truncate">{artigo.pergunta}</span>
              <span className="shrink-0 text-[var(--moni-text-tertiary)]" aria-hidden>
                →
              </span>
            </button>
          </li>
        ))}
      </ul>
      {restantes > 0 ? (
        <button
          type="button"
          onClick={() => setExpandido((atual) => !atual)}
          className="mt-3 min-h-11 self-start px-2 text-left font-[family-name:var(--moni-font-sans)] text-[length:var(--moni-text-sm)] font-medium text-[var(--moni-navy-800)]"
        >
          {expandido ? 'Ver menos' : `Ver mais ${restantes} ${restantes === 1 ? 'artigo' : 'artigos'} →`}
        </button>
      ) : null}
    </article>
  );
}
