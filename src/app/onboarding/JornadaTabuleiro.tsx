'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { X } from 'lucide-react';

export type BoardLink = { href: string; label: string };

export type BoardNode = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  links: BoardLink[];
  /** Posição no mapa (0–100), sistema de coordenadas do SVG viewBox */
  x: number;
  y: number;
  /** Etiqueta opcional estilo “pill” do fluxo */
  pill?: string;
};

/** Ramos da jornada (diagramação não linear, tipo mapa / fluxograma). */
const BOARD_NODES: BoardNode[] = [
  {
    id: 'partida',
    title: 'Partida',
    subtitle: 'Início da jornada',
    description:
      'Ponto de partida do franqueado na Moní. Daqui a jornada ramifica para mapeamento, hipótese e, em paralelo, para temas de produto e mercado.',
    links: [{ href: '/onboarding/introducao', label: 'Voltar à Introdução' }],
    x: 10,
    y: 48,
    pill: 'Kick-off',
  },
  {
    id: 's1',
    title: 'Step 1',
    subtitle: 'Perímetro & mapeamento',
    description: 'Mapeamento da região, praça e condomínios — base para todas as decisões seguintes.',
    links: [
      { href: '/step-one', label: 'Step 1 no Hub' },
      { href: '/funil-stepone', label: 'Funil Step One' },
    ],
    x: 26,
    y: 22,
  },
  {
    id: 's2',
    title: 'Step 2',
    subtitle: 'Hipótese de negócio',
    description: 'Hipótese e estudo de viabilidade; daqui pode avançar para negociação ou aprofundar produto (BCA).',
    links: [
      { href: '/step-2', label: 'Step 2 no Hub' },
      { href: '/dashboard-novos-negocios', label: 'Dashboard Novos Negócios' },
    ],
    x: 42,
    y: 40,
  },
  {
    id: 'bca',
    title: 'BCA & batalha',
    subtitle: 'Ramo paralelo',
    description: 'Comparativo de casas, batalha de mercado e preparação do BCA — pode correr em paralelo à esteira.',
    links: [
      { href: '/onboarding/bca-guia', label: 'Guia BCA' },
      { href: '/onboarding/batalha-casas', label: 'Batalha de Casas' },
      { href: '/portfolio', label: 'Funil Portfolio' },
    ],
    x: 30,
    y: 62,
    pill: 'Paralelo',
  },
  {
    id: 's3',
    title: 'Step 3',
    subtitle: 'Negociação',
    description: 'Opção e negociação com partes até fecho do caminho aprovado.',
    links: [{ href: '/step-3', label: 'Step 3 no Hub' }],
    x: 58,
    y: 24,
  },
  {
    id: 's4-8',
    title: 'Steps 4–8',
    subtitle: 'Legal · crédito · comitê',
    description: 'Check legal, crédito, acoplamento, comitê, diligência e contrato.',
    links: [
      { href: '/painel', label: 'Check Legal + Crédito' },
      { href: '/acoplamento-pl', label: 'Acoplamento' },
      { href: '/step-5', label: 'Step 5 — Comitê' },
      { href: '/step-6', label: 'Step 6 — Diligência' },
      { href: '/step-7', label: 'Step 7 — Contrato' },
    ],
    x: 72,
    y: 44,
  },
  {
    id: 'ops',
    title: 'Operação',
    subtitle: 'Drive & rotina',
    description: 'Materiais, pastas e rotina operacional após a fase de viabilidade.',
    links: [
      { href: '/onboarding/pastas-drive', label: 'Pastas do Drive' },
      { href: '/onboarding/licao-de-casa', label: 'Lição de Casa' },
      { href: '/operacoes', label: 'Funil Operações' },
    ],
    x: 56,
    y: 68,
  },
  {
    id: 'preobra',
    title: 'Pré-obra',
    subtitle: 'Em breve',
    description: 'Próxima etapa do mapa — acompanhe comunicados Moní.',
    links: [{ href: '/onboarding/pre-obra', label: 'Secção Pré-obra' }],
    x: 38,
    y: 78,
  },
  {
    id: 'meta',
    title: 'Conquista',
    subtitle: 'Unidade madura',
    description: 'Unidade alinhada à rede, com processos e ferramentas consolidados.',
    links: [{ href: '/dashboard-novos-negocios', label: 'Dashboard' }],
    x: 84,
    y: 58,
    pill: 'Meta',
  },
];

type Edge = { from: string; to: string; dashed?: boolean };

const BOARD_EDGES: Edge[] = [
  { from: 'partida', to: 's1' },
  { from: 's1', to: 's2' },
  { from: 's2', to: 's3' },
  { from: 's2', to: 'bca' },
  { from: 's3', to: 's4-8' },
  { from: 'bca', to: 's4-8', dashed: true },
  { from: 's4-8', to: 'ops' },
  { from: 's4-8', to: 'meta', dashed: true },
  { from: 'ops', to: 'preobra' },
  { from: 'preobra', to: 'meta' },
  { from: 'bca', to: 'ops', dashed: true },
];

const VB = { w: 100, h: 100 };

