'use client';

import type React from 'react';
import { MessageCircle, Pencil, User } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { rotaCardOrigem } from '@/lib/rota-card-origem';
import {
  atualizarInteracaoCompletaSirene,
  atualizarStatusInteracaoSirene,
  listarComentariosCardSirene,
  publicarComentarioCardSirene,
  type ComentarioCardSireneRow,
  type StatusInteracaoDb,
} from './actions';

export type InteracaoSireneRow = {
  id: string;
  card_id: string | null;
  card_titulo: string | null;
  fase_nome: string;
  kanban_nome: string;
  kanban_id: string | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  tipo: string;
  titulo: string;
  descricao: string | null;
  atividade_status: string;
  data_vencimento: string | null;
  time_nome: string | null;
  times_nomes: unknown;
  franqueado_nome: string | null;
  criado_em: string;
  sla_status: string | null;
  trava: boolean;
  origem: string;
  responsaveis_ids: string[];
  times_ids: string[];
};

type TimeOpt = { id: string; nome: string };
type RespOpt = { id: string; nome: string };

type EditLinhaDraft = {
  titulo: string;
  tipo: 'atividade' | 'duvida';
  data: string;
  timesIds: string[];
  responsaveisIds: string[];
  trava: boolean;
};

type Props = {
  interacoes: InteracaoSireneRow[];
  times: TimeOpt[];
  responsaveis: RespOpt[];
  currentUserId: string | null;
  comentariosCountByCardId: Record<string, number>;
};

type FiltrosChamados = {
  statusF: string;
  tipoF: string;
  kanbanF: string;
  timeF: string;
  respF: string;
  travaF: string;
  busca: string;
};

const DEFAULT_FILTROS: FiltrosChamados = {
  statusF: 'todos',
  tipoF: 'todos',
  kanbanF: 'todos',
  timeF: 'todos',
  respF: 'todos',
  travaF: 'todos',
  busca: '',
};

function countFiltrosAtivos(f: FiltrosChamados): number {
  let n = 0;
  if (f.statusF !== 'todos') n++;
  if (f.tipoF !== 'todos') n++;
  if (f.kanbanF !== 'todos') n++;
  if (f.timeF !== 'todos') n++;
  if (f.respF !== 'todos') n++;
  if (f.travaF !== 'todos') n++;
  if (f.busca.trim() !== '') n++;
  return n;
}

function parseTimesNomes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x));
}

function norm(s: string): string {
  return String(s ?? '')
    .trim()
    .toLowerCase();
}

function temResponsavel(row: InteracaoSireneRow): boolean {
  if (row.responsavel_id) return true;
  return (row.responsaveis_ids?.length ?? 0) > 0;
}

function subGrupoFluxo(row: InteracaoSireneRow): 'a_fazer' | 'em_andamento' | 'aguardando' | 'concluido' {
  const s = norm(row.atividade_status);
  if (s === 'concluida' || s === 'concluída' || s === 'cancelada') return 'concluido';
  if (s === 'em_andamento') return 'em_andamento';
  if (s === 'pendente' || !s) return temResponsavel(row) ? 'aguardando' : 'a_fazer';
  return 'a_fazer';
}

function grupoLista(row: InteracaoSireneRow): 'trava' | 'a_fazer' | 'em_andamento' | 'aguardando' | 'concluido' {
  if (row.trava) return 'trava';
  return subGrupoFluxo(row);
}

function statusDbParaSelect(s: string): StatusInteracaoDb {
  const x = norm(s);
  if (x === 'concluida' || x === 'concluída') return 'concluida';
  if (x === 'em_andamento') return 'em_andamento';
  return 'pendente';
}

function badgeTipo(tipo: string): { label: string; className: string } {
  const t = norm(tipo);
  if (t === 'duvida' || t === 'dúvida')
    return {
      label: 'Dúvida',
      className: 'border-[color:var(--moni-gold-600)] bg-[rgba(212,173,104,0.12)] text-[color:var(--moni-gold-200)]',
    };
  if (t === 'chamado_hdm') return { label: 'Chamado HDM', className: 'bg-red-900/50 text-red-100 border-red-700/40' };
  if (t === 'chamado_padrao') return { label: 'Chamado', className: 'bg-red-900/40 text-red-100 border-red-700/40' };
  return { label: 'Atividade', className: 'bg-sky-900/40 text-sky-100 border-sky-700/40' };
}

function SelectEscuro(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`rounded-lg border border-stone-600 bg-stone-700 px-2 py-1.5 text-sm text-stone-100 outline-none focus:border-stone-500 ${props.className ?? ''}`}
    />
  );
}

