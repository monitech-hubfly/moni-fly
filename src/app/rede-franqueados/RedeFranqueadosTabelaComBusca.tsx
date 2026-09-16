'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import {
  ordenarRedePorNFranquia,
  filtrarLinhasEmBrancoRedeFranqueados,
  redeFranqueadoRowMatchesBusca,
  type RedeFranqueadoRowDb,
} from '@/lib/rede-franqueados';
import { TabelaRedeFranqueadosEditavel } from '@/components/TabelaRedeFranqueadosEditavel';
import { RedeTabelaToolbarBusca } from '@/app/rede-franqueados/RedeTabelaToolbarBusca';
import { DiagnosticoRedeSumario } from '@/components/diagnostico-rede/DiagnosticoRedeSumario';
import {
  calcRelacao,
  calcIndicador,
  calcEngajamento,
  isAdormecido,
  isStatusNC,
} from '@/lib/rede-diagnostico-engine';

// ─── Tipos de filtro ─────────────────────────────────────────────────────────

const TODOS = 'TODOS' as const;

type Filtros = {
  // Operacionais
  status: string;
  modalidade: string;
  uf: string;
  regional: string;
  areaAtuacao: string;
  dataContrato: string;   // 'YYYY-MM' | TODOS
  dataExpiracao: string;  // 'YYYY-MM' | TODOS
  adimplencia: 'ok' | 'inad' | 'em_transferencia' | 'na' | typeof TODOS;
  proximaAcao: 'sim' | 'nao' | typeof TODOS;
  // Diagnóstico — dimensões
  score: 'alta' | 'desenv' | 'evolucao' | 'estrut' | 'na' | typeof TODOS;
  dimD: '2' | '1' | '0' | 'na' | typeof TODOS;
  dimC: '2' | '1' | '0' | 'na' | typeof TODOS;
  dimK: '2' | '1' | '0' | 'na' | typeof TODOS;
  relacao: 'saudavel' | 'atencao' | 'critica' | 'nao-aferida' | typeof TODOS;
  indicador: 'ritmo' | 'proximo' | 'regular' | 'abaixo' | 'na' | typeof TODOS;
  tendEng: '↑' | '→' | '↓' | typeof TODOS;
  tendRel: '↑' | '→' | '↓' | typeof TODOS;
  tendInd: '↑' | '→' | '↓' | typeof TODOS;
  avaliadoEm: '30' | '60' | '90' | 'sem' | typeof TODOS;
};