function nodeById(id: string): BoardNode | undefined {
  return BOARD_NODES.find((n) => n.id === id);
}

type Props = {
  userInitials: string;
  userDisplayName: string;
};

export function JornadaTabuleiro({ userInitials, userDisplayName }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [pawnId, setPawnId] = useState<string>('partida');

  const openNode = openId ? nodeById(openId) : null;

  const movePawnHere = useCallback((id: string) => {
    setPawnId(id);
    setOpenId(id);
  }, []);

  const edgesPaths = useMemo(() => {
    const lines: { d: string; dashed?: boolean; key: string }[] = [];
    for (const e of BOARD_EDGES) {
      const a = nodeById(e.from);
      const b = nodeById(e.to);
      if (!a || !b) continue;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const perp = 6 * Math.sign(dx || 1);
      const cx = mx + (Math.abs(dy) > Math.abs(dx) ? perp : 0);
      const cy = my + (Math.abs(dx) >= Math.abs(dy) ? perp * 0.5 : -perp * 0.5);
      const d = `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
      lines.push({ d, dashed: e.dashed, key: `${e.from}-${e.to}` });
    }
    return lines;
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#e8f5f0]">
      <div className="shrink-0 border-b border-emerald-200/60 bg-[#ecfdf5] px-4 py-3 md:px-6">
        <h2 className="text-lg font-bold text-moni-primary md:text-xl">Jornada do franqueado</h2>
        <p className="mt-1 text-sm text-emerald-900/75">
          Mapa interativo — <strong className="text-emerald-950">{userDisplayName}</strong> ({userInitials}).
          Clique num cartão para detalhes e links. Ramos tracejados indicam fluxos paralelos ou atalhos.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto min-h-[620px] w-[min(100%,1100px)] p-4 pb-16 md:min-h-[700px] md:p-6">
          <div
            className="relative rounded-2xl border border-emerald-200/80 bg-[#f0fdf9] shadow-[0_12px_40px_rgba(6,78,59,0.12)]"
            style={{ aspectRatio: `${VB.w} / ${VB.h}`, minHeight: 520 }}
          >
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full text-emerald-900"
              viewBox={`0 0 ${VB.w} ${VB.h}`}
              preserveAspectRatio="xMidYMid meet"
              aria-hidden
            >
              <defs>
                <marker
                  id="jornada-arrow"
                  markerWidth="5"
                  markerHeight="5"
                  refX="4.2"
                  refY="2.5"
                  orient="auto"
                >
                  <path d="M0,0 L0,5 L5,2.5 z" className="fill-emerald-800" />
                </marker>
              </defs>
              {edgesPaths.map((line) => (
                <path
                  key={line.key}
                  d={line.d}
                  fill="none"
                  className="stroke-emerald-800"
                  strokeWidth={0.55}
                  strokeLinecap="round"
                  strokeDasharray={line.dashed ? '1.8 1.2' : undefined}
                  markerEnd="url(#jornada-arrow)"
                  opacity={line.dashed ? 0.55 : 0.85}
                />
              ))}
            </svg>

            {BOARD_NODES.map((node) => {
              const isPawn = node.id === pawnId;
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => movePawnHere(node.id)}
                  className={`absolute z-10 w-[min(42vw,200px)] max-w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-stone-200/90 bg-white text-left shadow-[0_10px_28px_rgba(15,23,42,0.14)] outline-none transition hover:z-20 hover:shadow-[0_16px_36px_rgba(15,23,42,0.18)] focus-visible:ring-2 focus-visible:ring-moni-primary md:w-[220px] ${
                    isPawn ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-[#f0fdf9]' : ''
                  }`}
                  style={{ left: `${node.x}%`, top: `${node.y}%` }}
                >
                  <div className="flex items-center justify-between gap-1 rounded-t-xl bg-moni-primary px-2.5 py-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-white/95">
                      {node.title}
                    </span>
                    {node.pill && (
                      <span className="shrink-0 rounded-full bg-white/20 px-1.5 py-0.5 text-[9px] font-medium text-white">
                        {node.pill}
                      </span>
                    )}
                  </div>
                  <div className="px-2.5 py-2">
                    <p className="text-[11px] font-medium text-stone-700">{node.subtitle}</p>
                    <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-stone-500">Toque para ver mais</p>
                  </div>
                  {isPawn && (
                    <div
                      className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-amber-200 bg-gradient-to-b from-amber-200 to-amber-400 text-[11px] font-bold text-amber-950 shadow-md"
                      title="Sua posição"
                    >
                      {userInitials}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {openNode && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="jornada-modal-title"
        >
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-emerald-800/80">{openNode.subtitle}</p>
                <h3 id="jornada-modal-title" className="text-lg font-bold text-stone-900">
                  {openNode.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOpenId(null)}
                className="rounded-full p-1 text-stone-500 hover:bg-stone-100"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-stone-600">{openNode.description}</p>
            <ul className="mt-4 space-y-2">
              {openNode.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="block rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-medium text-moni-primary hover:bg-moni-light/50"
                  >
                    {l.label} →
                  </Link>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setOpenId(null)}
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
