'use client';

/**
 * Painel de diagnóstico read-only — exibido no topo do "Painel da Unidade".
 * Mostra score, D/C/K, saúde da relação, indicador, perfil, prioridade e grupo.
 * Sem ícones/símbolos; sem campos de edição.
 */

import {
  calcEngajamento,
  calcRelacao,
  calcIndicador,
  calcPriority,
  calcGrupo,
  calcPerfil,
  engajamentoColor,
  engajamentoLabel,
  npsCategoria,
  GA_NOME,
  type DiagGrupo,
  type DiagPriority,
} from '@/lib/rede-diagnostico-engine';
import type { RedeDiagnosticoSource } from '@/lib/rede-diagnostico-form';

// ─── Helpers visuais ─────────────────────────────────────────────────────────

function Dot({ color }: { color: 'green' | 'amber' | 'red' | 'gray' }) {
  const cls = {
    green: 'bg-green-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    gray: 'bg-stone-300',
  }[color];
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${cls}`} />;
}

function dimDot(val: number | null | undefined): 'green' | 'amber' | 'red' | 'gray' {
  if (val === null || val === undefined) return 'gray';
  if (val === 2) return 'green';
  if (val === 1) return 'amber';
  return 'red';
}

const dimLabel = (val: number | null | undefined) =>
  val === null || val === undefined ? '—' : val === 2 ? 'Tem' : val === 1 ? 'Moderado' : 'Não tem';

const SCORE_COLOR: Record<string, string> = {
  green: 'text-green-600',
  lime: 'text-lime-600',
  amber: 'text-amber-600',
  red: 'text-red-600',
};

const P_STYLE: Record<DiagPriority, string> = {
  P1: 'bg-red-900 text-white',
  P2: 'bg-red-600 text-white',
  P3: 'bg-orange-600 text-white',
  P4: 'bg-amber-600 text-white',
  P5: 'bg-lime-600 text-white',
  P6: 'bg-sky-600 text-white',
  P7: 'bg-violet-600 text-white',
  AD: 'bg-stone-500 text-white',
  NC: 'bg-stone-700 text-white',
};

const GA_BADGE: Record<DiagGrupo, string> = {
  GA1: 'bg-red-100 text-red-800',
  GA2: 'bg-amber-100 text-amber-800',
  GA3: 'bg-pink-100 text-pink-800',
  GA4: 'bg-sky-100 text-sky-800',
  GA5: 'bg-green-100 text-green-800',
  GA6: 'bg-violet-100 text-violet-800',
  GA7: 'bg-stone-100 text-stone-600',
};

const REL_COLOR: Record<string, string> = {
  saudavel: 'text-green-700',
  atencao: 'text-amber-700',
  critica: 'text-red-700',
  'nao-aferida': 'text-stone-400',
};
const REL_LABEL: Record<string, string> = {
  saudavel: 'Saudável',
  atencao: 'Atenção',
  critica: 'Crítica',
  'nao-aferida': 'Não aferida',
};

const IND_LABEL: Record<string, string> = {
  ritmo: 'No ritmo',
  proximo: 'Próximo',
  regular: 'Regular',
  abaixo: 'Abaixo',
};
const IND_COLOR: Record<string, string> = {
  ritmo: 'text-green-700',
  proximo: 'text-amber-700',
  regular: 'text-blue-700',
  abaixo: 'text-red-700',
};

// ─── Bloco de seção ──────────────────────────────────────────────────────────

function Section({
  title,
  children,
  border = 'border-stone-200',
}: {
  title: string;
  children: React.ReactNode;
  border?: string;
}) {
  return (
    <div className={`rounded-xl border ${border} bg-white p-4`}>
      <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-stone-400">{title}</p>
      {children}
    </div>
  );
}

// ─── Barra de progresso ───────────────────────────────────────────────────────

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  const w = Math.min(100, Math.max(0, pct));
  return (
    <div className="h-1.5 w-full rounded-full bg-stone-100">
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${w}%` }} />
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

interface Props {
  row: RedeDiagnosticoSource;
  internalView?: boolean;
}