const FILTROS_INICIAIS: Filtros = {
  status: TODOS,
  modalidade: TODOS,
  uf: TODOS,
  regional: TODOS,
  areaAtuacao: TODOS,
  dataContrato: TODOS,
  dataExpiracao: TODOS,
  adimplencia: TODOS,
  proximaAcao: TODOS,
  score: TODOS,
  dimD: TODOS,
  dimC: TODOS,
  dimK: TODOS,
  relacao: TODOS,
  indicador: TODOS,
  tendEng: TODOS,
  tendRel: TODOS,
  tendInd: TODOS,
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

    // Regional
    if (f.regional !== TODOS) {
      if (String((r as unknown as { regional?: string | null }).regional ?? '').trim() !== f.regional) return false;
    }

    // Área de Atuação
    if (f.areaAtuacao !== TODOS) {
      if (String((r as unknown as { area_atuacao?: string | null }).area_atuacao ?? '').trim() !== f.areaAtuacao) return false;
    }

    // Data de Ass. Contrato (mês/ano)
    if (f.dataContrato !== TODOS) {
      const d = (r as unknown as { data_ass_contrato?: string | null }).data_ass_contrato;
      if (!d || !String(d).startsWith(f.dataContrato)) return false;
    }

    // Data de Expiração da Franquia (mês/ano)
    if (f.dataExpiracao !== TODOS) {
      const d = (r as unknown as { data_expiracao_franquia?: string | null }).data_expiracao_franquia;
      if (!d || !String(d).startsWith(f.dataExpiracao)) return false;
    }

    // Adimplência
    if (f.adimplencia !== TODOS) {
      if (f.adimplencia === 'ok' && r.diag_adimplencia !== 'ok') return false;
      if (f.adimplencia === 'inad' && r.diag_adimplencia !== 'inad') return false;
      if (f.adimplencia === 'em_transferencia' && r.diag_adimplencia !== 'em_transferencia') return false;
      if (f.adimplencia === 'na' && r.diag_adimplencia !== null && r.diag_adimplencia !== undefined) return false;
    }

    // Próxima ação
    if (f.proximaAcao !== TODOS) {
      const tem = !!(r.diag_proxima_acao && String(r.diag_proxima_acao).trim());
      if (f.proximaAcao === 'sim' && !tem) return false;
      if (f.proximaAcao === 'nao' && tem) return false;
    }

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

const radioRow = 'flex flex-wrap gap-x-2 gap-y-1 text-xs';
const radioLabel = 'inline-flex cursor-pointer items-center gap-1 text-xs';
const radioClass = 'h-3 w-3 shrink-0 border-stone-300 text-[color:var(--moni-navy-600)] focus:ring-[color:var(--moni-navy-400)]';

type SecaoId =
  | 'status' | 'modalidade' | 'uf' | 'regional' | 'areaAtuacao'
  | 'dataContrato' | 'dataExpiracao' | 'adimplencia' | 'proximaAcao'
  | 'score' | 'dimD' | 'dimC' | 'dimK' | 'relacao' | 'indicador'
  | 'avaliadoEm' | 'tendEng' | 'tendRel' | 'tendInd';

function SecaoColapsavel({
  titulo,
  expandido,
  onToggle,
  badge,
  children,
}: {
  titulo: string;
  expandido: boolean;
  onToggle: () => void;
  badge: string | null;
  children: ReactNode;
}) {
  return (
    <div className="border-b last:border-b-0" style={{ borderColor: 'var(--moni-border-default)' }}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-1 py-1.5 text-left transition-colors hover:bg-stone-50/80"
      >
        <span className="min-w-0 flex flex-1 items-center gap-1 truncate">
          <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
            {titulo}
          </span>
          {badge ? (
            <span
              className="max-w-[7rem] truncate rounded px-1 py-0.5 text-[9px] font-semibold"
              style={{ background: 'var(--moni-surface-100)', color: 'var(--moni-text-secondary)', border: '0.5px solid var(--moni-border-default)' }}
            >
              {badge}
            </span>
          ) : null}
        </span>
        <span className="shrink-0 text-[10px] tabular-nums text-stone-500" aria-hidden>
          {expandido ? '▾' : '▸'}
        </span>
      </button>
      <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${expandido ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="min-h-0 overflow-hidden">
          <div className="pb-2 pt-0.5">{children}</div>
        </div>
      </div>
    </div>
  );
}

function RadioList<T extends string>({
  name,
  value,
  onChange,
  options,
  scroll,
}: {
  name: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  scroll?: boolean;
}) {
  return (
    <div
      className={`${radioRow} flex-col flex-nowrap ${scroll ? 'max-h-32 overflow-y-auto' : ''}`}
      style={{ color: 'var(--moni-text-primary)' }}
    >
      {options.map((o) => (
        <label key={o.value} className={radioLabel}>
          <input
            type="radio"
            name={name}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className={radioClass}
          />
          <span className="max-w-[12rem] truncate">{o.label}</span>
        </label>
      ))}
    </div>
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
  { value: '2' as const, label: 'Saudável (2)' },
  { value: '1' as const, label: 'Atenção (1)' },
  { value: '0' as const, label: 'Crítico (0)' },
  NA_OPT,
];

function expandidoInicial(f: Filtros): Record<SecaoId, boolean> {
  const keys = Object.keys(f) as (keyof Filtros)[];
  const algum = keys.some((k) => f[k] !== TODOS);
  if (!algum) {
    return {
      status: false, modalidade: false, uf: false, regional: false, areaAtuacao: false,
      dataContrato: false, dataExpiracao: false, adimplencia: false, proximaAcao: false,
      score: false, dimD: false, dimC: false, dimK: false, relacao: false, indicador: false,
      avaliadoEm: false, tendEng: false, tendRel: false, tendInd: false,
    };
  }
  return {
    status: f.status !== TODOS, modalidade: f.modalidade !== TODOS, uf: f.uf !== TODOS,
    regional: f.regional !== TODOS, areaAtuacao: f.areaAtuacao !== TODOS,
    dataContrato: f.dataContrato !== TODOS, dataExpiracao: f.dataExpiracao !== TODOS,
    adimplencia: f.adimplencia !== TODOS, proximaAcao: f.proximaAcao !== TODOS,
    score: f.score !== TODOS, dimD: f.dimD !== TODOS, dimC: f.dimC !== TODOS,
    dimK: f.dimK !== TODOS, relacao: f.relacao !== TODOS, indicador: f.indicador !== TODOS,
    avaliadoEm: f.avaliadoEm !== TODOS, tendEng: f.tendEng !== TODOS,
    tendRel: f.tendRel !== TODOS, tendInd: f.tendInd !== TODOS,
  };
}

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
  const [draft, setDraft] = useState<Filtros>(FILTROS_INICIAIS);
  const [painelAberto, setPainelAberto] = useState(false);
  const [expanded, setExpanded] = useState<Record<SecaoId, boolean>>(() => expandidoInicial(FILTROS_INICIAIS));

  function setDraftFiltro<K extends keyof Filtros>(key: K, value: Filtros[K]) {
    setDraft((f) => ({ ...f, [key]: value }));
  }

  function aplicarDraft() {
    setFiltros(draft);
    setExpanded(expandidoInicial(draft));
  }

  function resetarFiltros() {
    setFiltros(FILTROS_INICIAIS);
    setDraft(FILTROS_INICIAIS);
    setExpanded(expandidoInicial(FILTROS_INICIAIS));
  }

  function toggleSecao(id: SecaoId) {
    setExpanded((e) => ({ ...e, [id]: !e[id] }));
  }

  function badge<T extends string>(value: T, opts: { value: T; label: string }[]): string | null {
    if (value === TODOS) return null;
    return opts.find((o) => o.value === value)?.label ?? String(value);
  }

  const rowsComCadastro = useMemo(() => filtrarLinhasEmBrancoRedeFranqueados(rows), [rows]);

  // Opções dinâmicas derivadas dos dados
  const { modalidades, ufs, regionais, areasAtuacao, datasContrato, datasExpiracao, statusOptions } = useMemo(() => {
    const modSet = new Set<string>();
    const ufSet = new Set<string>();
    const regSet = new Set<string>();
    const areaSet = new Set<string>();
    const ctSet = new Set<string>();
    const expSet = new Set<string>();
    const statusSet = new Set<string>();

    const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    function yyyymmLabel(val: string): string {
      const [y, m] = val.split('-');
      const mes = MESES_PT[parseInt(m, 10) - 1] ?? m;
      return `${mes}/${y}`;
    }

    rowsComCadastro.forEach((r) => {
      const rr = r as unknown as Record<string, string | null | undefined>;
      const mod = String(rr.modalidade ?? '').trim();
      if (mod) modSet.add(mod);
      const uf = String(r.estado_casa_frank ?? rr.estado ?? '').trim();
      if (uf) ufSet.add(uf);
      const reg = String(rr.regional ?? '').trim();
      if (reg) regSet.add(reg);
      const area = String(rr.area_atuacao ?? '').trim();
      if (area) areaSet.add(area);
      const ct = String(rr.data_ass_contrato ?? '').slice(0, 7); // YYYY-MM
      if (ct.length === 7) ctSet.add(ct);
      const exp = String(rr.data_expiracao_franquia ?? '').slice(0, 7);
      if (exp.length === 7) expSet.add(exp);
      const st = String(r.status_franquia ?? '').trim();
      if (st) statusSet.add(st);
    });

    const sortedDates = (s: Set<string>) =>
      [TODOS_OPT, ...[...s].sort().map((v) => ({ value: v, label: yyyymmLabel(v) }))];

    return {
      modalidades: [TODOS_OPT, ...[...modSet].sort().map((m) => ({ value: m, label: m }))],
      ufs: [TODOS_OPT, ...[...ufSet].sort().map((u) => ({ value: u, label: u }))],
      regionais: [TODOS_OPT, ...[...regSet].sort().map((v) => ({ value: v, label: v }))],
      areasAtuacao: [TODOS_OPT, ...[...areaSet].sort().map((v) => ({ value: v, label: v }))],
      datasContrato: sortedDates(ctSet),
      datasExpiracao: sortedDates(expSet),
      statusOptions: statusSet,
    };
  }, [rowsComCadastro]);

  const rowsFiltradas = useMemo(() => {
    const q = busca.trim();
    let base = q
      ? rowsComCadastro.filter((r) => redeFranqueadoRowMatchesBusca(r, q))
      : rowsComCadastro;
    base = aplicarFiltros(base, filtros);
    return ordenarRedePorNFranquia(base);
  }, [rowsComCadastro, busca, filtros]);

  const nAtivos = filtrosAtivos(filtros) + (busca.trim() ? 1 : 0);
  const buscaAtiva = nAtivos > 0;

  return (
    <div className="space-y-4">
      <DiagnosticoRedeSumario rows={rowsComCadastro} />

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
          onClick={() => {
            setPainelAberto((v) => {
              if (!v) { setDraft(filtros); setExpanded(expandidoInicial(filtros)); }
              return !v;
            });
          }}
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

        {buscaAtiva ? (
          <button
            type="button"
            onClick={() => { setBusca(''); resetarFiltros(); }}
            className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-700"
          >
            <X className="h-3.5 w-3.5" />
            Limpar ({rowsFiltradas.length}/{rowsComCadastro.length})
          </button>
        ) : (
          <span className="text-xs text-stone-400">{rowsComCadastro.length} franqueados</span>
        )}

        {children}
      </RedeTabelaToolbarBusca>

      {/* Painel de filtros */}
      {painelAberto ? (
        <div
          className="rounded-xl border p-2 shadow-xl"
          style={{
            borderColor: 'var(--moni-border-default)',
            background: 'var(--moni-surface-0)',
            boxShadow: 'var(--moni-shadow-sm), 0 12px 40px rgba(12, 38, 51, 0.12)',
          }}
        >
          <div className="max-h-[min(70vh,36rem)] overflow-y-auto pr-0.5">
            {/* ── OPERACIONAL ── */}
            <p className="mb-0.5 px-0.5 pt-0.5 text-[9px] font-bold uppercase tracking-widest text-stone-400">Operacional</p>
            {(() => {
              const statusOpts = [
                TODOS_OPT,
                { value: 'em_operacao' as const, label: 'Em Operação' },
                { value: 'em_transferencia' as const, label: 'Em Transferência' },
                { value: 'encerrada' as const, label: 'Encerrada' },
                { value: 'adormecida' as const, label: 'Adormecida' },
              ];
              const adimOpts = [
                TODOS_OPT,
                { value: 'ok' as const, label: 'OK — Adimplente' },
                { value: 'inad' as const, label: 'Inadimplente' },
                { value: 'em_transferencia' as const, label: 'Em Transferência' },
                NA_OPT,
              ];
              const proxOpts = [
                TODOS_OPT,
                { value: 'sim' as const, label: 'Preenchida' },
                { value: 'nao' as const, label: 'Em branco' },
              ];
              return (
                <>
                  <SecaoColapsavel titulo="Status" expandido={expanded.status} onToggle={() => toggleSecao('status')} badge={badge(draft.status, statusOpts)}>
                    <RadioList name="rf-status" value={draft.status} onChange={(v) => setDraftFiltro('status', v)} options={statusOpts} />
                  </SecaoColapsavel>
                  <SecaoColapsavel titulo="Modalidade" expandido={expanded.modalidade} onToggle={() => toggleSecao('modalidade')} badge={badge(draft.modalidade, modalidades)}>
                    <RadioList name="rf-mod" value={draft.modalidade} onChange={(v) => setDraftFiltro('modalidade', v)} options={modalidades} scroll />
                  </SecaoColapsavel>
                  <SecaoColapsavel titulo="UF" expandido={expanded.uf} onToggle={() => toggleSecao('uf')} badge={badge(draft.uf, ufs)}>
                    <RadioList name="rf-uf" value={draft.uf} onChange={(v) => setDraftFiltro('uf', v)} options={ufs} scroll />
                  </SecaoColapsavel>
                  <SecaoColapsavel titulo="Regional" expandido={expanded.regional} onToggle={() => toggleSecao('regional')} badge={badge(draft.regional, regionais)}>
                    <RadioList name="rf-reg" value={draft.regional} onChange={(v) => setDraftFiltro('regional', v)} options={regionais} scroll />
                  </SecaoColapsavel>
                  <SecaoColapsavel titulo="Área de Atuação" expandido={expanded.areaAtuacao} onToggle={() => toggleSecao('areaAtuacao')} badge={badge(draft.areaAtuacao, areasAtuacao)}>
                    <RadioList name="rf-area" value={draft.areaAtuacao} onChange={(v) => setDraftFiltro('areaAtuacao', v)} options={areasAtuacao} scroll />
                  </SecaoColapsavel>
                  <SecaoColapsavel titulo="Ass. Contrato" expandido={expanded.dataContrato} onToggle={() => toggleSecao('dataContrato')} badge={badge(draft.dataContrato, datasContrato)}>
                    <RadioList name="rf-ct" value={draft.dataContrato} onChange={(v) => setDraftFiltro('dataContrato', v)} options={datasContrato} scroll />
                  </SecaoColapsavel>
                  <SecaoColapsavel titulo="Expiração Franquia" expandido={expanded.dataExpiracao} onToggle={() => toggleSecao('dataExpiracao')} badge={badge(draft.dataExpiracao, datasExpiracao)}>
                    <RadioList name="rf-exp" value={draft.dataExpiracao} onChange={(v) => setDraftFiltro('dataExpiracao', v)} options={datasExpiracao} scroll />
                  </SecaoColapsavel>
                  <SecaoColapsavel titulo="Adimplência" expandido={expanded.adimplencia} onToggle={() => toggleSecao('adimplencia')} badge={badge(draft.adimplencia, adimOpts)}>
                    <RadioList name="rf-adim" value={draft.adimplencia} onChange={(v) => setDraftFiltro('adimplencia', v)} options={adimOpts} />
                  </SecaoColapsavel>
                  <SecaoColapsavel titulo="Próxima Ação" expandido={expanded.proximaAcao} onToggle={() => toggleSecao('proximaAcao')} badge={badge(draft.proximaAcao, proxOpts)}>
                    <RadioList name="rf-prox" value={draft.proximaAcao} onChange={(v) => setDraftFiltro('proximaAcao', v)} options={proxOpts} />
                  </SecaoColapsavel>
                </>
              );
            })()}

            {/* ── DIAGNÓSTICO ── */}
            <p className="mb-0.5 mt-2 px-0.5 text-[9px] font-bold uppercase tracking-widest text-stone-400">Diagnóstico</p>
            {(() => {
              const scoreOpts = [
                TODOS_OPT,
                { value: 'alta' as const, label: '≥85% Alta Prontidão' },
                { value: 'desenv' as const, label: '70–84% Em Desenv.' },
                { value: 'evolucao' as const, label: '50–69% Em Evolução' },
                { value: 'estrut' as const, label: '<50% Em Estruturação' },
                NA_OPT,
              ];
              const relacaoOpts = [
                TODOS_OPT,
                { value: 'saudavel' as const, label: 'Saudável' },
                { value: 'atencao' as const, label: 'Atenção' },
                { value: 'critica' as const, label: 'Crítica' },
                { value: 'nao-aferida' as const, label: 'Não aferida' },
              ];
              const indicadorOpts = [
                TODOS_OPT,
                { value: 'ritmo' as const, label: 'No ritmo' },
                { value: 'proximo' as const, label: 'Próximo' },
                { value: 'regular' as const, label: 'Regular' },
                { value: 'abaixo' as const, label: 'Abaixo' },
                NA_OPT,
              ];
              const avalOpts = [
                TODOS_OPT,
                { value: '30' as const, label: 'Últimos 30 dias' },
                { value: '60' as const, label: 'Últimos 60 dias' },
                { value: '90' as const, label: 'Últimos 90 dias' },
                { value: 'sem' as const, label: 'Sem avaliação' },
              ];
              return (
                <>
                  <SecaoColapsavel titulo="Score" expandido={expanded.score} onToggle={() => toggleSecao('score')} badge={badge(draft.score, scoreOpts)}>
                    <RadioList name="rf-score" value={draft.score} onChange={(v) => setDraftFiltro('score', v)} options={scoreOpts} />
                  </SecaoColapsavel>
                  <SecaoColapsavel titulo="D — Dinheiro" expandido={expanded.dimD} onToggle={() => toggleSecao('dimD')} badge={badge(draft.dimD, DIM_OPTS)}>
                    <RadioList name="rf-dimD" value={draft.dimD} onChange={(v) => setDraftFiltro('dimD', v)} options={DIM_OPTS} />
                  </SecaoColapsavel>
                  <SecaoColapsavel titulo="C — Comportamento" expandido={expanded.dimC} onToggle={() => toggleSecao('dimC')} badge={badge(draft.dimC, DIM_OPTS)}>
                    <RadioList name="rf-dimC" value={draft.dimC} onChange={(v) => setDraftFiltro('dimC', v)} options={DIM_OPTS} />
                  </SecaoColapsavel>
                  <SecaoColapsavel titulo="K — Conhecimento" expandido={expanded.dimK} onToggle={() => toggleSecao('dimK')} badge={badge(draft.dimK, DIM_OPTS)}>
                    <RadioList name="rf-dimK" value={draft.dimK} onChange={(v) => setDraftFiltro('dimK', v)} options={DIM_OPTS} />
                  </SecaoColapsavel>
                  <SecaoColapsavel titulo="Saúde da Relação" expandido={expanded.relacao} onToggle={() => toggleSecao('relacao')} badge={badge(draft.relacao, relacaoOpts)}>
                    <RadioList name="rf-rel" value={draft.relacao} onChange={(v) => setDraftFiltro('relacao', v)} options={relacaoOpts} />
                  </SecaoColapsavel>
                  <SecaoColapsavel titulo="Indicador" expandido={expanded.indicador} onToggle={() => toggleSecao('indicador')} badge={badge(draft.indicador, indicadorOpts)}>
                    <RadioList name="rf-ind" value={draft.indicador} onChange={(v) => setDraftFiltro('indicador', v)} options={indicadorOpts} />
                  </SecaoColapsavel>
                  <SecaoColapsavel titulo="Avaliado em" expandido={expanded.avaliadoEm} onToggle={() => toggleSecao('avaliadoEm')} badge={badge(draft.avaliadoEm, avalOpts)}>
                    <RadioList name="rf-aval" value={draft.avaliadoEm} onChange={(v) => setDraftFiltro('avaliadoEm', v)} options={avalOpts} />
                  </SecaoColapsavel>
                  <SecaoColapsavel titulo="Tend. Engajamento" expandido={expanded.tendEng} onToggle={() => toggleSecao('tendEng')} badge={badge(draft.tendEng, TEND_OPTS)}>
                    <RadioList name="rf-tendEng" value={draft.tendEng} onChange={(v) => setDraftFiltro('tendEng', v)} options={TEND_OPTS} />
                  </SecaoColapsavel>
                  <SecaoColapsavel titulo="Tend. Relação" expandido={expanded.tendRel} onToggle={() => toggleSecao('tendRel')} badge={badge(draft.tendRel, TEND_OPTS)}>
                    <RadioList name="rf-tendRel" value={draft.tendRel} onChange={(v) => setDraftFiltro('tendRel', v)} options={TEND_OPTS} />
                  </SecaoColapsavel>
                  <SecaoColapsavel titulo="Tend. Indicador" expandido={expanded.tendInd} onToggle={() => toggleSecao('tendInd')} badge={badge(draft.tendInd, TEND_OPTS)}>
                    <RadioList name="rf-tendInd" value={draft.tendInd} onChange={(v) => setDraftFiltro('tendInd', v)} options={TEND_OPTS} />
                  </SecaoColapsavel>
                </>
              );
            })()}
          </div>

          {/* Limpar / Aplicar */}
          <div className="mt-1.5 flex flex-wrap gap-1 border-t pt-1.5" style={{ borderColor: 'var(--moni-border-default)' }}>
            <button
              type="button"
              onClick={resetarFiltros}
              className="rounded-lg border px-2 py-0.5 text-xs font-medium transition hover:opacity-95"
              style={{ borderColor: 'var(--moni-border-default)', background: 'var(--moni-surface-50)', color: 'var(--moni-text-secondary)' }}
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={aplicarDraft}
              className="rounded-lg px-2 py-0.5 text-xs font-medium text-[var(--moni-text-inverse)] transition hover:opacity-95"
              style={{ background: 'var(--moni-navy-800)' }}
            >
              Aplicar
            </button>
          </div>
        </div>
      ) : null}

      <TabelaRedeFranqueadosEditavel
        rows={rowsFiltradas}
        canEditRows={canEditRows}
        maskSensitiveColumns={maskSensitiveColumns}
        totalSemBusca={rowsComCadastro.length}
        buscaAtiva={buscaAtiva}
        buscaResetKey={JSON.stringify(filtros) + busca}
        internalView={internalView}
      />
    </div>
  );
}
