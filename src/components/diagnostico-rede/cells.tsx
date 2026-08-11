'use client';

/**
 * Células de diagnóstico — renderizam os campos diag_* do RedeFranqueadoRowDb.
 * Usadas em TabelaRedeFranqueadosEditavel como colunas read-only à direita.
 */

import {
  npsCategoria,
  engajamentoColor,
  engajamentoLabel,
  calcIndicador,
  calcGrupo,
  GA_NOME,
  calcPriority,
  calcPerfil,
  type DiagGrupo,
  type DiagPriority,
} from '@/lib/rede-diagnostico-engine';
import type { RedeDiagnosticoSource } from '@/lib/rede-diagnostico-form';
import type { RedeFranqueadoRowDb } from '@/lib/rede-franqueados';

type DiagRow = RedeDiagnosticoSource | RedeFranqueadoRowDb;

// ─── Dot ────────────────────────────────────────────────────────────────────

function Dot({ cls }: { cls: string }) {
  const colorMap: Record<string, string> = {
    'dot-3': 'bg-green-500',
    'dot-2': 'bg-amber-500',
    'dot-0': 'bg-red-500',
    'dot-na': 'bg-stone-300',
  };
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${colorMap[cls] ?? 'bg-stone-300'}`}
    />
  );
}

const NA = <span className="text-stone-300">—</span>;

// ─── DimCell (D / C / K) ─────────────────────────────────────────────────────

export function DimCell({
  val,
  desc,
}: {
  val: number | null | undefined;
  desc?: string | null;
}) {
  if (val === null || val === undefined) return NA;
  const dotCls = val === 3 ? 'dot-3' : val === 2 ? 'dot-2' : 'dot-0';
  return (
    <div className="flex items-center gap-1 font-semibold">
      <Dot cls={dotCls} />
      <span>{val}</span>
      {desc ? <span className="text-[10px] font-normal text-stone-400">{desc}</span> : null}
    </div>
  );
}

// ─── NpsCell ─────────────────────────────────────────────────────────────────

const NPS_LABEL: Record<string, string> = {
  promotor: 'Promotor',
  neutro: 'Neutro',
  detrator: 'Detrator',
};

export function NpsCell({ nps }: { nps: number | null | undefined }) {
  const v = nps !== null && nps !== undefined ? Number(nps) : null;
  if (v === null) return NA;
  const cat = npsCategoria(v)!;
  const dotCls = cat === 'promotor' ? 'dot-3' : cat === 'neutro' ? 'dot-2' : 'dot-0';
  return (
    <div className="flex items-center gap-1 font-semibold">
      <Dot cls={dotCls} />
      <span>{v}</span>
      <span className="text-[10px] font-normal text-stone-400">{NPS_LABEL[cat]}</span>
    </div>
  );
}

// ─── CsatCell ────────────────────────────────────────────────────────────────

export function CsatCell({ csat }: { csat: number | null | undefined }) {
  const v = csat !== null && csat !== undefined ? Number(csat) : null;
  if (v === null) return NA;
  const dotCls = v >= 4 ? 'dot-3' : v >= 3 ? 'dot-2' : 'dot-0';
  const label = v >= 4.5 ? 'Ótimo' : v >= 4 ? 'Bom' : v >= 3 ? 'Atenção' : 'Crítico';
  return (
    <div className="flex items-center gap-1 font-semibold">
      <Dot cls={dotCls} />
      <span>{v.toFixed(1).replace('.', ',')}</span>
      <span className="text-[10px] font-normal text-stone-400">{label}</span>
    </div>
  );
}

// ─── AdimplenciaCell ─────────────────────────────────────────────────────────

export function AdimplenciaCell({ adimplente }: { adimplente: boolean | null | undefined }) {
  if (adimplente === null || adimplente === undefined) return NA;
  if (adimplente === true) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-[color:var(--moni-green-50,#eef4f0)] px-1.5 py-0.5 text-xs font-semibold text-[color:var(--moni-green-800,#2F4A3A)]">
        OK
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 text-xs font-semibold text-red-700">
      Inad.
    </span>
  );
}

// ─── ScoreCell ───────────────────────────────────────────────────────────────

const SCORE_TEXT: Record<string, string> = {
  green: 'text-green-600',
  lime: 'text-lime-600',
  amber: 'text-amber-600',
  red: 'text-red-600',
};

const SCORE_BADGE: Record<string, string> = {
  green: 'bg-green-100 text-green-700',
  lime: 'bg-lime-100 text-lime-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
};

export function ScoreCell({
  score,
  internalView,
}: {
  score: number | null;
  internalView: boolean;
}) {
  if (score === null) return NA;
  const color = engajamentoColor(score);
  const label = engajamentoLabel(score, internalView);
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`text-sm font-extrabold leading-none ${SCORE_TEXT[color]}`}>{score}%</span>
      <span className={`inline-block rounded-full px-1.5 py-px text-[9px] font-semibold ${SCORE_BADGE[color]}`}>
        {label}
      </span>
    </div>
  );
}

// ─── IndCell ─────────────────────────────────────────────────────────────────

const IND_STYLE: Record<string, string> = {
  ritmo: 'bg-green-100 text-green-700',
  proximo: 'bg-amber-100 text-amber-700',
  regular: 'bg-blue-100 text-blue-700',
  abaixo: 'bg-red-100 text-red-700',
};
const IND_LABEL: Record<string, string> = {
  ritmo: 'No ritmo',
  proximo: 'Próximo',
  regular: 'Regular',
  abaixo: 'Abaixo',
};

export function IndCell({ row }: { row: DiagRow }) {
  const ind = calcIndicador(row);
  if (ind === null) return NA;
  const contratos = Number(row.diag_contratos_12m ?? 0);
  const meta = Number(row.diag_ano_meta ?? 4);
  return (
    <div className="flex items-center gap-1.5 font-semibold">
      <span>
        {contratos}/{meta}
      </span>
      <span className={`rounded-full px-1.5 py-px text-[9px] font-semibold ${IND_STYLE[ind]}`}>
        {IND_LABEL[ind]}
      </span>
    </div>
  );
}

// ─── GrupoCell ───────────────────────────────────────────────────────────────

const GA_BADGE_STYLE: Record<DiagGrupo, string> = {
  GA1: 'bg-red-100 text-red-800',
  GA2: 'bg-amber-100 text-amber-800',
  GA3: 'bg-pink-100 text-pink-800',
  GA4: 'bg-sky-100 text-sky-800',
  GA5: 'bg-green-100 text-green-800',
  GA6: 'bg-violet-100 text-violet-800',
  GA7: 'bg-stone-100 text-stone-600',
};

export function GrupoCell({ row }: { row: DiagRow }) {
  const g = calcGrupo(row);
  if (!g) return NA;
  const sec = row.diag_grupo_sec as DiagGrupo | null | undefined;
  return (
    <div className="flex min-w-[130px] flex-col gap-0.5">
      <div>
        <span className={`inline-block rounded px-1.5 py-px text-[10px] font-bold ${GA_BADGE_STYLE[g]}`}>
          {g}
        </span>
        <div className="mt-px text-[9.5px] text-stone-600">{GA_NOME[g]}</div>
      </div>
      {sec && GA_NOME[sec] ? (
        <div className="flex items-center gap-1 border-t border-stone-100 pt-0.5">
          <span className={`rounded px-1 py-px text-[8.5px] font-bold ${GA_BADGE_STYLE[sec]}`}>
            {sec}
          </span>
          <span className="text-[8.5px] text-stone-400">{GA_NOME[sec]}</span>
        </div>
      ) : null}
    </div>
  );
}

// ─── PriorityBadge ───────────────────────────────────────────────────────────

const P_STYLE: Record<DiagPriority, string> = {
  P1: 'bg-red-900',
  P2: 'bg-red-600',
  P3: 'bg-orange-600',
  P4: 'bg-amber-600',
  P5: 'bg-lime-600',
  P6: 'bg-sky-600',
  P7: 'bg-violet-600',
  AD: 'bg-stone-500',
  NC: 'bg-stone-700',
};

export function PriorityBadge({ row }: { row: DiagRow }) {
  const p = calcPriority(row);
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-bold text-white ${P_STYLE[p]}`}>
      {p}
    </span>
  );
}

