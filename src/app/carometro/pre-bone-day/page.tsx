'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BoneDayTabs } from '@/components/carometro/BoneDayTabs';
import { createClient } from '@/lib/supabase/client';
import { useEffectiveUser } from '@/hooks/useEffectiveUser';
import {
  usePlanoBoneDay, IndicadorBone, ComportamentoItem, AgendaMacroItem,
  ObjetivoResponsavel, semanasDoMes, getMonthOptions,
} from '@/hooks/usePlanoBoneDay';
import type { MetaItem, ResponsavelItem } from '@/hooks/useMetasIndicadores';
import { SeletorUsuarioAdmin } from '@/components/carometro/todo/SeletorUsuarioAdmin';
import { registrarLog } from '@/hooks/useAuditLog';
import { isoWeek } from '@/utils/periodos';
import { listarAreas } from '@/utils/areasOrder';
import { listarEscalasCustom, carregarEscalasCustom, salvarNovaEscalaCustom } from '@/utils/escalasCustom';

const LOG = (args: Record<string, unknown>) =>
  void (registrarLog as unknown as (a: Record<string, unknown>) => Promise<void>)(args);

// ── Utilitários ───────────────────────────────────────────────────────────────
function formatarDataCurta(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ── Conta dias úteis (seg-sex) entre duas datas, inclusive ──────────────────
function contarDiasUteisRange(inicio: Date, fim: Date): number {
  let count = 0;
  const d = new Date(inicio);
  while (d <= fim) { if (d.getDay() !== 0 && d.getDay() !== 6) count++; d.setDate(d.getDate() + 1); }
  return count;
}

// ── Helper: % esperado de um projeto com base em dias úteis decorridos ──────
function calcularEsperadoPct(dataInicio: string | null, dataFim: string | null, diasUteis: number | null): number | null {
  if (!dataInicio || !dataFim) return null;
  const inicio = new Date(dataInicio + 'T00:00:00');
  const fim    = new Date(dataFim    + 'T00:00:00');
  // Fallback: calcula dias úteis localmente se não veio do banco
  const du = (diasUteis && diasUteis > 0) ? diasUteis : contarDiasUteisRange(inicio, fim);
  if (du <= 0) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  if (hoje < inicio) return 0;
  if (hoje > fim)    return 100;
  return Math.min(100, Math.round((contarDiasUteisRange(inicio, hoje) / du) * 100));
}

// ── Helper: semanas do projeto com % esperado no fim de cada semana ──────────
function calcularSemanasTimeline(
  dataInicio: string,
  dataFim: string,
  rawDias: number | null,
): Array<{ semana: number; esperadoPct: number; isCurrent: boolean; isFuture: boolean }> {
  if (!dataInicio || !dataFim) return [];
  const inicio = new Date(dataInicio + 'T00:00:00');
  const fim    = new Date(dataFim    + 'T00:00:00');
  const diasUteis = (rawDias && rawDias > 0) ? rawDias : contarDiasUteisRange(inicio, fim);
  if (diasUteis <= 0) return [];
  const hoje   = new Date(); hoje.setHours(0, 0, 0, 0);
  const sAtual = isoWeek(hoje);
  const result: Array<{ semana: number; esperadoPct: number; isCurrent: boolean; isFuture: boolean }> = [];
  const seen   = new Set<number>();

  // Começa na segunda-feira da semana de início
  const d = new Date(inicio);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));

  while (d <= fim) {
    const s = isoWeek(d);
    if (!seen.has(s)) {
      seen.add(s);
      const sexta = new Date(d); sexta.setDate(d.getDate() + 4);
      const ref   = sexta > fim ? new Date(fim) : new Date(sexta);
      let count   = 0;
      const dd    = new Date(inicio);
      while (dd <= ref) {
        if (dd.getDay() !== 0 && dd.getDay() !== 6) count++;
        dd.setDate(dd.getDate() + 1);
      }
      result.push({
        semana: s,
        esperadoPct: Math.min(100, Math.round((count / diasUteis) * 100)),
        isCurrent: s === sAtual,
        isFuture:  s > sAtual,
      });
    }
    d.setDate(d.getDate() + 7);
  }
  return result;
}

// ── Mini barra de cores para a semana atual do Projeto (coluna Semáforo) ─────
function MiniProjetoBar({ esperadoPct }: { esperadoPct: number }) {
  const e = Math.max(0, Math.min(100, esperadoPct));
  if (e <= 0) return <span className="text-[9px] text-purple-400">Projeto · aguarda início</span>;
  const ve = Math.round(e * 0.75);
  const vc = Math.round(e * 0.60);
  const am = Math.round(e * 0.30);
  const tip = `Meta desta semana: ${e}%\n≥${ve}% → verde escuro\n≥${vc}% → verde claro\n≥${am}% → amarelo\n<${am}% → vermelho`;
  return (
    <div className="flex flex-col gap-0.5" title={tip}>
      <span className="text-[9px] text-purple-600 font-medium">meta: {e}%</span>
      <div className="flex rounded-sm overflow-hidden h-2 w-full">
        <div style={{ width: `${am}%`,      backgroundColor: '#d24141' }} />
        <div style={{ width: `${vc - am}%`, backgroundColor: '#f2c94c' }} />
        <div style={{ width: `${ve - vc}%`, backgroundColor: '#52b36f' }} />
        <div style={{ width: `${e  - ve}%`, backgroundColor: '#1e7a3a' }} />
        {e < 100 && <div style={{ width: `${100 - e}%`, backgroundColor: '#e5e7eb' }} />}
      </div>
      <div className="flex text-[8px] gap-1.5">
        <span style={{ color: '#d24141' }}>•&lt;{am}%</span>
        <span style={{ color: '#f2c94c' }}>•&lt;{vc}%</span>
        <span style={{ color: '#52b36f' }}>•&lt;{ve}%</span>
        <span style={{ color: '#1e7a3a' }}>•≥{ve}%</span>
      </div>
    </div>
  );
}

