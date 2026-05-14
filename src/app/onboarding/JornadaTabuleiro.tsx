'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { X } from 'lucide-react';

export type BoardLink = { href: string; label: string };

export type BoardCell = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  links: BoardLink[];
  /** Cor da casa no tabuleiro */
  tone: 'start' | 'step' | 'tool' | 'risk' | 'finish';
};

const BOARD_CELLS: BoardCell[] = [
  {
    id: 'partida',
    title: 'Partida',
    subtitle: 'Início da jornada',
    description:
      'Aqui começa o percurso do franqueado na Moní. Cada casa representa uma fase da esteira de viabilidade e da operação — avance clicando nas casas para ver detalhes e atalhos para o Hub Fly.',
    links: [{ href: '/onboarding/introducao', label: 'Abrir Introdução (portal)' }],
    tone: 'start',
  },
  {
    id: 's1',
    title: 'Step 1',
    subtitle: 'Perímetro & mapeamento',
    description:
      'Mapeamento da região, praça e condomínios. É o primeiro passo para entender onde e como a Moní entra no mercado.',
    links: [
      { href: '/step-one', label: 'Abrir Step 1 no Hub' },
      { href: '/funil-stepone', label: 'Funil Step One' },
    ],
    tone: 'step',
  },
  {
    id: 's2',
    title: 'Step 2',
    subtitle: 'Hipótese de negócio',
    description: 'Construção da hipótese, estudo de viabilidade e consolidação do novo negócio.',
    links: [
      { href: '/step-2', label: 'Abrir Step 2 no Hub' },
      { href: '/dashboard-novos-negocios', label: 'Dashboard Novos Negócios' },
    ],
    tone: 'step',
  },
  {
    id: 's3',
    title: 'Step 3',
    subtitle: 'Negociação',
    description: 'Fase de opção e negociação com partes envolvidas até aprovação do caminho.',
    links: [{ href: '/step-3', label: 'Abrir Step 3 no Hub' }],
    tone: 'step',
  },
  {
    id: 's4-8',
    title: 'Steps 4–8',
    subtitle: 'Legal, crédito, comitê…',
    description:
      'Check legal, checklist de crédito, acoplamento em paralelo, comitê, diligência e contrato — bloco crítico de governança.',
    links: [
      { href: '/painel', label: 'Step 4 — Check Legal + Crédito' },
      { href: '/acoplamento-pl', label: 'Acoplamento (paralelo)' },
      { href: '/step-5', label: 'Step 5 — Comitê' },
      { href: '/step-6', label: 'Step 6 — Diligência' },
      { href: '/step-7', label: 'Step 7 — Contrato' },
    ],
    tone: 'step',
  },
  {
    id: 'bca',
    title: 'BCA & batalha',
    subtitle: 'Produto vs mercado',
    description: 'Comparativo de casas, modelo de negócio e preparação do BCA para o franqueado.',
    links: [
      { href: '/onboarding/bca-guia', label: 'Guia BCA (portal)' },
      { href: '/onboarding/batalha-casas', label: 'Batalha de Casas (portal)' },
      { href: '/portfolio', label: 'Funil Portfolio' },
    ],
    tone: 'tool',
  },
  {
    id: 'ops',
    title: 'Operação',
    subtitle: 'Drive & rotina',
    description: 'Pastas compartilhadas, materiais e rotina operacional do dia a dia.',
    links: [
      { href: '/onboarding/pastas-drive', label: 'Pastas do Drive (portal)' },
      { href: '/onboarding/licao-de-casa', label: 'Lição de Casa (portal)' },
      { href: '/operacoes', label: 'Funil Operações' },
    ],
    tone: 'tool',
  },
  {
    id: 'preobra',
    title: 'Pré-obra',
    subtitle: 'Em breve',
    description: 'Próxima fase do tabuleiro: acompanhe comunicados da Moní para abertura desta casa.',
    links: [{ href: '/onboarding/pre-obra', label: 'Ver secção Pré-obra' }],
    tone: 'risk',
  },
  {
    id: 'meta',
    title: 'Conquista',
    subtitle: 'Unidade em operação',
    description:
      'Meta da jornada: unidade franqueada madura, com processos e ferramentas alinhados à rede Moní.',
    links: [{ href: '/dashboard-novos-negocios', label: 'Dashboard Novos Negócios' }],
    tone: 'finish',
  },
];

const COLS = 6;

function cellGridPosition(index: number): { row: number; col: number } {
  const row = Math.floor(index / COLS);
  const colInRow = index % COLS;
  const col = row % 2 === 0 ? colInRow : COLS - 1 - colInRow;
  return { row: row + 1, col: col + 1 };
}

