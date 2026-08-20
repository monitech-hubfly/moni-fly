'use client';

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useEffectiveUser } from '@/hooks/useEffectiveUser';
import {
  useMetasIndicadores,
  MetaItem, SubMetaItem, IndicadorItemMeta, ResponsavelItem, ObjetivoResponsavel,
} from '@/hooks/useMetasIndicadores';
import { registrarLog } from '@/hooks/useAuditLog';
import { getMonthOptions } from '@/hooks/usePlanoBoneDay';
import { statusSemaforoPorValor } from '@/utils/semaforoFaixas';

// ── Utilitários ────────────────────────────────────────────────────────────────
const TIPO_BADGE: Record<string, string> = {
  atingivel:            'bg-blue-100 text-blue-700',
  'atingivel - projeto':'bg-purple-100 text-purple-700',
  recorrente:           'bg-green-100 text-green-700',
};

function TipoBadge({ tipo }: { tipo: string | null }) {
  if (!tipo) return null;
  const key = tipo.toLowerCase();
  const cls = TIPO_BADGE[key] ?? 'bg-gray-100 text-gray-600';
  const label = key === 'atingivel - projeto' ? 'Projeto' : tipo.charAt(0).toUpperCase() + tipo.slice(1).toLowerCase();
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
}

// ── Data curta DD/MM ──────────────────────────────────────────────────────────
function formatarDataCurta(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ── Semana → range de datas ───────────────────────────────────────────────────
function isoWeekToDates(week: number, year: number): { label: string; range: string } {
  const jan4 = new Date(year, 0, 4);
  const dow = (jan4.getDay() + 6) % 7;
  const weekStart = new Date(jan4);
  weekStart.setDate(jan4.getDate() - dow + (week - 1) * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const fmt = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  return { label: `S${week}`, range: `${fmt(weekStart)}-${fmt(weekEnd)}` };
}

// ── Helpers para indicadores is_projeto_relativo ──────────────────────────────
function ultimoDiaSemanaISO(semana: number, ano: number): Date {
  const jan4  = new Date(ano, 0, 4);
  const dow   = (jan4.getDay() + 6) % 7;
  const start = new Date(jan4);
  start.setDate(jan4.getDate() - dow + (semana - 1) * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6); // domingo
  return end;
}

function calcEsperadoPct(
  dataInicio: string | null | undefined,
  dataFim: string | null | undefined,
  diasUteis: number | null | undefined,
  refDate: Date,
): number | null {
  if (!dataInicio || !dataFim) return null;
  const ref    = new Date(refDate); ref.setHours(0, 0, 0, 0);
  const inicio = new Date(dataInicio + 'T00:00:00');
  const fim    = new Date(dataFim    + 'T00:00:00');
  if (ref < inicio) return 0;
  if (ref > fim)    return 100;
  // Bug 3 fix: se dias_uteis não foi salvo no banco (null), calcula do range de datas
  let total = (diasUteis && diasUteis > 0) ? diasUteis : 0;
  if (!total) {
    const d = new Date(inicio);
    while (d <= fim) { if (d.getDay() !== 0 && d.getDay() !== 6) total++; d.setDate(d.getDate() + 1); }
  }
  if (total <= 0) return null;
  let count = 0;
  const d = new Date(inicio);
  while (d <= ref) {
    if (d.getDay() !== 0 && d.getDay() !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return Math.min(100, Math.round((count / total) * 100));
}

// ── Faixas legend ─────────────────────────────────────────────────────────────
type FaixaItem = { cor: string; limite: string; comparacao: string };

const FAROL_HEX: Record<string, string> = {
  ve: '#1e7a3a', vc: '#52b36f', am: '#f2c94c', vm: '#d24141',
};
const COMP: Record<string, string> = {
  gte: '≥', lte: '≤', gt: '>', lt: '<', eq: '=',
};
const FAROL_TEXT: Record<string, string> = {
  ve: '#ffffff', vc: '#ffffff', am: '#1f2937', vm: '#ffffff',
};

function corParaTexto(hex: string): string {
  if (hex === '#f2c94c') return '#1f2937';
  return '#ffffff';
}

/** Calcula hex do semáforo para indicadores is_projeto_relativo a partir do valor real e do % esperado. */
function resolveHexProjeto(valor: string | null | undefined, espPct: number | null): string {
  if (!valor || espPct === null || espPct <= 0) return '#d1d5db';
  const ratio = (parseFloat(valor) / espPct) * 100;
  if (isNaN(ratio)) return '#d1d5db';
  if (ratio >= 75) return FAROL_HEX['ve']!;
  if (ratio >= 60) return FAROL_HEX['vc']!;
  if (ratio >= 30) return FAROL_HEX['am']!;
  return FAROL_HEX['vm']!;
}

// Ordem posicional das cores do semáforo (melhor → pior)
const FAROL_POSICIONAL = ['ve', 'vc', 'am', 'vm'] as const;

function FaixasLegenda({ faixas }: { faixas: FaixaItem[] }) {
  if (!faixas.length) return null;
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {faixas.map((f, i) => {
        // Usa f.cor se bater exatamente em FAROL_HEX; caso contrário usa posição
        const corKey = (f.cor && FAROL_HEX[f.cor]) ? f.cor : (FAROL_POSICIONAL[i] ?? 'vm');
        return (
          <span key={i} className="text-[9px] font-bold px-1.5 py-0.5 rounded"
            style={{ backgroundColor: FAROL_HEX[corKey], color: FAROL_TEXT[corKey] }}>
            {COMP[f.comparacao] ?? f.comparacao}{f.limite}
          </span>
        );
      })}
    </div>
  );
}

// ── Faixas legend para is_projeto_relativo (limiares fixos sobre razão) ───────
function FaixasLegendaProjeto() {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {([
        { cor: 've' as const, label: '≥75%' },
        { cor: 'vc' as const, label: '≥60%' },
        { cor: 'am' as const, label: '≥30%' },
        { cor: 'vm' as const, label: '<30%' },
      ]).map(({ cor, label }) => (
        <span key={cor} className="text-[9px] font-bold px-1.5 py-0.5 rounded"
          style={{ backgroundColor: FAROL_HEX[cor], color: FAROL_TEXT[cor] }}>
          {label}
        </span>
      ))}
    </div>
  );
}

// ── Toast de confirmação ──────────────────────────────────────────────────────
function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex items-center gap-2 bg-gray-900 text-white text-xs font-medium px-4 py-2.5 rounded-xl shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
      <span className="text-green-400 text-sm">✓</span>
      {message}
    </div>
  );
}

// ── Seção colapsável ──────────────────────────────────────────────────────────
function SecaoToggle({ label, count, aberta, onToggle, children, cor }: {
  label: string; count: number; aberta: boolean; onToggle: () => void; children: ReactNode; cor?: string;
}) {
  return (
    <div className="border-t border-gray-100 pt-1.5">
      <button type="button"
        className={`w-full flex items-center justify-between text-xs py-0.5 transition-colors ${cor ?? 'text-gray-500 hover:text-gray-700'}`}
        onClick={onToggle}>
        <span>{label} ({count})</span>
        <span className="text-[10px] text-gray-400">{aberta ? '▲' : '▼'}</span>
      </button>
      {aberta && <div className="mt-1.5">{children}</div>}
    </div>
  );
}

// ── Formulário reutilizável (add/edit meta) ───────────────────────────────────
type MetaFormState = { descricao: string; tipo: string; respId: string; metaUnidade: string };

