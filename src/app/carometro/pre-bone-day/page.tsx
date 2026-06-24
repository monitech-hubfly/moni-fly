'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useEffectiveUser } from '@/hooks/useEffectiveUser';
import {
  usePlanoBoneDay, IndicadorBone, ComportamentoItem, AgendaMacroItem,
  semanasDoMes, getMonthOptions,
} from '@/hooks/usePlanoBoneDay';
import type { MetaItem, ResponsavelItem } from '@/hooks/useMetasIndicadores';
import { SeletorUsuarioAdmin } from '@/components/carometro/todo/SeletorUsuarioAdmin';
import { registrarLog } from '@/hooks/useAuditLog';
import { isoWeek } from '@/utils/periodos';
import { listarAreas } from '@/utils/areasOrder';

const LOG = (args: Record<string, unknown>) =>
  void (registrarLog as unknown as (a: Record<string, unknown>) => Promise<void>)(args);

// ── Utilitários ───────────────────────────────────────────────────────────────
const TIPO_BADGE: Record<string, string> = {
  atingivel:  'bg-blue-100 text-blue-700',
  recorrente: 'bg-green-100 text-green-700',
};

function TipoBadge({ tipo }: { tipo: string | null }) {
  if (!tipo) return null;
  const cls = TIPO_BADGE[tipo.toLowerCase()] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cls}`}>
      {tipo.charAt(0).toUpperCase() + tipo.slice(1).toLowerCase()}
    </span>
  );
}

// Semáforo badges coloridos a partir do JSON de faixas
type FaixaItem = { cor: string; limite: string; comparacao: string };

function SemaforoBadges({ semaforo_faixas }: { semaforo_faixas: unknown }) {
  const faixas = (semaforo_faixas as { faixas?: FaixaItem[] } | null)?.faixas ?? [];
  // Deduplica por cor para mostrar no máximo 4 badges distintos
  const vistos = new Set<string>();
  const badge = faixas.filter(f => {
    if (!f.cor || vistos.has(f.cor)) return false;
    vistos.add(f.cor);
    return true;
  });
  if (!badge.length) return <span className="text-[10px] text-gray-300">—</span>;
  return (
    <div className="flex gap-0.5 flex-wrap">
      {badge.map((f, i) => (
        <span key={i} className="text-[9px] px-1 py-0.5 rounded text-white font-medium"
          style={{ backgroundColor: f.cor }}>
          {f.comparacao === 'gte' ? `≥${f.limite}` : f.comparacao === 'lte' ? `≤${f.limite}` : f.limite}
        </span>
      ))}
    </div>
  );
}

function buildSemaforoFaixas(tipo: string, verde: string, amarelo: string): object {
  if (tipo === 'sim_nao') {
    return { escala_tipo: 'sim_nao', escala_custom_id: null, faixas: [
      { cor: '#1e7a3a', limite: 'SIM', comparacao: 'eq' }, { cor: '#52b36f', limite: 'SIM', comparacao: 'eq' },
      { cor: '#f2c94c', limite: 'NAO', comparacao: 'eq' }, { cor: '#d24141', limite: 'NAO', comparacao: 'eq' },
    ] };
  }
  if (tipo === 'status_3') {
    return { escala_tipo: 'status_3', escala_custom_id: null, faixas: [
      { cor: '#1e7a3a', limite: 'OK', comparacao: 'eq' }, { cor: '#52b36f', limite: 'OK', comparacao: 'eq' },
      { cor: '#f2c94c', limite: 'ANDAMENTO', comparacao: 'eq' }, { cor: '#d24141', limite: 'NAO_OK', comparacao: 'eq' },
    ] };
  }
  const escala = tipo === 'percentual' ? 'percentual' : 'numero';
  const v = parseFloat(verde) || 75, a = parseFloat(amarelo) || 35;
  return { escala_tipo: escala, escala_custom_id: null, faixas: [
    { cor: '#1e7a3a', limite: String(v), comparacao: 'gte' },
    { cor: '#52b36f', limite: String(Math.round(v * 0.85)), comparacao: 'gte' },
    { cor: '#f2c94c', limite: String(a), comparacao: 'gte' },
    { cor: '#d24141', limite: '0', comparacao: 'gte' },
  ] };
}

// ── Bloco 1: Metas não concluídas ─────────────────────────────────────────────
function MetaNaoConcluida({ meta, responsaveis, onRelançar }: {
  meta: MetaItem; responsaveis: ResponsavelItem[];
  onRelançar: (id: string, f: { metaUnidade: string; respId: string }) => Promise<void>;
}) {
  const [aberto,   setAberto]   = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({ metaUnidade: meta.meta_unidade ?? '', respId: meta.profile_id ?? '' });

  const handleSalvar = async () => {
    setSalvando(true);
    try { await onRelançar(meta.id, form); setAberto(false); }
    finally { setSalvando(false); }
  };

  return (
    <div className="bg-white border border-amber-200 rounded-lg p-3 shadow-sm">
      <div className="flex items-start gap-2 flex-wrap">
        {meta.is_chave && <span>🔑</span>}
        <TipoBadge tipo={meta.tipo} />
        <span className="text-sm font-medium text-gray-800 flex-1 leading-snug">{meta.descricao}</span>
        <div className="flex items-center gap-2 text-xs text-gray-500 flex-shrink-0">
          {meta.meta_unidade && <span>Prazo: {meta.meta_unidade}</span>}
          {meta.responsavel_nome && <span>· {meta.responsavel_nome}</span>}
        </div>
        {!aberto && (
          <button type="button" onClick={() => setAberto(true)}
            className="text-xs px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-300 rounded-lg transition-colors">
            Relançar
          </button>
        )}
      </div>
      {aberto && (
        <div className="mt-3 pt-3 border-t border-amber-100 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-gray-500 mb-0.5 block">Novo prazo</label>
              <input type="date" className="w-full text-xs border border-gray-300 rounded px-2 py-1.5"
                value={form.metaUnidade} onChange={e => setForm(p => ({ ...p, metaUnidade: e.target.value }))} />
            </div>
            {responsaveis.length > 0 && (
              <div>
                <label className="text-[10px] text-gray-500 mb-0.5 block">Responsável</label>
                <select className="w-full text-xs border border-gray-300 rounded px-2 py-1.5"
                  value={form.respId} onChange={e => setForm(p => ({ ...p, respId: e.target.value }))}>
                  <option value="">— opcional —</option>
                  {responsaveis.map(r => <option key={r.profile_id} value={r.profile_id}>{r.nome}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setAberto(false)} className="text-xs text-gray-500 hover:text-gray-700">Cancelar</button>
            <button type="button" onClick={handleSalvar} disabled={salvando}
              className="text-xs px-3 py-1 bg-amber-500 text-white rounded disabled:opacity-50 hover:bg-amber-600">
              {salvando ? 'Salvando...' : 'Confirmar relançamento'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Bloco 2: Meta + seus indicadores ─────────────────────────────────────────
const TIPOS_SEMAFORO = [
  { value: 'percentual', label: '%' }, { value: 'quantidade', label: 'Nº' },
  { value: 'sim_nao', label: 'SIM/NÃO' }, { value: 'status_3', label: 'OK/And./NãoOK' },
];

// Indicadores — responsável editável por admin; meta: somente visualização.
function LinhaIndicador({ ind, responsaveis, isAdmin, onUpdate }: {
  ind: IndicadorBone; responsaveis: ResponsavelItem[];
  isAdmin: boolean; onUpdate: () => void;
}) {
  const supabase  = useMemo(() => createClient(), []);
  const [salvandoResp, setSalvandoResp] = useState(false);
  const [confirmExcl,  setConfirmExcl]  = useState(false);

  const handleRespChange = async (profileId: string) => {
    setSalvandoResp(true);
    await supabase.from('indicadores').update({ profile_id: profileId || null }).eq('id', ind.id);
    setSalvandoResp(false);
    onUpdate();
  };

  const handleExcluir = async () => {
    await supabase.from('indicadores').delete().eq('id', ind.id);
    onUpdate();
  };

  const respNome  = responsaveis.find(r => r.profile_id === ind.profile_id)?.nome ?? '—';
  const metaLabel = ind.meta_valor !== null
    ? `${ind.meta_valor}${ind.meta_unidade ? ' ' + ind.meta_unidade : ''}`
    : '—';

  return (
    <tr className="border-b border-gray-100 group hover:bg-gray-50/50">
      <td className="px-3 py-2 text-xs text-gray-700">
        <div className="flex items-center gap-1">
          {ind.indicador_chave && <span title="Indicador chave" className="text-[11px]">🔑</span>}
          <span>{ind.nome}</span>
          {ind.tipo && <span className="text-[9px] text-gray-400 bg-gray-100 px-1 rounded">{ind.tipo}</span>}
        </div>
      </td>
      <td className="px-3 py-2"><SemaforoBadges semaforo_faixas={ind.semaforo_faixas} /></td>
      <td className="px-3 py-2">
        {isAdmin ? (
          <select className="text-[11px] border border-gray-200 rounded px-1.5 py-0.5 max-w-[130px] disabled:opacity-50"
            value={ind.profile_id ?? ''} onChange={e => handleRespChange(e.target.value)} disabled={salvandoResp}>
            <option value="">—</option>
            {responsaveis.map(r => <option key={r.profile_id} value={r.profile_id}>{r.nome}</option>)}
          </select>
        ) : (
          <span className="text-[11px] text-gray-500">{respNome}</span>
        )}
      </td>
      <td className="px-3 py-2"><span className="text-[11px] text-gray-500">{metaLabel}</span></td>
      {isAdmin && (
        <td className="px-2 py-2 text-right">
          {confirmExcl ? (
            <span className="flex gap-1 text-[10px] text-red-600">
              <button type="button" onClick={handleExcluir} className="font-medium hover:underline">Sim</button>
              <button type="button" onClick={() => setConfirmExcl(false)} className="text-gray-400">Não</button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmExcl(true)}
              className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity text-xs">✕</button>
          )}
        </td>
      )}
    </tr>
  );
}

function FormNovoIndicadorMeta({ metaId, areaId, responsaveis, onSalvo }: {
  metaId: string; areaId: string; responsaveis: ResponsavelItem[]; onSalvo: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [aberto,   setAberto]   = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({ nome: '', profileId: '', tipo: 'percentual', verde: '75', amarelo: '35', chave: false });
  const set = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  const handleSalvar = async () => {
    if (!form.nome.trim()) return;
    setSalvando(true);
    try {
      const sf = buildSemaforoFaixas(form.tipo, form.verde, form.amarelo);
      const { data: ins, error: e } = await supabase.from('indicadores')
        .insert({ area_id: areaId, nome: form.nome.trim(), objetivo_id: metaId,
          profile_id: form.profileId || null, indicador_chave: form.chave,
          tipo: form.tipo === 'percentual' ? 'percentual' : form.tipo === 'quantidade' ? 'quantidade' : 'outro',
          semaforo_faixas: sf })
        .select('id').single();
      if (e) { console.error('[AddIndMeta]', e); return; }
      LOG({ modulo: 'Planejamento', entidade: 'indicadores',
        entidade_id: String((ins as { id: unknown }).id), operacao: 'INSERT',
        descricao: `Indicador criado para meta ${metaId}: ${form.nome}` });
      setForm({ nome: '', profileId: '', tipo: 'percentual', verde: '75', amarelo: '35', chave: false });
      setAberto(false); onSalvo();
    } finally { setSalvando(false); }
  };

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)}
        className="text-xs text-gray-400 hover:text-blue-600 transition-colors">
        + Adicionar indicador a esta meta
      </button>
    );
  }
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mt-2 flex flex-col gap-2">
      <input className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300"
        placeholder="Nome do indicador *" value={form.nome} onChange={e => set('nome', e.target.value)} autoFocus />
      <div className="grid grid-cols-3 gap-2">
        <select className="text-xs border border-gray-300 rounded px-2 py-1.5" value={form.tipo} onChange={e => set('tipo', e.target.value)}>
          {TIPOS_SEMAFORO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {(form.tipo === 'percentual' || form.tipo === 'quantidade') && (
          <>
            <input type="number" className="text-xs border border-gray-300 rounded px-2 py-1.5"
              placeholder="Verde ≥" value={form.verde} onChange={e => set('verde', e.target.value)} />
            <input type="number" className="text-xs border border-gray-300 rounded px-2 py-1.5"
              placeholder="Amarelo ≥" value={form.amarelo} onChange={e => set('amarelo', e.target.value)} />
          </>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {responsaveis.length > 0 && (
          <select className="text-xs border border-gray-300 rounded px-2 py-1.5" value={form.profileId} onChange={e => set('profileId', e.target.value)}>
            <option value="">— Responsável —</option>
            {responsaveis.map(r => <option key={r.profile_id} value={r.profile_id}>{r.nome}</option>)}
          </select>
        )}
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
          <input type="checkbox" checked={form.chave} onChange={e => set('chave', e.target.checked)} />
          Indicador chave 🔑
        </label>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={() => setAberto(false)} className="text-xs text-gray-500 hover:text-gray-700">Cancelar</button>
        <button type="button" onClick={handleSalvar} disabled={!form.nome.trim() || salvando}
          className="text-xs px-3 py-1 bg-blue-500 text-white rounded disabled:opacity-50 hover:bg-blue-600">
          {salvando ? 'Criando...' : 'Criar indicador'}
        </button>
      </div>
    </div>
  );
}

function MetaComIndicadores({ meta, indicadores, responsaveis, isAdmin, areaId, onUpdate, onConcluir, onExcluir }: {
  meta: MetaItem; indicadores: IndicadorBone[]; responsaveis: ResponsavelItem[];
  isAdmin: boolean; areaId: string; onUpdate: () => void;
  onConcluir: (id: string) => Promise<void>; onExcluir: (id: string) => Promise<void>;
}) {
  const [confirmExcl, setConfirmExcl]   = useState(false);
  const [confirmConc, setConfirmConc]   = useState(false);
  const [salvando,    setSalvando]      = useState(false);

  const handleConcluir = async () => {
    setSalvando(true); try { await onConcluir(meta.id); } finally { setSalvando(false); }
  };
  const handleExcluir = async () => {
    setSalvando(true); try { await onExcluir(meta.id); } finally { setSalvando(false); }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-2 px-3 py-2.5 flex-wrap border-b border-gray-100">
        {meta.is_chave && <span className="text-sm">🔑</span>}
        <TipoBadge tipo={meta.tipo} />
        <span className={`text-sm font-medium text-gray-800 flex-1 leading-snug ${meta.status === 'concluido' ? 'line-through text-gray-400' : ''}`}>
          {meta.descricao}
        </span>
        <div className="flex items-center gap-1.5 text-xs text-gray-500 flex-shrink-0">
          {meta.responsavel_nome && <span>{meta.responsavel_nome}</span>}
          {meta.meta_unidade && <span>· Prazo: {meta.meta_unidade}</span>}
        </div>
        {isAdmin && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {meta.status !== 'concluido' && (
              <button type="button" onClick={() => setConfirmConc(true)} title="Concluir"
                className="text-[14px] text-green-500 hover:text-green-700 font-bold transition-colors">✓</button>
            )}
            <button type="button" onClick={() => setConfirmExcl(true)} title="Excluir"
              className="text-red-400 hover:text-red-600 font-bold text-[12px] transition-colors">✕</button>
          </div>
        )}
      </div>

      {/* Confirmações inline */}
      {confirmConc && (
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-green-700 bg-green-50 border-b border-green-100">
          <span className="flex-1">Concluir esta meta?</span>
          <button type="button" onClick={handleConcluir} disabled={salvando} className="font-medium hover:underline disabled:opacity-50">{salvando ? '…' : 'Confirmar'}</button>
          <button type="button" onClick={() => setConfirmConc(false)} className="text-gray-400">Cancelar</button>
        </div>
      )}
      {confirmExcl && (
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-red-600 bg-red-50 border-b border-red-100">
          <span className="flex-1">Excluir esta meta?</span>
          <button type="button" onClick={handleExcluir} disabled={salvando} className="font-medium hover:underline disabled:opacity-50">{salvando ? '…' : 'Confirmar'}</button>
          <button type="button" onClick={() => setConfirmExcl(false)} className="text-gray-400">Cancelar</button>
        </div>
      )}

      {/* Tabela de indicadores */}
      {indicadores.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wide">
                <th className="px-3 py-1.5 text-left">Indicador</th>
                <th className="px-3 py-1.5 text-left">Semáforo</th>
                <th className="px-3 py-1.5 text-left">Responsável</th>
                <th className="px-3 py-1.5 text-left">Meta</th>
                {isAdmin && <th className="px-2 py-1.5" />}
              </tr>
            </thead>
            <tbody>
              {indicadores.map(ind => (
                <LinhaIndicador key={ind.id} ind={ind} responsaveis={responsaveis}
                  isAdmin={isAdmin} onUpdate={onUpdate} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* + Adicionar indicador */}
      {isAdmin && (
        <div className="px-3 py-2 border-t border-gray-100">
          <FormNovoIndicadorMeta metaId={meta.id} areaId={areaId}
            responsaveis={responsaveis} onSalvo={onUpdate} />
        </div>
      )}
    </div>
  );
}

// ── Bloco 3: Agenda Macro ─────────────────────────────────────────────────────
type CelulaKey = `${string}::${number}`; // "comportamentoId::semana"

const META_CORES = [
  { bg: '#dbeafe', border: '#93c5fd', text: '#1e40af' },
  { bg: '#dcfce7', border: '#86efac', text: '#166534' },
  { bg: '#ede9fe', border: '#c4b5fd', text: '#5b21b6' },
  { bg: '#fed7aa', border: '#fb923c', text: '#9a3412' },
  { bg: '#fce7f3', border: '#f9a8d4', text: '#9d174d' },
  { bg: '#ccfbf1', border: '#5eead4', text: '#115e59' },
  { bg: '#fef9c3', border: '#fde047', text: '#92400e' },
  { bg: '#e0f2fe', border: '#7dd3fc', text: '#075985' },
];

function AgendaMacroPessoa({ pessoa, comportamentos, metas, atividades, semanas, isAdmin, mes, areaId, onAdd, onDelete }: {
  pessoa: ResponsavelItem; comportamentos: ComportamentoItem[]; metas: MetaItem[];
  atividades: AgendaMacroItem[]; semanas: number[]; isAdmin: boolean; mes: string; areaId: string;
  onAdd: (profileId: string, acoId: string, semana: number, horas: number, objetivoId: string | null) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [expandido,          setExpandido]          = useState(true);
  const [celAtiva,           setCelAtiva]           = useState<CelulaKey | null>(null);
  const [novaComportamentoId, setNovaComportamentoId] = useState('');
  const [novaHoras,          setNovaHoras]          = useState('1');
  const [salvando,           setSalvando]           = useState(false);
  const [addFormAberto,      setAddFormAberto]      = useState(false);
  const [addComportamentoId, setAddComportamentoId] = useState('');
  const [addObjetivoId,      setAddObjetivoId]      = useState('');
  const [addSemana,          setAddSemana]          = useState('');
  const [addHoras,           setAddHoras]           = useState('1');
  const [salvandoAdd,        setSalvandoAdd]        = useState(false);

  // Linhas = apenas comportamentos que já têm atividades (grade começa vazia)
  const comportamentosUsados = useMemo(() => {
    const ids = new Set(atividades.filter(a => a.profile_id === pessoa.profile_id).map(a => a.tarefa_id ?? a.acao_id));
    return comportamentos.filter(c => ids.has(c.id));
  }, [atividades, comportamentos, pessoa.profile_id]);

  // Mapa: "acoId::semana" → atividade
  const mapaAtiv = useMemo(() => {
    const m = new Map<string, AgendaMacroItem>();
    atividades.filter(a => a.profile_id === pessoa.profile_id).forEach(a => {
      const s = a.semana_ano_inicio ?? 0;
      m.set(`${a.tarefa_id ?? a.acao_id}::${s}`, a);
    });
    return m;
  }, [atividades, pessoa.profile_id]);

  const totalHoras = useMemo(() =>
    atividades.filter(a => a.profile_id === pessoa.profile_id)
      .reduce((s, a) => s + (a.tempo_estimado_horas ?? 0), 0),
  [atividades, pessoa.profile_id]);

  const corDeMeta = useMemo(() => {
    const m = new Map<string, typeof META_CORES[0]>();
    metas.forEach((meta, i) => { m.set(meta.id, META_CORES[i % META_CORES.length]); });
    return m;
  }, [metas]);

  const metasUsadasNaGrade = useMemo(() => {
    const ids = new Set(
      atividades
        .filter(a => a.profile_id === pessoa.profile_id && a.objetivo_id)
        .map(a => a.objetivo_id as string)
    );
    return metas.filter(m => ids.has(m.id));
  }, [atividades, metas, pessoa.profile_id]);

  const handleAdd = async () => {
    if (!novaComportamentoId || !celAtiva) return;
    const semana = parseInt(celAtiva.split('::')[1], 10);
    setSalvando(true);
    try { await onAdd(pessoa.profile_id, novaComportamentoId, semana, parseFloat(novaHoras) || 1, null); setCelAtiva(null); }
    finally { setSalvando(false); }
  };

  const linhas = comportamentosUsados;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header da pessoa */}
      <button type="button" onClick={() => setExpandido(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100">
        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
          {pessoa.nome.charAt(0).toUpperCase()}
        </div>
        <span className="text-sm font-medium text-gray-700 flex-1">{pessoa.nome}</span>
        {totalHoras > 0 && <span className="text-xs text-gray-400">{totalHoras}h est.</span>}
        <span className="text-gray-400 text-xs">{expandido ? '▲' : '▼'}</span>
      </button>

      {expandido && (
        <>
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ minWidth: `${180 + semanas.length * 140}px` }}>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-[10px] text-gray-500 uppercase tracking-wide">
                <th className="sticky left-0 bg-gray-50 z-10 px-3 py-2 text-left min-w-[160px] border-r border-gray-100">
                  Comportamento
                </th>
                {semanas.map(s => (
                  <th key={s} className="px-3 py-2 text-center min-w-[120px]">S{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map(comportamento => (
                <tr key={comportamento.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                  <td className="sticky left-0 bg-white z-10 px-3 py-2 text-gray-700 border-r border-gray-100 font-medium">
                    {comportamento.nome}
                  </td>
                  {semanas.map(sem => {
                    const key = `${comportamento.id}::${sem}` as CelulaKey;
                    const atv = mapaAtiv.get(`${comportamento.id}::${sem}`);
                    if (atv) {
                      const cor = atv.objetivo_id ? corDeMeta.get(atv.objetivo_id) : undefined;
                      return (
                        <td key={sem} className="px-2 py-1.5 text-center"
                          style={cor ? { backgroundColor: cor.bg } : undefined}>
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="font-medium"
                              style={cor ? { color: cor.text } : { color: '#374151' }}>
                              {atv.tempo_estimado_horas ? `${atv.tempo_estimado_horas}h` : '—'}
                            </span>
                            {isAdmin && (
                              <button type="button" onClick={() => onDelete(atv.id)}
                                className="text-red-400 hover:text-red-600 text-[10px]">✕</button>
                            )}
                          </div>
                        </td>
                      );
                    }
                    if (isAdmin) {
                      return (
                        <td key={sem} className="px-2 py-1.5 text-center">
                          {celAtiva === key ? (
                            <div className="flex flex-col gap-1">
                              <input type="number" min="0.5" step="0.5"
                                className="w-14 mx-auto text-center text-xs border border-blue-300 rounded px-1 py-0.5"
                                value={novaHoras} onChange={e => setNovaHoras(e.target.value)}
                                placeholder="h" autoFocus />
                              <div className="flex gap-1 justify-center">
                                <button type="button" onClick={handleAdd} disabled={salvando}
                                  className="text-[10px] text-blue-600 hover:underline disabled:opacity-50">
                                  {salvando ? '…' : 'OK'}
                                </button>
                                <button type="button" onClick={() => setCelAtiva(null)}
                                  className="text-[10px] text-gray-400">✕</button>
                              </div>
                            </div>
                          ) : (
                            <button type="button" onClick={() => { setNovaComportamentoId(comportamento.id); setCelAtiva(key); }}
                              className="text-gray-300 hover:text-blue-500 text-lg transition-colors">+</button>
                          )}
                        </td>
                      );
                    }
                    return <td key={sem} className="px-2 py-1.5 text-center text-gray-200">—</td>;
                  })}
                </tr>
              ))}

              {/* Linha vazia se grade está vazia */}
              {linhas.length === 0 && (
                <tr>
                  <td colSpan={semanas.length + 1} className="px-3 py-4 text-center text-xs text-gray-400">
                    Nenhum comportamento planejado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Legenda de cores por meta */}
        {metasUsadasNaGrade.length > 0 && (
          <div className="px-3 py-2 border-t border-gray-100 flex flex-wrap gap-3">
            {metasUsadasNaGrade.map(m => {
              const cor = corDeMeta.get(m.id);
              return (
                <span key={m.id} className="flex items-center gap-1 text-[10px]">
                  <span className="w-3 h-3 rounded-sm flex-shrink-0 inline-block"
                    style={{ backgroundColor: cor?.bg, border: `1px solid ${cor?.border}` }} />
                  <span style={{ color: cor?.text }}>{m.descricao}</span>
                </span>
              );
            })}
          </div>
        )}

        {/* Mini-form: + Adicionar comportamento */}
        {isAdmin && (
          <div className="px-4 py-3 border-t border-gray-100">
            {addFormAberto ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 mb-0.5 block">Comportamento</label>
                    <select className="text-xs border border-gray-300 rounded px-2 py-1.5 max-w-[220px]"
                      value={addComportamentoId} onChange={e => setAddComportamentoId(e.target.value)}>
                      <option value="">— selecionar —</option>
                      {comportamentos.filter(c => !linhas.some(l => l.id === c.id)).map(c => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 mb-0.5 block">Meta vinculada</label>
                    <select className="text-xs border border-gray-300 rounded px-2 py-1.5 max-w-[200px]"
                      value={addObjetivoId} onChange={e => setAddObjetivoId(e.target.value)}>
                      <option value="">— opcional —</option>
                      {metas.map(m => (
                        <option key={m.id} value={m.id}>{m.descricao}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 mb-0.5 block">Semana</label>
                    <select className="text-xs border border-gray-300 rounded px-2 py-1.5"
                      value={addSemana} onChange={e => setAddSemana(e.target.value)}>
                      <option value="">— semana —</option>
                      {semanas.map(s => <option key={s} value={String(s)}>S{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 mb-0.5 block">Horas est.</label>
                    <input type="number" min="0.5" step="0.5" className="w-16 text-xs border border-gray-300 rounded px-2 py-1.5"
                      value={addHoras} onChange={e => setAddHoras(e.target.value)} />
                  </div>
                  <button type="button"
                    disabled={!addComportamentoId || !addSemana || salvandoAdd}
                    onClick={async () => {
                      if (!addComportamentoId || !addSemana) return;
                      setSalvandoAdd(true);
                      try {
                        await onAdd(pessoa.profile_id, addComportamentoId, parseInt(addSemana, 10), parseFloat(addHoras) || 1, addObjetivoId || null);
                        setAddComportamentoId(''); setAddObjetivoId(''); setAddSemana(''); setAddHoras('1'); setAddFormAberto(false);
                      } finally { setSalvandoAdd(false); }
                    }}
                    className="text-xs px-3 py-1.5 bg-blue-500 text-white rounded disabled:opacity-50 hover:bg-blue-600 transition-colors">
                    {salvandoAdd ? 'Salvando...' : 'Adicionar'}
                  </button>
                  <button type="button" onClick={() => { setAddFormAberto(false); setAddComportamentoId(''); setAddObjetivoId(''); }}
                    className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
                </div>
                <a href={`/carometro/comportamentos-e-atividades?area=${areaId}`}
                  className="text-[10px] text-blue-500 hover:underline">
                  Não encontrou? Cadastre em Comportamentos e Atividades →
                </a>
              </div>
            ) : (
              <button type="button" onClick={() => setAddFormAberto(true)}
                className="text-xs text-gray-400 hover:text-blue-600 transition-colors">
                + Adicionar comportamento
              </button>
            )}
          </div>
        )}
        </>
      )}
    </div>
  );
}

// ── Formulário de nova meta ───────────────────────────────────────────────────
function FormNovaMeta({ areaId, responsaveis, onSalvo }: {
  areaId: string; responsaveis: ResponsavelItem[]; onSalvo: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [aberto,   setAberto]   = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({ descricao: '', tipo: 'atingivel', respId: '', metaUnidade: '' });
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSalvar = async () => {
    if (!form.descricao.trim()) return;
    setSalvando(true);
    try {
      const { data: ins, error: e } = await supabase.from('objetivos')
        .insert({ area_id: areaId, descricao: form.descricao.trim(), tipo: form.tipo,
          profile_id: form.respId || null, meta_unidade: form.metaUnidade || null, status: 'ativo' })
        .select('id').single();
      if (e) { console.error('[NovaMeta]', e); return; }
      LOG({ modulo: 'Planejamento', entidade: 'objetivos', entidade_id: String((ins as { id: unknown }).id),
        operacao: 'INSERT', descricao: `Nova meta no Plano Boné Day: ${form.descricao}` });
      setForm({ descricao: '', tipo: 'atingivel', respId: '', metaUnidade: '' });
      setAberto(false); onSalvo();
    } finally { setSalvando(false); }
  };

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)}
        className="w-full text-xs text-gray-400 hover:text-blue-600 border border-dashed border-gray-300 hover:border-blue-300 rounded-lg py-2 transition-colors">
        + Adicionar meta
      </button>
    );
  }
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm flex flex-col gap-2">
      <p className="text-xs font-medium text-gray-700">Nova meta</p>
      <input className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300"
        placeholder="Descrição *" value={form.descricao} onChange={e => set('descricao', e.target.value)} autoFocus />
      <div className="grid grid-cols-3 gap-2">
        <select className="text-xs border border-gray-300 rounded px-2 py-1.5" value={form.tipo} onChange={e => set('tipo', e.target.value)}>
          <option value="atingivel">Atingível</option>
          <option value="recorrente">Recorrente</option>
        </select>
        <input type="date" className="text-xs border border-gray-300 rounded px-2 py-1.5"
          value={form.metaUnidade} onChange={e => set('metaUnidade', e.target.value)} />
        {responsaveis.length > 0 && (
          <select className="text-xs border border-gray-300 rounded px-2 py-1.5" value={form.respId} onChange={e => set('respId', e.target.value)}>
            <option value="">— Responsável —</option>
            {responsaveis.map(r => <option key={r.profile_id} value={r.profile_id}>{r.nome}</option>)}
          </select>
        )}
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={() => setAberto(false)} className="text-xs text-gray-500 hover:text-gray-700">Cancelar</button>
        <button type="button" onClick={handleSalvar} disabled={!form.descricao.trim() || salvando}
          className="text-xs px-3 py-1 bg-blue-500 text-white rounded disabled:opacity-50 hover:bg-blue-600">
          {salvando ? 'Criando...' : 'Criar meta'}
        </button>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function PreBoneDayPage() {
  const supabase = useMemo(() => createClient(), []);
  const { effectiveProfileId } = useEffectiveUser();

  // Select de área independente (persistido em localStorage)
  const [areas,          setAreas]          = useState<{ id: string; nome: string }[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string>('');

  useEffect(() => {
    const saved = localStorage.getItem('carometro_ultima_area');
    if (saved) setSelectedAreaId(saved);
  }, []);

  useEffect(() => {
    void (listarAreas as (s: unknown, f: string) => Promise<{ data: { id: string; nome: string }[] | null }>)(
      supabase, 'id, nome'
    ).then(({ data }) => {
      const list = data ?? [];
      setAreas(list);
      setSelectedAreaId(prev => {
        if (prev && list.some(a => a.id === prev)) return prev;
        return list[0]?.id ?? '';
      });
    });
  }, [supabase]);

  const areaId = selectedAreaId || null; // alias usado por handlers e hook

  const [isAdmin,    setIsAdmin]    = useState<boolean | null>(null);
  const [bloco1Open, setBloco1Open] = useState(false);
  const [bloco2Open, setBloco2Open] = useState(true);
  const [bloco3Open, setBloco3Open] = useState(true);

  const {
    metas, metasNaoConcluidas, indicadores, responsaveis, comportamentos, agendaMacro,
    mes, setMes, isLoading, error, recarregar,
  } = usePlanoBoneDay(areaId, effectiveProfileId);

  const monthOptions = useMemo(() => getMonthOptions(), []);
  const semanas      = useMemo(() => semanasDoMes(mes), [mes]);
  const semanaAtual  = useMemo(() => isoWeek(new Date()), []);

  // Admin check
  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsAdmin(false); return; }
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      setIsAdmin((prof as { role?: string } | null)?.role === 'admin');
    })();
  }, [supabase]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleRelançar = useCallback(async (id: string, f: { metaUnidade: string; respId: string }) => {
    const { error: e } = await supabase.from('objetivos')
      .update({ meta_unidade: f.metaUnidade || null, profile_id: f.respId || null, status: 'ativo' }).eq('id', id);
    if (e) { console.error('[Relançar]', e); return; }
    LOG({ modulo: 'Planejamento', entidade: 'objetivos', entidade_id: id,
      operacao: 'UPDATE', descricao: 'Meta relançada no Plano Boné Day' });
    recarregar();
  }, [supabase, recarregar]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConcluirMeta = useCallback(async (id: string) => {
    const { error: e } = await supabase.from('objetivos')
      .update({ status: 'concluido', concluido_em: new Date().toISOString() }).eq('id', id);
    if (e) { console.error('[ConcluirMeta]', e); return; }
    LOG({ modulo: 'Planejamento', entidade: 'objetivos', entidade_id: id, operacao: 'UPDATE', descricao: 'Meta concluída' });
    recarregar();
  }, [supabase, recarregar]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExcluirMeta = useCallback(async (id: string) => {
    const { error: e } = await supabase.from('objetivos').delete().eq('id', id);
    if (e) { console.error('[ExcluirMeta]', e); return; }
    LOG({ modulo: 'Planejamento', entidade: 'objetivos', entidade_id: id, operacao: 'DELETE' });
    recarregar();
  }, [supabase, recarregar]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddAtividade = useCallback(async (profileId: string, tarefaId: string, semana: number, horas: number, objetivoId: string | null) => {
    if (!areaId) return;

    // Agenda Macro é visual por pessoa — o INSERT usa sempre o usuário logado para evitar FK violation
    const pidValido = effectiveProfileId ?? profileId;

    // acao_id é NOT NULL — buscar ou criar placeholder para a tarefa
    const { data: acaoExistente } = await supabase
      .from('acoes').select('id').eq('tarefa_id', tarefaId).limit(1).maybeSingle();

    let acaoId = (acaoExistente as { id: string } | null)?.id;
    if (!acaoId) {
      const { data: novaAcao, error: errAcao } = await supabase
        .from('acoes')
        .insert({ nome: tarefaId, tarefa_id: tarefaId })
        .select('id').single();
      if (errAcao || !novaAcao) { console.error('[AddAtividade] Falha ao criar acao placeholder:', errAcao); return; }
      acaoId = (novaAcao as { id: string }).id;
    }

    const { data: ins, error: e } = await supabase.from('gantt_planejamento')
      .insert({ acao_id: acaoId, profile_id: pidValido, semana_ano_inicio: semana, semana_ano_fim: semana,
        tempo_estimado_horas: horas, origem: 'pre_bone_day', pre_bone_day_mes: mes,
        comportamento_chave: false, objetivo_id: objetivoId })
      .select('id').single();
    if (e) { console.error('[AddAtividade] Falha no INSERT gantt_planejamento:', e); return; }
    LOG({ modulo: 'Planejamento', entidade: 'gantt_planejamento',
      entidade_id: String((ins as { id: unknown }).id), operacao: 'INSERT',
      descricao: `Atividade Boné Day inserida S${semana}` });
    recarregar();
  }, [supabase, areaId, effectiveProfileId, mes, recarregar]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleteAtividade = useCallback(async (id: string) => {
    const { error: e } = await supabase.from('gantt_planejamento').delete().eq('id', id);
    if (e) { console.error('[DeleteAtividade]', e); return; }
    recarregar();
  }, [supabase, recarregar]);

  const mesLabel = monthOptions.find(o => o.value === mes)?.label ?? mes;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Plano Boné Day</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs bg-blue-100 text-blue-700 font-medium px-2 py-0.5 rounded-full">{mesLabel}</span>
            <span className="text-xs text-gray-500">S{semanaAtual}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {areas.length > 0 && (
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500">Área:</label>
              <select className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                value={selectedAreaId}
                onChange={e => { setSelectedAreaId(e.target.value); localStorage.setItem('carometro_ultima_area', e.target.value); }}>
                {areas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500">Mês:</label>
            <select className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
              value={mes} onChange={e => setMes(e.target.value)}>
              {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <SeletorUsuarioAdmin />
        </div>
      </div>

      {error && <p className="text-xs text-red-500">Erro: {error}</p>}

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map(i => <div key={i} className="h-20 bg-gray-200 animate-pulse rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* ── Bloco 1: Metas não concluídas ──────────────────────────────── */}
          <section className="rounded-xl border border-amber-200 bg-amber-50 shadow-sm overflow-hidden">
            <button type="button"
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-amber-100 transition-colors"
              onClick={() => setBloco1Open(v => !v)}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-amber-800">⚠ Metas não concluídas</span>
                {metasNaoConcluidas.length > 0 && (
                  <span className="text-xs text-amber-700 bg-amber-200 rounded-full px-2 py-0.5">
                    {metasNaoConcluidas.length}
                  </span>
                )}
              </div>
              <span className="text-amber-600 text-xs">{bloco1Open ? '▲' : '▼'}</span>
            </button>
            {bloco1Open && (
              <div className="px-4 pb-4 border-t border-amber-200 pt-3">
                {metasNaoConcluidas.length === 0 ? (
                  <p className="text-xs text-amber-700">Todas as metas foram concluídas! 🎉</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {metasNaoConcluidas.map(meta => (
                      <MetaNaoConcluida key={meta.id} meta={meta} responsaveis={responsaveis} onRelançar={handleRelançar} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ── Bloco 2: Metas & Indicadores ───────────────────────────────── */}
          <section className="rounded-xl border border-gray-200 bg-gray-50 shadow-sm overflow-hidden">
            <button type="button"
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-100 transition-colors"
              onClick={() => setBloco2Open(v => !v)}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-700">Metas &amp; Indicadores</span>
                {metas.length > 0 && (
                  <span className="text-xs text-gray-400 bg-gray-200 rounded-full px-2 py-0.5">
                    {metas.length} metas · {indicadores.length} indicadores
                  </span>
                )}
              </div>
              <span className="text-gray-400 text-xs">{bloco2Open ? '▲' : '▼'}</span>
            </button>
            {bloco2Open && (
              <div className="px-4 pb-4 border-t border-gray-200 pt-3 flex flex-col gap-3">
                {metas.length === 0 ? (
                  <p className="text-xs text-gray-400">Nenhuma meta ativa para esta área.</p>
                ) : (
                  metas.map(meta => (
                    <MetaComIndicadores
                      key={meta.id} meta={meta}
                      indicadores={indicadores.filter(i => i.objetivo_id === meta.id)}
                      responsaveis={responsaveis}
                      isAdmin={Boolean(isAdmin)} areaId={areaId ?? ''}
                      onUpdate={recarregar}
                      onConcluir={handleConcluirMeta}
                      onExcluir={handleExcluirMeta}
                    />
                  ))
                )}
                {isAdmin && areaId && (
                  <FormNovaMeta areaId={areaId} responsaveis={responsaveis} onSalvo={recarregar} />
                )}
              </div>
            )}
          </section>

          {/* ── Bloco 3: Agenda Macro ───────────────────────────────────────── */}
          <section className="rounded-xl border border-gray-200 bg-gray-50 shadow-sm overflow-hidden">
            <button type="button"
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-100 transition-colors"
              onClick={() => setBloco3Open(v => !v)}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-700">Agenda Macro</span>
                <span className="text-xs text-gray-400 bg-gray-200 rounded-full px-2 py-0.5">
                  {semanas.map(s => `S${s}`).join(' · ')}
                </span>
              </div>
              <span className="text-gray-400 text-xs">{bloco3Open ? '▲' : '▼'}</span>
            </button>
            {bloco3Open && (
              <div className="px-4 pb-4 border-t border-gray-200 pt-3 flex flex-col gap-3">
                {responsaveis.length === 0 ? (
                  <p className="text-xs text-gray-400">Nenhum responsável cadastrado para esta área.</p>
                ) : (
                  responsaveis.map(p => (
                    <AgendaMacroPessoa
                      key={p.profile_id} pessoa={p} comportamentos={comportamentos}
                      metas={metas} atividades={agendaMacro} semanas={semanas}
                      isAdmin={Boolean(isAdmin)} mes={mes} areaId={areaId ?? ''}
                      onAdd={handleAddAtividade} onDelete={handleDeleteAtividade}
                    />
                  ))
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
