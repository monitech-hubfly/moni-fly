'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { TabelaRedeLoteadoresEditavel } from '@/components/TabelaRedeLoteadoresEditavel';
import { RedeTabelaToolbarBusca } from '@/app/rede-franqueados/RedeTabelaToolbarBusca';
import {
  ordenarRedeLoteadoresPorCodigo,
  filtrarLinhasEmBrancoRedeLoteadores,
  redeLoteadorRowMatchesBusca,
  type RedeLoteadorRow,
} from '@/lib/rede-loteadores';
import {
  calcLoteadorPriority,
  calcLoteadorRelacao,
  calcLoteadorGrupo,
  isLoteadorAdormecido,
  isLoteadorNC,
  LOTEADOR_GA_NOME,
  type LoteadorDiagPriority,
  type LoteadorDiagGrupo,
} from '@/lib/loteador-diagnostico-engine';

// ─── Filtros ─────────────────────────────────────────────────────────────────

const TODOS = 'TODOS' as const;

type Filtros = {
  status: 'ativo' | 'inativo' | 'em_analise' | 'adormecido' | typeof TODOS;
  uf: string;
  prioridade: LoteadorDiagPriority | typeof TODOS;
  dimD: '2' | '1' | '0' | 'na' | typeof TODOS;
  relacao: 'saudavel' | 'atencao' | 'critica' | 'nao-aferida' | typeof TODOS;
  grupo: LoteadorDiagGrupo | typeof TODOS;
  avaliadoEm: '30' | '60' | '90' | 'sem' | typeof TODOS;
};

const FILTROS_INICIAIS: Filtros = {
  status: TODOS,
  uf: TODOS,
  prioridade: TODOS,
  dimD: TODOS,
  relacao: TODOS,
  grupo: TODOS,
  avaliadoEm: TODOS,
};

function filtrosAtivos(f: Filtros): number {
  return Object.values(f).filter((v) => v !== TODOS).length;
}

