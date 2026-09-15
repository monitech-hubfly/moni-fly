'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useEffectiveUser } from '@/hooks/useEffectiveUser';
import { SeletorUsuarioAdmin } from '@/components/carometro/todo/SeletorUsuarioAdmin';
import { listarAreas } from '@/utils/areasOrder';
import {
  useFechamentoBoneDay,
  proximoMes, getMonthLabel, getMonthOptions,
} from '@/hooks/useFechamentoBoneDay';
import type { MetaBone, ComportamentoHoras, IndicadorMedio, BlockerTodo } from '@/hooks/useFechamentoBoneDay';

// ── CarinhaResumo — alinhado com MeuCarometroCard (4 faixas) ─────────────────
// Thresholds idênticos ao TO DO & Planning: ≥75 verde-escuro, ≥60 verde-claro,
// ≥30 amarelo, <30 vermelho.
function getCarinhaImg(score: number | null): string {
  if (score === null) return '/carometro/carometro-emoji-branco.png';
  if (score >= 75) return '/carometro/carometro-emoji-verde-escuro.png';
  if (score >= 60) return '/carometro/carometro-emoji-verde-claro.png';
  if (score >= 30) return '/carometro/carometro-emoji-amarelo.png';
  return '/carometro/carometro-emoji-vermelho.png';
}

function scoreColor(score: number | null): string {
  if (score === null) return 'text-gray-300';
  if (score >= 75) return 'text-green-700';
  if (score >= 60) return 'text-green-600';
  if (score >= 30) return 'text-yellow-600';
  return 'text-red-600';
}

function CarinhaResumo({ titulo, score }: { titulo: string; score: number | null }) {
  return (
    <div className="flex items-center gap-3">
      <img src={getCarinhaImg(score)} alt={titulo} className="w-10 h-10 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-sm text-gray-500 font-medium">{titulo}</p>
        <p className={`text-xl font-bold leading-tight ${scoreColor(score)}`}>
          {score !== null ? `${score}%` : '—'}
        </p>
      </div>
    </div>
  );
}

// ── BlockersList — editável (admin), usado na coluna do próximo mês ───────────
function BlockersList({
  items, isAdmin, onChange,
}: {
  items: string[]; isAdmin: boolean; onChange: (items: string[]) => void;
}) {
  const [adicionando, setAdicionando] = useState(false);
  const [novoItem,   setNovoItem]    = useState('');

  const adicionar = () => {
    const txt = novoItem.trim();
    if (!txt) return;
    onChange([...items, txt]);
    setNovoItem('');
    setAdicionando(false);
  };

  const remover = (idx: number) => onChange(items.filter((_, i) => i !== idx));

  if (!isAdmin && items.length === 0) {
    return <p className="text-xs text-gray-300 italic">Nenhum blocker registrado</p>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-1.5 group">
          <span className="text-red-400 flex-shrink-0 mt-0.5 text-xs">•</span>
          <span className="text-sm text-red-700 flex-1 leading-snug">{item}</span>
          {isAdmin && (
            <button type="button" onClick={() => remover(i)}
              className="text-red-400 hover:text-red-600 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-1">
              ✕
            </button>
          )}
        </div>
      ))}
      {isAdmin && (
        adicionando ? (
          <div className="flex gap-1.5 mt-0.5">
            <input
              autoFocus
              className="flex-1 text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300"
              placeholder="Descrever blocker..."
              value={novoItem}
              onChange={e => setNovoItem(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') adicionar();
                if (e.key === 'Escape') { setAdicionando(false); setNovoItem(''); }
              }}
            />
            <button type="button" onClick={adicionar}
              className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">OK</button>
            <button type="button" onClick={() => { setAdicionando(false); setNovoItem(''); }}
              className="text-xs text-gray-400 hover:text-gray-600">✕</button>
          </div>
        ) : (
          <button type="button" onClick={() => setAdicionando(true)}
            className="text-xs text-gray-400 hover:text-blue-600 transition-colors text-left mt-0.5">
            + Adicionar blocker
          </button>
        )
      )}
    </div>
  );
}