const ORDEM_GRUPOS: Array<{ key: 'trava' | 'a_fazer' | 'em_andamento' | 'aguardando' | 'concluido'; titulo: string }> = [
  { key: 'trava', titulo: 'Com trava' },
  { key: 'a_fazer', titulo: 'A fazer' },
  { key: 'em_andamento', titulo: 'Em andamento' },
  { key: 'aguardando', titulo: 'Aguardando' },
  { key: 'concluido', titulo: 'Concluído' },
];

const BOMBEIRO_SENTINEL = '__bombeiro__';

function rowMatchTime(row: InteracaoSireneRow, timeFiltro: string, timesById: Map<string, string>): boolean {
  if (timeFiltro === 'todos') return true;
  if (timeFiltro === BOMBEIRO_SENTINEL) {
    const tn = (row.time_nome ?? '').toLowerCase();
    const nomes = [tn, ...parseTimesNomes(row.times_nomes).map((x) => x.toLowerCase())];
    return nomes.some((n) => n.includes('bombeiro'));
  }
  const nomeTime = timesById.get(timeFiltro);
  if (!nomeTime) return false;
  const n = nomeTime.toLowerCase();
  if ((row.time_nome ?? '').toLowerCase() === n) return true;
  return parseTimesNomes(row.times_nomes).some((x) => x.toLowerCase() === n);
}

function filtroTipoMatch(row: InteracaoSireneRow, tipoF: string): boolean {
  if (tipoF === 'todos') return true;
  if (tipoF === 'chamado') return norm(row.tipo).includes('chamado');
  return norm(row.tipo) === norm(tipoF);
}

type SecaoRadioProps = {
  titulo: string;
  children: React.ReactNode;
};

function SecaoFiltro({ titulo, children }: SecaoRadioProps) {
  return (
    <fieldset className="space-y-2 border-b border-stone-600 pb-3 last:border-b-0">
      <legend className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-stone-400">{titulo}</legend>
      {children}
    </fieldset>
  );
}

function tipoEdicaoFromRow(tipo: string): 'atividade' | 'duvida' {
  const t = norm(tipo);
  if (t === 'duvida' || t === 'dúvida') return 'duvida';
  return 'atividade';
}

function nomesTimesDeIds(ids: string[], catalog: TimeOpt[]): unknown {
  const m = new Map(catalog.map((t) => [t.id, t.nome]));
  return ids.map((id) => m.get(id) ?? '').filter(Boolean);
}