// ─── PerfilCell ──────────────────────────────────────────────────────────────

export function PerfilCell({
  row,
  internalView,
}: {
  row: DiagRow;
  internalView: boolean;
}) {
  const label = calcPerfil(row, internalView);
  return (
    <span className="block max-w-[140px] whitespace-normal text-[11px] leading-tight text-stone-700">
      {label}
    </span>
  );
}

// ─── TendCell ────────────────────────────────────────────────────────────────

function TendArrow({
  val,
  label,
}: {
  val: '↑' | '→' | '↓' | null | undefined;
  label: string;
}) {
  const color = !val
    ? 'text-stone-200'
    : val === '↑'
      ? 'text-green-600'
      : val === '↓'
        ? 'text-red-600'
        : 'text-stone-300';
  return (
    <div className="flex flex-col items-center gap-0">
      <span className={`text-[13px] font-extrabold leading-tight ${color}`}>{val ?? '—'}</span>
      <span className="text-[7.5px] font-medium text-stone-400">{label}</span>
    </div>
  );
}

export function TendCell({ row }: { row: DiagRow }) {
  return (
    <div className="flex gap-1.5">
      <TendArrow val={row.diag_tend_eng} label="Engaj." />
      <TendArrow val={row.diag_tend_rel} label="Rel." />
      <TendArrow val={row.diag_tend_ind} label="Ind." />
    </div>
  );
}

// ─── PmaCell (Próxima melhor ação) ───────────────────────────────────────────

export function PmaCell({ text }: { text: string | null | undefined }) {
  if (!text) return NA;
  return (
    <p className="max-w-[200px] whitespace-normal text-[11px] leading-snug text-stone-700">{text}</p>
  );
}