export function DiagnosticoPainelReadOnly({ row, internalView = true }: Props) {
  const engScore = calcEngajamento(row);
  const engColor = engScore !== null ? engajamentoColor(engScore) : null;
  const rel = calcRelacao(row);
  const ind = calcIndicador(row);
  const prio = calcPriority(row);
  const grupo = calcGrupo(row);
  const grupoSec = row.diag_grupo_sec as DiagGrupo | null | undefined;
  const perfil = calcPerfil(row, internalView);
  const perfilExt = calcPerfil(row, false);

  const meta = Number(row.diag_ano_meta ?? 4);
  const contratos = Number(row.diag_contratos_12m ?? 0);
  const pct = meta > 0 ? Math.round((contratos / meta) * 100) : 0;
  const indBarColor = pct >= 100 ? 'bg-green-500' : pct >= 75 ? 'bg-amber-400' : pct >= 50 ? 'bg-blue-400' : 'bg-red-400';

  const nps = row.diag_nps !== null && row.diag_nps !== undefined ? Number(row.diag_nps) : null;
  const csat = row.diag_csat !== null && row.diag_csat !== undefined ? Number(row.diag_csat) : null;
  const npsCat = npsCategoria(nps);
  const npsDot = npsCat === 'promotor' ? 'green' : npsCat === 'neutro' ? 'amber' : npsCat === 'detrator' ? 'red' : 'gray';
  const csatDot = csat === null ? 'gray' : csat >= 4 ? 'green' : csat >= 3 ? 'amber' : 'red';
  const csatLabel = csat === null ? '—' : csat >= 4.5 ? 'Ótimo' : csat >= 4 ? 'Bom' : csat >= 3 ? 'Atenção' : 'Crítico';

  const hasData =
    row.diag_d !== null || row.diag_c !== null || row.diag_k !== null ||
    row.diag_nps !== null || row.diag_csat !== null || row.diag_contratos_12m !== null;

  if (!hasData) {
    return (
      <div className="mb-6 rounded-xl border border-dashed border-stone-200 p-4 text-sm text-stone-400">
        Diagnóstico ainda não aferido para esta unidade.
      </div>
    );
  }

  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">

      {/* ENGAJAMENTO */}
      <Section title="Engajamento" border="border-green-200/80">
        {engScore !== null && engColor ? (
          <div className="mb-3 flex items-baseline gap-1.5">
            <span className={`text-3xl font-extrabold leading-none ${SCORE_COLOR[engColor]}`}>
              {engScore}%
            </span>
            <span className={`text-xs font-medium ${SCORE_COLOR[engColor]} opacity-80`}>
              {engajamentoLabel(engScore, internalView)}
            </span>
          </div>
        ) : (
          <p className="mb-3 text-sm text-stone-400">Não calculado</p>
        )}
        <div className="space-y-2">
          {([
            ['D', 'Dinheiro', row.diag_d, row.diag_d_desc],
            ['C', 'Comportamento', row.diag_c, row.diag_c_desc],
            ['K', 'Conhecimento', row.diag_k, row.diag_k_desc],
          ] as const).map(([key, name, val, desc]) => (
            <div key={key} className="flex items-start gap-2">
              <Dot color={dimDot(val)} />
              <div className="min-w-0 flex-1">
                <span className="text-xs font-semibold text-stone-700">
                  {key} · {name}
                </span>
                <span className="ml-1.5 text-[10px] text-stone-400">{dimLabel(val)}</span>
                {desc ? (
                  <p className="mt-0.5 truncate text-[10px] italic text-stone-400">{desc}</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* SAÚDE DA RELAÇÃO */}
      <Section title="Saúde da Relação" border="border-rose-200/80">
        <p className={`mb-3 text-base font-bold ${REL_COLOR[rel]}`}>{REL_LABEL[rel]}</p>
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <Dot color={npsDot} />
            <span className="text-xs text-stone-600">NPS (relação geral)</span>
            <span className="ml-auto text-sm font-semibold text-stone-800">
              {nps !== null ? nps : '—'}
            </span>
            {npsCat ? (
              <span className="text-[10px] text-stone-400">{npsCat === 'promotor' ? 'Promotor' : npsCat === 'neutro' ? 'Neutro' : 'Detrator'}</span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Dot color={csatDot} />
            <span className="text-xs text-stone-600">CSAT (experiências)</span>
            <span className="ml-auto text-sm font-semibold text-stone-800">
              {csat !== null ? csat.toFixed(1).replace('.', ',') : '—'}
            </span>
            <span className="text-[10px] text-stone-400">{csatLabel}</span>
          </div>
        </div>
        {row.diag_tend_rel ? (
          <p className="mt-3 text-[10px] text-stone-400">
            Tendência: <span className="font-semibold">{row.diag_tend_rel}</span>
          </p>
        ) : null}
      </Section>

      {/* INDICADOR */}
      <Section title="Indicador" border="border-blue-200/80">
        <div className="mb-3 flex items-baseline gap-1.5">
          <span className={`text-2xl font-extrabold leading-none ${ind ? IND_COLOR[ind] : 'text-stone-400'}`}>
            {contratos}/{meta}
          </span>
          <span className="text-xs text-stone-400">{pct}% da meta</span>
        </div>
        <div className="space-y-2">
          <div>
            <div className="mb-1 flex justify-between text-[10px] text-stone-500">
              <span>Contratos assinados</span>
              <span>{contratos}/{meta}</span>
            </div>
            <ProgressBar pct={pct} color={indBarColor} />
          </div>
        </div>
        {ind ? (
          <p className={`mt-3 text-xs font-semibold ${IND_COLOR[ind]}`}>{IND_LABEL[ind]}</p>
        ) : null}
        {row.diag_tend_ind ? (
          <p className="mt-1 text-[10px] text-stone-400">
            Tendência: <span className="font-semibold">{row.diag_tend_ind}</span>
          </p>
        ) : null}
      </Section>

      {/* PERFIL */}
      <Section title="Perfil" border="border-stone-200">
        <div className="space-y-3">
          {internalView ? (
            <div>
              <p className="text-[10px] text-stone-400">Interno/Externo</p>
              <button
                type="button"
                className="mt-0.5 text-[10px] text-stone-400 underline decoration-dotted"
                title="Alterna entre visão interna e externa"
              >
                ⓘ
              </button>
            </div>
          ) : null}
          <div>
            <p className="text-[10px] text-stone-400">Interno</p>
            <p className="text-sm font-semibold text-stone-800">{calcPerfil(row, true)}</p>
          </div>
          <div>
            <p className="text-[10px] text-stone-400">Externo</p>
            <p className="text-sm font-semibold text-stone-700">{perfilExt}</p>
          </div>
        </div>
        {row.diag_proxima_acao ? (
          <div className="mt-3 border-t border-stone-100 pt-2">
            <p className="text-[10px] text-stone-400">Próxima ação</p>
            <p className="mt-0.5 text-xs text-stone-700">{row.diag_proxima_acao}</p>
          </div>
        ) : null}
      </Section>

      {/* PRIORIDADE + GRUPO */}
      <Section title="Prioridade e Grupo" border="border-stone-200">
        <div className="mb-3">
          <p className="text-[10px] text-stone-400">Prioridade</p>
          <div className="mt-1 flex items-center gap-2">
            <span className={`rounded px-2 py-0.5 text-sm font-bold ${P_STYLE[prio]}`}>{prio}</span>
            <span className="text-xs text-stone-600">{perfil}</span>
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-[10px] text-stone-400">Grupo de Ação</p>
          {grupo ? (
            <div>
              <span className="text-[9px] text-stone-400">Principal</span>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className={`rounded px-1.5 py-px text-[10px] font-bold ${GA_BADGE[grupo]}`}>{grupo}</span>
                <span className="text-xs text-stone-700">{GA_NOME[grupo]}</span>
              </div>
            </div>
          ) : null}
          {grupoSec && GA_NOME[grupoSec] ? (
            <div className="pt-1">
              <span className="text-[9px] text-stone-400">Secundário</span>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className={`rounded px-1.5 py-px text-[10px] font-bold ${GA_BADGE[grupoSec]}`}>{grupoSec}</span>
                <span className="text-xs text-stone-500">{GA_NOME[grupoSec]}</span>
              </div>
            </div>
          ) : null}
        </div>
        {row.diag_ultima_aval ? (
          <p className="mt-3 text-[10px] text-stone-400">
            Últ. avaliação: {new Date(row.diag_ultima_aval).toLocaleDateString('pt-BR')}
            {row.diag_avaliado_por ? ` · ${row.diag_avaliado_por}` : ''}
          </p>
        ) : null}
      </Section>
    </div>
  );
}