// ── BlockersTodoList — read-only, vem automaticamente do TO DO & Planning ─────
function BlockersTodoList({ blockers }: { blockers: BlockerTodo[] }) {
  if (blockers.length === 0) {
    return <p className="text-xs text-gray-300 italic">Nenhum blocker registrado no TO DO para este mês</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {blockers.map(b => (
        <div key={b.id} className="flex flex-col gap-0.5">
          {b.metaDescricao && (
            <p className="text-xs text-red-500 font-semibold truncate">{b.metaDescricao}</p>
          )}
          <div className="flex items-start gap-1.5">
            <span className="text-red-400 flex-shrink-0 mt-0.5 text-xs">•</span>
            <span className="text-sm text-red-700 leading-snug">{b.descricao}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── ComentarioEditor ───────────────────────────────────────────────────────────
function ComentarioEditor({
  valor, isAdmin, onSalvar, placeholder,
}: {
  valor: string; isAdmin: boolean;
  onSalvar: (v: string) => void;
  placeholder?: string;
}) {
  const [texto, setTexto] = useState(valor);
  useEffect(() => { setTexto(valor); }, [valor]);

  if (!isAdmin) {
    return texto
      ? <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{texto}</p>
      : <p className="text-xs text-gray-300 italic">—</p>;
  }

  return (
    <textarea
      className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-300 text-gray-700 placeholder-gray-300 bg-gray-50/60"
      rows={4}
      placeholder={placeholder}
      value={texto}
      onChange={e => setTexto(e.target.value)}
      onBlur={() => { if (texto !== valor) onSalvar(texto); }}
    />
  );
}

// ── SecaoMetas ─────────────────────────────────────────────────────────────────
function MetaItem({ m }: { m: MetaBone }) {
  const isRecorrente = m.tipo?.toLowerCase() === 'recorrente';
  const icone = m.status === 'concluido' ? '✓' : isRecorrente ? '–' : '✗';
  const iconeColor = m.status === 'concluido' ? 'text-green-500' : isRecorrente ? 'text-gray-400' : 'text-red-400';
  return (
    <li className="flex items-start gap-1.5 text-sm">
      <span className={`flex-shrink-0 font-bold mt-px ${iconeColor}`}>
        {icone}
      </span>
      <span className={`flex-1 min-w-0 ${m.status === 'concluido' ? 'text-gray-400' : 'text-gray-700'}`}>
        {m.is_chave && <span className="mr-0.5">🔑</span>}
        <span className={m.status === 'concluido' ? 'line-through' : ''}>{m.descricao}</span>
        {m.meta_unidade && (
          <span className="text-gray-400 ml-1" style={{ textDecoration: 'none' }}>
            · {m.meta_unidade}
          </span>
        )}
      </span>
    </li>
  );
}

function SecaoMetas({ metas, mensagemVazia }: { metas: MetaBone[]; mensagemVazia?: string }) {
  // 1. Concluídas (qualquer tipo) — topo
  const concluidas = metas.filter(m => m.status === 'concluido');
  // 2. Atingíveis não concluídas — meio, ordenadas por prazo
  const atingiveisAbertos = metas
    .filter(m => m.status !== 'concluido' && m.tipo?.toLowerCase() !== 'recorrente')
    .sort((a, b) => {
      if (!a.meta_unidade && !b.meta_unidade) return 0;
      if (!a.meta_unidade) return 1;
      if (!b.meta_unidade) return -1;
      return a.meta_unidade.localeCompare(b.meta_unidade);
    });
  // 3. Recorrentes não concluídas — sempre ao final
  const recorrentesAbertos = metas.filter(m => m.status !== 'concluido' && m.tipo?.toLowerCase() === 'recorrente');

  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Metas</p>
      {metas.length === 0 ? (
        <p className="text-xs text-gray-400 italic bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
          {mensagemVazia ?? 'Nenhuma meta definida para este mês.'}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {concluidas.length > 0 && (
            <div>
              <p className="text-[11px] text-green-400 uppercase tracking-wider mb-1.5 font-semibold">Concluídas</p>
              <ul className="flex flex-col gap-2">{concluidas.map(m => <MetaItem key={m.id} m={m} />)}</ul>
            </div>
          )}
          {atingiveisAbertos.length > 0 && (
            <div>
              <p className="text-[11px] text-gray-300 uppercase tracking-wider mb-1.5 font-semibold">Atingível</p>
              <ul className="flex flex-col gap-2">{atingiveisAbertos.map(m => <MetaItem key={m.id} m={m} />)}</ul>
            </div>
          )}
          {recorrentesAbertos.length > 0 && (
            <div>
              <p className="text-[11px] text-gray-300 uppercase tracking-wider mb-1.5 font-semibold">Recorrente</p>
              <ul className="flex flex-col gap-2">{recorrentesAbertos.map(m => <MetaItem key={m.id} m={m} />)}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── SecaoComportamentos ────────────────────────────────────────────────────────
function SecaoComportamentos({ comportamentos }: { comportamentos: ComportamentoHoras[] }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Comportamentos</p>
      {comportamentos.length === 0 ? (
        <p className="text-xs text-gray-300 italic">Não identificados</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {comportamentos.map(c => (
            <li key={c.tarefaId} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-gray-700 truncate flex-1">{c.nome}</span>
              <span className="text-gray-400 flex-shrink-0 tabular-nums font-medium">{c.horas}h</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── SecaoCarometro ─────────────────────────────────────────────────────────────
function SecaoCarometro({ indicadores, nota }: { indicadores: IndicadorMedio; nota: string | null }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Carômetro</p>
      <div className="flex gap-5 flex-wrap">
        <CarinhaResumo titulo="Sirene" score={indicadores.sirene} />
        <CarinhaResumo titulo="Engajamento" score={indicadores.engajamento} />
        <CarinhaResumo titulo="Indicadores" score={indicadores.indicadores} />
      </div>
      {nota && (
        <p className="text-[10px] text-gray-400 italic mt-2">* {nota}</p>
      )}
    </div>
  );
}

// ── Coluna ─────────────────────────────────────────────────────────────────────
const HEADER_COLOR = '#1C3A2B';

function Coluna({ titulo, badge, children }: { titulo: string; badge: string; children: ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
      <div className="px-4 py-3 flex items-center gap-2" style={{ backgroundColor: HEADER_COLOR }}>
        <h2 className="text-base font-bold text-white flex-1 truncate">{titulo}</h2>
        <span className="text-[10px] bg-white/20 text-white font-semibold px-2 py-0.5 rounded-full flex-shrink-0">
          {badge}
        </span>
      </div>
      <div className="px-4 py-5 flex flex-col gap-6 flex-1">{children}</div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────
export default function FechamentoBoneDayPage() {
  const supabase = useMemo(() => createClient(), []);
  const { effectiveProfileId } = useEffectiveUser();

  const [areas, setAreas] = useState<{ id: string; nome: string }[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

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

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsAdmin(false); return; }
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      setIsAdmin((prof as { role?: string } | null)?.role === 'admin');
    })();
  }, [supabase]);

  const areaId = selectedAreaId || null;
  const admin  = Boolean(isAdmin);

  const {
    metasMes, metasProximo, comportamentos, indicadores, indicadoresNota, blockersDoTodo, registro,
    mes, setMes, isLoading, error, salvarRegistro,
  } = useFechamentoBoneDay(areaId, effectiveProfileId);

  const monthOptions = useMemo(() => getMonthOptions(), []);
  const mesLabel   = getMonthLabel(mes);
  const proxLabel  = getMonthLabel(proximoMes(mes));

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Fechamento Boné Day</h1>
          <p className="text-xs text-gray-400 mt-0.5">Resumo executivo do ciclo</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {areas.length > 0 && (
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500">Área:</label>
              <select
                className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                value={selectedAreaId}
                onChange={e => {
                  setSelectedAreaId(e.target.value);
                  localStorage.setItem('carometro_ultima_area', e.target.value);
                }}>
                {areas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500">Mês:</label>
            <select
              className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
              value={mes} onChange={e => setMes(e.target.value)}>
              {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <SeletorUsuarioAdmin />
          <button
            type="button" disabled title="Em breve"
            className="text-xs px-3 py-1.5 bg-gray-100 text-gray-400 rounded-lg border border-gray-200 cursor-not-allowed select-none">
            Exportar PPT
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-500">Erro: {error}</p>}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1].map(i => <div key={i} className="h-96 bg-gray-200 animate-pulse rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">

          {/* ── Coluna esquerda: Fechamento ── */}
          <Coluna titulo={`Fechamento: ${mesLabel}`} badge="Mês atual">
            <SecaoMetas
              metas={metasMes}
              mensagemVazia="Nenhuma meta definida para este mês. Acesse Plano Boné Day para criar."
            />
            <SecaoCarometro indicadores={indicadores} nota={indicadoresNota} />
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Blocker&apos;s
              </p>
              {/* Blockers automáticos vindos do TO DO & Planning — somente leitura */}
              <BlockersTodoList blockers={blockersDoTodo} />
            </div>
          </Coluna>

          {/* ── Coluna direita: Próximo mês ── */}
          <Coluna titulo={`Plano: ${proxLabel}`} badge="Próximo mês">
            <SecaoMetas
              metas={metasProximo}
              mensagemVazia="Nenhuma meta planejada para o próximo mês. Acesse Plano Boné Day para criar."
            />
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Comentários
              </p>
              <ComentarioEditor
                valor={registro.comentariosProximo}
                isAdmin={admin}
                onSalvar={txt => salvarRegistro({ comentariosProximo: txt })}
                placeholder="Foco, alinhamentos e direcionamentos do próximo ciclo..."
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Blocker&apos;s
              </p>
              <BlockersList
                items={registro.blockersProximo}
                isAdmin={admin}
                onChange={items => salvarRegistro({ blockersProximo: items })}
              />
            </div>
          </Coluna>

        </div>
      )}
    </div>
  );
}