function MetaForm({ inicial, responsaveis, onSalvar, onCancelar, salvando, labelSalvar, isFilha }: {
  inicial: MetaFormState; responsaveis: ResponsavelItem[];
  onSalvar: (d: MetaFormState) => void; onCancelar: () => void;
  salvando: boolean; labelSalvar: string; isFilha?: boolean;
}) {
  const [f, setF] = useState<MetaFormState>(inicial);
  const [erroResp, setErroResp] = useState(false);
  const set = <K extends keyof MetaFormState>(k: K, v: MetaFormState[K]) => setF(p => ({ ...p, [k]: v }));

  const handleSalvar = () => {
    if (isFilha && !f.respId) { setErroResp(true); return; }
    onSalvar(f);
  };

  return (
    <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
      <input className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300"
        placeholder="Descrição *" value={f.descricao} onChange={e => set('descricao', e.target.value)} autoFocus />
      <div className={`grid gap-2 ${f.tipo === 'atingivel' ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <select className="text-xs border border-gray-300 rounded px-2 py-1.5"
          value={f.tipo} onChange={e => { set('tipo', e.target.value); set('metaUnidade', ''); }}>
          <option value="atingivel">Atingível</option>
          <option value="recorrente">Recorrente</option>
        </select>
        {f.tipo === 'atingivel' && (
          <input type="date" className="text-xs border border-gray-300 rounded px-2 py-1.5"
            value={f.metaUnidade} onChange={e => set('metaUnidade', e.target.value)} />
        )}
      </div>
      {responsaveis.length > 0 && (
        <div>
          <select
            className={`w-full text-xs border rounded px-2 py-1.5 ${erroResp ? 'border-red-400' : 'border-gray-300'}`}
            value={f.respId} onChange={e => { set('respId', e.target.value); setErroResp(false); }}>
            <option value="">{isFilha ? '— Responsável * —' : '— Responsável (opcional) —'}</option>
            {responsaveis.map(r => <option key={r.profile_id} value={r.profile_id}>{r.nome}</option>)}
          </select>
          {erroResp && <p className="text-[10px] text-red-500 mt-0.5">Responsável obrigatório</p>}
        </div>
      )}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancelar} className="text-xs text-gray-500 hover:text-gray-700 transition-colors">Cancelar</button>
        <button type="button" onClick={handleSalvar} disabled={!f.descricao.trim() || salvando}
          className="text-xs px-3 py-1 bg-blue-500 text-white rounded disabled:opacity-50 hover:bg-blue-600 transition-colors">
          {salvando ? 'Salvando...' : labelSalvar}
        </button>
      </div>
    </div>
  );
}

// ── Modal Assumir Projeto (com datas) ─────────────────────────────────────────
function ModalAssumirProjeto({ meta, onConfirmar, onCancelar }: {
  meta: MetaItem;
  onConfirmar: (metaId: string, dataInicio: string, dataFim: string) => Promise<void>;
  onCancelar: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [form,          setForm]          = useState({ inicio: '', fim: '' });
  const [diasPreview,   setDiasPreview]   = useState<number | null>(null);
  const [calculando,    setCalculando]    = useState(false);
  const [salvando,      setSalvando]      = useState(false);

  const calcularDiasUteis = useCallback(async (inicio: string, fim: string) => {
    if (!inicio || !fim) { setDiasPreview(null); return; }
    setCalculando(true);
    const { data } = await supabase.rpc('calcular_dias_uteis', { data_inicio: inicio, data_fim: fim });
    setDiasPreview(typeof data === 'number' ? data : null);
    setCalculando(false);
  }, [supabase]);

  const handleChange = (k: 'inicio' | 'fim', v: string) => {
    const next = { ...form, [k]: v };
    setForm(next);
    void calcularDiasUteis(next.inicio, next.fim);
  };

  const handleConfirmar = async () => {
    if (!form.inicio || !form.fim) return;
    setSalvando(true);
    try { await onConfirmar(meta.id, form.inicio, form.fim); }
    finally { setSalvando(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancelar}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative bg-white rounded-xl shadow-2xl w-80 flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h4 className="text-sm font-semibold text-gray-700">Assumir Projeto</h4>
          <button type="button" onClick={onCancelar} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="px-4 py-3 flex flex-col gap-3">
          <p className="text-xs text-gray-600 leading-snug">{meta.descricao}</p>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-gray-500 font-medium">Data início *</label>
            <input type="date" className="text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300"
              value={form.inicio} onChange={e => handleChange('inicio', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-gray-500 font-medium">Data fim *</label>
            <input type="date" className="text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300"
              value={form.fim} onChange={e => handleChange('fim', e.target.value)} />
          </div>
          {calculando && <p className="text-[10px] text-gray-400">Calculando dias úteis…</p>}
          {diasPreview !== null && !calculando && (
            <p className="text-[10px] text-blue-600 font-medium">{diasPreview} dias úteis</p>
          )}
        </div>
        <div className="px-4 py-3 border-t border-gray-100 flex gap-2 justify-end">
          <button type="button" onClick={onCancelar} className="text-xs text-gray-500 hover:text-gray-700">Cancelar</button>
          <button type="button" onClick={handleConfirmar}
            disabled={!form.inicio || !form.fim || salvando}
            className="text-xs px-3 py-1.5 bg-blue-500 text-white rounded disabled:opacity-50 hover:bg-blue-600 transition-colors">
            {salvando ? 'Salvando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Comentários overlay ───────────────────────────────────────────────────────
type ComRow = { id: string; descricao: string | null; usuario: string | null; criado_em: string | null };

function ComentariosModal({ metaId, onFechar, onNovoComentario }: {
  metaId: string; onFechar: () => void; onNovoComentario: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [coms,     setComs]     = useState<ComRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [texto,    setTexto]    = useState('');
  const [enviando, setEnviando] = useState(false);

  const fetchComs = useCallback(async () => {
    const { data } = await supabase.from('audit_log')
      .select('id, descricao, usuario, criado_em')
      .eq('entidade', 'objetivos').eq('entidade_id', metaId).eq('operacao', 'COMMENT')
      .order('criado_em', { ascending: false }).limit(20);
    setComs((data ?? []) as ComRow[]);
    setLoading(false);
  }, [supabase, metaId]);

  useEffect(() => { fetchComs(); }, [fetchComs]);

  const handleComentar = async () => {
    if (!texto.trim()) return;
    setEnviando(true);
    await (registrarLog as unknown as (a: Record<string, unknown>) => Promise<void>)({
      modulo: 'Planejamento', entidade: 'objetivos', entidade_id: metaId,
      operacao: 'COMMENT', descricao: texto.trim(),
    });
    setTexto('');
    await fetchComs();
    setEnviando(false);
    onNovoComentario();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onFechar}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative bg-white rounded-xl shadow-2xl w-96 max-h-[70vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h4 className="text-sm font-semibold text-gray-700">Comentários</h4>
          <button type="button" onClick={onFechar} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
          {loading ? <p className="text-xs text-gray-400">Carregando...</p>
            : coms.length === 0 ? <p className="text-xs text-gray-400">Nenhum comentário ainda.</p>
            : coms.map(c => (
              <div key={c.id} className="text-xs bg-gray-50 rounded-lg px-3 py-2">
                <div className="text-gray-800 leading-snug">{c.descricao}</div>
                <div className="text-gray-400 mt-1">
                  {c.usuario} · {c.criado_em ? new Date(c.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                </div>
              </div>
            ))}
        </div>
        <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
          <textarea className="flex-1 text-xs border border-gray-300 rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-blue-300"
            rows={2} placeholder="Escrever comentário..." value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComentar(); } }} />
          <button type="button" onClick={handleComentar} disabled={!texto.trim() || enviando}
            className="text-xs px-3 py-1.5 self-end bg-blue-500 text-white rounded-lg disabled:opacity-50 hover:bg-blue-600">
            {enviando ? '…' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-meta ──────────────────────────────────────────────────────────────────
function SubMetaEditavel({ sub, onSalvo, onExcluir }: {
  sub: SubMetaItem;
  onSalvo: (id: string, descricao: string) => void;
  onExcluir: (id: string) => void;
}) {
  const [editando,    setEditando]    = useState(false);
  const [texto,       setTexto]       = useState(sub.descricao);
  const [confirmando, setConfirmando] = useState(false);

  const salvar = () => {
    const novo = texto.trim();
    if (novo && novo !== sub.descricao) onSalvo(sub.id, novo);
    setEditando(false);
  };

  if (editando) {
    return (
      <li className="flex items-center gap-1">
        <input className="flex-1 text-xs border border-blue-300 rounded px-1.5 py-0.5 focus:outline-none"
          value={texto} onChange={e => setTexto(e.target.value)} onBlur={salvar}
          onKeyDown={e => { if (e.key === 'Enter') salvar(); if (e.key === 'Escape') { setTexto(sub.descricao); setEditando(false); } }}
          autoFocus />
      </li>
    );
  }
  if (confirmando) {
    return (
      <li className="flex items-center gap-1 text-xs text-red-600">
        <span className="flex-1">Excluir?</span>
        <button type="button" onClick={() => onExcluir(sub.id)} className="font-medium hover:underline">Sim</button>
        <button type="button" onClick={() => setConfirmando(false)} className="text-gray-400 ml-1">Não</button>
      </li>
    );
  }
  return (
    <li className="text-xs text-gray-600 flex items-center gap-1 group">
      <span className="text-gray-400">•</span>
      <span className="flex-1 leading-snug">{sub.descricao}</span>
      {sub.is_minha && (
        <>
          <button type="button" onClick={() => setEditando(true)} title="Editar"
            className="text-gray-300 group-hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs">✏️</button>
          <button type="button" onClick={() => setConfirmando(true)} title="Excluir"
            className="text-gray-300 group-hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs">✕</button>
        </>
      )}
    </li>
  );
}

// ── Linha de indicador ────────────────────────────────────────────────────────
function IndicadorLinha({
  ind, effectiveProfileId, currentUserId, responsaveis,
  semanaAtual, semanaAnterior, anoRelativo,
  onLancar, onAssumirIndicador, projetoOr, onToast,
}: {
  ind: IndicadorItemMeta;
  effectiveProfileId: string | null;
  currentUserId: string | null;
  responsaveis: ResponsavelItem[];
  semanaAtual: number;
  semanaAnterior: number;
  anoRelativo: number;
  onLancar: (indId: string, valor: string, semana: number) => Promise<boolean>;
  onAssumirIndicador: (indId: string) => Promise<void>;
  projetoOr?: { data_inicio: string | null; data_fim: string | null; dias_uteis: number | null } | null;
  onToast?: (msg: string) => void;
}) {
  const [valorEditAtual,    setValorEditAtual]    = useState(ind.valorAtual    ?? '');
  const [valorEditAnterior, setValorEditAnterior] = useState(ind.valorAnterior ?? '');
  const [salvandoAtual,     setSalvandoAtual]     = useState(false);
  const [salvandoAnterior,  setSalvandoAnterior]  = useState(false);
  const [assumindo,         setAssumindo]         = useState(false);

  useEffect(() => { setValorEditAtual(ind.valorAtual ?? '');       }, [ind.valorAtual]);
  useEffect(() => { setValorEditAnterior(ind.valorAnterior ?? ''); }, [ind.valorAnterior]);

  type RawSf = { is_projeto_relativo?: boolean; data_inicio?: string; data_fim?: string; dias_uteis?: number; faixas?: FaixaItem[] };
  const rawSf            = ind.semaforo_faixas as RawSf | null;
  const faixas           = rawSf?.faixas ?? [];
  const isEq             = faixas.length > 0 && faixas.every(f => f.comparacao === 'eq');
  const isProjetoRelativo = Boolean(rawSf?.is_projeto_relativo);

  // Datas do projeto: prioriza semaforo_faixas, cai para objetivo_responsaveis do usuário
  const prjInicio = rawSf?.data_inicio ?? projetoOr?.data_inicio ?? null;
  const prjFim    = rawSf?.data_fim    ?? projetoOr?.data_fim    ?? null;
  const prjUteis  = rawSf?.dias_uteis  ?? projetoOr?.dias_uteis  ?? null;

  // % esperado por semana (apenas para is_projeto_relativo)
  const esperadoAtual    = isProjetoRelativo
    ? calcEsperadoPct(prjInicio, prjFim, prjUteis, new Date())
    : null;
  const esperadoAnterior = isProjetoRelativo && anoRelativo > 0
    ? calcEsperadoPct(prjInicio, prjFim, prjUteis, ultimoDiaSemanaISO(semanaAnterior, anoRelativo))
    : null;

  const infoAtual    = anoRelativo > 0 ? isoWeekToDates(semanaAtual,    anoRelativo) : { label: `S${semanaAtual}`,    range: '' };
  const infoAnterior = anoRelativo > 0 ? isoWeekToDates(semanaAnterior, anoRelativo) : { label: `S${semanaAnterior}`, range: '' };

  // Quem é o responsável por este indicador
  const isMeu       = !!ind.profile_id && ind.profile_id === (effectiveProfileId ?? currentUserId);
  const semDono     = !ind.profile_id;
  const donoNome    = ind.profile_id ? (responsaveis.find(r => r.profile_id === ind.profile_id)?.nome ?? 'outro') : null;
  // Pode preencher: é o responsável do indicador
  const podeEditar  = isMeu;

  // Bug 2 fix: usa valorEdit (estado local) para calcular cor imediatamente ao digitar,
  // sem esperar o recarregar() do hook que só atualiza após o save confirmado pelo servidor.
  const hexAtual = isProjetoRelativo
    ? resolveHexProjeto(valorEditAtual.trim() || null, esperadoAtual)
    : valorEditAtual.trim()
      ? (FAROL_HEX[statusSemaforoPorValor(ind, valorEditAtual) as string] ?? '#d1d5db')
      : ind.corHex;

  const semaforoAnt = !isProjetoRelativo && valorEditAnterior.trim()
    ? (statusSemaforoPorValor(ind, valorEditAnterior) as string | null)
    : null;
  const hexAnterior = isProjetoRelativo
    ? resolveHexProjeto(valorEditAnterior.trim() || null, esperadoAnterior)
    : (semaforoAnt ? (FAROL_HEX[semaforoAnt] ?? '#e5e7eb') : '#e5e7eb');
  const VAZIO_HEX   = '#e5e7eb';

  const handleLancarAtual = async (val?: string) => {
    const v = (val !== undefined ? val : valorEditAtual).trim();
    if (!v) return;
    setSalvandoAtual(true);
    const ok = await onLancar(ind.id, v, semanaAtual);
    setSalvandoAtual(false);
    if (ok) onToast?.('Valor salvo com sucesso');
    else     onToast?.('Erro ao salvar — tente novamente');
  };
  const handleLancarAnterior = async (val?: string) => {
    const v = (val !== undefined ? val : valorEditAnterior).trim();
    if (!v) return;
    setSalvandoAnterior(true);
    const ok = await onLancar(ind.id, v, semanaAnterior);
    setSalvandoAnterior(false);
    if (ok) onToast?.('Valor salvo com sucesso');
    else     onToast?.('Erro ao salvar — tente novamente');
  };
  const handleAssumir = async () => {
    setAssumindo(true);
    await onAssumirIndicador(ind.id);
    setAssumindo(false);
  };

  // Detecta se é indicador percentual (aceita 0–100 inteiro)
  const isPct = isProjetoRelativo || ind.nome.includes('%');

  const CelulaLancamento = ({
    isAtual, info, hex, valor, setValor, salvando, onLancarFn, esperadoPct,
  }: {
    isAtual: boolean; info: { label: string; range: string };
    hex: string; valor: string; setValor: (v: string) => void;
    salvando: boolean; onLancarFn: (val?: string) => Promise<void>;
    esperadoPct?: number | null;
  }) => {
    const temValor = !!valor.trim();
    const bg       = temValor ? hex : VAZIO_HEX;
    const fg       = temValor ? corParaTexto(hex) : '#6b7280';
    const baseInput = 'w-full text-xs font-semibold rounded px-1.5 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-blue-300 transition-colors disabled:opacity-60';
    return (
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 mb-0.5">
          <span className="text-[9px] font-semibold text-gray-600">{info.label}</span>
          {isAtual && <span className="text-[8px] text-yellow-500 font-bold">★</span>}
          {info.range && <span className="text-[8px] text-gray-400">{info.range}</span>}
        </div>
        {esperadoPct !== null && esperadoPct !== undefined && (
          <div className="text-[8px] text-gray-400 font-medium mb-0.5">esp: {esperadoPct}%</div>
        )}
        {isEq ? (
          <select disabled={!podeEditar || salvando} value={valor}
            onChange={e => { setValor(e.target.value); void onLancarFn(e.target.value); }}
            className={baseInput}
            style={{ backgroundColor: bg, color: fg, border: `1px solid ${temValor ? hex : '#d1d5db'}` }}>
            <option value="">—</option>
            {faixas.map(f => <option key={f.limite} value={f.limite}>{f.limite}</option>)}
          </select>
        ) : (
          <input
            type="number"
            min={0}
            max={isPct ? 100 : undefined}
            step={1}
            disabled={!podeEditar || salvando}
            value={valor}
            placeholder={salvando ? '…' : '—'}
            onChange={e => setValor(e.target.value)}
            onBlur={() => void onLancarFn()}
            onKeyDown={e => { if (e.key === 'Enter') void onLancarFn(); }}
            className={baseInput}
            style={{ backgroundColor: bg, color: fg, border: `1px solid ${temValor ? hex : '#d1d5db'}` }}
          />
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-1.5 px-2 py-2 rounded bg-gray-50 border border-gray-100">
      {/* Linha 1: nome + faixas + responsável / assumir */}
      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
        {ind.indicador_chave && <span className="text-[11px] leading-none flex-shrink-0">🔑</span>}
        <span className="text-xs text-gray-700 leading-snug flex-1 min-w-0">{ind.nome}</span>
        {isProjetoRelativo ? <FaixasLegendaProjeto /> : faixas.length > 0 && <FaixasLegenda faixas={faixas} />}
        {/* Responsável / botão assumir */}
        {isMeu ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded border bg-blue-100 text-blue-700 border-blue-300 whitespace-nowrap flex-shrink-0">
            ✓ Minha
          </span>
        ) : semDono ? (
          <button type="button" onClick={handleAssumir} disabled={assumindo}
            className="text-[10px] px-1.5 py-0.5 rounded border text-gray-400 border-gray-200 hover:border-blue-300 hover:text-blue-500 transition-colors whitespace-nowrap flex-shrink-0 disabled:opacity-50">
            {assumindo ? '…' : 'Assumir'}
          </button>
        ) : (
          <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">
            {donoNome}
          </span>
        )}
      </div>

      {/* Linha 2: células das duas semanas — só se tem responsável */}
      {/* Nota: CelulaLancamento é chamada como FUNÇÃO (não como componente JSX) para evitar
          que o React desmonte/remonte o input a cada keystroke (o que dispararia onBlur → save
          com valor parcial e causaria os React errors #418/#422). */}
      {!semDono && (
        <div className="flex items-stretch gap-2">
          {CelulaLancamento({
            isAtual: false, info: infoAnterior, hex: hexAnterior,
            valor: valorEditAnterior, setValor: setValorEditAnterior,
            salvando: salvandoAnterior, onLancarFn: handleLancarAnterior,
            esperadoPct: esperadoAnterior,
          })}
          <div className="w-px bg-gray-200 self-stretch flex-shrink-0" />
          {CelulaLancamento({
            isAtual: true, info: infoAtual, hex: hexAtual,
            valor: valorEditAtual, setValor: setValorEditAtual,
            salvando: salvandoAtual, onLancarFn: handleLancarAtual,
            esperadoPct: esperadoAtual,
          })}
        </div>
      )}
    </div>
  );
}

// ── Tipos de blocker ──────────────────────────────────────────────────────────
type BlockerRow = { id: string; descricao: string; objetivo_id: string | null; criado_em: string | null; resolvido: boolean };

// ── MetaCard ──────────────────────────────────────────────────────────────────
function MetaCard({
  meta, subMetas, indicadores, responsaveis,
  podeConcluirGlobal, effectiveProfileId, currentUserId,
  assumiu, concluiuMeta, totalResponsaveis, concluiuCount,
  semanaAtual, semanaAnterior, anoRelativo,
  blockers, onAdicionarBlocker, onResolverBlocker,
  onEditarSubMeta, onExcluirSubMeta, onAddSubMeta,
  onConcluirMeta, onReabrirMeta,
  onLancarIndicador, onAssumirIndicador,
  onToggleResponsavel, onAssumirProjeto, projetoOr, onToast,
}: {
  meta: MetaItem; subMetas: SubMetaItem[]; indicadores: IndicadorItemMeta[];
  responsaveis: ResponsavelItem[];
  podeConcluirGlobal: boolean;
  effectiveProfileId: string | null;
  currentUserId: string | null;
  assumiu: boolean;
  concluiuMeta: boolean;
  totalResponsaveis: number;
  concluiuCount: number;
  semanaAtual: number; semanaAnterior: number; anoRelativo: number;
  blockers: BlockerRow[];
  onAdicionarBlocker: (metaId: string, descricao: string) => Promise<void>;
  onResolverBlocker: (blockerId: string) => Promise<void>;
  onEditarSubMeta: (id: string, desc: string) => void;
  onExcluirSubMeta: (id: string) => void;
  onAddSubMeta: (metaPaiId: string, desc: string, tipo: string, respId: string | null) => Promise<void>;
  onConcluirMeta: (metaId: string) => Promise<void>;
  onReabrirMeta: (metaId: string) => Promise<void>;
  onLancarIndicador: (indId: string, valor: string, semana: number) => Promise<boolean>;
  onAssumirIndicador: (indId: string) => Promise<void>;
  onToggleResponsavel: (metaId: string) => Promise<void>;
  onAssumirProjeto: (metaId: string, dataInicio: string, dataFim: string) => Promise<void>;
  projetoOr?: { data_inicio: string | null; data_fim: string | null; dias_uteis: number | null } | null;
  onToast?: (msg: string) => void;
}) {
  const [secaoFilhas,        setSecaoFilhas]        = useState(false);
  const [adicionandoFilha,   setAdicionandoFilha]   = useState(false);
  const [adicionandoBlocker, setAdicionandoBlocker] = useState(false);
  const [descricaoBlocker,   setDescricaoBlocker]   = useState('');
  const [salvandoBlocker,    setSalvandoBlocker]    = useState(false);
  const [concluindo,         setConcluindo]         = useState(false);
  const [reabrindo,          setReabrindo]          = useState(false);
  const [salvandoFilha,      setSalvandoFilha]      = useState(false);
  const [modalComs,          setModalComs]          = useState(false);
  const [modalProjeto,       setModalProjeto]       = useState(false);
  const [togglenando,        setTogglendo]          = useState(false);
  const [countLocal,         setCountLocal]         = useState(meta.comentariosCount);

  useEffect(() => { setCountLocal(meta.comentariosCount); }, [meta.comentariosCount]);

  const isRecorrente  = meta.tipo?.toLowerCase() === 'recorrente';
  const isProjeto     = meta.tipo?.toLowerCase() === 'atingivel - projeto';
  const hoje          = new Date().toISOString().slice(0, 10);
  const isAtrasada    = !isRecorrente && !!meta.meta_unidade && meta.meta_unidade < hoje && !concluiuMeta;
  const hasChave      = meta.is_chave || indicadores.some(i => i.indicador_chave);
  const precisaJustificar = isAtrasada && countLocal === 0;
  const diffDias      = isAtrasada && meta.meta_unidade
    ? Math.max(1, Math.floor((new Date(hoje + 'T00:00:00').getTime() - new Date(meta.meta_unidade + 'T00:00:00').getTime()) / 86400000))
    : 0;

  const handleSalvarFilha = async (f: MetaFormState) => {
    setSalvandoFilha(true);
    try { await onAddSubMeta(meta.id, f.descricao, f.tipo, f.respId || null); setAdicionandoFilha(false); }
    finally { setSalvandoFilha(false); }
  };

  const handleConcluir = async () => {
    setConcluindo(true);
    try { await onConcluirMeta(meta.id); }
    finally { setConcluindo(false); }
  };

  const handleReabrir = async () => {
    setReabrindo(true);
    try { await onReabrirMeta(meta.id); }
    finally { setReabrindo(false); }
  };

  const handleSalvarBlocker = async () => {
    if (!descricaoBlocker.trim()) return;
    setSalvandoBlocker(true);
    try { await onAdicionarBlocker(meta.id, descricaoBlocker.trim()); setDescricaoBlocker(''); setAdicionandoBlocker(false); }
    finally { setSalvandoBlocker(false); }
  };

  const handleToggle = async () => {
    if (assumiu) {
      // já assumiu → remove
      setTogglendo(true);
      try { await onToggleResponsavel(meta.id); }
      finally { setTogglendo(false); }
    } else {
      // ainda não assumiu
      if (isProjeto) { setModalProjeto(true); }
      else {
        setTogglendo(true);
        try { await onToggleResponsavel(meta.id); }
        finally { setTogglendo(false); }
      }
    }
  };

  // Indicadores sem responsável (profile_id = null) dentro desta meta
  const indsSemDono = indicadores.filter(i => !i.profile_id);

  return (
    <div className={`bg-white border rounded-lg shadow-sm overflow-hidden ${
      precisaJustificar ? 'border-red-400 ring-1 ring-red-200 shadow-red-100' :
      isAtrasada        ? 'border-amber-300' : 'border-gray-200'
    }`}>
      {/* Cabeçalho */}
      <div className={`p-3 flex flex-col gap-1.5 ${precisaJustificar ? 'bg-gradient-to-br from-red-50 to-white' : ''}`}>
        <div className="flex items-start gap-1.5 min-w-0">
          <span className={`text-sm font-medium text-gray-800 leading-snug flex-1 min-w-0 ${concluiuMeta ? 'line-through text-gray-400' : ''}`}>
            {hasChave && <span className="mr-1">🔑</span>}
            {isAtrasada && <span className="mr-1">⚠️</span>}
            {meta.descricao}
            {!isRecorrente && meta.meta_unidade && (
              <span className={`ml-1.5 text-xs font-normal ${isAtrasada ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>
                · {meta.meta_unidade}
              </span>
            )}
            {!isRecorrente && meta.criado_em && (
              <span className="ml-1 text-[10px] font-normal text-gray-300">
                · aberta {formatarDataCurta(meta.criado_em)}
              </span>
            )}
          </span>
          <div className="flex items-center gap-1 ml-1 flex-shrink-0 flex-wrap justify-end">
            <TipoBadge tipo={meta.tipo} />
            {/* Botão Assumir / ✓ Minha */}
            <button type="button" onClick={handleToggle} disabled={togglenando}
              className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors whitespace-nowrap disabled:opacity-50 ${
                assumiu
                  ? 'bg-blue-100 text-blue-700 border-blue-300'
                  : 'text-gray-400 border-gray-200 hover:border-blue-300 hover:text-blue-500'
              }`}>
              {togglenando ? '…' : assumiu ? '✓ Minha' : 'Assumir'}
            </button>
            {/* Concluído per-user */}
            {assumiu && (
              concluiuMeta ? (
                <button type="button" onClick={handleReabrir} disabled={reabrindo}
                  className="text-[10px] px-1.5 py-0.5 rounded border bg-green-100 text-green-700 border-green-300 hover:bg-green-200 transition-colors whitespace-nowrap disabled:opacity-50">
                  {reabrindo ? '…' : '✓ Concluída'}
                </button>
              ) : (
                <button type="button" onClick={handleConcluir} disabled={concluindo}
                  className="text-[14px] text-green-500 hover:text-green-700 font-bold transition-colors px-0.5 disabled:opacity-50"
                  title="Marcar como concluída para mim">
                  {concluindo ? '…' : '✓'}
                </button>
              )
            )}
            {/* Indicador de quantos concluíram */}
            {totalResponsaveis > 1 && concluiuCount > 0 && (
              <span className="text-[9px] text-gray-400 whitespace-nowrap">
                {concluiuCount}/{totalResponsaveis} concl.
              </span>
            )}
            {isAtrasada && (
              <button type="button" onClick={() => setModalComs(true)} title="Justificar atraso"
                className="text-[10px] text-amber-600 hover:text-amber-800 font-medium px-1 py-0.5 rounded bg-amber-50 border border-amber-200 transition-colors whitespace-nowrap">
                💬 Justificar
              </button>
            )}
            <button type="button" onClick={() => setModalComs(true)} title="Comentários"
              className="text-[10px] text-gray-400 hover:text-blue-500 transition-colors px-0.5">
              💬{countLocal > 0 ? ` ${countLocal}` : ''}
            </button>
          </div>
        </div>

        {meta.responsavel_nome && (
          <div className="text-xs text-gray-500">
            {meta.responsavel_nome}
            {meta.meta_valor && <span> · Meta: {meta.meta_valor}</span>}
          </div>
        )}
      </div>

      {/* Corpo */}
      {precisaJustificar ? (
        <div className="px-3 pb-4 pt-1">
          <div className="rounded-xl border border-red-200 bg-red-50/70 p-4 flex flex-col items-center gap-2 text-center">
            <div className="w-10 h-10 rounded-full bg-red-100 border border-red-200 flex items-center justify-center text-lg">🔒</div>
            <p className="text-sm font-semibold text-red-700">Atrasada há {diffDias} dia{diffDias !== 1 ? 's' : ''}</p>
            <p className="text-xs text-red-500 leading-snug max-w-[220px]">
              Justifique o motivo do atraso para desbloquear as ações desta meta.
            </p>
            <button type="button" onClick={() => setModalComs(true)}
              className="mt-1 inline-flex items-center gap-1.5 px-5 py-2 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 active:bg-red-800 transition-colors shadow-sm">
              💬 Justificar agora
            </button>
          </div>
        </div>
      ) : (
        <div className="px-3 pb-3 flex flex-col gap-1.5">
          {/* Indicadores sem responsável — aviso para assumir */}
          {indsSemDono.length > 0 && totalResponsaveis > 1 && (
            <div className="border-t border-orange-100 pt-1.5">
              <p className="text-[10px] font-semibold text-orange-600 uppercase tracking-wide mb-1">
                📋 Indicadores sem responsável ({indsSemDono.length}) — assuma os seus
              </p>
              <div className="flex flex-col gap-1">
                {indsSemDono.map(ind => (
                  <IndicadorLinha key={ind.id} ind={ind}
                    effectiveProfileId={effectiveProfileId}
                    currentUserId={currentUserId}
                    responsaveis={responsaveis}
                    semanaAtual={semanaAtual} semanaAnterior={semanaAnterior} anoRelativo={anoRelativo}
                    onLancar={onLancarIndicador}
                    onAssumirIndicador={onAssumirIndicador}
                    projetoOr={projetoOr}
                    onToast={onToast}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Indicadores com responsável */}
          {indicadores.filter(i => !!i.profile_id).length > 0 && (
            <div className="border-t border-gray-100 pt-1.5 flex flex-col gap-1">
              {indicadores.filter(i => !!i.profile_id).map(ind => (
                <IndicadorLinha key={ind.id} ind={ind}
                  effectiveProfileId={effectiveProfileId}
                  currentUserId={currentUserId}
                  responsaveis={responsaveis}
                  semanaAtual={semanaAtual} semanaAnterior={semanaAnterior} anoRelativo={anoRelativo}
                  onLancar={onLancarIndicador}
                  onAssumirIndicador={onAssumirIndicador}
                  projetoOr={projetoOr}
                  onToast={onToast}
                />
              ))}
            </div>
          )}

          {/* Seção Metas filhas */}
          {subMetas.length > 0 && (
            <SecaoToggle label="Metas filhas" count={subMetas.length} aberta={secaoFilhas} onToggle={() => setSecaoFilhas(v => !v)}>
              <ul className="flex flex-col gap-0.5 pl-2 border-l-2 border-gray-100">
                {subMetas.map(s => <SubMetaEditavel key={s.id} sub={s} onSalvo={onEditarSubMeta} onExcluir={onExcluirSubMeta} />)}
              </ul>
            </SecaoToggle>
          )}

          {/* Blockers */}
          {blockers.length > 0 && (
            <div className="border-t border-gray-100 pt-1.5 flex flex-col gap-1">
              <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wide">🚧 Blockers ({blockers.length})</p>
              {blockers.map(b => (
                <div key={b.id} className="flex items-start gap-2 bg-red-50 border border-red-200 rounded px-2 py-1.5">
                  <p className="text-xs text-red-800 flex-1 leading-snug">{b.descricao}</p>
                  <button type="button" onClick={() => onResolverBlocker(b.id)} title="Marcar como resolvido"
                    className="text-green-600 hover:text-green-800 font-bold text-xs shrink-0">✓</button>
                </div>
              ))}
            </div>
          )}

          {/* Formulário add blocker */}
          {adicionandoBlocker && (
            <div className="border-t border-gray-100 pt-1.5 flex flex-col gap-2">
              <textarea rows={2} placeholder="Descreva o blocker *"
                value={descricaoBlocker} onChange={e => setDescricaoBlocker(e.target.value)}
                className="w-full text-xs border border-red-200 rounded px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-red-300"
                autoFocus />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => { setAdicionandoBlocker(false); setDescricaoBlocker(''); }}
                  className="text-xs text-gray-500 hover:text-gray-700">Cancelar</button>
                <button type="button" onClick={handleSalvarBlocker} disabled={!descricaoBlocker.trim() || salvandoBlocker}
                  className="text-xs px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 transition-colors">
                  {salvandoBlocker ? 'Salvando...' : 'Adicionar'}
                </button>
              </div>
            </div>
          )}

          {/* Ações do rodapé */}
          {adicionandoFilha ? (
            <MetaForm
              inicial={{ descricao: '', tipo: 'atingivel', respId: '', metaUnidade: '' }}
              responsaveis={responsaveis} onSalvar={handleSalvarFilha}
              onCancelar={() => setAdicionandoFilha(false)} salvando={salvandoFilha}
              labelSalvar="Salvar meta filha" isFilha />
          ) : !adicionandoBlocker ? (
            <div className="border-t border-gray-100 pt-1.5 flex items-center gap-4">
              <button type="button" onClick={() => setAdicionandoFilha(true)}
                className="text-xs text-gray-400 hover:text-blue-600 text-left transition-colors">
                + Adicionar meta filha
              </button>
              <button type="button" onClick={() => setAdicionandoBlocker(true)}
                className="text-xs text-red-400 hover:text-red-600 transition-colors">
                🚧 + Blocker
              </button>
            </div>
          ) : null}
        </div>
      )}

      {modalComs && (
        <ComentariosModal metaId={meta.id} onFechar={() => setModalComs(false)}
          onNovoComentario={() => setCountLocal(c => c + 1)} />
      )}
      {modalProjeto && (
        <ModalAssumirProjeto meta={meta}
          onConfirmar={async (id, ini, fim) => { await onAssumirProjeto(id, ini, fim); setModalProjeto(false); }}
          onCancelar={() => setModalProjeto(false)} />
      )}
    </div>
  );
}

// ── IndicadorLinhaSimples (versão sem células de lançamento — para MetaCardSemDono) ──
function IndicadorLinhaSimples({ ind, responsaveis, onAssumirIndicador }: {
  ind: IndicadorItemMeta;
  responsaveis: ResponsavelItem[];
  onAssumirIndicador: (indId: string) => Promise<void>;
}) {
  const [assumindo, setAssumindo] = useState(false);

  type RawSf = { is_projeto_relativo?: boolean; faixas?: FaixaItem[] };
  const rawSf = ind.semaforo_faixas as RawSf | null;
  const faixas = rawSf?.faixas ?? [];
  const isProjetoRelativo = Boolean(rawSf?.is_projeto_relativo);

  const semDono  = !ind.profile_id;
  const donoNome = ind.profile_id ? (responsaveis.find(r => r.profile_id === ind.profile_id)?.nome ?? 'outro') : null;

  const handleAssumir = async () => {
    setAssumindo(true);
    try { await onAssumirIndicador(ind.id); }
    finally { setAssumindo(false); }
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap px-2 py-1.5 rounded bg-gray-50 border border-gray-100">
      {ind.indicador_chave && <span className="text-[11px] leading-none flex-shrink-0">🔑</span>}
      <span className="text-xs text-gray-700 leading-snug flex-1 min-w-0">{ind.nome}</span>
      {isProjetoRelativo ? <FaixasLegendaProjeto /> : faixas.length > 0 && <FaixasLegenda faixas={faixas} />}
      {semDono ? (
        <button type="button" onClick={handleAssumir} disabled={assumindo}
          className="text-[10px] px-1.5 py-0.5 rounded border text-gray-400 border-gray-200 hover:border-blue-300 hover:text-blue-500 transition-colors whitespace-nowrap flex-shrink-0 disabled:opacity-50">
          {assumindo ? '…' : 'Assumir'}
        </button>
      ) : (
        <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">{donoNome}</span>
      )}
    </div>
  );
}

// ── MetaCardSemDono (card simplificado para metas sem responsável) ─────────────
function MetaCardSemDono({ meta, indicadores, responsaveis, onToggleResponsavel, onAssumirProjeto, onAssumirIndicador }: {
  meta: MetaItem;
  indicadores: IndicadorItemMeta[];
  responsaveis: ResponsavelItem[];
  onToggleResponsavel: (metaId: string) => Promise<void>;
  onAssumirProjeto: (metaId: string, dataInicio: string, dataFim: string) => Promise<void>;
  onAssumirIndicador: (indId: string) => Promise<void>;
}) {
  const [assumindo,    setAssumindo]    = useState(false);
  const [modalProjeto, setModalProjeto] = useState(false);
  const isProjeto = meta.tipo?.toLowerCase() === 'atingivel - projeto';

  const handleAssumir = async () => {
    if (isProjeto) { setModalProjeto(true); return; }
    setAssumindo(true);
    try { await onToggleResponsavel(meta.id); }
    finally { setAssumindo(false); }
  };

  return (
    <div className="bg-white border border-orange-200 rounded-lg shadow-sm overflow-hidden">
      {/* Cabeçalho da meta */}
      <div className="px-3 py-2.5 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <TipoBadge tipo={meta.tipo} />
            <span className="text-sm font-medium text-gray-800 leading-snug">
              {meta.is_chave && <span className="mr-1">🔑</span>}
              {meta.descricao}
            </span>
            {!meta.tipo?.toLowerCase().includes('recorrente') && meta.meta_unidade && (
              <span className="text-xs text-gray-400 ml-1">· {meta.meta_unidade}</span>
            )}
            {meta.criado_em && (
              <span className="text-[10px] text-gray-300">· aberta {formatarDataCurta(meta.criado_em)}</span>
            )}
          </div>
        </div>
        <button type="button" onClick={handleAssumir} disabled={assumindo}
          className="text-[10px] px-2 py-1 rounded border text-gray-500 border-gray-300 hover:border-blue-400 hover:text-blue-600 transition-colors whitespace-nowrap flex-shrink-0 disabled:opacity-50">
          {assumindo ? '…' : 'Assumir'}
        </button>
      </div>

      {/* Indicadores da meta */}
      {indicadores.length > 0 && (
        <div className="px-3 pb-2.5 flex flex-col gap-1 border-t border-orange-100 pt-2">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Indicadores</p>
          {indicadores.map(ind => (
            <IndicadorLinhaSimples key={ind.id} ind={ind}
              responsaveis={responsaveis}
              onAssumirIndicador={onAssumirIndicador}
            />
          ))}
        </div>
      )}

      {modalProjeto && (
        <ModalAssumirProjeto meta={meta}
          onConfirmar={async (id, ini, fim) => { await onAssumirProjeto(id, ini, fim); setModalProjeto(false); }}
          onCancelar={() => setModalProjeto(false)} />
      )}
    </div>
  );
}

// ── MetasIndicadoresBloco ─────────────────────────────────────────────────────
const LS_MES_KEY = 'bone_day_ultimo_mes';

function mesAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function MetasIndicadoresBloco() {
  const supabase = useMemo(() => createClient(), []);
  const { effectiveProfileId, areaId } = useEffectiveUser();

  // Hydration fix: inicializa com mes atual (igual no servidor), depois sincroniza do localStorage
  const [mes, setMesState] = useState(mesAtual);
  useEffect(() => {
    const saved = localStorage.getItem(LS_MES_KEY);
    if (saved && /^\d{4}-\d{2}$/.test(saved)) setMesState(saved);
  }, []);
  const setMes = (m: string) => { localStorage.setItem(LS_MES_KEY, m); setMesState(m); };
  const mesOptions = useMemo(() => getMonthOptions(), []);

  const {
    metas, subMetas: hookSubMetas, indicadores, responsaveis, objetivoResponsaveis,
    semanaRelativa, semanaAnterior, anoRelativo,
    isLoading, error, recarregar,
  } = useMetasIndicadores(effectiveProfileId, areaId, mes);

  const [expandido,         setExpandido]         = useState(false);
  const [localSubMetas,     setLocalSubMetas]      = useState<SubMetaItem[]>([]);
  const [currentUserId,     setCurrentUserId]      = useState<string | null>(null);
  const [filtroMinhas,      setFiltroMinhas]       = useState(true);
  const [semDonoAberta,     setSemDonoAberta]      = useState(true);
  const [allBlockers,       setAllBlockers]        = useState<BlockerRow[]>([]);
  const [toastMsg,          setToastMsg]           = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    })();
  }, [supabase]);

  const loadBlockers = useCallback(async () => {
    if (!areaId) return;
    const { data } = await supabase.from('blockers')
      .select('id, descricao, objetivo_id, criado_em, resolvido')
      .eq('area_id', areaId).eq('resolvido', false)
      .order('criado_em', { ascending: false });
    setAllBlockers((data ?? []) as BlockerRow[]);
  }, [supabase, areaId]);

  useEffect(() => { if (expandido) { void loadBlockers(); } }, [expandido, loadBlockers]);
  useEffect(() => { setLocalSubMetas(hookSubMetas); }, [hookSubMetas]);

  const log = (args: Record<string, unknown>) =>
    void (registrarLog as unknown as (a: Record<string, unknown>) => Promise<void>)(args);

  // ── Assumir / deixar meta ───────────────────────────────────────────────────
  const handleToggleResponsavel = useCallback(async (objetivoId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const jaExiste = objetivoResponsaveis.some(r => r.objetivo_id === objetivoId && r.profile_id === user.id);
    if (jaExiste) {
      // Remove responsabilidade
      await supabase.from('objetivo_responsaveis').delete()
        .eq('objetivo_id', objetivoId).eq('profile_id', user.id);

      // Verifica quantos restaram
      const restantes = objetivoResponsaveis.filter(r => r.objetivo_id === objetivoId && r.profile_id !== user.id);
      if (restantes.length === 1) {
        // Ficou só 1 → auto-assign indicadores sem dono para esse único responsável
        const unico = restantes[0].profile_id;
        const indsObj = indicadores.filter(i => i.objetivo_id === objetivoId && !i.profile_id);
        if (indsObj.length > 0) {
          await supabase.from('indicadores').update({ profile_id: unico })
            .in('id', indsObj.map(i => i.id));
        }
      } else if (restantes.length === 0) {
        // Ninguém mais → reset indicadores
        await (supabase.from('indicadores') as any).update({ profile_id: null }) // eslint-disable-line
          .eq('objetivo_id', objetivoId);
      }
    } else {
      // Assume a meta
      await supabase.from('objetivo_responsaveis').insert({ objetivo_id: objetivoId, profile_id: user.id });

      // Verifica quantos são agora
      const totalAgora = objetivoResponsaveis.filter(r => r.objetivo_id === objetivoId).length + 1;
      if (totalAgora === 1) {
        // Primeiro e único → auto-assign todos os indicadores sem dono
        const indsObj = indicadores.filter(i => i.objetivo_id === objetivoId && !i.profile_id);
        if (indsObj.length > 0) {
          await supabase.from('indicadores').update({ profile_id: user.id })
            .in('id', indsObj.map(i => i.id));
        }
      }
      // Se já tinha outros → não mexe nos indicadores (cada um escolhe os seus)
    }
    log({ modulo: 'Planejamento', entidade: 'objetivos', entidade_id: objetivoId, operacao: 'UPDATE', descricao: jaExiste ? 'Deixou a meta' : 'Assumiu a meta' });
    recarregar();
  }, [supabase, objetivoResponsaveis, indicadores, recarregar]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAssumirProjeto = useCallback(async (objetivoId: string, dataInicio: string, dataFim: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: dias } = await supabase.rpc('calcular_dias_uteis', { data_inicio: dataInicio, data_fim: dataFim });
    await supabase.from('objetivo_responsaveis').insert({
      objetivo_id: objetivoId, profile_id: user.id,
      data_inicio: dataInicio, data_fim: dataFim,
      dias_uteis: typeof dias === 'number' ? dias : null,
    });

    const totalAgora = objetivoResponsaveis.filter(r => r.objetivo_id === objetivoId).length + 1;
    if (totalAgora === 1) {
      const indsObj = indicadores.filter(i => i.objetivo_id === objetivoId && !i.profile_id);
      if (indsObj.length > 0) {
        await supabase.from('indicadores').update({ profile_id: user.id })
          .in('id', indsObj.map(i => i.id));
      }
    }
    log({ modulo: 'Planejamento', entidade: 'objetivos', entidade_id: objetivoId, operacao: 'UPDATE', descricao: 'Assumiu projeto com datas' });
    recarregar();
  }, [supabase, objetivoResponsaveis, indicadores, recarregar]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Assumir indicador ───────────────────────────────────────────────────────
  const handleAssumirIndicador = useCallback(async (indId: string) => {
    const uid = currentUserId;
    if (!uid) return;
    const { error: e } = await supabase.from('indicadores').update({ profile_id: uid }).eq('id', indId);
    if (e) { console.error('[AssumirIndicador]', e); return; }
    log({ modulo: 'Planejamento', entidade: 'indicadores', entidade_id: indId, operacao: 'UPDATE', descricao: 'Assumiu indicador' });
    recarregar();
  }, [supabase, currentUserId, recarregar]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Conclusão individual ────────────────────────────────────────────────────
  const handleConcluirMeta = useCallback(async (metaId: string) => {
    const uid = currentUserId;
    if (!uid) return;
    const { error: e } = await (supabase.from('objetivo_responsaveis') as any)
      .update({ concluido: true, concluido_em: new Date().toISOString() })
      .eq('objetivo_id', metaId).eq('profile_id', uid);
    if (e) { console.error('[ConcluirMeta]', e); return; }
    log({ modulo: 'Planejamento', entidade: 'objetivos', entidade_id: metaId, operacao: 'UPDATE', descricao: 'Meta concluída (individual)' });
    recarregar();
  }, [supabase, currentUserId, recarregar]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReabrirMeta = useCallback(async (metaId: string) => {
    const uid = currentUserId;
    if (!uid) return;
    const { error: e } = await (supabase.from('objetivo_responsaveis') as any)
      .update({ concluido: false, concluido_em: null })
      .eq('objetivo_id', metaId).eq('profile_id', uid);
    if (e) { console.error('[ReabrirMeta]', e); return; }
    recarregar();
  }, [supabase, currentUserId, recarregar]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sub-metas ───────────────────────────────────────────────────────────────
  const handleEditarSubMeta = useCallback(async (id: string, desc: string) => {
    const { error: e } = await supabase.from('objetivos').update({ descricao: desc }).eq('id', id);
    if (e) { console.error('[EditarSubMeta]', e); return; }
    log({ modulo: 'Planejamento', entidade: 'objetivos', entidade_id: id, operacao: 'UPDATE', campo: 'descricao', valor_novo: desc });
    setLocalSubMetas(prev => prev.map(s => s.id === id ? { ...s, descricao: desc } : s));
  }, [supabase]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExcluirSubMeta = useCallback(async (id: string) => {
    const { error: e } = await supabase.from('objetivos').delete().eq('id', id);
    if (e) { console.error('[ExcluirSubMeta]', e); return; }
    log({ modulo: 'Planejamento', entidade: 'objetivos', entidade_id: id, operacao: 'DELETE' });
    setLocalSubMetas(prev => prev.filter(s => s.id !== id));
  }, [supabase]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddSubMeta = useCallback(async (metaPaiId: string, descricao: string, tipo: string, profileId: string | null) => {
    if (!areaId) return;
    const { data: ins, error: e } = await supabase.from('objetivos')
      .insert({ area_id: areaId, descricao, tipo, objetivo_pai_id: metaPaiId, status: 'ativo', profile_id: profileId })
      .select('id').single();
    if (e) { console.error('[AddSubMeta]', e); return; }
    log({ modulo: 'Planejamento', entidade: 'objetivos', entidade_id: String((ins as { id: unknown }).id), operacao: 'INSERT', descricao: `Nova meta filha: ${descricao}` });
    recarregar();
  }, [supabase, areaId, recarregar]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Lançar indicador ────────────────────────────────────────────────────────
  const handleLancarIndicador = useCallback(async (indId: string, valor: string, semana: number): Promise<boolean> => {
    if (!semana) return false;
    const profileId = effectiveProfileId ?? currentUserId;
    if (!profileId) { console.warn('[LancarIndicador] sem profileId'); return false; }

    try {
      // Bug 1 fix (v2): busca linha própria OU legada (profile_id null) para evitar falha de
      // INSERT por unique constraint quando já existe registro antigo sem profile_id na semana.
      const { data: rows, error: selectErr } = await (supabase.from('indicador_lancamentos') as any)
        .select('id, valor, profile_id')
        .eq('indicador_id', indId)
        .eq('semana', semana)
        .or(`profile_id.eq.${profileId},profile_id.is.null`);

      if (selectErr) {
        console.error('[LancarIndicador] erro ao buscar lançamento existente:', selectErr);
      }
      // Prioriza linha própria do usuário; cai para linha legada (profile_id null)
      const existingRows = (rows ?? []) as { id: string; valor: string; profile_id: string | null }[];
      const existing = existingRows.find(r => r.profile_id === profileId) ?? existingRows[0] ?? null;

      let saveErr: unknown = null;
      if (existing?.id) {
        // UPDATE: linha já existe (própria ou legada) — migra profile_id para o usuário atual
        const { error } = await (supabase.from('indicador_lancamentos') as any)
          .update({ valor, profile_id: profileId })
          .eq('id', existing.id);
        saveErr = error;
      } else {
        // INSERT: primeira vez nesta semana para este usuário (inclui semana_ano)
        const { error } = await (supabase.from('indicador_lancamentos') as any)
          .insert({ indicador_id: indId, semana, semana_ano: new Date().getFullYear(), valor, profile_id: profileId });
        saveErr = error;
      }

      if (saveErr) {
        console.error('[LancarIndicador]', saveErr);
        return false;
      }

      const operacao = existing?.id ? 'UPDATE' : 'INSERT';
      const descricao = existing?.id
        ? `Valor alterado de "${existing.valor}" para "${valor}" — semana ${semana}`
        : `Valor lançado: "${valor}" — semana ${semana}`;
      log({ modulo: 'Planejamento', entidade: 'indicador_lancamentos', entidade_id: indId, operacao, descricao });

      recarregar();
      return true;
    } catch (e) {
      console.error('[LancarIndicador] exception', e);
      return false;
    }
  }, [supabase, effectiveProfileId, currentUserId, recarregar]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Blockers ────────────────────────────────────────────────────────────────
  const handleAdicionarBlocker = useCallback(async (metaId: string, descricao: string) => {
    if (!areaId) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error: e } = await supabase.from('blockers').insert({
      area_id: areaId, descricao, objetivo_id: metaId, criado_por: user?.id,
    });
    if (e) { console.error('[AdicionarBlocker]', e); return; }
    await loadBlockers();
  }, [supabase, areaId, loadBlockers]);

  const handleResolverBlocker = useCallback(async (blockerId: string) => {
    await supabase.from('blockers').update({ resolvido: true, resolvido_em: new Date().toISOString() }).eq('id', blockerId);
    setAllBlockers(prev => prev.filter(b => b.id !== blockerId));
  }, [supabase]);

  // ── Computed ─────────────────────────────────────────────────────────────────
  const uid = effectiveProfileId ?? currentUserId;

  // Metas que o usuário efetivo assumiu
  const metasMinhas = useMemo(() =>
    metas.filter(m => objetivoResponsaveis.some(r => r.objetivo_id === m.id && r.profile_id === uid)),
    [metas, objetivoResponsaveis, uid]);

  // Metas sem NENHUM responsável
  const metasSemResponsavel = useMemo(() =>
    metas.filter(m => !objetivoResponsaveis.some(r => r.objetivo_id === m.id)),
    [metas, objetivoResponsaveis]);

  const metasExibidas   = filtroMinhas ? metasMinhas : metas;
  const metasAtingiveis = useMemo(() => metasExibidas.filter(m => m.tipo?.toLowerCase() !== 'recorrente'), [metasExibidas]);
  const metasRecorrentes = useMemo(() => metasExibidas.filter(m => m.tipo?.toLowerCase() === 'recorrente'), [metasExibidas]);

  const metasExibidasCount = metasExibidas.length;
  const indExibidosIds = new Set(metasExibidas.map(m => m.id));
  const indicadoresExibidosCount = indicadores.filter(i => i.objetivo_id && indExibidosIds.has(i.objetivo_id)).length;

  const totalLabel = [
    metasExibidasCount       > 0 ? `${metasExibidasCount} metas`            : '',
    indicadoresExibidosCount > 0 ? `${indicadoresExibidosCount} indicadores` : '',
  ].filter(Boolean).join(' · ');

  const renderMetaCard = (meta: MetaItem) => {
    const meusResps   = objetivoResponsaveis.filter(r => r.objetivo_id === meta.id);
    const euAssumiRow = meusResps.find(r => r.profile_id === (currentUserId ?? uid));
    const assumiu     = !!euAssumiRow;
    const concluiuMeta   = euAssumiRow?.concluido ?? false;
    const concluiuCount  = meusResps.filter(r => r.concluido).length;
    const totalResponsaveis = meusResps.length;

    // Tenta usar as datas do próprio usuário; se não tiver (assumiu sem datas ou não assumiu),
    // cai para qualquer OR row da meta que tenha datas — para que is_projeto_relativo funcione.
    const orRowComDatas =
      (euAssumiRow?.data_inicio ? euAssumiRow : null) ??
      meusResps.find(r => !!r.data_inicio) ??
      objetivoResponsaveis.find(r => r.objetivo_id === meta.id && !!r.data_inicio);
    const projetoOrFinal = orRowComDatas
      ? { data_inicio: orRowComDatas.data_inicio, data_fim: orRowComDatas.data_fim, dias_uteis: orRowComDatas.dias_uteis }
      : null;

    return (
      <MetaCard
        key={meta.id}
        meta={meta}
        subMetas={localSubMetas.filter(s => s.objetivo_pai_id === meta.id)}
        indicadores={indicadores.filter(i => i.objetivo_id === meta.id)}
        responsaveis={responsaveis}
        podeConcluirGlobal={false}
        effectiveProfileId={effectiveProfileId}
        currentUserId={currentUserId}
        assumiu={assumiu}
        concluiuMeta={concluiuMeta}
        totalResponsaveis={totalResponsaveis}
        concluiuCount={concluiuCount}
        semanaAtual={semanaRelativa}
        semanaAnterior={semanaAnterior}
        anoRelativo={anoRelativo}
        blockers={allBlockers.filter(b => b.objetivo_id === meta.id)}
        onAdicionarBlocker={handleAdicionarBlocker}
        onResolverBlocker={handleResolverBlocker}
        onEditarSubMeta={handleEditarSubMeta}
        onExcluirSubMeta={handleExcluirSubMeta}
        onAddSubMeta={handleAddSubMeta}
        onConcluirMeta={handleConcluirMeta}
        onReabrirMeta={handleReabrirMeta}
        onLancarIndicador={handleLancarIndicador}
        onAssumirIndicador={handleAssumirIndicador}
        onToggleResponsavel={handleToggleResponsavel}
        onAssumirProjeto={handleAssumirProjeto}
        projetoOr={projetoOrFinal}
        onToast={showToast}
      />
    );
  };

  // suppress unused type warning
  void ([] as ObjetivoResponsavel[]);

  return (
    <>
    <section className="rounded-xl border border-gray-200 bg-gray-50 shadow-sm overflow-hidden">
      <button type="button"
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-100 transition-colors"
        onClick={() => setExpandido(v => !v)}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-700">Metas &amp; Indicadores</span>
          <button type="button" onClick={e => { e.stopPropagation(); setFiltroMinhas(v => !v); }}
            className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${filtroMinhas ? 'bg-blue-100 text-blue-700 border-blue-300' : 'text-gray-400 border-gray-200 hover:border-blue-300 hover:text-blue-500'}`}>
            {filtroMinhas ? '✓ minhas' : 'minhas'}
          </button>
          <select
            className="text-[10px] border border-gray-200 rounded px-1.5 py-0.5 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-300"
            value={mes}
            onClick={e => e.stopPropagation()}
            onChange={e => { e.stopPropagation(); setMes(e.target.value); }}>
            {mesOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {!isLoading && totalLabel && <span className="text-xs text-gray-400 bg-gray-200 rounded-full px-2 py-0.5">{totalLabel}</span>}
          {isLoading && <span className="text-xs text-gray-400">carregando...</span>}
          {/* Badge de metas sem responsável */}
          {!isLoading && metasSemResponsavel.length > 0 && (
            <span className="text-[10px] bg-orange-100 text-orange-700 border border-orange-200 rounded-full px-2 py-0.5 font-medium">
              ⚠ {metasSemResponsavel.length} sem responsável
            </span>
          )}
        </div>
        <span className="text-gray-400 text-xs">{expandido ? '▲' : '▼'}</span>
      </button>

      {expandido && (
        <div className="p-4 border-t border-gray-200">
          {error && <p className="text-xs text-red-500 mb-3">Erro: {error}</p>}

          {isLoading ? (
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map(i => <div key={i} className="h-16 bg-gray-200 animate-pulse rounded-lg" />)}
            </div>
          ) : (
            <>
              {/* ── 1. METAS SEM RESPONSÁVEL ── sempre no topo ── */}
              {metasSemResponsavel.length > 0 && (
                <div className="mb-4">
                  <button type="button"
                    className="w-full flex items-center justify-between mb-2"
                    onClick={() => setSemDonoAberta(v => !v)}>
                    <h3 className="text-xs font-semibold text-orange-700 uppercase tracking-wide">
                      ⚠ Metas sem responsável ({metasSemResponsavel.length}) — assuma no Boné Day ou aqui
                    </h3>
                    <span className="text-gray-400 text-[10px]">{semDonoAberta ? '▲' : '▼'}</span>
                  </button>
                  {semDonoAberta && (
                    <div className="flex flex-col gap-2">
                      {metasSemResponsavel.map(meta => (
                        <MetaCardSemDono key={meta.id} meta={meta}
                          indicadores={indicadores.filter(i => i.objetivo_id === meta.id)}
                          responsaveis={responsaveis}
                          onToggleResponsavel={handleToggleResponsavel}
                          onAssumirProjeto={handleAssumirProjeto}
                          onAssumirIndicador={handleAssumirIndicador}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── 2. METAS DO USUÁRIO ── */}
              {metas.length === 0 ? (
                <p className="text-xs text-gray-400">Nenhuma meta ativa para esta área.</p>
              ) : (
                <>
                  {metasAtingiveis.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">
                        Metas Atingíveis ({metasAtingiveis.length})
                      </h3>
                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                        {metasAtingiveis.map(renderMetaCard)}
                      </div>
                    </div>
                  )}
                  {metasRecorrentes.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">
                        Metas Recorrentes ({metasRecorrentes.length})
                      </h3>
                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                        {metasRecorrentes.map(renderMetaCard)}
                      </div>
                    </div>
                  )}
                </>
              )}

            </>
          )}
        </div>
      )}
    </section>
    {toastMsg && <Toast message={toastMsg} />}
    </>
  );
}