function aplicarFiltros(rows: RedeLoteadorRow[], f: Filtros): RedeLoteadorRow[] {
  return rows.filter((r) => {
    // Status
    if (f.status !== TODOS) {
      const adorm = isLoteadorAdormecido(r);
      const nc = isLoteadorNC(r);
      if (f.status === 'adormecido' && !adorm) return false;
      if (f.status === 'inativo' && (!nc || adorm)) return false;
      if (f.status === 'ativo' && (nc || adorm || r.status !== 'ativo')) return false;
      if (f.status === 'em_analise' && r.status !== 'em_analise') return false;
    }
    // UF
    if (f.uf !== TODOS) {
      const estado = String(r.estado ?? r.condominio_estado ?? '');
      if (estado !== f.uf) return false;
    }
    // Prioridade
    if (f.prioridade !== TODOS && calcLoteadorPriority(r) !== f.prioridade) return false;
    // D
    if (f.dimD !== TODOS) {
      const v = r.diag_d;
      if (f.dimD === 'na' && v !== null && v !== undefined) return false;
      if (f.dimD !== 'na' && (v === null || v === undefined || String(v) !== f.dimD)) return false;
    }
    // Relação
    if (f.relacao !== TODOS && calcLoteadorRelacao(r) !== f.relacao) return false;
    // Grupo
    if (f.grupo !== TODOS && calcLoteadorGrupo(r) !== f.grupo) return false;
    // Avaliado em
    if (f.avaliadoEm !== TODOS) {
      const aval = r.diag_ultima_aval ? new Date(r.diag_ultima_aval) : null;
      if (f.avaliadoEm === 'sem' && aval !== null) return false;
      if (f.avaliadoEm !== 'sem') {
        if (!aval) return false;
        const dias = (Date.now() - aval.getTime()) / 86_400_000;
        if (dias > Number(f.avaliadoEm)) return false;
      }
    }
    return true;
  });
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

const selectCls =
  'rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs text-stone-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-stone-400 min-w-[120px]';

function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  const isActive = value !== TODOS;
  return (
    <label className="flex flex-col gap-0.5">
      <span className={`text-[9px] font-semibold uppercase tracking-wide ${isActive ? 'text-stone-700' : 'text-stone-400'}`}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={`${selectCls} ${isActive ? 'border-stone-400 font-semibold' : ''}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

// ─── Sumário ─────────────────────────────────────────────────────────────────

function Sumario({ rows }: { rows: RedeLoteadorRow[] }) {
  const ativos = rows.filter((r) => !isLoteadorNC(r) && !isLoteadorAdormecido(r));
  const adorm = rows.filter((r) => isLoteadorAdormecido(r)).length;
  const inativos = rows.filter((r) => isLoteadorNC(r)).length;

  const prios = ativos.reduce<Record<string, number>>((acc, r) => {
    const p = calcLoteadorPriority(r);
    acc[p] = (acc[p] ?? 0) + 1;
    return acc;
  }, {});

  const semD = ativos.filter((r) => r.diag_d === null || r.diag_d === undefined).length;
  const d0 = ativos.filter((r) => r.diag_d === 0).length;
  const d1 = ativos.filter((r) => r.diag_d === 1).length;
  const d2 = ativos.filter((r) => r.diag_d === 2).length;

  const npsRows = ativos.filter((r) => r.diag_nps !== null && r.diag_nps !== undefined);
  const avgNps = npsRows.length > 0
    ? (npsRows.reduce((a, r) => a + Number(r.diag_nps), 0) / npsRows.length).toFixed(1)
    : null;

  const card = 'rounded-xl border border-stone-200 bg-white p-3 shadow-sm';
  const kv = (label: string, value: string | number, cls = 'text-stone-700') => (
    <div className="flex items-baseline gap-1">
      <span className={`text-base font-extrabold tabular-nums ${cls}`}>{value}</span>
      <span className="text-[10px] text-stone-400">{label}</span>
    </div>
  );

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className={card}>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400">Visão Geral</div>
        {kv('ativos', ativos.length, 'text-stone-800')}
        {kv('adormecidos', adorm, 'text-blue-600')}
        {kv('inativos', inativos, 'text-stone-400')}
      </div>

      <div className={card}>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400">Capital (D)</div>
        {kv('Sem capital', d0, 'text-red-600')}
        {kv('Moderado', d1, 'text-amber-600')}
        {kv('Tem capital', d2, 'text-green-600')}
        {semD > 0 && kv('não aferido', semD, 'text-stone-300')}
      </div>

      <div className={card}>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400">NPS médio</div>
        {avgNps !== null ? (
          <>
            {kv('NPS', avgNps, Number(avgNps) >= 8 ? 'text-green-600' : Number(avgNps) >= 5 ? 'text-amber-600' : 'text-red-600')}
            <div className="text-[10px] text-stone-400">{npsRows.length} avaliados de {ativos.length}</div>
          </>
        ) : (
          <span className="text-sm text-stone-300">Sem dados</span>
        )}
        {(prios['P1'] ?? 0) > 0 && (
          <div className="mt-1 text-[10px] font-semibold text-red-700">{prios['P1']} com P1 (crítico)</div>
        )}
      </div>

      <div className={card}>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400">Prioridades</div>
        {(['P1','P2','P3','P4'] as const).map((p) =>
          (prios[p] ?? 0) > 0 ? (
            <div key={p} className="flex items-center gap-1 text-[11px]">
              <span className="font-bold text-stone-600">{p}</span>
              <span className="text-stone-400">{prios[p]}</span>
            </div>
          ) : null
        )}
        {(['P5','P6','P7'] as const).map((p) =>
          (prios[p] ?? 0) > 0 ? (
            <div key={p} className="flex items-center gap-1 text-[11px]">
              <span className="font-semibold text-stone-400">{p}</span>
              <span className="text-stone-300">{prios[p]}</span>
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

type Props = {
  rows: RedeLoteadorRow[];
  children?: ReactNode;
  solicitarCriacao?: number;
};

export function RedeLoteadoresTabelaComBusca({ rows, children, solicitarCriacao = 0 }: Props) {
  const [busca, setBusca] = useState('');
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIAIS);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  const rowsComCadastro = useMemo(() => filtrarLinhasEmBrancoRedeLoteadores(rows), [rows]);

  // UFs disponíveis
  const ufs = useMemo(() => {
    const set = new Set<string>();
    rowsComCadastro.forEach((r) => {
      const u = r.estado ?? r.condominio_estado;
      if (u) set.add(u);
    });
    return [...set].sort();
  }, [rowsComCadastro]);

  const rowsFiltradas = useMemo(() => {
    const q = busca.trim();
    let base = q ? rowsComCadastro.filter((r) => redeLoteadorRowMatchesBusca(r, q)) : rowsComCadastro;
    base = aplicarFiltros(base, filtros);
    return ordenarRedeLoteadoresPorCodigo(base);
  }, [rowsComCadastro, busca, filtros]);

  const nAtivos = filtrosAtivos(filtros);
  const limpar = () => { setFiltros(FILTROS_INICIAIS); setBusca(''); };

  return (
    <div className="space-y-4">
      <Sumario rows={rowsComCadastro} />

      <RedeTabelaToolbarBusca
        value={busca}
        onChange={setBusca}
        placeholder="Pesquisar loteadores…"
        ariaLabel="Pesquisar loteadores"
      >
        <button
          type="button"
          onClick={() => setFiltrosAbertos((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium shadow-sm transition ${
            filtrosAbertos || nAtivos > 0
              ? 'border-stone-400 bg-stone-100 text-stone-800'
              : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filtros
          {nAtivos > 0 && (
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-stone-700 text-[9px] font-bold text-white">
              {nAtivos}
            </span>
          )}
        </button>
        {nAtivos > 0 && (
          <button
            type="button"
            onClick={limpar}
            className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-xs text-stone-500 hover:bg-stone-50"
          >
            <X className="h-3 w-3" /> Limpar
          </button>
        )}
        {children}
      </RedeTabelaToolbarBusca>

      {filtrosAbertos && (
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 shadow-sm">
          <div className="flex flex-wrap gap-4">
            <FilterSelect
              label="Status"
              value={filtros.status}
              onChange={(v) => setFiltros((f) => ({ ...f, status: v }))}
              options={[
                { value: TODOS, label: 'Todos' },
                { value: 'ativo', label: 'Ativo' },
                { value: 'em_analise', label: 'Em análise' },
                { value: 'adormecido', label: 'Adormecido' },
                { value: 'inativo', label: 'Inativo' },
              ]}
            />
            <FilterSelect
              label="UF"
              value={filtros.uf}
              onChange={(v) => setFiltros((f) => ({ ...f, uf: v }))}
              options={[
                { value: TODOS, label: 'Todas' },
                ...ufs.map((u) => ({ value: u, label: u })),
              ]}
            />
            <FilterSelect
              label="D · Capital"
              value={filtros.dimD}
              onChange={(v) => setFiltros((f) => ({ ...f, dimD: v }))}
              options={[
                { value: TODOS, label: 'Todos' },
                { value: '0', label: '0 · Sem capital' },
                { value: '1', label: '1 · Moderado' },
                { value: '2', label: '2 · Tem capital' },
                { value: 'na', label: 'Não aferido' },
              ]}
            />
            <FilterSelect
              label="Saúde Relação"
              value={filtros.relacao}
              onChange={(v) => setFiltros((f) => ({ ...f, relacao: v }))}
              options={[
                { value: TODOS, label: 'Todas' },
                { value: 'saudavel', label: 'Saudável' },
                { value: 'atencao', label: 'Atenção' },
                { value: 'critica', label: 'Crítica' },
                { value: 'nao-aferida', label: 'Não aferida' },
              ]}
            />
            <FilterSelect
              label="Prioridade"
              value={filtros.prioridade}
              onChange={(v) => setFiltros((f) => ({ ...f, prioridade: v }))}
              options={[
                { value: TODOS, label: 'Todas' },
                { value: 'P1', label: 'P1 — Crítico' },
                { value: 'P2', label: 'P2 — Sem capital' },
                { value: 'P3', label: 'P3 — Rel. crítica' },
                { value: 'P4', label: 'P4 — Rel. atenção' },
                { value: 'P5', label: 'P5 — Capital moderado' },
                { value: 'P6', label: 'P6 — Cap. ok, rel. ok' },
                { value: 'P7', label: 'P7 — Tudo verde' },
                { value: 'AD', label: 'AD — Adormecido' },
                { value: 'NC', label: 'NC — Inativo' },
              ]}
            />
            <FilterSelect
              label="Grupo GA"
              value={filtros.grupo}
              onChange={(v) => setFiltros((f) => ({ ...f, grupo: v }))}
              options={[
                { value: TODOS, label: 'Todos' },
                ...(['GA1','GA2','GA3','GA4','GA5'] as LoteadorDiagGrupo[]).map((g) => ({
                  value: g,
                  label: `${g} · ${LOTEADOR_GA_NOME[g]}`,
                })),
              ]}
            />
            <FilterSelect
              label="Avaliado em"
              value={filtros.avaliadoEm}
              onChange={(v) => setFiltros((f) => ({ ...f, avaliadoEm: v }))}
              options={[
                { value: TODOS, label: 'Qualquer' },
                { value: '30', label: 'Últimos 30 dias' },
                { value: '60', label: 'Últimos 60 dias' },
                { value: '90', label: 'Últimos 90 dias' },
                { value: 'sem', label: 'Sem avaliação' },
              ]}
            />
          </div>
        </div>
      )}

      <TabelaRedeLoteadoresEditavel
        rows={rowsFiltradas}
        totalSemBusca={rowsComCadastro.length}
        buscaAtiva={busca.trim().length > 0 || nAtivos > 0}
        buscaResetKey={busca}
        solicitarCriacao={solicitarCriacao}
      />
    </div>
  );
}
