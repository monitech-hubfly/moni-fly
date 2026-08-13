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

function FaixasLegenda({ faixas }: { faixas: FaixaItem[] }) {
  if (!faixas.length) return null;
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {faixas.map((f, i) => (
        <span key={i} className="text-[9px] font-bold px-1.5 py-0.5 rounded"
          style={{ backgroundColor: FAROL_HEX[f.cor] ?? '#9ca3af', color: FAROL_TEXT[f.cor] ?? '#ffffff' }}>
          {COMP[f.comparacao] ?? f.comparacao}{f.limite}
        </span>
      ))}
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
  onLancar, onAssumirIndicador,
}: {
  ind: IndicadorItemMeta;
  effectiveProfileId: string | null;
  currentUserId: string | null;
  responsaveis: ResponsavelItem[];
  semanaAtual: number;
  semanaAnterior: number;
  anoRelativo: number;
  onLancar: (indId: string, valor: string, semana: number) => Promise<void>;
  onAssumirIndicador: (indId: string) => Promise<void>;
}) {
  const [valorEditAtual,    setValorEditAtual]    = useState(ind.valorAtual    ?? '');
  const [valorEditAnterior, setValorEditAnterior] = useState(ind.valorAnterior ?? '');
  const [salvandoAtual,     setSalvandoAtual]     = useState(false);
  const [salvandoAnterior,  setSalvandoAnterior]  = useState(false);
  const [assumindo,         setAssumindo]         = useState(false);

  useEffect(() => { setValorEditAtual(ind.valorAtual ?? '');       }, [ind.valorAtual]);
  useEffect(() => { setValorEditAnterior(ind.valorAnterior ?? ''); }, [ind.valorAnterior]);

  const faixas = (ind.semaforo_faixas as { faixas?: FaixaItem[] } | null)?.faixas ?? [];
  const isEq   = faixas.length > 0 && faixas.every(f => f.comparacao === 'eq');

  const infoAtual    = anoRelativo > 0 ? isoWeekToDates(semanaAtual,    anoRelativo) : { label: `S${semanaAtual}`,    range: '' };
  const infoAnterior = anoRelativo > 0 ? isoWeekToDates(semanaAnterior, anoRelativo) : { label: `S${semanaAnterior}`, range: '' };

  // Quem é o responsável por este indicador
  const isMeu       = !!ind.profile_id && ind.profile_id === (effectiveProfileId ?? currentUserId);
  const semDono     = !ind.profile_id;
  const donoNome    = ind.profile_id ? (responsaveis.find(r => r.profile_id === ind.profile_id)?.nome ?? 'outro') : null;
  // Pode preencher: é o responsável do indicador
  const podeEditar  = isMeu;

  const hexAtual    = ind.corHex;
  const semaforoAnt = ind.valorAnterior != null
    ? (statusSemaforoPorValor(ind, ind.valorAnterior) as string | null)
    : null;
  const hexAnterior = semaforoAnt ? (FAROL_HEX[semaforoAnt] ?? '#e5e7eb') : '#e5e7eb';
  const VAZIO_HEX   = '#e5e7eb';

  const handleLancarAtual = async (val?: string) => {
    const v = (val !== undefined ? val : valorEditAtual).trim();
    if (!v) return;
    setSalvandoAtual(true);
    await onLancar(ind.id, v, semanaAtual);
    setSalvandoAtual(false);
  };
  const handleLancarAnterior = async (val?: string) => {
    const v = (val !== undefined ? val : valorEditAnterior).trim();
    if (!v) return;
    setSalvandoAnterior(true);
    await onLancar(ind.id, v, semanaAnterior);
    setSalvandoAnterior(false);
  };
  const handleAssumir = async () => {
    setAssumindo(true);
    await onAssumirIndicador(ind.id);
    setAssumindo(false);
  };

  const CelulaLancamento = ({
    isAtual, info, hex, valor, setValor, salvando, onLancarFn,
  }: {
    isAtual: boolean; info: { label: string; range: string };
    hex: string; valor: string; setValor: (v: string) => void;
    salvando: boolean; onLancarFn: (val?: string) => Promise<void>;
  }) => {
    const temValor = !!valor.trim();
    const bg       = temValor ? hex : VAZIO_HEX;
    const fg       = temValor ? corParaTexto(hex) : '#6b7280';
    const baseInput = 'w-full text-xs font-semibold rounded px-1.5 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-blue-300 transition-colors disabled:opacity-60';
    return (
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 mb-1">
          <span className="text-[9px] font-semibold text-gray-600">{info.label}</span>
          {isAtual && <span className="text-[8px] text-yellow-500 font-bold">★</span>}
          {info.range && <span className="text-[8px] text-gray-400">{info.range}</span>}
        </div>
        {isEq ? (
          <select disabled={!podeEditar || salvando} value={valor}
            onChange={e => { setValor(e.target.value); void onLancarFn(e.target.value); }}
            className={baseInput}
            style={{ backgroundColor: bg, color: fg, border: `1px solid ${temValor ? hex : '#d1d5db'}` }}>
            <option value="">—</option>
            {faixas.map(f => <option key={f.limite} value={f.limite}>{f.limite}</option>)}
          </select>
        ) : (
          <input disabled={!podeEditar || salvando}
            value={salvando ? '…' : valor} placeholder="—"
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
        {faixas.length > 0 && <FaixasLegenda faixas={faixas} />}
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
      {!semDono && (
        <div className="flex items-stretch gap-2">
          <CelulaLancamento
            isAtual={false} info={infoAnterior} hex={hexAnterior}
            valor={valorEditAnterior} setValor={setValorEditAnterior}
            salvando={salvandoAnterior} onLancarFn={handleLancarAnterior}
          />
          <div className="w-px bg-gray-200 self-stretch flex-shrink-0" />
          <CelulaLancamento
            isAtual info={infoAtual} hex={hexAtual}
            valor={valorEditAtual} setValor={setValorEditAtual}
            salvando={salvandoAtual} onLancarFn={handleLancarAtual}
          />
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
  onToggleResponsavel, onAssumirProjeto,
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
  onLancarIndicador: (indId: string, valor: string, semana: number) => Promise<void>;
  onAssumirIndicador: (indId: string) => Promise<void>;
  onToggleResponsavel: (metaId: string) => Promise<void>;
  onAssumirProjeto: (metaId: string, dataInicio: string, dataFim: string) => Promise<void>;
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

// ── MetaCardSemDono (card simplificado para metas sem responsável) ─────────────
function MetaCardSemDono({ meta, onToggleResponsavel, onAssumirProjeto }: {
  meta: MetaItem;
  onToggleResponsavel: (metaId: string) => Promise<void>;
  onAssumirProjeto: (metaId: string, dataInicio: string, dataFim: string) => Promise<void>;
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
    <div className="bg-white border border-orange-200 rounded-lg shadow-sm px-3 py-2.5 flex items-center gap-2">
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

function mesInicial(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(LS_MES_KEY);
    if (saved && /^\d{4}-\d{2}$/.test(saved)) return saved;
  }
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function MetasIndicadoresBloco() {
  const supabase = useMemo(() => createClient(), []);
  const { effectiveProfileId, areaId } = useEffectiveUser();

  const [mes, setMesState] = useState(mesInicial);
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
  const [disponiveisAberta, setDisponiveisAberta]  = useState(false);
  const [semDonoAberta,     setSemDonoAberta]      = useState(true);
  const [allBlockers,       setAllBlockers]        = useState<BlockerRow[]>([]);

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('indicadores') as any).update({ profile_id: null })
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
  const handleLancarIndicador = useCallback(async (indId: string, valor: string, semana: number) => {
    if (!semana) return;
    const profileId = effectiveProfileId ?? currentUserId;
    const table: any = supabase.from('indicador_lancamentos');
    const payload = { indicador_id: indId, semana, valor, profile_id: profileId };
    const { error: upsertErr } = await table.upsert(payload, { onConflict: 'indicador_id,semana,profile_id' });
    if (upsertErr) {
      await (supabase.from('indicador_lancamentos') as any).delete()
        .eq('indicador_id', indId).eq('semana', semana).eq('profile_id', profileId);
      const { error: insErr } = await (supabase.from('indicador_lancamentos') as any).insert(payload);
      if (insErr) { console.error('[LancarIndicador]', insErr); return; }
    }
    recarregar();
  }, [supabase, effectiveProfileId, currentUserId, recarregar]);

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

  // Metas que outros assumiram mas o usuário não (disponíveis para assumir)
  const metasDisponiveis = useMemo(() =>
    metas.filter(m =>
      objetivoResponsaveis.some(r => r.objetivo_id === m.id) &&
      !objetivoResponsaveis.some(r => r.objetivo_id === m.id && r.profile_id === uid)
    ),
    [metas, objetivoResponsaveis, uid]);

  const metasExibidas   = filtroMinhas ? metasMinhas : metas;
  const metasAtingiveis = useMemo(() => metasExibidas.filter(m => m.tipo?.toLowerCase() !== 'recorrente'), [metasExibidas]);
  const metasRecorrentes = useMemo(() => metasExibidas.filter(m => m.tipo?.toLowerCase() === 'recorrente'), [metasExibidas]);

  const totalLabel = [
    metas.length       > 0 ? `${metas.length} metas`            : '',
    indicadores.length > 0 ? `${indicadores.length} indicadores` : '',
  ].filter(Boolean).join(' · ');

  const renderMetaCard = (meta: MetaItem) => {
    const meusResps   = objetivoResponsaveis.filter(r => r.objetivo_id === meta.id);
    const euAssumiRow = meusResps.find(r => r.profile_id === (currentUserId ?? uid));
    const assumiu     = !!euAssumiRow;
    const concluiuMeta   = euAssumiRow?.concluido ?? false;
    const concluiuCount  = meusResps.filter(r => r.concluido).length;
    const totalResponsaveis = meusResps.length;

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
      />
    );
  };

  // suppress unused type warning
  void ([] as ObjetivoResponsavel[]);

  return (
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
                          onToggleResponsavel={handleToggleResponsavel}
                          onAssumirProjeto={handleAssumirProjeto}
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

              {/* ── 3. DISPONÍVEIS NA ÁREA (outros assumiram, eu não) ── */}
              {metasDisponiveis.length > 0 && (
                <SecaoToggle
                  label="Disponíveis na área"
                  count={metasDisponiveis.length}
                  aberta={disponiveisAberta}
                  onToggle={() => setDisponiveisAberta(v => !v)}
                >
                  <p className="text-[10px] text-gray-400 mb-2">
                    Metas que colegas já assumiram. Você pode assumir também se quiser participar.
                  </p>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {metasDisponiveis.map(renderMetaCard)}
                  </div>
                </SecaoToggle>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
