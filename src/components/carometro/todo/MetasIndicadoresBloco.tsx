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
  atingivel:  'bg-blue-100 text-blue-700',
  recorrente: 'bg-green-100 text-green-700',
};

function TipoBadge({ tipo }: { tipo: string | null }) {
  if (!tipo) return null;
  const cls = TIPO_BADGE[tipo.toLowerCase()] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap ${cls}`}>
      {tipo.charAt(0).toUpperCase() + tipo.slice(1).toLowerCase()}
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
  // Jan 4 sempre está na semana 1 do ISO
  const jan4 = new Date(year, 0, 4);
  const dow = (jan4.getDay() + 6) % 7; // 0=Seg, 6=Dom
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
  if (hex === '#f2c94c') return '#1f2937'; // amarelo → escuro
  return '#ffffff';
}

function FaixasLegenda({ faixas }: { faixas: FaixaItem[] }) {
  if (!faixas.length) return null;
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {faixas.map((f, i) => (
        <span
          key={i}
          className="text-[9px] font-bold px-1.5 py-0.5 rounded"
          style={{
            backgroundColor: FAROL_HEX[f.cor] ?? '#9ca3af',
            color: FAROL_TEXT[f.cor] ?? '#ffffff',
          }}
        >
          {COMP[f.comparacao] ?? f.comparacao}{f.limite}
        </span>
      ))}
    </div>
  );
}

// ── Seção colapsável ──────────────────────────────────────────────────────────
function SecaoToggle({ label, count, aberta, onToggle, children }: {
  label: string; count: number; aberta: boolean; onToggle: () => void; children: ReactNode;
}) {
  return (
    <div className="border-t border-gray-100 pt-1.5">
      <button type="button"
        className="w-full flex items-center justify-between text-xs text-gray-500 hover:text-gray-700 py-0.5 transition-colors"
        onClick={onToggle}>
        <span>{label} ({count})</span>
        <span className="text-gray-400 text-[10px]">{aberta ? '▲' : '▼'}</span>
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
function IndicadorLinha({ ind, podeEditar, isAdmin, semanaAtual, semanaAnterior, anoRelativo, onLancar, onEditarIndicador, onExcluirIndicador }: {
  ind: IndicadorItemMeta;
  podeEditar: boolean;
  isAdmin: boolean;
  semanaAtual: number;
  semanaAnterior: number;
  anoRelativo: number;
  onLancar: (indId: string, valor: string, semana: number) => Promise<void>;
  onEditarIndicador: (id: string, nome: string) => Promise<void>;
  onExcluirIndicador: (id: string) => Promise<void>;
}) {
  const [valorEditAtual,    setValorEditAtual]    = useState(ind.valorAtual    ?? '');
  const [valorEditAnterior, setValorEditAnterior] = useState(ind.valorAnterior ?? '');
  const [salvandoAtual,     setSalvandoAtual]     = useState(false);
  const [salvandoAnterior,  setSalvandoAnterior]  = useState(false);
  const [editandoNome,      setEditandoNome]      = useState(false);
  const [nomeEdit,          setNomeEdit]          = useState(ind.nome);
  const [salvandoNome,      setSalvandoNome]      = useState(false);
  const [confirmExcl,       setConfirmExcl]       = useState(false);
  const [salvandoExcl,      setSalvandoExcl]      = useState(false);

  // Sync quando hook recarrega
  useEffect(() => { setValorEditAtual(ind.valorAtual ?? '');       }, [ind.valorAtual]);
  useEffect(() => { setValorEditAnterior(ind.valorAnterior ?? ''); }, [ind.valorAnterior]);

  const faixas = (ind.semaforo_faixas as { faixas?: FaixaItem[] } | null)?.faixas ?? [];
  const isEq   = faixas.length > 0 && faixas.every(f => f.comparacao === 'eq');

  const infoAtual    = anoRelativo > 0 ? isoWeekToDates(semanaAtual,    anoRelativo) : { label: `S${semanaAtual}`,    range: '' };
  const infoAnterior = anoRelativo > 0 ? isoWeekToDates(semanaAnterior, anoRelativo) : { label: `S${semanaAnterior}`, range: '' };

  // Cores das células
  const hexAtual    = ind.corHex; // já calculado no hook
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
  const handleSalvarNome = async () => {
    if (!nomeEdit.trim() || nomeEdit === ind.nome) { setEditandoNome(false); return; }
    setSalvandoNome(true);
    await onEditarIndicador(ind.id, nomeEdit.trim());
    setSalvandoNome(false);
    setEditandoNome(false);
  };
  const handleExcluir = async () => {
    setSalvandoExcl(true);
    await onExcluirIndicador(ind.id);
    setSalvandoExcl(false);
  };

  if (editandoNome) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-gray-50 border border-blue-200">
        <input className="flex-1 text-xs border border-blue-300 rounded px-1.5 py-0.5 focus:outline-none"
          value={nomeEdit} onChange={e => setNomeEdit(e.target.value)}
          onBlur={handleSalvarNome}
          onKeyDown={e => { if (e.key === 'Enter') handleSalvarNome(); if (e.key === 'Escape') { setNomeEdit(ind.nome); setEditandoNome(false); } }}
          autoFocus />
        {salvandoNome && <span className="text-xs text-gray-400">…</span>}
      </div>
    );
  }
  if (confirmExcl) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-red-50 border border-red-100 text-xs text-red-600">
        <span className="flex-1">Excluir &ldquo;{ind.nome}&rdquo;?</span>
        <button type="button" onClick={handleExcluir} disabled={salvandoExcl}
          className="font-medium hover:underline disabled:opacity-50">{salvandoExcl ? '…' : 'Confirmar'}</button>
        <button type="button" onClick={() => setConfirmExcl(false)} className="text-gray-400 hover:text-gray-600">Cancelar</button>
      </div>
    );
  }

  // Célula de lançamento (semana anterior ou atual)
  const CelulaLancamento = ({
    isAtual, info, hex, valor, setValor, salvando, onLancarFn,
  }: {
    isAtual: boolean;
    info: { label: string; range: string };
    hex: string;
    valor: string;
    setValor: (v: string) => void;
    salvando: boolean;
    onLancarFn: (val?: string) => Promise<void>;
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
          <select
            disabled={!podeEditar || salvando}
            value={valor}
            onChange={e => { setValor(e.target.value); void onLancarFn(e.target.value); }}
            className={baseInput}
            style={{ backgroundColor: bg, color: fg, border: `1px solid ${temValor ? hex : '#d1d5db'}` }}
          >
            <option value="">—</option>
            {faixas.map(f => <option key={f.limite} value={f.limite}>{f.limite}</option>)}
          </select>
        ) : (
          <input
            disabled={!podeEditar || salvando}
            value={salvando ? '…' : valor}
            placeholder="—"
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
    <div className="flex flex-col gap-1.5 px-2 py-2 rounded bg-gray-50 border border-gray-100 group">
      {/* Linha 1: nome + faixas coloridas + ações admin */}
      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
        {ind.indicador_chave && <span className="text-[11px] leading-none flex-shrink-0">🔑</span>}
        <span className="text-xs text-gray-700 leading-snug flex-1 min-w-0">{ind.nome}</span>
        {faixas.length > 0 && <FaixasLegenda faixas={faixas} />}
        {isAdmin && (
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button type="button" onClick={() => setEditandoNome(true)} title="Editar indicador"
              className="text-gray-300 hover:text-gray-500 text-[11px]">✏️</button>
            <button type="button" onClick={() => setConfirmExcl(true)} title="Excluir indicador"
              className="text-red-400 hover:text-red-600 font-bold text-[11px]">✕</button>
          </div>
        )}
      </div>

      {/* Linha 2: células das duas semanas */}
      <div className="flex items-stretch gap-2">
        <CelulaLancamento
          isAtual={false} info={infoAnterior} hex={hexAnterior}
          valor={valorEditAnterior} setValor={setValorEditAnterior}
          salvando={salvandoAnterior} onLancarFn={handleLancarAnterior}
        />
        <div className="w-px bg-gray-200 self-stretch flex-shrink-0" />
        <CelulaLancamento
          isAtual hex={hexAtual}
          info={infoAtual}
          valor={valorEditAtual} setValor={setValorEditAtual}
          salvando={salvandoAtual} onLancarFn={handleLancarAtual}
        />
      </div>
    </div>
  );
}

// ── Tipos de blocker ──────────────────────────────────────────────────────────
type BlockerRow = { id: string; descricao: string; objetivo_id: string | null; criado_em: string | null; resolvido: boolean };

// ── MetaCard ──────────────────────────────────────────────────────────────────
function MetaCard({
  meta, subMetas, indicadores, responsaveis, isAdmin, podeConcluir, effectiveProfileId,
  semanaAtual, semanaAnterior, anoRelativo,
  blockers, onAdicionarBlocker, onResolverBlocker,
  onEditarSubMeta, onExcluirSubMeta, onAddSubMeta,
  onEditarMeta, onExcluirMeta, onConcluirMeta,
  onLancarIndicador, onEditarIndicador, onExcluirIndicador,
}: {
  meta: MetaItem; subMetas: SubMetaItem[]; indicadores: IndicadorItemMeta[];
  responsaveis: ResponsavelItem[]; isAdmin: boolean; podeConcluir: boolean;
  effectiveProfileId: string | null;
  semanaAtual: number; semanaAnterior: number; anoRelativo: number;
  blockers: BlockerRow[];
  onAdicionarBlocker: (metaId: string, descricao: string) => Promise<void>;
  onResolverBlocker: (blockerId: string) => Promise<void>;
  onEditarSubMeta: (id: string, desc: string) => void;
  onExcluirSubMeta: (id: string) => void;
  onAddSubMeta: (metaPaiId: string, desc: string, tipo: string, respId: string | null) => Promise<void>;
  onEditarMeta: (id: string, dados: MetaFormState) => Promise<void>;
  onExcluirMeta: (id: string) => Promise<void>;
  onConcluirMeta: (id: string) => Promise<void>;
  onLancarIndicador: (indId: string, valor: string, semana: number) => Promise<void>;
  onEditarIndicador: (id: string, nome: string) => Promise<void>;
  onExcluirIndicador: (id: string) => Promise<void>;
}) {
  const [secaoFilhas,        setSecaoFilhas]        = useState(false);
  const [adicionandoFilha,   setAdicionandoFilha]   = useState(false);
  const [adicionandoBlocker, setAdicionandoBlocker] = useState(false);
  const [descricaoBlocker,   setDescricaoBlocker]   = useState('');
  const [salvandoBlocker,    setSalvandoBlocker]    = useState(false);
  const [editandoMeta,       setEditandoMeta]       = useState(false);
  const [excluindoMeta,      setExcluindoMeta]      = useState(false);
  const [concluindoMeta,     setConcluindoMeta]     = useState(false);
  const [salvandoMeta,       setSalvandoMeta]       = useState(false);
  const [salvandoFilha,      setSalvandoFilha]      = useState(false);
  const [modalComs,          setModalComs]          = useState(false);
  const [countLocal,         setCountLocal]         = useState(meta.comentariosCount);

  useEffect(() => { setCountLocal(meta.comentariosCount); }, [meta.comentariosCount]);

  const metaConcluida    = meta.status === 'concluido';
  const isRecorrente     = meta.tipo?.toLowerCase() === 'recorrente';
  const hoje             = new Date().toISOString().slice(0, 10);
  const isAtrasada       = !isRecorrente && !!meta.meta_unidade && meta.meta_unidade < hoje && !metaConcluida;
  // 🔑 se a própria meta é chave OU se tem algum indicador chave vinculado
  const hasChave         = meta.is_chave || indicadores.some(i => i.indicador_chave);
  // Overlay vermelho: atrasada 1+ dia sem nenhum comentário de justificativa
  const precisaJustificar = isAtrasada && countLocal === 0;
  const diffDias          = isAtrasada && meta.meta_unidade
    ? Math.max(1, Math.floor((new Date(hoje + 'T00:00:00').getTime() - new Date(meta.meta_unidade + 'T00:00:00').getTime()) / 86400000))
    : 0;

  const handleSalvarFilha = async (f: MetaFormState) => {
    setSalvandoFilha(true);
    try { await onAddSubMeta(meta.id, f.descricao, f.tipo, f.respId || null); setAdicionandoFilha(false); }
    finally { setSalvandoFilha(false); }
  };
  const handleSalvarMeta = async (f: MetaFormState) => {
    setSalvandoMeta(true);
    try { await onEditarMeta(meta.id, f); setEditandoMeta(false); }
    finally { setSalvandoMeta(false); }
  };
  const handleExcluirMeta = async () => {
    setSalvandoMeta(true);
    try { await onExcluirMeta(meta.id); }
    finally { setSalvandoMeta(false); }
  };
  const handleConcluirMeta = async () => {
    setSalvandoMeta(true);
    try { await onConcluirMeta(meta.id); }
    finally { setSalvandoMeta(false); }
  };
  const handleSalvarBlocker = async () => {
    if (!descricaoBlocker.trim()) return;
    setSalvandoBlocker(true);
    try { await onAdicionarBlocker(meta.id, descricaoBlocker.trim()); setDescricaoBlocker(''); setAdicionandoBlocker(false); }
    finally { setSalvandoBlocker(false); }
  };

  if (editandoMeta) {
    return (
      <div className="bg-white border border-blue-200 rounded-lg p-3 shadow-sm">
        <p className="text-xs font-medium text-gray-600 mb-1">Editar meta</p>
        <MetaForm
          inicial={{ descricao: meta.descricao, tipo: meta.tipo ?? 'atingivel', respId: meta.profile_id ?? '', metaUnidade: meta.meta_unidade ?? '' }}
          responsaveis={responsaveis} onSalvar={handleSalvarMeta}
          onCancelar={() => setEditandoMeta(false)} salvando={salvandoMeta} labelSalvar="Salvar" />
      </div>
    );
  }

  return (
    <div className={`bg-white border rounded-lg shadow-sm overflow-hidden ${
      precisaJustificar ? 'border-red-400 ring-1 ring-red-200 shadow-red-100' :
      isAtrasada ? 'border-amber-300' : 'border-gray-200'
    }`}>
      {/* Cabeçalho: sempre visível */}
      <div className={`p-3 flex flex-col gap-1.5 ${precisaJustificar ? 'bg-gradient-to-br from-red-50 to-white' : ''}`}>
      {/* Linha 1: [🔑] [⚠️] Descrição · Prazo · aberta DD/MM | badges | ações */}
      <div className="flex items-start gap-1.5 min-w-0">
        <span className={`text-sm font-medium text-gray-800 leading-snug flex-1 min-w-0 ${metaConcluida ? 'line-through text-gray-400' : ''}`}>
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
        <div className="flex items-center gap-1 ml-1 flex-shrink-0">
          <TipoBadge tipo={meta.tipo} />
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
          {podeConcluir && !metaConcluida && (
            <button type="button" onClick={() => setConcluindoMeta(true)} title="Concluir"
              className="text-[14px] text-green-500 hover:text-green-700 font-bold transition-colors px-0.5">✓</button>
          )}
          {isAdmin && (
            <>
              <button type="button" onClick={() => setEditandoMeta(true)} title="Editar"
                className="text-[12px] text-gray-300 hover:text-gray-500 transition-colors px-0.5">✏️</button>
              <button type="button" onClick={() => setExcluindoMeta(true)} title="Excluir"
                className="text-[12px] text-red-500 hover:text-red-700 font-bold transition-colors px-0.5">✕</button>
            </>
          )}
        </div>
      </div>

      {/* Linha 2: Responsável */}
      {meta.responsavel_nome && (
        <div className="text-xs text-gray-500">
          {meta.responsavel_nome}
          {meta.meta_valor && <span> · Meta: {meta.meta_valor}</span>}
        </div>
      )}

      {/* Confirmação exclusão */}
      {excluindoMeta && (
        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded px-2 py-1.5">
          <span className="flex-1">Excluir esta meta?</span>
          <button type="button" onClick={handleExcluirMeta} disabled={salvandoMeta}
            className="font-medium hover:underline disabled:opacity-50">{salvandoMeta ? '…' : 'Confirmar'}</button>
          <button type="button" onClick={() => setExcluindoMeta(false)} className="text-gray-400 hover:text-gray-600">Cancelar</button>
        </div>
      )}

      {/* Confirmação conclusão */}
      {concluindoMeta && (
        <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded px-2 py-1.5">
          <span className="flex-1">Concluir esta meta?</span>
          <button type="button" onClick={handleConcluirMeta} disabled={salvandoMeta}
            className="font-medium hover:underline disabled:opacity-50">{salvandoMeta ? '…' : 'Confirmar'}</button>
          <button type="button" onClick={() => setConcluindoMeta(false)} className="text-gray-400 hover:text-gray-600">Cancelar</button>
        </div>
      )}
      </div>{/* fim cabeçalho */}

      {/* Corpo: overlay de justificativa OU conteúdo normal */}
      {precisaJustificar ? (
        <div className="px-3 pb-4 pt-1">
          <div className="rounded-xl border border-red-200 bg-red-50/70 p-4 flex flex-col items-center gap-2 text-center">
            <div className="w-10 h-10 rounded-full bg-red-100 border border-red-200 flex items-center justify-center text-lg">🔒</div>
            <p className="text-sm font-semibold text-red-700">
              Atrasada há {diffDias} dia{diffDias !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-red-500 leading-snug max-w-[220px]">
              Justifique o motivo do atraso para desbloquear as ações desta meta.
            </p>
            <button
              type="button"
              onClick={() => setModalComs(true)}
              className="mt-1 inline-flex items-center gap-1.5 px-5 py-2 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 active:bg-red-800 transition-colors shadow-sm"
            >
              💬 Justificar agora
            </button>
          </div>
        </div>
      ) : (
        <div className="px-3 pb-3 flex flex-col gap-1.5">
          {/* Indicadores — sempre visíveis */}
          {indicadores.length > 0 && (
            <div className="border-t border-gray-100 pt-1.5 flex flex-col gap-1">
              {indicadores.map(ind => (
                <IndicadorLinha key={ind.id} ind={ind}
                  podeEditar={podeConcluir || ind.profile_id === effectiveProfileId}
                  isAdmin={isAdmin}
                  semanaAtual={semanaAtual}
                  semanaAnterior={semanaAnterior}
                  anoRelativo={anoRelativo}
                  onLancar={onLancarIndicador}
                  onEditarIndicador={onEditarIndicador}
                  onExcluirIndicador={onExcluirIndicador}
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

          {/* Blockers inline */}
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
              <textarea
                rows={2}
                placeholder="Descreva o blocker *"
                value={descricaoBlocker}
                onChange={e => setDescricaoBlocker(e.target.value)}
                className="w-full text-xs border border-red-200 rounded px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-red-300"
                autoFocus
              />
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

          {/* Formulário add filha ou botões de ação */}
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
        <ComentariosModal metaId={meta.id} onFechar={() => setModalComs(false)} onNovoComentario={() => setCountLocal(c => c + 1)} />
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

  const [expandido,      setExpandido]      = useState(false);
  const [localSubMetas,  setLocalSubMetas]  = useState<SubMetaItem[]>([]);
  const [isAdminUser,    setIsAdminUser]    = useState(false);
  const [isTeamUser,     setIsTeamUser]     = useState(false);
  const [filtroMinhas,   setFiltroMinhas]   = useState(false);
  const [currentUserId,  setCurrentUserId]  = useState<string | null>(null);
  const [allBlockers,    setAllBlockers]    = useState<BlockerRow[]>([]);

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      const role = (prof as { role?: string } | null)?.role ?? '';
      setIsAdminUser(role === 'admin');
      setIsTeamUser(role === 'team');
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

  const handleEditarMeta = useCallback(async (id: string, f: MetaFormState) => {
    const { error: e } = await supabase.from('objetivos')
      .update({ descricao: f.descricao, tipo: f.tipo, profile_id: f.respId || null, meta_unidade: f.metaUnidade || null })
      .eq('id', id);
    if (e) { console.error('[EditarMeta]', e); return; }
    log({ modulo: 'Planejamento', entidade: 'objetivos', entidade_id: id, operacao: 'UPDATE', descricao: `Meta editada: ${f.descricao}` });
    recarregar();
  }, [supabase, recarregar]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExcluirMeta = useCallback(async (id: string) => {
    const { error: e } = await supabase.from('objetivos').delete().eq('id', id);
    if (e) { console.error('[ExcluirMeta]', e); return; }
    log({ modulo: 'Planejamento', entidade: 'objetivos', entidade_id: id, operacao: 'DELETE' });
    recarregar();
  }, [supabase, recarregar]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConcluirMeta = useCallback(async (id: string) => {
    const { error: e } = await supabase.from('objetivos')
      .update({ status: 'concluido', concluido_em: new Date().toISOString() }).eq('id', id);
    if (e) { console.error('[ConcluirMeta]', e); return; }
    log({ modulo: 'Planejamento', entidade: 'objetivos', entidade_id: id, operacao: 'UPDATE', descricao: 'Meta concluída' });
    recarregar();
  }, [supabase, recarregar]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLancarIndicador = useCallback(async (indId: string, valor: string, semana: number) => {
    if (!semana) return;
    const payload = { indicador_id: indId, semana, valor };
    const { error: upsertErr } = await supabase.from('indicador_lancamentos')
      .upsert(payload, { onConflict: 'indicador_id,semana' });
    if (upsertErr) {
      await supabase.from('indicador_lancamentos').delete().eq('indicador_id', indId).eq('semana', semana);
      const { error: insErr } = await supabase.from('indicador_lancamentos').insert(payload);
      if (insErr) { console.error('[LancarIndicador]', insErr); return; }
    }
    recarregar();
  }, [supabase, recarregar]);

  const handleEditarIndicador = useCallback(async (id: string, nome: string) => {
    const { error: e } = await supabase.from('indicadores').update({ nome }).eq('id', id);
    if (e) { console.error('[EditarIndicador]', e); return; }
    recarregar();
  }, [supabase, recarregar]);

  const handleExcluirIndicador = useCallback(async (id: string) => {
    const { error: e } = await supabase.from('indicadores').delete().eq('id', id);
    if (e) { console.error('[ExcluirIndicador]', e); return; }
    recarregar();
  }, [supabase, recarregar]);

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

  const [adicionandoMeta,   setAdicionandoMeta]   = useState(false);
  const [salvandoNovaMeta,  setSalvandoNovaMeta]  = useState(false);

  const handleAddMeta = useCallback(async (f: MetaFormState) => {
    if (!areaId) return;
    setSalvandoNovaMeta(true);
    try {
      const { data: ins, error: e } = await supabase.from('objetivos')
        .insert({ area_id: areaId, descricao: f.descricao, tipo: f.tipo, profile_id: f.respId || null, meta_unidade: f.metaUnidade || null, status: 'ativo' })
        .select('id').single();
      if (e) { console.error('[AddMeta]', e); return; }
      log({ modulo: 'Planejamento', entidade: 'objetivos', entidade_id: String((ins as { id: unknown }).id), operacao: 'INSERT', descricao: `Nova meta: ${f.descricao}` });
      setAdicionandoMeta(false);
      recarregar();
    } finally { setSalvandoNovaMeta(false); }
  }, [supabase, areaId, recarregar]); // eslint-disable-line react-hooks/exhaustive-deps

  const metasFiltradas = useMemo(() => {
    if (!filtroMinhas || !currentUserId) return metas;
    return metas.filter(m =>
      objetivoResponsaveis.some(r => r.objetivo_id === m.id && r.profile_id === currentUserId)
    );
  }, [metas, filtroMinhas, currentUserId, objetivoResponsaveis]);

  const metasAtingiveis  = useMemo(() => metasFiltradas.filter(m => m.tipo?.toLowerCase() !== 'recorrente'), [metasFiltradas]);
  const metasRecorrentes = useMemo(() => metasFiltradas.filter(m => m.tipo?.toLowerCase() === 'recorrente'),  [metasFiltradas]);
  const podeConcluir     = isAdminUser || isTeamUser;

  const totalLabel = [
    metas.length       > 0 ? `${metas.length} metas`            : '',
    indicadores.length > 0 ? `${indicadores.length} indicadores` : '',
  ].filter(Boolean).join(' · ');

  const renderMetaCard = (meta: MetaItem) => (
    <MetaCard
      key={meta.id}
      meta={meta}
      subMetas={localSubMetas.filter(s => s.objetivo_pai_id === meta.id)}
      indicadores={indicadores.filter(i => i.objetivo_id === meta.id)}
      responsaveis={responsaveis}
      isAdmin={isAdminUser}
      podeConcluir={podeConcluir}
      effectiveProfileId={effectiveProfileId}
      semanaAtual={semanaRelativa}
      semanaAnterior={semanaAnterior}
      anoRelativo={anoRelativo}
      blockers={allBlockers.filter(b => b.objetivo_id === meta.id)}
      onAdicionarBlocker={handleAdicionarBlocker}
      onResolverBlocker={handleResolverBlocker}
      onEditarSubMeta={handleEditarSubMeta}
      onExcluirSubMeta={handleExcluirSubMeta}
      onAddSubMeta={handleAddSubMeta}
      onEditarMeta={handleEditarMeta}
      onExcluirMeta={handleExcluirMeta}
      onConcluirMeta={handleConcluirMeta}
      onLancarIndicador={handleLancarIndicador}
      onEditarIndicador={handleEditarIndicador}
      onExcluirIndicador={handleExcluirIndicador}
    />
  );

  // suppress unused warning — ObjetivoResponsavel is used in metasFiltradas
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

              {/* Legenda global de cores do semáforo */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4 pt-3 border-t border-gray-100 text-[10px] text-gray-500">
                <span className="font-medium text-gray-400 uppercase tracking-wide mr-1">Legenda:</span>
                {([
                  { cor: 've', label: 'Verde escuro' },
                  { cor: 'vc', label: 'Verde claro' },
                  { cor: 'am', label: 'Amarelo' },
                  { cor: 'vm', label: 'Vermelho' },
                ] as const).map(({ cor, label }) => (
                  <span key={cor} className="flex items-center gap-1">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: FAROL_HEX[cor] }}
                    />
                    {label}
                  </span>
                ))}
              </div>

              {isAdminUser && (
                <div className="mt-4">
                  {adicionandoMeta ? (
                    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                      <p className="text-xs font-medium text-gray-600 mb-1">Nova meta</p>
                      <MetaForm
                        inicial={{ descricao: '', tipo: 'atingivel', respId: '', metaUnidade: '' }}
                        responsaveis={responsaveis} onSalvar={handleAddMeta}
                        onCancelar={() => setAdicionandoMeta(false)} salvando={salvandoNovaMeta} labelSalvar="Criar meta" />
                    </div>
                  ) : (
                    <button type="button" onClick={() => setAdicionandoMeta(true)}
                      className="w-full text-xs text-gray-400 hover:text-blue-600 border border-dashed border-gray-300 hover:border-blue-300 rounded-lg py-2 transition-colors">
                      + Nova meta
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