export function InteracoesLista({
  interacoes,
  times,
  responsaveis,
  currentUserId,
  comentariosCountByCardId,
}: Props) {
  const [verTodas, setVerTodas] = useState(false);
  const [applied, setApplied] = useState<FiltrosChamados>(DEFAULT_FILTROS);
  const [draft, setDraft] = useState<FiltrosChamados>(DEFAULT_FILTROS);
  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const filtrosBtnRef = useRef<HTMLButtonElement>(null);

  /** Status local após salvar (evita re-fetch; reset quando `interacoes` muda). */
  const [statusPatch, setStatusPatch] = useState<Record<string, string>>({});
  /** Campos da linha após edição inline (merge sobre `interacoes`). */
  const [rowPatch, setRowPatch] = useState<Record<string, Partial<InteracaoSireneRow>>>({});
  const [msgErro, setMsgErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditLinhaDraft | null>(null);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [commentsOpenByRow, setCommentsOpenByRow] = useState<Record<string, boolean>>({});
  const [commentsFetchedByCard, setCommentsFetchedByCard] = useState<Record<string, boolean>>({});
  const [commentsByCardId, setCommentsByCardId] = useState<Record<string, ComentarioCardSireneRow[]>>({});
  const [commentsLoading, setCommentsLoading] = useState<Record<string, boolean>>({});
  const [novoComentarioPorCard, setNovoComentarioPorCard] = useState<Record<string, string>>({});
  const [salvandoComentario, setSalvandoComentario] = useState<Record<string, boolean>>({});
  const [countPatch, setCountPatch] = useState<Record<string, number>>({});

  useEffect(() => {
    setStatusPatch({});
    setRowPatch({});
    setEditingId(null);
    setEditDraft(null);
    setCommentsOpenByRow({});
    setCommentsFetchedByCard({});
    setCommentsByCardId({});
    setNovoComentarioPorCard({});
    setCountPatch({});
  }, [interacoes]);

  useEffect(() => {
    if (!filtrosOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDraft({ ...applied });
        setFiltrosOpen(false);
      }
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popoverRef.current?.contains(t)) return;
      if (filtrosBtnRef.current?.contains(t)) return;
      setDraft({ ...applied });
      setFiltrosOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [filtrosOpen, applied]);

  const linhas = useMemo(
    () =>
      interacoes.map((r) => {
        const p = rowPatch[r.id];
        return {
          ...r,
          atividade_status: statusPatch[r.id] ?? r.atividade_status,
          ...(p ?? {}),
        };
      }),
    [interacoes, statusPatch, rowPatch],
  );

  const timesById = useMemo(() => new Map(times.map((t) => [t.id, t.nome])), [times]);

  const kanbans = useMemo(() => {
    const s = new Set<string>();
    for (const r of interacoes) {
      const k = r.kanban_nome?.trim();
      if (k) s.add(k);
    }
    return [...s].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [interacoes]);

  const nomePorUserId = useMemo(() => new Map(responsaveis.map((r) => [r.id, r.nome])), [responsaveis]);

  const filtradas = useMemo(() => {
    const q = norm(applied.busca);
    return linhas.filter((row) => {
      if (!verTodas && currentUserId) {
        const ids = row.responsaveis_ids ?? [];
        const mine = ids.includes(currentUserId) || row.responsavel_id === currentUserId;
        if (!mine) return false;
      } else if (!verTodas && !currentUserId) {
        return false;
      }

      if (applied.statusF !== 'todos') {
        const sg = subGrupoFluxo(row);
        if (applied.statusF === 'a_fazer' && sg !== 'a_fazer') return false;
        if (applied.statusF === 'aguardando' && sg !== 'aguardando') return false;
        if (applied.statusF === 'em_andamento' && sg !== 'em_andamento') return false;
        if (applied.statusF === 'concluida' && sg !== 'concluido') return false;
      }

      if (!filtroTipoMatch(row, applied.tipoF)) return false;

      if (applied.kanbanF !== 'todos' && row.kanban_nome !== applied.kanbanF) return false;

      if (!rowMatchTime(row, applied.timeF, timesById)) return false;

      if (applied.travaF === 'com' && !row.trava) return false;
      if (applied.travaF === 'sem' && row.trava) return false;

      if (applied.respF === 'eu' && currentUserId) {
        const ids = row.responsaveis_ids ?? [];
        if (!ids.includes(currentUserId) && row.responsavel_id !== currentUserId) return false;
      } else if (applied.respF !== 'todos' && applied.respF !== 'eu') {
        const ids = row.responsaveis_ids ?? [];
        if (!ids.includes(applied.respF) && row.responsavel_id !== applied.respF) return false;
      }

      if (q) {
        const blob = `${row.titulo} ${row.card_titulo ?? ''} ${row.descricao ?? ''} ${row.franqueado_nome ?? ''}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }

      return true;
    });
  }, [linhas, verTodas, currentUserId, applied, timesById]);

  const porGrupo = useMemo(() => {
    const m = new Map<string, InteracaoSireneRow[]>();
    for (const g of ORDEM_GRUPOS) m.set(g.key, []);
    for (const row of filtradas) {
      const k = grupoLista(row);
      m.get(k)!.push(row);
    }
    return m;
  }, [filtradas]);

  function onStatusChange(id: string, novo: StatusInteracaoDb) {
    setMsgErro(null);
    startTransition(async () => {
      const res = await atualizarStatusInteracaoSirene(id, novo);
      if (!res.ok) {
        setMsgErro(res.error);
        return;
      }
      setStatusPatch((prev) => ({ ...prev, [id]: novo }));
    });
  }

  function abrirEdicao(row: InteracaoSireneRow) {
    const rids = [...(row.responsaveis_ids ?? [])];
    if (row.responsavel_id && !rids.includes(row.responsavel_id)) rids.unshift(row.responsavel_id);
    setEditingId(row.id);
    setEditDraft({
      titulo: row.titulo,
      tipo: tipoEdicaoFromRow(row.tipo),
      data: row.data_vencimento ?? '',
      timesIds: [...(row.times_ids ?? [])],
      responsaveisIds: rids,
      trava: row.trava,
    });
  }

  function cancelarEdicao() {
    setEditingId(null);
    setEditDraft(null);
  }

  async function salvarEdicao(atividadeId: string) {
    if (!editDraft) return;
    if (!editDraft.titulo.trim()) {
      setMsgErro('Informe o título.');
      return;
    }
    setMsgErro(null);
    setSalvandoEdicao(true);
    try {
      const res = await atualizarInteracaoCompletaSirene(atividadeId, {
        titulo: editDraft.titulo.trim(),
        tipo: editDraft.tipo,
        data_vencimento: editDraft.data.trim() || null,
        times_ids: editDraft.timesIds,
        responsaveis_ids: editDraft.responsaveisIds,
        trava: editDraft.trava,
      });
      if (!res.ok) {
        setMsgErro(res.error);
        return;
      }
      const tnomes = nomesTimesDeIds(editDraft.timesIds, times);
      const firstTimeNome = Array.isArray(tnomes) && tnomes.length > 0 ? String(tnomes[0]) : null;
      setRowPatch((prev) => ({
        ...prev,
        [atividadeId]: {
          titulo: editDraft.titulo.trim(),
          tipo: editDraft.tipo,
          data_vencimento: editDraft.data.trim() || null,
          trava: editDraft.trava,
          times_ids: [...editDraft.timesIds],
          responsaveis_ids: [...editDraft.responsaveisIds],
          times_nomes: tnomes,
          time_nome: firstTimeNome,
        },
      }));
      setEditingId(null);
      setEditDraft(null);
    } finally {
      setSalvandoEdicao(false);
    }
  }

  function toggleComentarios(row: InteracaoSireneRow) {
    const cid = row.card_id;
    if (!cid) return;
    const willOpen = !commentsOpenByRow[row.id];
    setCommentsOpenByRow((p) => ({ ...p, [row.id]: willOpen }));
    if (willOpen && !commentsFetchedByCard[cid]) {
      setCommentsFetchedByCard((f) => ({ ...f, [cid]: true }));
      setCommentsLoading((l) => ({ ...l, [cid]: true }));
      void listarComentariosCardSirene(cid).then((res) => {
        setCommentsLoading((l) => ({ ...l, [cid]: false }));
        if (res.ok) setCommentsByCardId((c) => ({ ...c, [cid]: res.items }));
        else setMsgErro(res.error);
      });
    }
  }

  async function publicarComentario(cardId: string) {
    const texto = (novoComentarioPorCard[cardId] ?? '').trim();
    if (!texto) return;
    setSalvandoComentario((s) => ({ ...s, [cardId]: true }));
    setMsgErro(null);
    try {
      const res = await publicarComentarioCardSirene(cardId, texto, null);
      if (!res.ok) {
        setMsgErro(res.error);
        return;
      }
      setNovoComentarioPorCard((m) => ({ ...m, [cardId]: '' }));
      setCountPatch((c) => ({ ...c, [cardId]: (c[cardId] ?? comentariosCountByCardId[cardId] ?? 0) + 1 }));
      const list = await listarComentariosCardSirene(cardId);
      if (list.ok) setCommentsByCardId((c) => ({ ...c, [cardId]: list.items }));
    } finally {
      setSalvandoComentario((s) => ({ ...s, [cardId]: false }));
    }
  }

  function comentariosCount(cardId: string | null): number {
    if (!cardId) return 0;
    if (countPatch[cardId] != null) return countPatch[cardId]!;
    return comentariosCountByCardId[cardId] ?? 0;
  }

  function iniciaisNome(nome: string): string {
    const p = nome.trim().split(/\s+/).filter(Boolean);
    if (p.length === 0) return '?';
    if (p.length === 1) return p[0]!.slice(0, 2).toUpperCase();
    return (p[0]![0] + p[p.length - 1]![0]).toUpperCase();
  }

  function abrirPainelFiltros() {
    setDraft({ ...applied });
    setFiltrosOpen(true);
  }

  function aplicarFiltros() {
    setApplied({ ...draft });
    setFiltrosOpen(false);
  }

  function limparDraftFiltros() {
    setDraft(DEFAULT_FILTROS);
  }

  const ativos = countFiltrosAtivos(applied);

  const radioRow = 'flex flex-wrap gap-x-4 gap-y-2 text-sm text-stone-200';
  const radioLabel = 'inline-flex cursor-pointer items-center gap-2';

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 text-stone-100">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative">
          <button
            ref={filtrosBtnRef}
            type="button"
            onClick={() => (filtrosOpen ? (setDraft({ ...applied }), setFiltrosOpen(false)) : abrirPainelFiltros())}
            className="rounded-lg border border-stone-600 bg-stone-800 px-4 py-2 text-sm font-medium text-stone-200 hover:bg-stone-700"
          >
            Filtros ({ativos})
          </button>
          {filtrosOpen ? (
            <div
              ref={popoverRef}
              className="absolute left-0 top-full z-50 mt-2 w-[min(100vw-2rem,28rem)] rounded-lg border border-stone-600 bg-stone-800 p-4 shadow-xl"
            >
              <div className="max-h-[min(70vh,32rem)] space-y-4 overflow-y-auto pr-1">
                <label className="block text-xs text-stone-400">
                  <span className="mb-1 block font-semibold uppercase tracking-wide">Buscar</span>
                  <input
                    type="search"
                    value={draft.busca}
                    onChange={(e) => setDraft((d) => ({ ...d, busca: e.target.value }))}
                    placeholder="Buscar…"
                    className="mt-1 w-full rounded-lg border border-stone-600 bg-stone-900 px-3 py-2 text-sm text-stone-100 placeholder:text-stone-500 focus:border-stone-500 focus:outline-none"
                  />
                </label>

                <SecaoFiltro titulo="Status">
                  <div className={radioRow}>
                    {[
                      ['todos', 'Todos'],
                      ['a_fazer', 'A fazer'],
                      ['em_andamento', 'Em andamento'],
                      ['aguardando', 'Aguardando'],
                      ['concluida', 'Concluído'],
                    ].map(([v, lab]) => (
                      <label key={v} className={radioLabel}>
                        <input
                          type="radio"
                          name="filtro-status"
                          checked={draft.statusF === v}
                          onChange={() => setDraft((d) => ({ ...d, statusF: v }))}
                          className="border-stone-500 text-red-500 focus:ring-red-400"
                        />
                        {lab}
                      </label>
                    ))}
                  </div>
                </SecaoFiltro>

                <SecaoFiltro titulo="Tipo">
                  <div className={radioRow}>
                    {[
                      ['todos', 'Todos'],
                      ['atividade', 'Atividade'],
                      ['duvida', 'Dúvida'],
                      ['chamado', 'Chamado'],
                    ].map(([v, lab]) => (
                      <label key={v} className={radioLabel}>
                        <input
                          type="radio"
                          name="filtro-tipo"
                          checked={draft.tipoF === v}
                          onChange={() => setDraft((d) => ({ ...d, tipoF: v }))}
                          className="border-stone-500 text-red-500 focus:ring-red-400"
                        />
                        {lab}
                      </label>
                    ))}
                  </div>
                </SecaoFiltro>

                <SecaoFiltro titulo="Kanban">
                  <div className="flex max-h-40 flex-col gap-2 overflow-y-auto text-sm text-stone-200">
                    <label className={radioLabel}>
                      <input
                        type="radio"
                        name="filtro-kanban"
                        checked={draft.kanbanF === 'todos'}
                        onChange={() => setDraft((d) => ({ ...d, kanbanF: 'todos' }))}
                        className="border-stone-500 text-red-500"
                      />
                      Todos
                    </label>
                    {kanbans.map((k) => (
                      <label key={k} className={radioLabel}>
                        <input
                          type="radio"
                          name="filtro-kanban"
                          checked={draft.kanbanF === k}
                          onChange={() => setDraft((d) => ({ ...d, kanbanF: k }))}
                          className="border-stone-500 text-red-500"
                        />
                        {k}
                      </label>
                    ))}
                  </div>
                </SecaoFiltro>

                <SecaoFiltro titulo="Time">
                  <div className="flex max-h-36 flex-col gap-2 overflow-y-auto text-sm text-stone-200">
                    <label className={radioLabel}>
                      <input
                        type="radio"
                        name="filtro-time"
                        checked={draft.timeF === 'todos'}
                        onChange={() => setDraft((d) => ({ ...d, timeF: 'todos' }))}
                        className="border-stone-500 text-red-500"
                      />
                      Todos
                    </label>
                    {times.map((t) => (
                      <label key={t.id} className={radioLabel}>
                        <input
                          type="radio"
                          name="filtro-time"
                          checked={draft.timeF === t.id}
                          onChange={() => setDraft((d) => ({ ...d, timeF: t.id }))}
                          className="border-stone-500 text-red-500"
                        />
                        {t.nome}
                      </label>
                    ))}
                    <label className={radioLabel}>
                      <input
                        type="radio"
                        name="filtro-time"
                        checked={draft.timeF === BOMBEIRO_SENTINEL}
                        onChange={() => setDraft((d) => ({ ...d, timeF: BOMBEIRO_SENTINEL }))}
                        className="border-stone-500 text-red-500"
                      />
                      Bombeiro
                    </label>
                  </div>
                </SecaoFiltro>

                <SecaoFiltro titulo="Responsável">
                  <div className="flex max-h-36 flex-col gap-2 overflow-y-auto text-sm text-stone-200">
                    <label className={radioLabel}>
                      <input
                        type="radio"
                        name="filtro-resp"
                        checked={draft.respF === 'todos'}
                        onChange={() => setDraft((d) => ({ ...d, respF: 'todos' }))}
                        className="border-stone-500 text-red-500"
                      />
                      Todos
                    </label>
                    {currentUserId ? (
                      <label className={radioLabel}>
                        <input
                          type="radio"
                          name="filtro-resp"
                          checked={draft.respF === 'eu'}
                          onChange={() => setDraft((d) => ({ ...d, respF: 'eu' }))}
                          className="border-stone-500 text-red-500"
                        />
                        Eu
                      </label>
                    ) : null}
                    {responsaveis.map((r) => (
                      <label key={r.id} className={radioLabel}>
                        <input
                          type="radio"
                          name="filtro-resp"
                          checked={draft.respF === r.id}
                          onChange={() => setDraft((d) => ({ ...d, respF: r.id }))}
                          className="border-stone-500 text-red-500"
                        />
                        {r.nome}
                      </label>
                    ))}
                  </div>
                </SecaoFiltro>

                <SecaoFiltro titulo="Trava">
                  <div className={radioRow}>
                    {[
                      ['todos', 'Todos'],
                      ['com', 'Com trava'],
                      ['sem', 'Sem trava'],
                    ].map(([v, lab]) => (
                      <label key={v} className={radioLabel}>
                        <input
                          type="radio"
                          name="filtro-trava"
                          checked={draft.travaF === v}
                          onChange={() => setDraft((d) => ({ ...d, travaF: v }))}
                          className="border-stone-500 text-red-500"
                        />
                        {lab}
                      </label>
                    ))}
                  </div>
                </SecaoFiltro>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-stone-600 pt-3">
                <button
                  type="button"
                  onClick={limparDraftFiltros}
                  className="rounded-lg border border-stone-600 px-3 py-1.5 text-sm text-stone-300 hover:bg-stone-700"
                >
                  Limpar filtros
                </button>
                <button
                  type="button"
                  onClick={aplicarFiltros}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500"
                >
                  Aplicar
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex rounded-lg border border-stone-600 bg-stone-800 p-0.5 text-sm">
          <button
            type="button"
            onClick={() => setVerTodas(false)}
            className={`rounded-md px-3 py-1.5 font-medium transition ${
              !verTodas ? 'bg-stone-600 text-white' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            Ver minhas
          </button>
          <button
            type="button"
            onClick={() => setVerTodas(true)}
            className={`rounded-md px-3 py-1.5 font-medium transition ${
              verTodas ? 'bg-stone-600 text-white' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            Ver todas
          </button>
        </div>
      </div>

      {msgErro && (
        <div className="mb-4 rounded-lg border border-red-800/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {msgErro}
        </div>
      )}

      {pending && <p className="mb-2 text-xs text-stone-500">Salvando status…</p>}
      {salvandoEdicao && <p className="mb-2 text-xs text-stone-500">Salvando chamado…</p>}

      <div className="space-y-8">
        {ORDEM_GRUPOS.map(({ key, titulo }) => {
          const lista = porGrupo.get(key) ?? [];
          if (lista.length === 0) return null;
          return (
            <section key={key}>
              <h3 className="mb-3 border-b border-stone-700 bg-stone-800 px-3 py-2 text-sm font-semibold text-stone-100">
                {titulo}
                <span className="ml-2 font-normal text-stone-500">({lista.length})</span>
              </h3>
              <ul className="rounded-lg border border-stone-800 bg-stone-900/80">
                {lista.map((row) => {
                  const tipoB = badgeTipo(row.tipo);
                  const hrefCard = rotaCardOrigem(row.kanban_nome, row.card_id);
                  const sel = statusDbParaSelect(row.atividade_status);
                  const idsResp = [...new Set([...(row.responsaveis_ids ?? []), ...(row.responsavel_id ? [row.responsavel_id] : [])])];

                  const ccid = row.card_id;
                  const cnt = ccid ? comentariosCount(ccid) : 0;

                  return (
                    <li key={row.id} className="flex flex-col gap-0 border-b border-stone-800 px-3 py-3 last:border-b-0">
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:gap-x-3 sm:gap-y-2">
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {row.trava && (
                              <span className="rounded border border-red-700/60 bg-red-950/50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-200">
                                Trava
                              </span>
                            )}
                            <span className="font-medium text-white">{row.titulo}</span>
                            {ccid ? (
                              <button
                                type="button"
                                onClick={() => toggleComentarios(row)}
                                className="inline-flex items-center gap-1 rounded border border-stone-600 bg-stone-800 px-1.5 py-0.5 text-stone-300 hover:border-stone-500 hover:text-white"
                                aria-expanded={Boolean(commentsOpenByRow[row.id])}
                                aria-label={`Comentários do card (${cnt})`}
                              >
                                <MessageCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                <span className="min-w-[1.1rem] text-center text-[10px] font-semibold tabular-nums">{cnt}</span>
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => abrirEdicao(row)}
                              className="rounded p-0.5 text-stone-400 hover:bg-stone-800 hover:text-white"
                              aria-label="Editar chamado"
                              title="Editar"
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden />
                            </button>
                            <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase ${tipoB.className}`}>
                              {tipoB.label}
                            </span>
                          </div>
                          {(row.franqueado_nome ?? '').trim() ? (
                            <div className="flex items-center gap-1 text-xs text-stone-400">
                              <User className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              <span>{(row.franqueado_nome ?? '').trim()}</span>
                            </div>
                          ) : null}
                          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-400">
                            <Link
                              href={hrefCard}
                              className="rounded border border-stone-600 bg-stone-800/80 px-2 py-0.5 text-stone-200 underline-offset-2 hover:text-white hover:underline"
                            >
                              Card: {row.card_titulo?.trim() || '—'}
                            </Link>
                            <span className="rounded bg-stone-600/80 px-1.5 py-0.5 text-[10px] text-stone-200">{row.kanban_nome}</span>
                            {parseTimesNomes(row.times_nomes).map((tn) => (
                              <span key={tn} className="rounded bg-stone-700 px-1.5 py-0.5 text-[10px] text-stone-300">
                                {tn}
                              </span>
                            ))}
                            {row.time_nome && parseTimesNomes(row.times_nomes).length === 0 && (
                              <span className="rounded bg-stone-700 px-1.5 py-0.5 text-[10px] text-stone-300">{row.time_nome}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                          <div className="flex -space-x-1">
                            {idsResp.slice(0, 6).map((uid) => (
                              <span
                                key={uid}
                                title={nomePorUserId.get(uid) ?? uid}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-stone-600 bg-stone-700 text-[10px] font-semibold text-stone-100"
                              >
                                {iniciaisNome(nomePorUserId.get(uid) ?? '?')}
                              </span>
                            ))}
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
                            {row.data_vencimento ? (
                              <span className="text-stone-400">
                                Prazo {row.data_vencimento.split('-').reverse().join('/')}
                              </span>
                            ) : null}
                            <SelectEscuro
                              value={sel}
                              disabled={pending}
                              onChange={(e) => onStatusChange(row.id, e.target.value as StatusInteracaoDb)}
                              className="min-w-[9.5rem]"
                              aria-label="Status do chamado"
                            >
                              <option value="pendente">A fazer</option>
                              <option value="em_andamento">Em andamento</option>
                              <option value="concluida">Concluída</option>
                            </SelectEscuro>
                          </div>
                        </div>
                      </div>

                      {editingId === row.id && editDraft ? (
                        <div className="mt-3 space-y-3 border-t border-stone-800 pt-3">
                          <label className="block text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                            Título
                            <input
                              type="text"
                              value={editDraft.titulo}
                              onChange={(e) => setEditDraft((d) => (d ? { ...d, titulo: e.target.value } : d))}
                              className="mt-1 w-full rounded-lg border border-stone-600 bg-stone-900 px-2 py-1.5 text-sm text-stone-100"
                            />
                          </label>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                              Tipo
                              <SelectEscuro
                                value={editDraft.tipo}
                                onChange={(e) =>
                                  setEditDraft((d) =>
                                    d ? { ...d, tipo: e.target.value as 'atividade' | 'duvida' } : d,
                                  )
                                }
                                className="mt-1 w-full"
                              >
                                <option value="atividade">Atividade</option>
                                <option value="duvida">Dúvida</option>
                              </SelectEscuro>
                            </label>
                            <label className="block text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                              Prazo
                              <input
                                type="date"
                                value={editDraft.data}
                                onChange={(e) => setEditDraft((d) => (d ? { ...d, data: e.target.value } : d))}
                                className="mt-1 w-full rounded-lg border border-stone-600 bg-stone-900 px-2 py-1.5 text-sm text-stone-100"
                              />
                            </label>
                          </div>
                          <div>
                            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                              Times
                            </span>
                            <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto">
                              {times.map((t) => {
                                const on = editDraft.timesIds.includes(t.id);
                                return (
                                  <button
                                    key={t.id}
                                    type="button"
                                    onClick={() =>
                                      setEditDraft((d) => {
                                        if (!d) return d;
                                        const has = d.timesIds.includes(t.id);
                                        return {
                                          ...d,
                                          timesIds: has ? d.timesIds.filter((x) => x !== t.id) : [...d.timesIds, t.id],
                                        };
                                      })
                                    }
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                      on ? 'bg-red-700 text-white' : 'bg-stone-800 text-stone-300'
                                    }`}
                                  >
                                    {t.nome}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <div>
                            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                              Responsáveis
                            </span>
                            <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto">
                              {responsaveis.map((p) => {
                                const on = editDraft.responsaveisIds.includes(p.id);
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() =>
                                      setEditDraft((d) => {
                                        if (!d) return d;
                                        const has = d.responsaveisIds.includes(p.id);
                                        return {
                                          ...d,
                                          responsaveisIds: has
                                            ? d.responsaveisIds.filter((x) => x !== p.id)
                                            : [...d.responsaveisIds, p.id],
                                        };
                                      })
                                    }
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                      on ? 'bg-red-700 text-white' : 'bg-stone-800 text-stone-300'
                                    }`}
                                  >
                                    {p.nome}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-300">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-stone-500"
                              checked={editDraft.trava}
                              onChange={(e) => setEditDraft((d) => (d ? { ...d, trava: e.target.checked } : d))}
                            />
                            Trava — bloqueia o card até concluir
                          </label>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={salvandoEdicao}
                              onClick={() => void salvarEdicao(row.id)}
                              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
                            >
                              {salvandoEdicao ? 'Salvando…' : 'Salvar'}
                            </button>
                            <button
                              type="button"
                              disabled={salvandoEdicao}
                              onClick={cancelarEdicao}
                              className="rounded-lg border border-stone-600 px-3 py-1.5 text-sm text-stone-200 hover:bg-stone-800"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {commentsOpenByRow[row.id] && ccid ? (
                        <div className="mt-3 border-t border-stone-800 pt-3">
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                            Comentários do card
                          </p>
                          {commentsLoading[ccid] ? (
                            <p className="text-xs text-stone-500">Carregando…</p>
                          ) : (
                            <ul className="mb-3 max-h-48 space-y-2 overflow-y-auto text-sm">
                              {[...(commentsByCardId[ccid] ?? [])]
                                .sort(
                                  (a, b) =>
                                    new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
                                )
                                .map((c) => (
                                  <li
                                    key={c.id}
                                    className="flex gap-2 rounded border border-stone-700 bg-stone-950/50 px-2 py-2 text-stone-200"
                                  >
                                    <span
                                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-stone-600 bg-stone-800 text-[10px] font-semibold text-stone-200"
                                      aria-hidden
                                    >
                                      {iniciaisNome(c.autor_nome ?? '')}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs leading-snug">
                                        <span className="font-medium text-stone-100">
                                          {(c.autor_nome ?? '—').trim() || '—'}
                                        </span>
                                        {c.created_at ? (
                                          <>
                                            {' '}
                                            <span className="tabular-nums text-stone-500">
                                              {new Date(c.created_at).toLocaleString('pt-BR')}
                                            </span>
                                          </>
                                        ) : null}
                                      </p>
                                      <p className="mt-1 whitespace-pre-wrap text-sm text-stone-100">{c.texto}</p>
                                    </div>
                                  </li>
                                ))}
                            </ul>
                          )}
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <input
                              type="text"
                              value={novoComentarioPorCard[ccid] ?? ''}
                              onChange={(e) =>
                                setNovoComentarioPorCard((m) => ({ ...m, [ccid]: e.target.value }))
                              }
                              placeholder="Escreva um comentário…"
                              className="min-w-0 flex-1 rounded-lg border border-stone-600 bg-stone-900 px-2 py-1.5 text-sm text-stone-100 placeholder:text-stone-500"
                            />
                            <button
                              type="button"
                              disabled={Boolean(salvandoComentario[ccid])}
                              onClick={() => void publicarComentario(ccid)}
                              className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
                            >
                              {salvandoComentario[ccid] ? '…' : 'Publicar'}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {filtradas.length === 0 && (
        <p className="mt-8 text-center text-sm text-stone-500">Nenhum chamado com os filtros atuais.</p>
      )}
    </main>
  );
}
