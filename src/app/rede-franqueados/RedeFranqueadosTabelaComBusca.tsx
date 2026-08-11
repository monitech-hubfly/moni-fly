'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import {
  ordenarRedePorNFranquia,
  redeFranqueadoRowMatchesBusca,
  type RedeFranqueadoRowDb,
} from '@/lib/rede-franqueados';
import { TabelaRedeFranqueadosEditavel } from '@/components/TabelaRedeFranqueadosEditavel';
import { RedeTabelaToolbarBusca } from '@/app/rede-franqueados/RedeTabelaToolbarBusca';
import { DiagnosticoRedeSumario } from '@/components/diagnostico-rede/DiagnosticoRedeSumario';
import {
  calcPriority,
  calcRelacao,
  calcIndicador,
  calcEngajamento,
  calcGrupo,
  isAdormecido,
  isStatusNC,
  type DiagPriority,
  type DiagGrupo,
} from '@/lib/rede-diagnostico-engine';

// ─── Tipos de filtro ─────────────────────────────────────────────────────────

const TODOS = 'TODOS' as const;

const PRIORITIES = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'AD', 'NC'] as const;
type PrioFilter = (typeof PRIORITIES)[number] | typeof TODOS;

type Filtros = {
  // Operacionais
  status: string;
  modalidade: string;
  uf: string;
  adimplencia: 'ok' | 'inad' | 'na' | typeof TODOS;
  proximaAcao: 'sim' | 'nao' | typeof TODOS;
  // Prioridade
  prioridade: PrioFilter;
  // Diagnóstico
  score: 'alta' | 'desenv' | 'evolucao' | 'estrut' | 'na' | typeof TODOS;
  dimD: '2' | '1' | '0' | 'na' | typeof TODOS;
  dimC: '2' | '1' | '0' | 'na' | typeof TODOS;
  dimK: '2' | '1' | '0' | 'na' | typeof TODOS;
  relacao: 'saudavel' | 'atencao' | 'critica' | 'nao-aferida' | typeof TODOS;
  indicador: 'ritmo' | 'proximo' | 'regular' | 'abaixo' | 'na' | typeof TODOS;
  tendEng: '↑' | '→' | '↓' | typeof TODOS;
  tendRel: '↑' | '→' | '↓' | typeof TODOS;
  tendInd: '↑' | '→' | '↓' | typeof TODOS;
  grupo: DiagGrupo | typeof TODOS;
  avaliadoEm: '30' | '60' | '90' | 'sem' | typeof TODOS;
};

const FILTROS_INICIAIS: Filtros = {
  status: TODOS,
  modalidade: TODOS,
  uf: TODOS,
  adimplencia: TODOS,
  proximaAcao: TODOS,
  prioridade: TODOS,
  score: TODOS,
  dimD: TODOS,
  dimC: TODOS,
  dimK: TODOS,
  relacao: TODOS,
  indicador: TODOS,
  tendEng: TODOS,
  tendRel: TODOS,
  tendInd: TODOS,
  grupo: TODOS,
  avaliadoEm: TODOS,
};

function filtrosAtivos(f: Filtros): number {
  return Object.values(f).filter((v) => v !== TODOS).length;
}

// ─── Lógica de filtro ────────────────────────────────────────────────────────