const toneClasses: Record<BoardCell['tone'], string> = {
  start: 'from-emerald-600 to-emerald-800 border-emerald-900/40',
  step: 'from-sky-600 to-indigo-800 border-indigo-900/40',
  tool: 'from-amber-500 to-orange-700 border-amber-900/30',
  risk: 'from-stone-500 to-stone-700 border-stone-900/30',
  finish: 'from-fuchsia-600 to-violet-800 border-violet-900/40',
};

type Props = {
  userInitials: string;
  userDisplayName: string;
};

export function JornadaTabuleiro({ userInitials, userDisplayName }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [pawnIndex, setPawnIndex] = useState(0);

  const rows = Math.ceil(BOARD_CELLS.length / COLS);
  const openCell = openIndex != null ? BOARD_CELLS[openIndex] : null;

  const movePawnHere = useCallback((i: number) => {
    setPawnIndex(i);
    setOpenIndex(i);
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-gradient-to-b from-stone-200 via-stone-100 to-stone-200 px-3 py-4 md:px-6">
      <div className="mx-auto mb-4 max-w-4xl text-center">
        <h2 className="text-lg font-bold text-stone-800 md:text-xl">Jornada — Tabuleiro da vida Moní</h2>
        <p className="mt-1 text-sm text-stone-600">
          A peça <strong className="text-moni-primary">{userDisplayName}</strong> representa você no tabuleiro.
          Clique numa casa para ler mais e abrir links do Hub.
        </p>
      </div>

      <div
        className="mx-auto w-full max-w-5xl pb-8"
        style={{ perspective: '1600px', perspectiveOrigin: '50% 35%' }}
      >
        <div
          className="relative mx-auto origin-center transition-transform duration-500 ease-out"
          style={{
            transform: 'rotateX(58deg) rotateZ(-10deg)',
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Tabuleiro base (feltro) */}
          <div
            className="relative rounded-3xl border-4 border-emerald-900/50 bg-gradient-to-br from-emerald-900/90 via-emerald-800 to-teal-900 p-4 shadow-2xl md:p-6"
            style={{
              transform: 'translateZ(0)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.35), inset 0 2px 0 rgba(255,255,255,0.12)',
            }}
          >
            <div
              className="grid gap-2 md:gap-3"
              style={{
                gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${rows}, minmax(72px, 1fr))`,
              }}
            >
              {BOARD_CELLS.map((cell, i) => {
                const { row, col } = cellGridPosition(i);
                const isPawn = i === pawnIndex;
                return (
                  <button
                    key={cell.id}
                    type="button"
                    onClick={() => movePawnHere(i)}
                    className={`group relative flex flex-col items-center justify-center rounded-2xl border-2 bg-gradient-to-br p-2 text-center text-white shadow-md transition-all duration-200 hover:z-10 hover:scale-[1.03] hover:shadow-xl md:p-3 ${toneClasses[cell.tone]} ${
                      isPawn ? 'ring-4 ring-amber-300 ring-offset-2 ring-offset-emerald-950' : ''
                    }`}
                    style={{
                      gridRow: row,
                      gridColumn: col,
                      transform: 'translateZ(8px)',
                      transformStyle: 'preserve-3d',
                    }}
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-white/80 md:text-xs">
                      Casa {i + 1}
                    </span>
                    <span className="mt-0.5 text-xs font-bold leading-tight md:text-sm">{cell.title}</span>
                    <span className="mt-0.5 hidden text-[10px] text-white/85 sm:block">{cell.subtitle}</span>
                    {isPawn && (
                      <div
                        className="absolute -right-1 -top-2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-amber-200 bg-gradient-to-b from-amber-300 to-amber-500 text-xs font-bold text-amber-950 shadow-lg md:h-11 md:w-11 md:text-sm"
                        style={{ transform: 'translateZ(24px)' }}
                        title="Sua peça"
                        aria-hidden
                      >
                        {userInitials}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

          </div>

          <p className="mt-3 text-center text-[11px] text-stone-500 md:text-xs">
            Dica: use o scroll e a rotação visual como no tabuleiro 3D do Jogo da Vida — cada etapa é uma decisão na rede.
          </p>
        </div>
      </div>

      {openCell && openIndex != null && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="jornada-modal-title"
        >
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-stone-400">Casa {openIndex + 1}</p>
                <h3 id="jornada-modal-title" className="text-lg font-bold text-stone-900">
                  {openCell.title}
                </h3>
                <p className="text-sm text-moni-primary">{openCell.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpenIndex(null)}
                className="rounded-full p-1 text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-stone-600">{openCell.description}</p>
            <ul className="mt-4 space-y-2">
              {openCell.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="block rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-medium text-moni-primary hover:bg-moni-light/60"
                  >
                    {l.label} →
                  </Link>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setOpenIndex(null)}
              className="mt-5 w-full rounded-lg bg-moni-primary py-2.5 text-sm font-semibold text-white hover:opacity-95"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