// ── Timeline semanal do Projeto (dentro da seção de datas na meta) ────────────
function ProjetoTimeline({ dataInicio, dataFim, diasUteis }: {
  dataInicio: string; dataFim: string; diasUteis: number | null;
}) {
  const semanas = calcularSemanasTimeline(dataInicio, dataFim, diasUteis);
  if (semanas.length === 0) return null;
  return (
    <div className="flex items-center gap-1 overflow-x-auto py-0.5 flex-wrap">
      {semanas.map((s, i) => {
        const e  = s.esperadoPct;
        const ve = Math.round(e * 0.75);
        const vc = Math.round(e * 0.60);
        const am = Math.round(e * 0.30);
        const tip = `S${s.semana} · meta ${e}%\n≥${ve}% verde escuro  ≥${vc}% verde claro  ≥${am}% amarelo  <${am}% vermelho`;
        return (
          <div key={s.semana} className="flex items-center gap-1 flex-shrink-0">
            {i > 0 && <span className="text-gray-300 text-[9px]">→</span>}
            {s.isFuture ? (
              <span className="text-[9px] px-1.5 py-0.5 rounded cursor-default text-gray-400 bg-gray-50 border border-gray-200" title={tip}>
                S{s.semana} · {e}%
              </span>
            ) : (
              <div className={`flex flex-col gap-0.5 min-w-[72px] ${!s.isCurrent ? 'opacity-60' : ''}`} title={tip}>
                <span className={`text-[9px] font-semibold ${s.isCurrent ? 'text-purple-700' : 'text-gray-500'}`}>
                  S{s.semana} · {e}%
                </span>
                <div className="flex rounded-sm overflow-hidden h-1.5 w-full">
                  <div style={{ width: `${am}%`,      backgroundColor: '#d24141' }} />
                  <div style={{ width: `${vc - am}%`, backgroundColor: '#f2c94c' }} />
                  <div style={{ width: `${ve - vc}%`, backgroundColor: '#52b36f' }} />
                  <div style={{ width: `${e  - ve}%`, backgroundColor: '#1e7a3a' }} />
                  {e < 100 && <div style={{ width: `${100 - e}%`, backgroundColor: '#e5e7eb' }} />}
                </div>
                <div className="flex text-[8px] gap-1 flex-wrap">
                  <span style={{ color: '#d24141' }}>•&lt;{am}%</span>
                  <span style={{ color: '#f2c94c' }}>•&lt;{vc}%</span>
                  <span style={{ color: '#1e7a3a' }}>•≥{ve}%</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const TIPO_BADGE: Record<string, string> = {
  atingivel:           'bg-blue-100 text-blue-700',
  recorrente:          'bg-green-100 text-green-700',
  'atingivel - projeto': 'bg-purple-100 text-purple-700',
};

const TIPO_LABEL: Record<string, string> = {
  atingivel:           'Atingível',
  recorrente:          'Recorrente',
  'atingivel - projeto': 'Projeto',
};

function TipoBadge({ tipo }: { tipo: string | null }) {
  if (!tipo) return null;
  const key = tipo.toLowerCase();
  const cls = TIPO_BADGE[key] ?? 'bg-gray-100 text-gray-600';
  const label = TIPO_LABEL[key] ?? (tipo.charAt(0).toUpperCase() + tipo.slice(1).toLowerCase());
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cls}`}>
      {label}
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
  if (tipo.startsWith('custom:')) {
    return { escala_tipo: 'custom', escala_custom_id: tipo.slice(7), faixas: [] };
  }
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
function MetaNaoConcluida({ meta, responsaveis, podeRelançar, onRelançar, onArquivar }: {
  meta: MetaItem; responsaveis: ResponsavelItem[];
  podeRelançar: boolean;
  onRelançar: (id: string, f: { metaUnidade: string; respId: string }) => Promise<void>;
  onArquivar: (id: string) => Promise<void>;
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
          {meta.criado_em && (
            <span className="text-gray-400">· aberta {formatarDataCurta(meta.criado_em)}</span>
          )}
          {meta.responsavel_nome && <span>· {meta.responsavel_nome}</span>}
        </div>
        {podeRelançar && !aberto && (
          <div className="flex gap-1.5 flex-shrink-0">
            <button type="button" onClick={() => setAberto(true)}
              className="text-xs px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-300 rounded-lg transition-colors">
              Relançar
            </button>
            <button type="button" onClick={() => void onArquivar(meta.id)}
              className="text-xs px-2.5 py-1 bg-gray-50 hover:bg-gray-100 text-gray-500 border border-gray-300 rounded-lg transition-colors"
              title="Arquivar — não relançar esta meta">
              Arquivar
            </button>
          </div>
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

// Indicadores — responsável editável por admin; todos podem assumir.
function LinhaIndicador({ ind, responsaveis, isAdmin, currentUserId, onUpdate, esperadoPct }: {
  ind: IndicadorBone; responsaveis: ResponsavelItem[];
  isAdmin: boolean; currentUserId: string | null; onUpdate: () => void;
  esperadoPct?: number | null;
}) {
  const supabase  = useMemo(() => createClient(), []);
  const [salvandoResp, setSalvandoResp] = useState(false);
  const [confirmExcl,  setConfirmExcl]  = useState(false);
  const [editando,     setEditando]     = useState(false);

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

  const respNome = responsaveis.find(r => r.profile_id === ind.profile_id)?.nome ?? 'Sem responsável';

  const isMinha = !!currentUserId && ind.profile_id === currentUserId;

  if (editando) {
    return (
      <tr className="border-b border-gray-100 bg-blue-50/40">
        <td colSpan={isAdmin ? 4 : 3} className="px-3 py-2">
          <FormEditarIndicador ind={ind} onSalvo={() => { setEditando(false); onUpdate(); }} onCancelar={() => setEditando(false)} />
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50/50">
      <td className="px-3 py-2 text-xs text-gray-700">
        <div className="flex items-center gap-1">
          {ind.indicador_chave && <span title="Indicador chave" className="text-[11px]">🔑</span>}
          <span>{ind.nome}</span>
          {ind.tipo && <span className="text-[9px] text-gray-400 bg-gray-100 px-1 rounded">{ind.tipo}</span>}
        </div>
      </td>
      <td className="px-3 py-2">
        {(ind.semaforo_faixas as { is_projeto_relativo?: boolean } | null)?.is_projeto_relativo
          ? (esperadoPct !== null && esperadoPct !== undefined
            ? <MiniProjetoBar esperadoPct={esperadoPct} />
            : <span className="text-[9px] text-purple-400">Projeto</span>)
          : <SemaforoBadges semaforo_faixas={ind.semaforo_faixas} />
        }
      </td>
      <td className="px-3 py-2">
        {isAdmin ? (
          <select className="text-[11px] border border-gray-200 rounded px-1.5 py-0.5 max-w-[130px] disabled:opacity-50"
            value={ind.profile_id ?? ''} onChange={e => handleRespChange(e.target.value)} disabled={salvandoResp}>
            <option value="">Sem responsável</option>
            {responsaveis.map(r => <option key={r.profile_id} value={r.profile_id}>{r.nome}</option>)}
          </select>
        ) : (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-gray-500 flex-1 min-w-0 truncate">{respNome}</span>
            {currentUserId && (
              <button type="button" disabled={salvandoResp}
                onClick={() => handleRespChange(isMinha ? '' : currentUserId)}
                className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors flex-shrink-0 disabled:opacity-50 ${
                  isMinha
                    ? 'bg-blue-100 text-blue-700 border-blue-300'
                    : 'text-gray-400 border-gray-200 hover:border-blue-300 hover:text-blue-500'
                }`}>
                {isMinha ? '✓ Minha' : 'Assumir'}
              </button>
            )}
          </div>
        )}
      </td>
      {isAdmin && (
        <td className="px-2 py-2 text-right">
          {confirmExcl ? (
            <span className="flex gap-1 text-[10px] text-red-600 justify-end">
              <button type="button" onClick={handleExcluir} className="font-medium hover:underline">Sim</button>
              <button type="button" onClick={() => setConfirmExcl(false)} className="text-gray-400">Não</button>
            </span>
          ) : (
            <span className="flex gap-1 justify-end items-center">
              <button type="button" onClick={() => setEditando(true)}
                className="text-blue-400 hover:text-blue-600 text-xs" title="Editar">✎</button>
              <button type="button" onClick={() => setConfirmExcl(true)}
                className="text-red-400 hover:text-red-600 text-xs" title="Excluir">✕</button>
            </span>
          )}
        </td>
      )}
    </tr>
  );
}

type EscalaCustom = { id: string; nome: string; modo: 'lista' | 'percentual' | 'numero'; valores?: string[] };
type FaixaForm   = { cor: string; limite: string; comparacao: 'gte' | 'lte' | 'eq' };

const PRESET_FAIXAS_MAP: Record<string, FaixaForm[]> = {
  percentual: [
    { cor: '#1e7a3a', limite: '75', comparacao: 'gte' },
    { cor: '#52b36f', limite: '64', comparacao: 'gte' },
    { cor: '#f2c94c', limite: '35', comparacao: 'gte' },
    { cor: '#d24141', limite: '0',  comparacao: 'gte' },
  ],
  quantidade: [
    { cor: '#1e7a3a', limite: '75', comparacao: 'gte' },
    { cor: '#52b36f', limite: '64', comparacao: 'gte' },
    { cor: '#f2c94c', limite: '35', comparacao: 'gte' },
    { cor: '#d24141', limite: '0',  comparacao: 'gte' },
  ],
  sim_nao: [
    { cor: '#1e7a3a', limite: 'SIM',      comparacao: 'eq' },
    { cor: '#52b36f', limite: 'SIM',      comparacao: 'eq' },
    { cor: '#f2c94c', limite: 'NAO',      comparacao: 'eq' },
    { cor: '#d24141', limite: 'NAO',      comparacao: 'eq' },
  ],
  status_3: [
    { cor: '#1e7a3a', limite: 'OK',       comparacao: 'eq' },
    { cor: '#52b36f', limite: 'OK',       comparacao: 'eq' },
    { cor: '#f2c94c', limite: 'ANDAMENTO',comparacao: 'eq' },
    { cor: '#d24141', limite: 'NAO_OK',   comparacao: 'eq' },
  ],
};

function presetFaixasParaTipo(tipo: string, ecs: EscalaCustom[]): FaixaForm[] {
  if (PRESET_FAIXAS_MAP[tipo]) return PRESET_FAIXAS_MAP[tipo].map(f => ({ ...f }));
  if (tipo.startsWith('custom:')) {
    const ec = ecs.find(e => e.id === tipo.slice(7));
    if (!ec) return [{ cor: '#1e7a3a', limite: '', comparacao: 'gte' }];
    if (ec.modo === 'lista') {
      const v = ec.valores ?? ['', ''];
      return [
        { cor: '#1e7a3a', limite: v[0] ?? '',              comparacao: 'eq' },
        { cor: '#52b36f', limite: v[0] ?? '',              comparacao: 'eq' },
        { cor: '#f2c94c', limite: v[1] ?? '',              comparacao: 'eq' },
        { cor: '#d24141', limite: v[v.length - 1] ?? '',   comparacao: 'eq' },
      ];
    }
    return PRESET_FAIXAS_MAP.percentual.map(f => ({ ...f }));
  }
  return PRESET_FAIXAS_MAP.percentual.map(f => ({ ...f }));
}

function FormEditarIndicador({ ind, onSalvo, onCancelar }: {
  ind: IndicadorBone; onSalvo: () => void; onCancelar: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [salvando, setSalvando] = useState(false);

  const sf = ind.semaforo_faixas as { escala_tipo?: string; escala_custom_id?: string; faixas?: FaixaItem[] } | null;
  const initialTipo = sf?.escala_custom_id ? `custom:${sf.escala_custom_id}`
    : sf?.escala_tipo === 'sim_nao' ? 'sim_nao'
    : sf?.escala_tipo === 'status_3' ? 'status_3'
    : ind.tipo ?? 'percentual';
  const initialFaixas: FaixaForm[] = (sf?.faixas ?? []).map(f => ({
    cor: f.cor, limite: String(f.limite), comparacao: (f.comparacao as 'gte' | 'lte' | 'eq') ?? 'gte',
  }));

  const [form, setForm] = useState({ nome: ind.nome, tipo: initialTipo, chave: ind.indicador_chave });
  const [faixas, setFaixas] = useState<FaixaForm[]>(
    initialFaixas.length > 0 ? initialFaixas : PRESET_FAIXAS_MAP.percentual.map(f => ({ ...f }))
  );
  const [escalasCustom, setEscalasCustom] = useState<EscalaCustom[]>(() => (listarEscalasCustom as () => EscalaCustom[])());

  useEffect(() => {
    void (carregarEscalasCustom as (s: ReturnType<typeof createClient>) => Promise<unknown>)(supabase)
      .then(() => setEscalasCustom((listarEscalasCustom as () => EscalaCustom[])()));
  }, [supabase]);

  const handleTipoChange = (v: string) => {
    setForm(p => ({ ...p, tipo: v }));
    setFaixas(presetFaixasParaTipo(v, escalasCustom));
  };

  const handleSalvar = async () => {
    if (!form.nome.trim()) return;
    setSalvando(true);
    try {
      const tipo = form.tipo;
      const escalaCustomId = tipo.startsWith('custom:') ? tipo.slice(7) : null;
      const escalaTipo = escalaCustomId ? 'custom' : tipo === 'sim_nao' ? 'sim_nao' : tipo === 'status_3' ? 'status_3' : tipo;
      const sfPayload = { escala_tipo: escalaTipo, escala_custom_id: escalaCustomId, faixas };
      const tipoDb = tipo === 'percentual' ? 'percentual' : tipo === 'quantidade' ? 'quantidade' : 'outro';
      const { error: e } = await supabase.from('indicadores')
        .update({ nome: form.nome.trim(), indicador_chave: form.chave, tipo: tipoDb, semaforo_faixas: sfPayload })
        .eq('id', ind.id);
      if (e) { console.error('[EditIndMeta]', e); return; }
      onSalvo();
    } finally { setSalvando(false); }
  };

  const isEq = form.tipo === 'sim_nao' || form.tipo === 'status_3' ||
    (form.tipo.startsWith('custom:') && escalasCustom.find(e => e.id === form.tipo.slice(7))?.modo === 'lista');
  const updateFaixa = (i: number, k: keyof FaixaForm, v: string) =>
    setFaixas(prev => prev.map((f, j) => j === i ? { ...f, [k]: v } : f));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 items-center flex-wrap">
        <input className="flex-1 min-w-[120px] text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300"
          value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} autoFocus />
        <select className="text-xs border border-gray-300 rounded px-2 py-1.5" value={form.tipo} onChange={e => handleTipoChange(e.target.value)}>
          {TIPOS_SEMAFORO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          {escalasCustom.length > 0 && (
            <optgroup label="Escalas personalizadas">
              {escalasCustom.map(ec => <option key={ec.id} value={`custom:${ec.id}`}>{ec.nome}</option>)}
            </optgroup>
          )}
        </select>
        <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer flex-shrink-0">
          <input type="checkbox" checked={form.chave} onChange={e => setForm(p => ({ ...p, chave: e.target.checked }))} />🔑
        </label>
      </div>
      <div className="flex flex-col gap-1 bg-white border border-gray-100 rounded px-2 py-1.5">
        <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Faixas do semáforo</p>
        {faixas.map((f, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <label className="relative w-4 h-4 rounded-full cursor-pointer flex-shrink-0 overflow-hidden" style={{ backgroundColor: f.cor }}>
              <input type="color" value={f.cor} onChange={e => updateFaixa(i, 'cor', e.target.value)}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
            </label>
            {isEq ? (
              <span className="text-[10px] text-gray-400 w-6 text-center">=</span>
            ) : (
              <select className="text-[10px] border border-gray-200 rounded px-1 py-0.5 w-10"
                value={f.comparacao} onChange={e => updateFaixa(i, 'comparacao', e.target.value as 'gte' | 'lte' | 'eq')}>
                <option value="gte">≥</option><option value="lte">≤</option><option value="eq">=</option>
              </select>
            )}
            <input className="text-xs border border-gray-300 rounded px-2 py-0.5 flex-1 min-w-0"
              value={f.limite} onChange={e => updateFaixa(i, 'limite', e.target.value)} placeholder="Valor" />
            {faixas.length > 1 && (
              <button type="button" onClick={() => setFaixas(prev => prev.filter((_, j) => j !== i))}
                className="text-red-300 hover:text-red-500 text-xs flex-shrink-0">✕</button>
            )}
          </div>
        ))}
        <button type="button"
          onClick={() => setFaixas(prev => [...prev, { cor: '#cccccc', limite: '', comparacao: isEq ? 'eq' : 'gte' as 'gte' | 'eq' }])}
          className="text-[10px] text-blue-500 hover:underline text-left mt-0.5">+ Adicionar faixa</button>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancelar} className="text-xs text-gray-500 hover:text-gray-700">Cancelar</button>
        <button type="button" onClick={handleSalvar} disabled={!form.nome.trim() || salvando}
          className="text-xs px-3 py-1 bg-blue-500 text-white rounded disabled:opacity-50 hover:bg-blue-600">
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}

function FormNovoIndicadorMeta({ metaId, areaId, responsaveis, onSalvo }: {
  metaId: string; areaId: string; responsaveis: ResponsavelItem[]; onSalvo: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [aberto,   setAberto]   = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');
  const [form, setForm] = useState({ nome: '', tipo: 'percentual', chave: false });
  const [faixas, setFaixas] = useState<FaixaForm[]>(() => PRESET_FAIXAS_MAP.percentual.map(f => ({ ...f })));
  const set = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  // Escalas customizadas
  const [escalasCustom,     setEscalasCustom]     = useState<EscalaCustom[]>(() => (listarEscalasCustom as () => EscalaCustom[])());
  const [adicionandoEscala, setAdicionandoEscala] = useState(false);
  const [novaEscalaNome,    setNovaEscalaNome]    = useState('');
  const [novaEscalaModo,    setNovaEscalaModo]    = useState<'lista' | 'percentual' | 'numero'>('lista');
  const [novaEscalaValores, setNovaEscalaValores] = useState(['', '']);
  const [salvandoEscala,    setSalvandoEscala]    = useState(false);
  const [erroEscala,        setErroEscala]        = useState('');

  useEffect(() => {
    if (aberto) {
      void (carregarEscalasCustom as (s: ReturnType<typeof createClient>) => Promise<unknown>)(supabase)
        .then(() => setEscalasCustom((listarEscalasCustom as () => EscalaCustom[])()));
    }
  }, [aberto, supabase]);

  const handleTipoChange = (v: string) => {
    if (v === '__add_escala__') { setAdicionandoEscala(true); return; }
    set('tipo', v);
    setFaixas(presetFaixasParaTipo(v, escalasCustom));
  };

  const handleSalvarEscala = async () => {
    if (!novaEscalaNome.trim()) { setErroEscala('Nome obrigatório'); return; }
    setSalvandoEscala(true);
    setErroEscala('');
    try {
      const res = await (salvarNovaEscalaCustom as (s: ReturnType<typeof createClient>, d: unknown) => Promise<{ ok: boolean; erro?: string; escala: EscalaCustom }>)(supabase, {
        nome: novaEscalaNome.trim(),
        modo: novaEscalaModo,
        valores: novaEscalaModo === 'lista' ? novaEscalaValores.filter(v => v.trim()) : undefined,
      });
      if (!res.ok) { setErroEscala(res.erro ?? 'Erro ao salvar'); return; }
      const novasEscalas = (listarEscalasCustom as () => EscalaCustom[])();
      setEscalasCustom(novasEscalas);
      const novoTipo = `custom:${res.escala.id}`;
      set('tipo', novoTipo);
      setFaixas(presetFaixasParaTipo(novoTipo, novasEscalas));
      setAdicionandoEscala(false);
      setNovaEscalaNome(''); setNovaEscalaModo('lista'); setNovaEscalaValores(['', '']);
    } finally { setSalvandoEscala(false); }
  };

  const handleSalvar = async () => {
    if (!form.nome.trim()) { setErroForm('Nome do indicador é obrigatório'); return; }
    setSalvando(true);
    setErroForm('');
    try {
      const tipo = form.tipo;
      const escalaCustomId = tipo.startsWith('custom:') ? tipo.slice(7) : null;
      const escalaTipo = escalaCustomId ? 'custom' : tipo === 'sim_nao' ? 'sim_nao' : tipo === 'status_3' ? 'status_3' : tipo;
      const sf = { escala_tipo: escalaTipo, escala_custom_id: escalaCustomId, faixas };
      const tipoDb = tipo === 'percentual' ? 'percentual' : tipo === 'quantidade' ? 'quantidade' : 'outro';
      const { data: ins, error: e } = await supabase.from('indicadores')
        .insert({ area_id: areaId || null, nome: form.nome.trim(), objetivo_id: metaId || null,
          profile_id: null, indicador_chave: form.chave,
          tipo: tipoDb, semaforo_faixas: sf })
        .select('id').single();
      if (e) { console.error('[AddIndMeta]', e); setErroForm(e.message); return; }
      LOG({ modulo: 'Planejamento', entidade: 'indicadores',
        entidade_id: String((ins as { id: unknown }).id), operacao: 'INSERT',
        descricao: `Indicador criado para meta ${metaId}: ${form.nome}` });
      setForm({ nome: '', tipo: 'percentual', chave: false });
      setFaixas(PRESET_FAIXAS_MAP.percentual.map(f => ({ ...f })));
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
      <input
        className={`w-full text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300 ${erroForm && !form.nome.trim() ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
        placeholder="Nome do indicador *" value={form.nome}
        onChange={e => { set('nome', e.target.value); if (erroForm) setErroForm(''); }}
        autoFocus />
      <select className="text-xs border border-gray-300 rounded px-2 py-1.5 w-full" value={form.tipo} onChange={e => handleTipoChange(e.target.value)}>
        {TIPOS_SEMAFORO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        {escalasCustom.length > 0 && (
          <optgroup label="Escalas personalizadas">
            {escalasCustom.map(ec => (
              <option key={ec.id} value={`custom:${ec.id}`}>{ec.nome}</option>
            ))}
          </optgroup>
        )}
        <option value="__add_escala__">+ Adicionar escala…</option>
      </select>

      {/* Editor completo de faixas */}
      {(() => {
        const isEq = form.tipo === 'sim_nao' || form.tipo === 'status_3' ||
          (form.tipo.startsWith('custom:') && escalasCustom.find(e => e.id === form.tipo.slice(7))?.modo === 'lista');
        const updateFaixa = (i: number, k: keyof FaixaForm, v: string) =>
          setFaixas(prev => prev.map((f, j) => j === i ? { ...f, [k]: v } : f));
        return (
          <div className="flex flex-col gap-1 bg-white border border-gray-100 rounded-lg px-3 py-2">
            <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Faixas do semáforo</p>
            {faixas.map((f, i) => (
              <div key={i} className="flex items-center gap-1.5">
                {/* Bolinha = color picker */}
                <label className="relative w-4 h-4 rounded-full cursor-pointer flex-shrink-0 overflow-hidden"
                  style={{ backgroundColor: f.cor }}>
                  <input type="color" value={f.cor} onChange={e => updateFaixa(i, 'cor', e.target.value)}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                </label>
                {/* Comparação */}
                {isEq ? (
                  <span className="text-[10px] text-gray-400 w-6 text-center">=</span>
                ) : (
                  <select className="text-[10px] border border-gray-200 rounded px-1 py-0.5 w-10"
                    value={f.comparacao} onChange={e => updateFaixa(i, 'comparacao', e.target.value as 'gte' | 'lte' | 'eq')}>
                    <option value="gte">≥</option>
                    <option value="lte">≤</option>
                    <option value="eq">=</option>
                  </select>
                )}
                {/* Limite */}
                <input className="text-xs border border-gray-300 rounded px-2 py-0.5 flex-1 min-w-0"
                  value={f.limite} onChange={e => updateFaixa(i, 'limite', e.target.value)}
                  placeholder="Valor" />
                {/* Remover */}
                {faixas.length > 1 && (
                  <button type="button" onClick={() => setFaixas(prev => prev.filter((_, j) => j !== i))}
                    className="text-red-300 hover:text-red-500 text-xs flex-shrink-0">✕</button>
                )}
              </div>
            ))}
            <button type="button"
              onClick={() => setFaixas(prev => [...prev, { cor: '#cccccc', limite: '', comparacao: isEq ? 'eq' : 'gte' as 'gte' | 'eq' }])}
              className="text-[10px] text-blue-500 hover:underline text-left mt-0.5">+ Adicionar faixa</button>
          </div>
        );
      })()}

      {/* Sub-formulário: nova escala personalizada */}
      {adicionandoEscala && (
        <div className="border border-blue-200 rounded-lg p-3 bg-blue-50 flex flex-col gap-2">
          <p className="text-[10px] font-semibold text-blue-700">Nova escala personalizada</p>
          <input className="text-xs border border-gray-300 rounded px-2 py-1.5"
            placeholder="Nome da escala *" value={novaEscalaNome} onChange={e => setNovaEscalaNome(e.target.value)} autoFocus />
          <select className="text-xs border border-gray-300 rounded px-2 py-1.5"
            value={novaEscalaModo} onChange={e => setNovaEscalaModo(e.target.value as 'lista' | 'percentual' | 'numero')}>
            <option value="lista">Lista de valores</option>
            <option value="percentual">Percentual</option>
            <option value="numero">Número</option>
          </select>
          {novaEscalaModo === 'lista' && (
            <div className="flex flex-col gap-1">
              <p className="text-[10px] text-gray-500">Valores (mín. 2)</p>
              {novaEscalaValores.map((v, i) => (
                <div key={i} className="flex gap-1 items-center">
                  <input className="flex-1 text-xs border border-gray-300 rounded px-2 py-1"
                    placeholder={`Valor ${i + 1}`} value={v}
                    onChange={e => { const n = [...novaEscalaValores]; n[i] = e.target.value; setNovaEscalaValores(n); }} />
                  {novaEscalaValores.length > 2 && (
                    <button type="button" onClick={() => setNovaEscalaValores(novaEscalaValores.filter((_, j) => j !== i))}
                      className="text-red-400 hover:text-red-600 text-xs">✕</button>
                  )}
                </div>
              ))}
              <button type="button" onClick={() => setNovaEscalaValores([...novaEscalaValores, ''])}
                className="text-[10px] text-blue-600 hover:underline text-left">+ Adicionar valor</button>
            </div>
          )}
          {erroEscala && <p className="text-[10px] text-red-500">{erroEscala}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => { setAdicionandoEscala(false); setErroEscala(''); }}
              className="text-xs text-gray-500 hover:text-gray-700">Cancelar</button>
            <button type="button" onClick={handleSalvarEscala} disabled={salvandoEscala || !novaEscalaNome.trim()}
              className="text-xs px-3 py-1 bg-blue-500 text-white rounded disabled:opacity-50 hover:bg-blue-600">
              {salvandoEscala ? 'Salvando...' : 'Salvar escala'}
            </button>
          </div>
        </div>
      )}

      <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
        <input type="checkbox" checked={form.chave} onChange={e => set('chave', e.target.checked)} />
        Indicador chave 🔑
      </label>
      {erroForm && (
        <p className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{erroForm}</p>
      )}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={() => { setAberto(false); setErroForm(''); }} className="text-xs text-gray-500 hover:text-gray-700">Cancelar</button>
        <button type="button" onClick={handleSalvar} disabled={salvando}
          className="text-xs px-3 py-1 bg-blue-500 text-white rounded disabled:opacity-50 hover:bg-blue-600">
          {salvando ? 'Criando...' : 'Criar indicador'}
        </button>
      </div>
    </div>
  );
}

function MetaComIndicadores({ meta, indicadores, responsaveis, isAdmin, areaId, onUpdate, onConcluir, onConcluirIndividual, onExcluir, objetivoResponsaveis, currentUserId, currentUserEmail, podeEditarMeta, onToggleResponsavel, onAssumirProjeto }: {
  meta: MetaItem; indicadores: IndicadorBone[]; responsaveis: ResponsavelItem[];
  isAdmin: boolean; areaId: string; onUpdate: () => void;
  onConcluir: (id: string) => Promise<void>;
  onConcluirIndividual: (id: string, reabrir?: boolean) => Promise<void>;
  onExcluir: (id: string) => Promise<void>;
  objetivoResponsaveis: ObjetivoResponsavel[];
  currentUserId: string | null;
  currentUserEmail: string | null;
  podeEditarMeta: boolean;
  onToggleResponsavel: (objetivoId: string) => Promise<void>;
  onAssumirProjeto: (objetivoId: string, dataInicio: string, dataFim: string) => Promise<void>;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [confirmExcl,   setConfirmExcl]   = useState(false);
  const [confirmConc,   setConfirmConc]   = useState(false);
  const [salvando,      setSalvando]      = useState(false);
  const [editandoMeta,  setEditandoMeta]  = useState(false);
  const [salvandoMeta,  setSalvandoMeta]  = useState(false);
  // Modal de assumir Projeto
  const [modalAssumir,  setModalAssumir]  = useState(false);
  const [formDatas,     setFormDatas]     = useState({ inicio: '', fim: '' });
  const [diasPreview,   setDiasPreview]   = useState<number | null>(null);
  const [calculando,    setCalculando]    = useState(false);
  const [salvandoDatas, setSalvandoDatas] = useState(false);
  const [editandoDatas, setEditandoDatas] = useState(false);
  const [msgAdmin,      setMsgAdmin]      = useState(false);
  const [formMeta, setFormMeta] = useState({
    descricao: meta.descricao,
    tipo: meta.tipo ?? 'atingivel',
    metaUnidade: meta.meta_unidade ?? '',
    isChave: meta.is_chave,
  });

  const handleConcluir = async () => {
    setSalvando(true); try { await onConcluir(meta.id); } finally { setSalvando(false); }
  };
  const handleExcluir = async () => {
    setSalvando(true); try { await onExcluir(meta.id); } finally { setSalvando(false); }
  };
  const handleSalvarMeta = async () => {
    if (!formMeta.descricao.trim()) return;
    setSalvandoMeta(true);
    try {
      await supabase.from('objetivos').update({
        descricao: formMeta.descricao.trim(),
        tipo: formMeta.tipo,
        meta_unidade: formMeta.metaUnidade || null,
        is_chave: formMeta.isChave,
      }).eq('id', meta.id);
      setEditandoMeta(false);
      onUpdate();
    } finally { setSalvandoMeta(false); }
  };

  // ── Projeto: calcular dias úteis ao mudar datas ──────────────────────────
  const calcularDiasUteis = async (inicio: string, fim: string) => {
    if (!inicio || !fim || fim < inicio) { setDiasPreview(null); return; }
    setCalculando(true);
    try {
      const { data } = await supabase.rpc('calcular_dias_uteis', { data_inicio: inicio, data_fim: fim });
      setDiasPreview(typeof data === 'number' ? data : null);
    } finally { setCalculando(false); }
  };

  const handleFormDatasChange = (k: 'inicio' | 'fim', v: string) => {
    const next = { ...formDatas, [k]: v };
    setFormDatas(next);
    void calcularDiasUteis(next.inicio, next.fim);
  };

  const handleConfirmarAssumir = async () => {
    if (!formDatas.inicio || !formDatas.fim) return;
    setSalvandoDatas(true);
    try {
      await onAssumirProjeto(meta.id, formDatas.inicio, formDatas.fim);
      setModalAssumir(false);
    } finally { setSalvandoDatas(false); }
  };

  // Admin: atualizar datas de um responsável já assumido
  const handleSalvarDatasAdmin = async (profileId: string) => {
    if (!formDatas.inicio || !formDatas.fim) return;
    setSalvandoDatas(true);
    try {
      const dias = diasPreview ?? 0;
      await supabase.from('objetivo_responsaveis').update({
        data_inicio: formDatas.inicio, data_fim: formDatas.fim, dias_uteis: dias,
      }).eq('objetivo_id', meta.id).eq('profile_id', profileId);
      // Sincroniza datas no semaforo_faixas do indicador relativo
      const ind = indicadores.find(i => i.objetivo_id === meta.id && i.profile_id === profileId);
      if (ind) {
        const sf = ind.semaforo_faixas as { is_projeto_relativo?: boolean } | null;
        if (sf?.is_projeto_relativo) {
          await supabase.from('indicadores').update({
            semaforo_faixas: { ...sf, data_inicio: formDatas.inicio, data_fim: formDatas.fim, dias_uteis: dias },
          }).eq('id', ind.id);
        }
      }
      setEditandoDatas(false);
      onUpdate();
    } finally { setSalvandoDatas(false); }
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
        {(() => {
          const isProjeto = meta.tipo?.toLowerCase() === 'atingivel - projeto';
          const resps = objetivoResponsaveis.filter(r => r.objetivo_id === meta.id);
          const ismine = resps.some(r => r.profile_id === currentUserId);
          const handleAssumir = () => {
            if (isProjeto) {
              if (ismine) { void onToggleResponsavel(meta.id); } // remove assumption
              else { setFormDatas({ inicio: '', fim: '' }); setDiasPreview(null); setModalAssumir(true); }
            } else {
              void onToggleResponsavel(meta.id);
            }
          };
          return (
            <div className="flex items-center gap-1 flex-shrink-0">
              {resps.map(r => {
                const nome = responsaveis.find(p => p.profile_id === r.profile_id)?.nome ?? '?';
                return (
                  <span key={r.profile_id}
                    className={`w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center flex-shrink-0 ${r.concluido ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}
                    title={`${nome}${r.concluido ? ' ✓ concluído' : ''}`}>
                    {r.concluido ? '✓' : nome.charAt(0).toUpperCase()}
                  </span>
                );
              })}
              <button type="button" onClick={handleAssumir}
                className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors flex-shrink-0 ${ismine ? 'bg-blue-100 text-blue-700 border-blue-300' : 'text-gray-400 border-gray-200 hover:border-blue-300 hover:text-blue-500'}`}
                title={ismine ? 'Remover minha responsabilidade' : 'Assumir esta meta'}>
                {ismine ? '✓ Assumida' : 'Assumir'}
              </button>
            </div>
          );
        })()}
        <div className="flex items-center gap-1.5 text-xs text-gray-500 flex-shrink-0">
          {meta.responsavel_nome && <span>{meta.responsavel_nome}</span>}
          {meta.meta_unidade && <span>· Prazo: {meta.meta_unidade}</span>}
          {meta.tipo?.toLowerCase() !== 'recorrente' && meta.criado_em && (
            <span className="text-gray-300">· aberta {formatarDataCurta(meta.criado_em)}</span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Botão individual: qualquer um que assumiu pode concluir sua parte */}
          {(() => {
            const resps = objetivoResponsaveis.filter(r => r.objetivo_id === meta.id);
            const minhaEntrada = resps.find(r => r.profile_id === currentUserId);
            if (!minhaEntrada) return null;
            return minhaEntrada.concluido ? (
              <button type="button"
                onClick={() => void onConcluirIndividual(meta.id, true)}
                className="text-[10px] px-1.5 py-0.5 rounded border bg-green-100 text-green-700 border-green-300 flex-shrink-0"
                title="Você concluiu sua parte — clique para reabrir">
                ✓ Concluída
              </button>
            ) : (
              <button type="button"
                onClick={() => void onConcluirIndividual(meta.id, false)}
                className="text-[10px] px-1.5 py-0.5 rounded border text-gray-400 border-gray-200 hover:border-green-300 hover:text-green-600 flex-shrink-0"
                title="Marcar minha parte como concluída">
                Concluir
              </button>
            );
          })()}
          {podeEditarMeta && (
            <button type="button" onClick={() => setEditandoMeta(v => !v)} title="Editar meta"
              className={`text-sm transition-colors ${editandoMeta ? 'text-blue-600' : 'text-blue-400 hover:text-blue-600'}`}>✎</button>
          )}
          {isAdmin && (
            <>
              {meta.status !== 'concluido' && meta.tipo?.toLowerCase() !== 'recorrente' && (
                <button type="button" onClick={() => setConfirmConc(true)} title="Encerrar meta globalmente"
                  className="text-[14px] text-green-500 hover:text-green-700 font-bold transition-colors">✓</button>
              )}
              <button type="button" onClick={() => setConfirmExcl(true)} title="Excluir"
                className="text-red-400 hover:text-red-600 font-bold text-[12px] transition-colors">✕</button>
            </>
          )}
        </div>
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

      {/* Modal: Assumir Projeto (date pickers) */}
      {modalAssumir && (
        <div className="px-3 py-2.5 bg-purple-50 border-b border-purple-100 flex flex-col gap-2">
          <p className="text-[10px] font-semibold text-purple-700">Definir período de execução</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] text-gray-500">Data de início</label>
              <input type="date" className="text-xs border border-gray-300 rounded px-2 py-1.5"
                value={formDatas.inicio} onChange={e => handleFormDatasChange('inicio', e.target.value)} />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] text-gray-500">Data de entrega</label>
              <input type="date" className="text-xs border border-gray-300 rounded px-2 py-1.5"
                value={formDatas.fim} onChange={e => handleFormDatasChange('fim', e.target.value)} />
            </div>
          </div>
          {diasPreview !== null && (
            <p className="text-[10px] text-purple-600">
              {calculando ? 'Calculando…' : `${diasPreview} dias úteis · progresso linear de ${diasPreview > 0 ? Math.round(100 / diasPreview) : 0}%/dia`}
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setModalAssumir(false)} className="text-xs text-gray-500 hover:text-gray-700">Cancelar</button>
            <button type="button" onClick={handleConfirmarAssumir}
              disabled={!formDatas.inicio || !formDatas.fim || formDatas.fim < formDatas.inicio || salvandoDatas}
              className="text-xs px-3 py-1 bg-purple-600 text-white rounded disabled:opacity-50 hover:bg-purple-700">
              {salvandoDatas ? 'Assumindo...' : 'Assumir'}
            </button>
          </div>
        </div>
      )}

      {/* Projeto: datas + progresso esperado */}
      {meta.tipo?.toLowerCase() === 'atingivel - projeto' && (() => {
        const resps = objetivoResponsaveis.filter(r => r.objetivo_id === meta.id && r.data_inicio && r.data_fim);
        if (resps.length === 0) return null;
        return (
          <div className="px-3 py-2 border-b border-gray-100 flex flex-col gap-1.5">
            {resps.map(r => {
              const nome = responsaveis.find(p => p.profile_id === r.profile_id)?.nome ?? '?';
              const isAdminUser = isAdmin;
              return (
                <div key={r.profile_id} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-gray-500 font-medium">{nome}</span>
                    {isAdminUser && editandoDatas && r.profile_id === currentUserId ? (
                      <div className="flex items-center gap-1.5 flex-1">
                        <input type="date" className="text-[10px] border border-gray-300 rounded px-1.5 py-0.5"
                          value={formDatas.inicio} onChange={e => handleFormDatasChange('inicio', e.target.value)} />
                        <span className="text-gray-400 text-[10px]">→</span>
                        <input type="date" className="text-[10px] border border-gray-300 rounded px-1.5 py-0.5"
                          value={formDatas.fim} onChange={e => handleFormDatasChange('fim', e.target.value)} />
                        {diasPreview !== null && <span className="text-[10px] text-purple-600">{diasPreview}du</span>}
                        <button type="button" onClick={() => void handleSalvarDatasAdmin(r.profile_id)} disabled={salvandoDatas}
                          className="text-[10px] px-2 py-0.5 bg-purple-600 text-white rounded disabled:opacity-50">{salvandoDatas ? '…' : 'Salvar'}</button>
                        <button type="button" onClick={() => setEditandoDatas(false)} className="text-[10px] text-gray-400">✕</button>
                      </div>
                    ) : (
                      <>
                        <span className="text-[10px] text-gray-500">{r.data_inicio} → {r.data_fim}</span>
                        <span className="text-[10px] text-gray-400">({r.dias_uteis} dias úteis)</span>
                        {isAdminUser ? (
                          <button type="button" onClick={() => {
                            setFormDatas({ inicio: r.data_inicio ?? '', fim: r.data_fim ?? '' });
                            void calcularDiasUteis(r.data_inicio ?? '', r.data_fim ?? '');
                            setEditandoDatas(true);
                          }} className="text-[10px] text-blue-400 hover:text-blue-600">✎</button>
                        ) : (
                          <span className="text-[10px] text-gray-300" title="Acione o admin para alterar datas">🔒</span>
                        )}
                      </>
                    )}
                  </div>
                  {r.data_inicio && r.data_fim && (
                    <ProjetoTimeline
                      dataInicio={r.data_inicio}
                      dataFim={r.data_fim}
                      diasUteis={r.dias_uteis}
                    />
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Mensagem: acionar admin para datas */}
      {msgAdmin && (
        <div className="px-3 py-2 border-b border-amber-100 bg-amber-50 flex items-center gap-2">
          <span className="text-[10px] text-amber-700 flex-1">Para alterar as datas, acione um administrador da área.</span>
          <button type="button" onClick={() => setMsgAdmin(false)} className="text-[10px] text-gray-400">✕</button>
        </div>
      )}

      {/* Form editar meta (Danilo only) */}
      {editandoMeta && (
        <div className="px-3 py-2.5 bg-blue-50 border-b border-blue-100 flex flex-col gap-2">
          <p className="text-[10px] font-semibold text-blue-700">Editar meta</p>
          <input className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300"
            value={formMeta.descricao} onChange={e => setFormMeta(p => ({ ...p, descricao: e.target.value }))} autoFocus />
          <div className="grid grid-cols-3 gap-2">
            <select className="text-xs border border-gray-300 rounded px-2 py-1.5" value={formMeta.tipo} onChange={e => setFormMeta(p => ({ ...p, tipo: e.target.value }))}>
              <option value="atingivel">Atingível</option>
              <option value="recorrente">Recorrente</option>
              <option value="atingivel - projeto">Atingível - Projeto</option>
            </select>
            <input type="date" className="text-xs border border-gray-300 rounded px-2 py-1.5"
              value={formMeta.metaUnidade} onChange={e => setFormMeta(p => ({ ...p, metaUnidade: e.target.value }))} />
            <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={formMeta.isChave} onChange={e => setFormMeta(p => ({ ...p, isChave: e.target.checked }))} />
              Chave 🔑
            </label>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setEditandoMeta(false)} className="text-xs text-gray-500 hover:text-gray-700">Cancelar</button>
            <button type="button" onClick={handleSalvarMeta} disabled={!formMeta.descricao.trim() || salvandoMeta}
              className="text-xs px-3 py-1 bg-blue-500 text-white rounded disabled:opacity-50 hover:bg-blue-600">
              {salvandoMeta ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {/* Tabela de indicadores */}
      {indicadores.length > 0 && (
        <div className="overflow-x-auto">
          {/* Indicadores de metas recorrentes (KANBAN/SLA) são somente-leitura */}
          {meta.tipo?.toLowerCase() === 'recorrente' && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 border-b border-purple-100">
              <span className="text-[10px] text-purple-600 font-medium">🤖 Calculado automaticamente — somente visualização</span>
            </div>
          )}
          <table className="w-full text-xs table-fixed">
            <colgroup>
              <col style={{ width: '45%' }} />
              <col style={{ width: '30%' }} />
              <col style={{ width: '25%' }} />
              {isAdmin && meta.tipo?.toLowerCase() !== 'recorrente' && <col style={{ width: '60px' }} />}
            </colgroup>
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wide">
                <th className="px-3 py-1.5 text-left">Indicador</th>
                <th className="px-3 py-1.5 text-left">Semáforo</th>
                <th className="px-3 py-1.5 text-left">Responsável</th>
                {isAdmin && meta.tipo?.toLowerCase() !== 'recorrente' && <th className="px-2 py-1.5" />}
              </tr>
            </thead>
            <tbody>
              {indicadores.map(ind => {
                const isRecorrente = meta.tipo?.toLowerCase() === 'recorrente';
                const isProjeto = meta.tipo?.toLowerCase() === 'atingivel - projeto';
                let esperadoPct: number | null = null;
                if (isProjeto && ind.profile_id) {
                  const or = objetivoResponsaveis.find(r => r.objetivo_id === meta.id && r.profile_id === ind.profile_id);
                  if (or) esperadoPct = calcularEsperadoPct(or.data_inicio, or.data_fim, or.dias_uteis);
                }
                return (
                  <LinhaIndicador key={ind.id} ind={ind} responsaveis={responsaveis}
                    isAdmin={isAdmin && !isRecorrente} currentUserId={currentUserId} onUpdate={onUpdate}
                    esperadoPct={isProjeto ? esperadoPct : undefined} />
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* + Adicionar indicador (bloqueado para metas recorrentes/KANBAN) */}
      {isAdmin && meta.tipo?.toLowerCase() !== 'recorrente' && (
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

function AgendaMacroPessoa({ pessoa, comportamentos, metas, objetivoResponsaveis, atividades, semanas, isAdmin, currentUserId, mes, areaId, onAdd, onDelete, onAddLivre }: {
  pessoa: ResponsavelItem; comportamentos: ComportamentoItem[]; metas: MetaItem[];
  objetivoResponsaveis: ObjetivoResponsavel[];
  atividades: AgendaMacroItem[]; semanas: number[]; isAdmin: boolean; currentUserId: string | null; mes: string; areaId: string;
  onAdd: (profileId: string, acoId: string, semana: number, horas: number, objetivoId: string | null) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddLivre: (profileId: string, nome: string, semana: number, horas: number, objetivoId: string | null) => Promise<void>;
}) {
  // Pode editar: admin pode qualquer card; usuário comum pode apenas o próprio
  const podeEditar = isAdmin || currentUserId === pessoa.profile_id;
  const [expandido,          setExpandido]          = useState(true);
  const [celAtiva,           setCelAtiva]           = useState<CelulaKey | null>(null);
  const [novaComportamentoId, setNovaComportamentoId] = useState('');
  const [novaHoras,          setNovaHoras]          = useState('1');
  const [salvando,           setSalvando]           = useState(false);
  // Popup "nova atividade livre"
  const [popupSem,           setPopupSem]           = useState<number | null>(null);
  const [novoNome,           setNovoNome]           = useState('');
  const [novoObjId,          setNovoObjId]          = useState('');
  const [novaHoras2,         setNovaHoras2]         = useState('1');
  const [salvandoNovo,       setSalvandoNovo]       = useState(false);

  // Linhas = apenas comportamentos que já têm atividades (grade começa vazia)
  const comportamentosUsados = useMemo(() => {
    const ids = new Set(
      atividades
        .filter(a => a.profile_id === pessoa.profile_id && (a.tarefa_id || a.acao_id))
        .map(a => a.tarefa_id ?? a.acao_id)
    );
    return comportamentos.filter(c => ids.has(c.id));
  }, [atividades, comportamentos, pessoa.profile_id]);

  // Itens livres (descricao_livre, sem tarefa/acao) — agrupados por descrição
  const atividadesLivres = useMemo(() =>
    atividades.filter(a => a.profile_id === pessoa.profile_id && !a.tarefa_id && !a.acao_id && a.descricao_livre),
  [atividades, pessoa.profile_id]);

  const atividadesLivresAgrupadas = useMemo(() => {
    const map = new Map<string, AgendaMacroItem[]>();
    atividadesLivres.forEach(a => {
      const key = a.descricao_livre ?? '';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });
    return [...map.entries()].map(([desc, items]) => ({ desc, items }));
  }, [atividadesLivres]);

  // Mapa: "acoId::semana" → atividade
  const mapaAtiv = useMemo(() => {
    const m = new Map<string, AgendaMacroItem>();
    atividades.filter(a => a.profile_id === pessoa.profile_id && (a.tarefa_id || a.acao_id)).forEach(a => {
      const s = a.semana_ano_inicio ?? 0;
      m.set(`${a.tarefa_id ?? a.acao_id}::${s}`, a);
    });
    return m;
  }, [atividades, pessoa.profile_id]);

  const totalHoras = useMemo(() =>
    atividades.filter(a => a.profile_id === pessoa.profile_id)
      .reduce((s, a) => s + (a.tempo_estimado_horas ?? 0), 0),
  [atividades, pessoa.profile_id]);

  // Metas que essa pessoa assumiu (via objetivo_responsaveis)
  const metasAssumidas = useMemo(() => {
    const ids = new Set(
      objetivoResponsaveis
        .filter(r => r.profile_id === pessoa.profile_id)
        .map(r => r.objetivo_id)
    );
    return metas.filter(m => ids.has(m.id));
  }, [metas, objetivoResponsaveis, pessoa.profile_id]);

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

  const handleAddLivre = async (sem: number) => {
    if (!novoNome.trim()) return;
    setSalvandoNovo(true);
    try {
      await onAddLivre(pessoa.profile_id, novoNome.trim(), sem, parseFloat(novaHoras2) || 1, novoObjId || null);
      setPopupSem(null);
      setNovoNome(''); setNovoObjId(''); setNovaHoras2('1');
    } finally { setSalvandoNovo(false); }
  };

  const abrirPopup = (sem: number) => { setPopupSem(sem); setNovoNome(''); setNovoObjId(''); setNovaHoras2('1'); };
  const fecharPopup = () => { setPopupSem(null); setNovoNome(''); setNovoObjId(''); setNovaHoras2('1'); };

  return (
    <>
    {/* Modal popup nova atividade livre */}
    {popupSem !== null && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        onClick={fecharPopup}>
        <div className="bg-white rounded-xl shadow-xl p-6 w-[520px] flex flex-col gap-4"
          onClick={e => e.stopPropagation()}>
          <h3 className="text-sm font-semibold text-gray-800">Nova atividade — S{popupSem}</h3>
          <div>
            <label className="text-[10px] text-gray-500 mb-1 block">O que será feito?</label>
            <textarea autoFocus rows={4}
              className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
              placeholder="Descreva seus comportamentos e atividades para atingir as metas de sua área"
              value={novoNome} onChange={e => setNovoNome(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) void handleAddLivre(popupSem); if (e.key === 'Escape') fecharPopup(); }}
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 mb-1 block">Meta vinculada</label>
            {metasAssumidas.length > 0 ? (
              <select className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2"
                value={novoObjId} onChange={e => setNovoObjId(e.target.value)}>
                <option value="">— opcional —</option>
                {metasAssumidas.map(m => <option key={m.id} value={m.id}>{m.descricao}</option>)}
              </select>
            ) : (
              <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Nenhuma meta assumida — assuma uma meta para vinculá-la à atividade.
              </p>
            )}
          </div>
          <div>
            <label className="text-[10px] text-gray-500 mb-1 block">Horas Estimadas Semanais</label>
            <input type="number" min="0.5" step="0.5"
              className="w-24 text-xs border border-gray-300 rounded-lg px-3 py-2"
              value={novaHoras2} onChange={e => setNovaHoras2(e.target.value)} />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={fecharPopup}
              className="text-xs px-3 py-1.5 text-gray-500 hover:text-gray-700">Cancelar</button>
            <button type="button"
              disabled={!novoNome.trim() || salvandoNovo}
              onClick={() => void handleAddLivre(popupSem)}
              className="text-xs px-4 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors">
              {salvandoNovo ? 'Salvando…' : 'Adicionar'}
            </button>
          </div>
        </div>
      </div>
    )}
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
                  <td className="sticky left-0 bg-white z-10 px-3 py-2 text-gray-700 border-r border-gray-100 font-medium max-w-[160px]"
                    title={comportamento.nome}>
                    <span className="block truncate">{comportamento.nome}</span>
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
                            {podeEditar && (
                              <button type="button" onClick={() => onDelete(atv.id)}
                                className="text-red-400 hover:text-red-600 text-[10px]">✕</button>
                            )}
                          </div>
                        </td>
                      );
                    }
                    if (podeEditar) {
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
              {linhas.length === 0 && atividadesLivres.length === 0 && (
                <tr>
                  <td colSpan={semanas.length + 1} className="px-3 py-4 text-center text-xs text-gray-400">
                    Nenhum comportamento planejado ainda.
                  </td>
                </tr>
              )}

              {/* Atividades livres — agrupadas por descrição (1 linha por descrição única) */}
              {atividadesLivresAgrupadas.map(({ desc, items }) => (
                <tr key={desc} className="border-b border-gray-100 hover:bg-gray-50/50">
                  <td className="sticky left-0 bg-white z-10 px-3 py-2 text-gray-600 border-r border-gray-100 text-[12px] italic max-w-[160px]"
                    title={desc}>
                    <span className="block truncate">{desc}</span>
                  </td>
                  {semanas.map(sem => {
                    const atv = items.find(a => (a.semana_ano_inicio ?? 0) === sem);
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
                            {podeEditar && (
                              <button type="button" onClick={() => onDelete(atv.id)}
                                className="text-red-400 hover:text-red-600 text-[10px]">✕</button>
                            )}
                          </div>
                        </td>
                      );
                    }
                    return <td key={sem} className="px-2 py-1.5 text-center text-gray-200">—</td>;
                  })}
                </tr>
              ))}

              {podeEditar && (
                <tr>
                  <td className="sticky left-0 bg-white z-10 px-3 py-2 text-gray-400 border-r border-gray-100 text-[11px] italic">
                    + nova atividade
                  </td>
                  {semanas.map(sem => (
                    <td key={sem} className="px-2 py-1.5 text-center">
                      <button type="button" onClick={() => abrirPopup(sem)}
                        className="text-gray-300 hover:text-blue-500 text-xl transition-colors leading-none">+</button>
                    </td>
                  ))}
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

        </>
      )}
    </div>
    </>
  );
}

// ── Formulário de nova meta ───────────────────────────────────────────────────
// Faixas do indicador automático de Projeto: <30% vm, 30-59% am, 60-74% vc, >=75% ve
const FAIXAS_PROJETO = {
  escala_tipo: 'percentual',
  escala_custom_id: null,
  faixas: [
    { cor: '#1e7a3a', limite: '75', comparacao: 'gte' },
    { cor: '#52b36f', limite: '60', comparacao: 'gte' },
    { cor: '#f2c94c', limite: '30', comparacao: 'gte' },
    { cor: '#d24141', limite: '0',  comparacao: 'gte' },
  ],
};

function FormNovaMeta({ areaId, responsaveis, onSalvo, mes }: {
  areaId: string; responsaveis: ResponsavelItem[]; onSalvo: () => void; mes: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [aberto,   setAberto]   = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({ descricao: '', tipo: 'atingivel', respId: '', metaUnidade: '' });
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  const isProjeto = form.tipo === 'atingivel - projeto';

  const handleSalvar = async () => {
    if (!form.descricao.trim()) return;
    setSalvando(true);
    try {
      const { data: ins, error: e } = await supabase.from('objetivos')
        .insert({ area_id: areaId, descricao: form.descricao.trim(), tipo: form.tipo,
          profile_id: form.respId || null,
          meta_unidade: isProjeto ? null : (form.metaUnidade || null),
          status: 'ativo', mes })
        .select('id').single();
      if (e) { console.error('[NovaMeta]', e); return; }
      const metaId = (ins as { id: string }).id;
      LOG({ modulo: 'Planejamento', entidade: 'objetivos', entidade_id: metaId,
        operacao: 'INSERT', descricao: `Nova meta no Plano Boné Day: ${form.descricao}` });
      // Indicador criado automaticamente quando executor assumir e definir as datas

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
      <div className={`grid gap-2 ${isProjeto ? 'grid-cols-2' : 'grid-cols-3'}`}>
        <select className="text-xs border border-gray-300 rounded px-2 py-1.5" value={form.tipo} onChange={e => set('tipo', e.target.value)}>
          <option value="atingivel">Atingível</option>
          <option value="recorrente">Recorrente</option>
          <option value="atingivel - projeto">Atingível - Projeto</option>
        </select>
        {!isProjeto && (
          <input type="date" className="text-xs border border-gray-300 rounded px-2 py-1.5"
            value={form.metaUnidade} onChange={e => set('metaUnidade', e.target.value)} />
        )}
        {responsaveis.length > 0 && (
          <select className="text-xs border border-gray-300 rounded px-2 py-1.5" value={form.respId} onChange={e => set('respId', e.target.value)}>
            <option value="">— Responsável —</option>
            {responsaveis.map(r => <option key={r.profile_id} value={r.profile_id}>{r.nome}</option>)}
          </select>
        )}
      </div>
      {isProjeto && (
        <p className="text-[10px] text-purple-600 bg-purple-50 rounded px-2 py-1">
          Indicador &quot;Percentual de Evolução até Entrega (%)&quot; será criado automaticamente. Datas serão definidas por quem assumir.
        </p>
      )}
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
function PreBoneDayPageContent() {
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

  const [isAdmin,          setIsAdmin]          = useState<boolean | null>(null);
  const [currentUserId,    setCurrentUserId]    = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [bloco1Open, setBloco1Open] = useState(false);
  const [bloco2Open, setBloco2Open] = useState(true);
  const [bloco3Open, setBloco3Open] = useState(true);

  const {
    metas, metasNaoConcluidas, indicadores, responsaveis, comportamentos, agendaMacro,
    objetivoResponsaveis, mes, setMes, isLoading, error, recarregar,
  } = usePlanoBoneDay(areaId, effectiveProfileId);

  const monthOptions = useMemo(() => getMonthOptions(), []);
  const semanas      = useMemo(() => semanasDoMes(mes), [mes]);
  const semanaAtual  = useMemo(() => isoWeek(new Date()), []);

  // Admin check
  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsAdmin(false); return; }
      setCurrentUserId(user.id);
      setCurrentUserEmail(user.email ?? null);
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      setIsAdmin((prof as { role?: string } | null)?.role === 'admin');
    })();
  }, [supabase]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleRelançar = useCallback(async (id: string, f: { metaUnidade: string; respId: string }) => {
    const metaOriginal = metasNaoConcluidas.find(m => m.id === id);
    if (!metaOriginal || !areaId) return;

    // 1. Criar nova meta no mês atual
    const { data: novaMeta, error: e } = await supabase.from('objetivos').insert({
      area_id: areaId,
      descricao: metaOriginal.descricao,
      tipo: metaOriginal.tipo,
      is_chave: metaOriginal.is_chave,
      profile_id: f.respId || metaOriginal.profile_id || null,
      meta_unidade: f.metaUnidade || metaOriginal.meta_unidade || null,
      status: 'ativo',
      mes,
    }).select('id').single();
    if (e || !novaMeta) { console.error('[Relançar]', e); return; }

    const novaMetaId = (novaMeta as { id: string }).id;

    // 2. Marcar original como concluído (remove de Metas não concluídas)
    await supabase.from('objetivos')
      .update({ status: 'concluido', concluido_em: new Date().toISOString() })
      .eq('id', id);

    // 3. Copiar indicadores da meta original para a nova
    const { data: indsOriginais } = await supabase.from('indicadores')
      .select('nome, tipo, indicador_chave, semaforo_faixas, profile_id')
      .eq('objetivo_id', id);

    if (indsOriginais && indsOriginais.length > 0) {
      type IndRow = { nome: string; tipo: string | null; indicador_chave: boolean | null; semaforo_faixas: unknown; profile_id: string | null };
      await supabase.from('indicadores').insert(
        (indsOriginais as IndRow[]).map(ind => ({
          area_id: areaId,
          nome: ind.nome,
          tipo: ind.tipo,
          indicador_chave: ind.indicador_chave ?? false,
          semaforo_faixas: ind.semaforo_faixas,
          profile_id: ind.profile_id,
          objetivo_id: novaMetaId,
        }))
      );
    }

    LOG({ modulo: 'Planejamento', entidade: 'objetivos', entidade_id: id,
      operacao: 'INSERT', descricao: `Meta relançada no mês ${mes}: ${metaOriginal.descricao}` });
    recarregar();
  }, [supabase, areaId, mes, metasNaoConcluidas, recarregar]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleArquivarMeta = useCallback(async (id: string) => {
    await supabase.from('objetivos').update({ status: 'arquivado' }).eq('id', id);
    LOG({ modulo: 'Planejamento', entidade: 'objetivos', entidade_id: id, operacao: 'UPDATE', descricao: 'Meta arquivada' });
    recarregar();
  }, [supabase, recarregar]); // eslint-disable-line react-hooks/exhaustive-deps

  // Conclusão global (admin): encerra o objetivo para todos (move para Bloco 1)
  const handleConcluirMeta = useCallback(async (id: string) => {
    const { error: e } = await supabase.from('objetivos')
      .update({ status: 'concluido', concluido_em: new Date().toISOString() }).eq('id', id);
    if (e) { console.error('[ConcluirMeta]', e); return; }
    LOG({ modulo: 'Planejamento', entidade: 'objetivos', entidade_id: id, operacao: 'UPDATE', descricao: 'Meta encerrada globalmente' });
    recarregar();
  }, [supabase, recarregar]); // eslint-disable-line react-hooks/exhaustive-deps

  // Conclusão individual (per-user): marca/desmarca a própria participação
  const handleConcluirMetaIndividual = useCallback(async (id: string, reabrir = false) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error: e } = await supabase.from('objetivo_responsaveis')
      .update({ concluido: !reabrir, concluido_em: reabrir ? null : new Date().toISOString() })
      .eq('objetivo_id', id).eq('profile_id', user.id);
    if (e) { console.error('[ConcluirMetaIndividual]', e); return; }
    LOG({ modulo: 'Planejamento', entidade: 'objetivo_responsaveis', entidade_id: id,
      operacao: 'UPDATE', descricao: reabrir ? 'Meta reaberta (individual)' : 'Meta concluída (individual)' });
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

    // Atividades de comportamento ainda precisam de acao_id — buscar ou criar placeholder
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

  const handleAddAtividadeLivre = useCallback(async (profileId: string, nome: string, semana: number, horas: number, objetivoId: string | null) => {
    if (!areaId) return;
    const pidValido = effectiveProfileId ?? profileId;
    const { data: ins, error: e } = await supabase.from('gantt_planejamento')
      .insert({ acao_id: null, descricao_livre: nome.trim(), profile_id: pidValido,
        semana_ano_inicio: semana, semana_ano_fim: semana,
        tempo_estimado_horas: horas, origem: 'pre_bone_day', pre_bone_day_mes: mes,
        comportamento_chave: false, objetivo_id: objetivoId })
      .select('id').single();
    if (e) { console.error('[AddLivre] gantt:', e); return; }
    LOG({ modulo: 'Planejamento', entidade: 'gantt_planejamento',
      entidade_id: String((ins as { id: unknown }).id), operacao: 'INSERT',
      descricao: `Atividade livre S${semana}: ${nome}` });
    recarregar();
  }, [supabase, areaId, effectiveProfileId, mes, recarregar]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleResponsavel = useCallback(async (objetivoId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const jaExiste = objetivoResponsaveis.some(r => r.objetivo_id === objetivoId && r.profile_id === user.id);

    if (jaExiste) {
      // SAINDO: remover responsabilidade
      await supabase.from('objetivo_responsaveis').delete()
        .eq('objetivo_id', objetivoId).eq('profile_id', user.id);

      // Se for meta Projeto: apagar o indicador criado automaticamente ao assumir
      const indsProjeto = indicadores.filter(i =>
        i.objetivo_id === objetivoId &&
        i.profile_id === user.id &&
        (i.semaforo_faixas as { is_projeto_relativo?: boolean } | null)?.is_projeto_relativo
      );
      if (indsProjeto.length > 0) {
        await supabase.from('indicadores').delete().in('id', indsProjeto.map(i => i.id));
      } else {
        // Comportamento existente para metas não-Projeto
        const restantes = objetivoResponsaveis.filter(r => r.objetivo_id === objetivoId && r.profile_id !== user.id);
        if (restantes.length === 1) {
          const unico = restantes[0].profile_id;
          const indsObj = indicadores.filter(i => i.objetivo_id === objetivoId && !i.profile_id);
          if (indsObj.length > 0) {
            await supabase.from('indicadores').update({ profile_id: unico }).in('id', indsObj.map(i => i.id));
          }
        } else if (restantes.length === 0) {
          await (supabase.from('indicadores') as any).update({ profile_id: null }).eq('objetivo_id', objetivoId); // eslint-disable-line
        }
      }
    } else {
      // ASSUMINDO
      const totalAgora = objetivoResponsaveis.filter(r => r.objetivo_id === objetivoId).length + 1;
      await supabase.from('objetivo_responsaveis').insert({ objetivo_id: objetivoId, profile_id: user.id });

      if (totalAgora === 1) {
        // Primeiro (e único) responsável → auto-assign todos os indicadores sem dono
        const indsObj = indicadores.filter(i => i.objetivo_id === objetivoId && !i.profile_id);
        if (indsObj.length > 0) {
          await supabase.from('indicadores').update({ profile_id: user.id }).in('id', indsObj.map(i => i.id));
        }
      }
      // 2+ responsáveis → cada um escolhe seus indicadores manualmente
    }
    recarregar();
  }, [supabase, objetivoResponsaveis, indicadores, recarregar]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAssumirProjeto = useCallback(async (objetivoId: string, dataInicio: string, dataFim: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !areaId) return;
    const { data: dias } = await supabase.rpc('calcular_dias_uteis', { data_inicio: dataInicio, data_fim: dataFim });
    const diasUteis = typeof dias === 'number' ? dias : null;
    await supabase.from('objetivo_responsaveis').insert({
      objetivo_id: objetivoId, profile_id: user.id,
      data_inicio: dataInicio, data_fim: dataFim, dias_uteis: diasUteis,
    });
    // Criar indicador automático com semáforo relativo ao esperado
    await supabase.from('indicadores').insert({
      area_id: areaId,
      objetivo_id: objetivoId,
      nome: 'Percentual de Evolução até Entrega (%)',
      indicador_chave: true,
      tipo: 'percentual',
      profile_id: user.id,
      semaforo_faixas: {
        is_projeto_relativo: true,
        data_inicio: dataInicio,
        data_fim: dataFim,
        dias_uteis: diasUteis,
        escala_tipo: 'percentual',
        faixas: FAIXAS_PROJETO.faixas,
      },
    });
    recarregar();
  }, [supabase, areaId, recarregar]); // eslint-disable-line react-hooks/exhaustive-deps

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
                      <MetaNaoConcluida key={meta.id} meta={meta} responsaveis={responsaveis}
                        podeRelançar={Boolean(isAdmin)}
                        onRelançar={handleRelançar}
                        onArquivar={handleArquivarMeta} />
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
                      onConcluirIndividual={handleConcluirMetaIndividual}
                      onExcluir={handleExcluirMeta}
                      objetivoResponsaveis={objetivoResponsaveis}
                      currentUserId={currentUserId}
                      currentUserEmail={currentUserEmail}
                      podeEditarMeta={Boolean(isAdmin)}
                      onToggleResponsavel={handleToggleResponsavel}
                      onAssumirProjeto={handleAssumirProjeto}
                    />
                  ))
                )}
                {isAdmin && areaId && (
                  <FormNovaMeta areaId={areaId} responsaveis={responsaveis} onSalvo={recarregar} mes={mes} />
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
                      metas={metas} objetivoResponsaveis={objetivoResponsaveis}
                      atividades={agendaMacro} semanas={semanas}
                      isAdmin={Boolean(isAdmin)} currentUserId={currentUserId} mes={mes} areaId={areaId ?? ''}
                      onAdd={handleAddAtividade} onDelete={handleDeleteAtividade}
                      onAddLivre={handleAddAtividadeLivre}
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

export default function PreBoneDayPage() {
  return (
    <>
      <BoneDayTabs />
      <PreBoneDayPageContent />
    </>
  );
}