function aplicarFiltros(rows: RedeFranqueadoRowDb[], f: Filtros): RedeFranqueadoRowDb[] {
  return rows.filter((r) => {
    // Status (inclui adormecido como status próprio)
    if (f.status !== TODOS) {
      const adorm = isAdormecido(r);
      const nc = isStatusNC(r);
      if (f.status === 'adormecida' && !adorm) return false;
      if (f.status === 'encerrada' && (!nc || adorm)) return false;
      if (f.status === 'em_operacao') {
        if (adorm || nc) return false;
        const s = String(r.status_franquia ?? '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
        if (!s.includes('operac')) return false;
      }
      if (f.status === 'em_transferencia') {
        const s = String(r.status_franquia ?? '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
        if (!s.includes('transferen')) return false;
      }
    }

    // Modalidade
    if (f.modalidade !== TODOS) {
      const m = String((r as unknown as { modalidade?: string | null }).modalidade ?? '');
      if (m !== f.modalidade) return false;
    }

    // UF
    if (f.uf !== TODOS) {
      const estado = String(r.estado_casa_frank ?? (r as unknown as { estado?: string | null }).estado ?? '');
      if (estado !== f.uf) return false;
    }

    // Adimplência
    if (f.adimplencia !== TODOS) {
      if (f.adimplencia === 'ok' && r.diag_adimplente !== true) return false;
      if (f.adimplencia === 'inad' && r.diag_adimplente !== false) return false;
      if (f.adimplencia === 'na' && r.diag_adimplente !== null && r.diag_adimplente !== undefined) return false;
    }

    // Próxima ação
    if (f.proximaAcao !== TODOS) {
      const tem = !!(r.diag_proxima_acao && String(r.diag_proxima_acao).trim());
      if (f.proximaAcao === 'sim' && !tem) return false;
      if (f.proximaAcao === 'nao' && tem) return false;
    }

    // Prioridade
    if (f.prioridade !== TODOS && calcPriority(r) !== f.prioridade) return false;

    // Score faixa
    if (f.score !== TODOS) {
      const eng = calcEngajamento(r);
      if (f.score === 'na' && eng !== null) return false;
      if (f.score !== 'na') {
        if (eng === null) return false;
        if (f.score === 'alta' && eng < 85) return false;
        if (f.score === 'desenv' && (eng < 70 || eng >= 85)) return false;
        if (f.score === 'evolucao' && (eng < 50 || eng >= 70)) return false;
        if (f.score === 'estrut' && eng >= 50) return false;
      }
    }

    // D / C / K
    for (const [field, val] of [
      ['diag_d', f.dimD],
      ['diag_c', f.dimC],
      ['diag_k', f.dimK],
    ] as const) {
      if (val !== TODOS) {
        const rv = (r as unknown as Record<string, unknown>)[field];
        if (val === 'na' && rv !== null && rv !== undefined) return false;
        if (val !== 'na' && (rv === null || rv === undefined || String(rv) !== val)) return false;
      }
    }

    // Saúde da relação
    if (f.relacao !== TODOS && calcRelacao(r) !== f.relacao) return false;

    // Indicador
    if (f.indicador !== TODOS) {
      const ind = calcIndicador(r);
      if (f.indicador === 'na' && ind !== null) return false;
      if (f.indicador !== 'na' && ind !== f.indicador) return false;
    }

    // Tendências
    if (f.tendEng !== TODOS && r.diag_tend_eng !== f.tendEng) return false;
    if (f.tendRel !== TODOS && r.diag_tend_rel !== f.tendRel) return false;
    if (f.tendInd !== TODOS && r.diag_tend_ind !== f.tendInd) return false;

    // Grupo de ação
    if (f.grupo !== TODOS && calcGrupo(r) !== f.grupo) return false;

    // Avaliado nos últimos X dias
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
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const NA_OPT = { value: 'na' as const, label: 'Não aferido' };
const TODOS_OPT = { value: TODOS, label: 'Todos' };

const TEND_OPTS = [
  TODOS_OPT,
  { value: '↑' as const, label: '↑ Subindo' },
  { value: '→' as const, label: '→ Estável' },
  { value: '↓' as const, label: '↓ Caindo' },
];

const DIM_OPTS = [
  TODOS_OPT,
  { value: '2' as const, label: '2 · Tem' },
  { value: '1' as const, label: '1 · Moderado' },
  { value: '0' as const, label: '0 · Não tem' },
  NA_OPT,
];

// ─── Componente ───────────────────────────────────────────────────────────────

type Props = {
  rows: RedeFranqueadoRowDb[];
  canEditRows?: boolean;
  maskSensitiveColumns?: boolean;
  internalView?: boolean;
  children?: ReactNode;
};

export function RedeFranqueadosTabelaComBusca({
  rows,
  canEditRows,
  maskSensitiveColumns,
  internalView = false,
  children,
}: Props) {
  const [busca, setBusca] = useState('');
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIAIS);
  const [painelAberto, setPainelAberto] = useState(false);

  function setFiltro<K extends keyof Filtros>(key: K, value: Filtros[K]) {
    setFiltros((f) => ({ ...f, [key]: value }));
  }

  function resetarFiltros() {
    setFiltros(FILTROS_INICIAIS);
  }

  // Opções dinâmicas derivadas dos dados
  const { modalidades, ufs, statusOptions } = useMemo(() => {
    const modSet = new Set<string>();
    const ufSet = new Set<string>();
    const statusSet = new Set<string>();
    rows.forEach((r) => {
      const mod = String((r as unknown as { modalidade?: string | null }).modalidade ?? '').trim();
      if (mod) modSet.add(mod);
      const uf = String(r.estado_casa_frank ?? (r as unknown as { estado?: string | null }).estado ?? '').trim();
      if (uf) ufSet.add(uf);
      const st = String(r.status_franquia ?? '').trim();
      if (st) statusSet.add(st);
    });
    return {
      modalidades: [TODOS_OPT, ...[...modSet].sort().map((m) => ({ value: m, label: m }))],
      ufs: [TODOS_OPT, ...[...ufSet].sort().map((u) => ({ value: u, label: u }))],
      statusOptions: statusSet,
    };
  }, [rows]);

  const rowsFiltradas = useMemo(() => {
    const q = busca.trim();
    let base = q ? rows.filter((r) => redeFranqueadoRowMatchesBusca(r, q)) : rows;
    base = aplicarFiltros(base, filtros);
    return ordenarRedePorNFranquia(base);
  }, [rows, busca, filtros]);

  const nAtivos = filtrosAtivos(filtros) + (busca.trim() ? 1 : 0);
  const buscaAtiva = nAtivos > 0;

  return (
    <div className="space-y-4">
      <DiagnosticoRedeSumario rows={rows} />

      {/* Toolbar */}
      <RedeTabelaToolbarBusca
        value={busca}
        onChange={setBusca}
        placeholder="Pesquisar em qualquer coluna…"
        ariaLabel="Pesquisar franqueados na tabela"
      >
        {/* Botão filtros */}
        <button
          type="button"
          onClick={() => setPainelAberto((v) => !v)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
            painelAberto || filtrosAtivos(filtros) > 0
              ? 'border-stone-700 bg-stone-700 text-white'
              : 'border-stone-300 bg-white text-stone-600 hover:bg-stone-50'
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filtros
          {filtrosAtivos(filtros) > 0 ? (
            <span className="rounded-full bg-white/20 px-1.5 py-px text-[10px] font-bold">
              {filtrosAtivos(filtros)}
            </span>
          ) : null}
        </button>

        {/* Chips de prioridade */}
        <div className="flex flex-wrap gap-1">
          {([TODOS, ...PRIORITIES] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setFiltro('prioridade', p)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                filtros.prioridade === p
                  ? 'bg-stone-700 text-white'
                  : 'border border-stone-300 bg-white text-stone-600 hover:bg-stone-50'
              }`}
            >
              {p === TODOS ? 'Todas' : p}
            </button>
          ))}
        </div>

        {buscaAtiva ? (
          <button
            type="button"
            onClick={() => { setBusca(''); resetarFiltros(); }}
            className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-700"
          >
            <X className="h-3.5 w-3.5" />
            Limpar ({rowsFiltradas.length}/{rows.length})
          </button>
        ) : (
          <span className="text-xs text-stone-400">{rows.length} franqueados</span>
        )}

        {children}
      </RedeTabelaToolbarBusca>

      {/* Painel de filtros */}
      {painelAberto ? (
        <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Filtros avançados</p>
            {filtrosAtivos(filtros) > 0 ? (
              <button
                type="button"
                onClick={resetarFiltros}
                className="text-xs text-stone-400 underline hover:text-stone-700"
              >
                Limpar filtros
              </button>
            ) : null}
          </div>

          {/* Operacionais */}
          <div className="mb-4">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-stone-400">Operacional</p>
            <div className="flex flex-wrap gap-3">
              <FilterSelect
                label="Status"
                value={filtros.status}
                onChange={(v) => setFiltro('status', v)}
                options={[
                  TODOS_OPT,
                  { value: 'em_operacao', label: 'Em Operação' },
                  { value: 'em_transferencia', label: 'Em Transferência' },
                  { value: 'encerrada', label: 'Encerrada' },
                  { value: 'adormecida', label: 'Adormecida' },
                ]}
              />
              <FilterSelect
                label="Modalidade"
                value={filtros.modalidade}
                onChange={(v) => setFiltro('modalidade', v)}
                options={modalidades}
              />
              <FilterSelect
                label="UF"
                value={filtros.uf}
                onChange={(v) => setFiltro('uf', v)}
                options={ufs}
              />
              <FilterSelect
                label="Adimplência"
                value={filtros.adimplencia}
                onChange={(v) => setFiltro('adimplencia', v)}
                options={[
                  TODOS_OPT,
                  { value: 'ok', label: 'OK — Adimplente' },
                  { value: 'inad', label: 'Inadimplente' },
                  NA_OPT,
                ]}
              />
              <FilterSelect
                label="Próxima ação"
                value={filtros.proximaAcao}
                onChange={(v) => setFiltro('proximaAcao', v)}
                options={[
                  TODOS_OPT,
                  { value: 'sim', label: 'Preenchida' },
                  { value: 'nao', label: 'Em branco' },
                ]}
              />
            </div>
          </div>

          {/* Diagnóstico */}
          <div>
            <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-stone-400">Diagnóstico</p>
            <div className="flex flex-wrap gap-3">
              <FilterSelect
                label="Score"
                value={filtros.score}
                onChange={(v) => setFiltro('score', v)}
                options={[
                  TODOS_OPT,
                  { value: 'alta', label: '≥85% Alta Prontidão' },
                  { value: 'desenv', label: '70–84% Em Desenv.' },
                  { value: 'evolucao', label: '50–69% Em Evolução' },
                  { value: 'estrut', label: '<50% Em Estruturação' },
                  NA_OPT,
                ]}
              />
              <FilterSelect label="D (Dinheiro)" value={filtros.dimD} onChange={(v) => setFiltro('dimD', v)} options={DIM_OPTS} />
              <FilterSelect label="C (Comportamento)" value={filtros.dimC} onChange={(v) => setFiltro('dimC', v)} options={DIM_OPTS} />
              <FilterSelect label="K (Conhecimento)" value={filtros.dimK} onChange={(v) => setFiltro('dimK', v)} options={DIM_OPTS} />
              <FilterSelect
                label="Saúde da Relação"
                value={filtros.relacao}
                onChange={(v) => setFiltro('relacao', v)}
                options={[
                  TODOS_OPT,
                  { value: 'saudavel', label: 'Saudável' },
                  { value: 'atencao', label: 'Atenção' },
                  { value: 'critica', label: 'Crítica' },
                  { value: 'nao-aferida', label: 'Não aferida' },
                ]}
              />
              <FilterSelect
                label="Indicador"
                value={filtros.indicador}
                onChange={(v) => setFiltro('indicador', v)}
                options={[
                  TODOS_OPT,
                  { value: 'ritmo', label: 'No ritmo' },
                  { value: 'proximo', label: 'Próximo' },
                  { value: 'regular', label: 'Regular' },
                  { value: 'abaixo', label: 'Abaixo' },
                  NA_OPT,
                ]}
              />
              <FilterSelect
                label="Grupo de Ação"
                value={filtros.grupo}
                onChange={(v) => setFiltro('grupo', v)}
                options={[
                  TODOS_OPT,
                  { value: 'GA1', label: 'GA1 · Estruturação Financeira' },
                  { value: 'GA2', label: 'GA2 · Ativação e Execução' },
                  { value: 'GA3', label: 'GA3 · Recuperação da Relação' },
                  { value: 'GA4', label: 'GA4 · Desenvolvimento e Capacitação' },
                  { value: 'GA5', label: 'GA5 · Conversão e Resultado' },
                  { value: 'GA6', label: 'GA6 · Aceleração' },
                  { value: 'GA7', label: 'GA7 · Gestão de Adormecidos' },
                ]}
              />
              <FilterSelect
                label="Avaliado em"
                value={filtros.avaliadoEm}
                onChange={(v) => setFiltro('avaliadoEm', v)}
                options={[
                  TODOS_OPT,
                  { value: '30', label: 'Últimos 30 dias' },
                  { value: '60', label: 'Últimos 60 dias' },
                  { value: '90', label: 'Últimos 90 dias' },
                  { value: 'sem', label: 'Sem avaliação' },
                ]}
              />
              <FilterSelect label="Tend. Engaj." value={filtros.tendEng} onChange={(v) => setFiltro('tendEng', v)} options={TEND_OPTS} />
              <FilterSelect label="Tend. Relação" value={filtros.tendRel} onChange={(v) => setFiltro('tendRel', v)} options={TEND_OPTS} />
              <FilterSelect label="Tend. Indicador" value={filtros.tendInd} onChange={(v) => setFiltro('tendInd', v)} options={TEND_OPTS} />
            </div>
          </div>
        </div>
      ) : null}

      <TabelaRedeFranqueadosEditavel
        rows={rowsFiltradas}
        canEditRows={canEditRows}
        maskSensitiveColumns={maskSensitiveColumns}
        totalSemBusca={rows.length}
        buscaAtiva={buscaAtiva}
        buscaResetKey={JSON.stringify(filtros) + busca}
        internalView={internalView}
      />
    </div>
  );
}
