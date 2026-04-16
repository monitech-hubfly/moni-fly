'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { getAtividadesChecklistPainel, updateKanbanAtividadePainelStatus } from '../card-actions';
import {
  aplicarFiltrosTarefasPainel,
  defaultPainelTarefasFiltros,
  mergeTimesDisponiveis,
  painelTarefasFiltrosTemAlgumAtivo,
  PAINEL_TAREFAS_SEARCH_CLASS,
  PAINEL_TAREFAS_SELECT_CLASS,
  rotuloSlaInteracaoPainel,
  type PainelTarefasFiltrosState,
} from '@/lib/painel-tarefas-filtros';
import { rotaCardOrigem } from '@/lib/rota-card-origem';

type InteracaoPainel = {
  id: string;
  card_id: string;
  kanban_nome: string;
  kanban_id: string;
  tipo: string;
  sla_status: string | null;
  responsavel_id: string | null;
  etapa_painel: string;
  titulo: string;
  descricao: string | null;
  prazo_iso: string | null;
  card_titulo: string | null;
  times_nomes?: string[];
  responsaveis_nomes?: string[];
  time_nome: string | null;
  responsavel_nome: string | null;
  prazo: string | null;
  status: string;
  processo_cidade: string;
  processo_estado: string | null;
  numero_franquia?: string | null;
  nome_franqueado?: string | null;
  nome_condominio?: string | null;
};

type TarefasPainelConteudoProps = { basePath?: string };

type GrupoKey = 'duvidas' | 'a_fazer' | 'em_andamento' | 'concluido';

const GRUPO_DEFAULT_ABERTO: Record<GrupoKey, boolean> = {
  duvidas: true,
  a_fazer: true,
  em_andamento: true,
  concluido: true,
};

function textoInteracao(t: InteracaoPainel): string {
  const d = (t.descricao ?? '').trim();
  if (d) return d;
  return (t.titulo ?? '').trim() || '(sem descrição)';
}

function iniciaisResponsavel(nome: string | null | undefined): string {
  const s = (nome ?? '').trim();
  if (!s) return '?';
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return s.slice(0, 2).toUpperCase();
}

function ordenarPorPrazoTitulo(a: InteracaoPainel, b: InteracaoPainel): number {
  const ta = a.prazo_iso ? new Date(`${a.prazo_iso}T12:00:00`).getTime() : Number.POSITIVE_INFINITY;
  const tb = b.prazo_iso ? new Date(`${b.prazo_iso}T12:00:00`).getTime() : Number.POSITIVE_INFINITY;
  if (ta !== tb) return ta - tb;
  return textoInteracao(a).localeCompare(textoInteracao(b), 'pt-BR', { sensitivity: 'base' });
}

function isTipoDuvida(t: InteracaoPainel): boolean {
  return String(t.tipo ?? '').trim().toLowerCase() === 'duvida';
}

const thClass =
  'px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--moni-text-inverse)]';
const tdClass = 'px-3 py-2.5 align-middle text-sm text-[var(--moni-text-primary)]';

export function TarefasPainelConteudo({ basePath: _ = '/painel-novos-negocios' }: TarefasPainelConteudoProps) {
  const router = useRouter();
  const [interacoes, setInteracoes] = useState<InteracaoPainel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<PainelTarefasFiltrosState>(() => defaultPainelTarefasFiltros());
  const [gruposAbertos, setGruposAbertos] = useState<Record<GrupoKey, boolean>>(GRUPO_DEFAULT_ABERTO);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    const r = await getAtividadesChecklistPainel();
    if (r.ok) {
      setInteracoes(r.tarefas as InteracaoPainel[]);
      setLoadError(null);
    } else {
      setInteracoes([]);
      setLoadError(r.error);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    getAtividadesChecklistPainel().then((r) => {
      if (!cancelled) {
        if (r.ok) {
          setInteracoes(r.tarefas as InteracaoPainel[]);
          setLoadError(null);
        } else {
          setInteracoes([]);
          setLoadError(r.error);
        }
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStatus = async (atividadeId: string, status: 'nao_iniciada' | 'em_andamento' | 'concluido') => {
    setUpdatingId(atividadeId);
    const res = await updateKanbanAtividadePainelStatus(atividadeId, status);
    if (res.ok) {
      await recarregar();
      router.refresh();
    }
    setUpdatingId(null);
  };

  const toggleGrupo = (k: GrupoKey) => {
    setGruposAbertos((prev) => ({ ...prev, [k]: !prev[k] }));
  };

  const timesDisponiveis = useMemo(
    () =>
      mergeTimesDisponiveis(
        interacoes.flatMap((t) => {
          const arr = (t.times_nomes ?? []).map((x) => x.trim()).filter(Boolean);
          if (arr.length) return arr;
          return (t.time_nome ?? '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        }),
      ),
    [interacoes],
  );

  const kanbansDisponiveis = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of interacoes) {
      const id = (t.kanban_id ?? '').trim();
      if (!id) continue;
      const nome = (t.kanban_nome ?? '').trim() || id;
      m.set(id, nome);
    }
    return [...m.entries()].sort((a, b) =>
      a[1].localeCompare(b[1], 'pt-BR', { sensitivity: 'base' }),
    );
  }, [interacoes]);

  const responsaveisDisponiveis = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of interacoes) {
      const id = t.responsavel_id?.trim();
      if (!id) continue;
      const nome = (t.responsavel_nome ?? '').trim() || id.slice(0, 8);
      map.set(id, nome);
    }
    return [...map.entries()].sort((a, b) =>
      a[1].localeCompare(b[1], 'pt-BR', { sensitivity: 'base' }),
    );
  }, [interacoes]);

  const filtradas = useMemo(() => aplicarFiltrosTarefasPainel(interacoes, filtros), [interacoes, filtros]);

  const grupos = useMemo(() => {
    const duvidas = filtradas.filter(isTipoDuvida).sort(ordenarPorPrazoTitulo);
    const naoDuvida = filtradas.filter((t) => !isTipoDuvida(t));
    const aFazer = naoDuvida.filter((t) => t.status === 'nao_iniciada').sort(ordenarPorPrazoTitulo);
    const emAndamento = naoDuvida.filter((t) => t.status === 'em_andamento').sort(ordenarPorPrazoTitulo);
    const concluido = naoDuvida.filter((t) => t.status === 'concluido').sort(ordenarPorPrazoTitulo);
    return { duvidas, aFazer, emAndamento, concluido };
  }, [filtradas]);

  const renderTipoBadge = (t: InteracaoPainel) => {
    const duvida = isTipoDuvida(t);
    if (duvida) {
      return (
        <span
          className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{
            background: 'var(--moni-gold-50)',
            color: 'var(--moni-gold-800)',
            border: '1px solid var(--moni-gold-200)',
          }}
        >
          Dúvida
        </span>
      );
    }
    return (
      <span
        className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
        style={{
          background: 'var(--moni-status-active-bg)',
          color: 'var(--moni-status-active-text)',
          border: '1px solid var(--moni-status-active-border)',
        }}
      >
        Atividade
      </span>
    );
  };

  const renderKanbanBadge = (nome: string) => (
    <span
      className="inline-flex max-w-[140px] truncate rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{
        background: 'var(--moni-surface-100)',
        color: 'var(--moni-text-tertiary)',
        border: '1px solid var(--moni-border-subtle)',
      }}
      title={nome}
    >
      {nome}
    </span>
  );

  const renderSlaBadge = (t: InteracaoPainel) => {
    const { variante, texto } = rotuloSlaInteracaoPainel(t.prazo_iso, t.status);
    if (variante === 'nenhum') {
      return <span className="text-xs text-[var(--moni-text-tertiary)]">{texto}</span>;
    }
    if (variante === 'atrasado') {
      return (
        <span
          className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{
            background: 'var(--moni-status-overdue-bg)',
            color: 'var(--moni-status-overdue-text)',
            border: '1px solid var(--moni-status-overdue-border)',
          }}
        >
          {texto}
        </span>
      );
    }
    return (
      <span
        className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold"
        style={{
          background: 'var(--moni-status-attention-bg)',
          color: 'var(--moni-status-attention-text)',
          border: '1px solid var(--moni-status-attention-border)',
        }}
      >
        {texto}
      </span>
    );
  };

  const renderLinhaDesktop = (t: InteracaoPainel, idx: number) => {
    const zebra = idx % 2 === 0 ? 'var(--moni-surface-0)' : 'var(--moni-surface-50)';
    const cardTitulo = (t.card_titulo ?? '').trim() || '(sem título)';
    const times = (t.times_nomes ?? []).filter(Boolean);
    return (
      <tr key={t.id} style={{ background: zebra }}>
        <td className={`${tdClass} w-10`}>
          <input
            type="checkbox"
            checked={t.status === 'concluido'}
            disabled={updatingId === t.id}
            onChange={(e) => {
              void handleStatus(t.id, e.target.checked ? 'concluido' : 'nao_iniciada');
            }}
            className="h-4 w-4 rounded border-[var(--moni-border-default)]"
            aria-label={t.status === 'concluido' ? 'Marcar como não concluída' : 'Marcar como concluída'}
          />
        </td>
        <td className={`${tdClass} max-w-[220px]`}>
          <span className="line-clamp-2 font-medium">{textoInteracao(t)}</span>
        </td>
        <td className={`${tdClass} max-w-[200px]`}>
          <Link
            href={rotaCardOrigem(t.kanban_nome ?? '', t.card_id)}
            className="line-clamp-2 text-sm font-medium text-[var(--moni-navy-600)] underline-offset-2 hover:underline"
          >
            {cardTitulo}
          </Link>
        </td>
        <td className={tdClass}>{renderKanbanBadge((t.kanban_nome ?? '').trim() || '—')}</td>
        <td className={tdClass}>{renderTipoBadge(t)}</td>
        <td className={`${tdClass} max-w-[160px]`}>
          <div className="flex flex-wrap gap-1">
            {times.length ? (
              times.map((nome) => (
                <span
                  key={`${t.id}-${nome}`}
                  className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                  style={{
                    background: 'var(--moni-surface-100)',
                    color: 'var(--moni-text-secondary)',
                    border: '1px solid var(--moni-border-subtle)',
                  }}
                >
                  {nome}
                </span>
              ))
            ) : (
              <span className="text-xs text-[var(--moni-text-tertiary)]">—</span>
            )}
          </div>
        </td>
        <td className={tdClass}>
          <div className="flex items-center gap-2">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-[var(--moni-text-inverse)]"
              style={{ background: 'var(--moni-navy-600)' }}
              title={t.responsavel_nome ?? 'Sem responsável'}
            >
              {iniciaisResponsavel(t.responsavel_nome)}
            </span>
            <span className="min-w-0 truncate text-sm">
              {t.responsavel_nome?.trim() || <span className="text-[var(--moni-text-tertiary)]">Sem responsável</span>}
            </span>
          </div>
        </td>
        <td className={`${tdClass} whitespace-nowrap text-sm`}>
          {t.prazo?.trim() ? (
            <span>{t.prazo}</span>
          ) : (
            <span className="text-[var(--moni-text-tertiary)]">—</span>
          )}
        </td>
        <td className={tdClass}>{renderSlaBadge(t)}</td>
      </tr>
    );
  };

  const renderCardMobile = (t: InteracaoPainel) => {
    const cardTitulo = (t.card_titulo ?? '').trim() || '(sem título)';
    return (
      <article
        key={`m-${t.id}`}
        className="rounded-lg border p-3"
        style={{
          borderColor: 'var(--moni-border-default)',
          background: 'var(--moni-surface-0)',
        }}
      >
        <div className="flex gap-2">
          <input
            type="checkbox"
            checked={t.status === 'concluido'}
            disabled={updatingId === t.id}
            onChange={(e) => {
              void handleStatus(t.id, e.target.checked ? 'concluido' : 'nao_iniciada');
            }}
            className="mt-1 h-4 w-4 shrink-0 rounded border-[var(--moni-border-default)]"
            aria-label="Concluída"
          />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-semibold text-[var(--moni-text-primary)]">{textoInteracao(t)}</p>
            <Link
              href={rotaCardOrigem(t.kanban_nome ?? '', t.card_id)}
              className="block text-sm font-medium text-[var(--moni-navy-600)] underline-offset-2 hover:underline"
            >
              {cardTitulo}
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              {renderKanbanBadge((t.kanban_nome ?? '').trim() || '—')}
              {renderTipoBadge(t)}
              {renderSlaBadge(t)}
            </div>
            <div className="flex flex-wrap gap-1 text-xs text-[var(--moni-text-secondary)]">
              <span>
                Prazo: {t.prazo?.trim() || '—'}
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                Resp.:{' '}
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-[var(--moni-text-inverse)]" style={{ background: 'var(--moni-navy-600)' }}>
                  {iniciaisResponsavel(t.responsavel_nome)}
                </span>
                {t.responsavel_nome?.trim() || 'Sem responsável'}
              </span>
            </div>
            {(t.times_nomes ?? []).filter(Boolean).length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {(t.times_nomes ?? []).filter(Boolean).map((nome) => (
                  <span
                    key={`${t.id}-m-${nome}`}
                    className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                    style={{
                      background: 'var(--moni-surface-100)',
                      color: 'var(--moni-text-secondary)',
                    }}
                  >
                    {nome}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </article>
    );
  };

  const renderGrupo = (key: GrupoKey, titulo: string, emoji: string, lista: InteracaoPainel[]) => {
    const aberto = gruposAbertos[key];
    return (
      <section
        key={key}
        className="overflow-hidden rounded-lg border"
        style={{ borderColor: 'var(--moni-border-default)' }}
      >
        <button
          type="button"
          onClick={() => toggleGrupo(key)}
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:opacity-95"
          style={{ background: 'var(--moni-navy-800)', color: 'var(--moni-text-inverse)' }}
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            {aberto ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
            <span>
              {emoji} {titulo}{' '}
              <span className="font-normal opacity-90">({lista.length})</span>
            </span>
          </span>
        </button>
        {aberto && lista.length > 0 ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[960px] border-collapse text-left">
                <thead>
                  <tr style={{ background: 'var(--moni-navy-800)', color: 'var(--moni-text-inverse)' }}>
                    <th className={`${thClass} w-10`} scope="col">
                      <span className="sr-only">Concluída</span>
                      <span aria-hidden>[ ]</span>
                    </th>
                    <th className={thClass} scope="col">
                      Chamado
                    </th>
                    <th className={thClass} scope="col">
                      Card de Origem
                    </th>
                    <th className={thClass} scope="col">
                      Kanban
                    </th>
                    <th className={thClass} scope="col">
                      Tipo
                    </th>
                    <th className={thClass} scope="col">
                      Time(s)
                    </th>
                    <th className={thClass} scope="col">
                      Responsável
                    </th>
                    <th className={thClass} scope="col">
                      Prazo
                    </th>
                    <th className={thClass} scope="col">
                      SLA
                    </th>
                  </tr>
                </thead>
                <tbody>{lista.map((row, i) => renderLinhaDesktop(row, i))}</tbody>
              </table>
            </div>
            <div className="space-y-3 p-3 md:hidden">{lista.map((row) => renderCardMobile(row))}</div>
          </>
        ) : null}
        {aberto && lista.length === 0 ? (
          <p className="px-4 py-3 text-sm text-[var(--moni-text-tertiary)]">Nenhum chamado neste grupo.</p>
        ) : null}
      </section>
    );
  };

  if (loading) {
    return <p className="text-sm text-[var(--moni-text-tertiary)]">Carregando…</p>;
  }

  if (loadError) {
    return (
      <div
        className="rounded-lg border p-4 text-sm"
        style={{
          borderColor: 'var(--moni-status-overdue-border)',
          background: 'var(--moni-status-overdue-bg)',
          color: 'var(--moni-status-overdue-text)',
        }}
      >
        <p className="font-medium">Não foi possível carregar os chamados.</p>
        <p className="mt-1 opacity-90">{loadError}</p>
        <p className="mt-2 text-xs opacity-80">
          Modo visitante / listagem completa: o servidor precisa de{' '}
          <code className="rounded px-1" style={{ background: 'rgba(255,255,255,0.35)' }}>
            SUPABASE_DEV_SERVICE_ROLE_KEY ou SUPABASE_SERVICE_ROLE_KEY
          </code>{' '}
          (ex.: Vercel).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section
        className="rounded-xl border p-4 shadow-sm"
        style={{
          borderColor: 'var(--moni-border-default)',
          background: 'var(--moni-surface-50)',
        }}
        aria-label="Filtros do painel de chamados"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--moni-text-tertiary)]">Filtros</p>
          {painelTarefasFiltrosTemAlgumAtivo(filtros) && (
            <button
              type="button"
              onClick={() => setFiltros(defaultPainelTarefasFiltros())}
              className="text-xs font-medium text-[var(--moni-navy-600)] hover:underline"
            >
              Limpar filtros
            </button>
          )}
        </div>

        <div className="relative mb-3 w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--moni-text-tertiary)]" />
          <input
            type="search"
            value={filtros.busca}
            onChange={(e) => setFiltros((f) => ({ ...f, busca: e.target.value }))}
            placeholder="Buscar por chamado, card, responsável ou kanban"
            className={PAINEL_TAREFAS_SEARCH_CLASS}
            aria-label="Buscar chamados"
          />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <select
            value={filtros.status}
            onChange={(e) =>
              setFiltros((f) => ({
                ...f,
                status: e.target.value as PainelTarefasFiltrosState['status'],
              }))
            }
            className={PAINEL_TAREFAS_SELECT_CLASS}
            aria-label="Filtrar por status"
            style={{ color: 'var(--moni-text-primary)' }}
          >
            <option value="todos">Status: todos</option>
            <option value="nao_iniciada">Status: a fazer</option>
            <option value="em_andamento">Status: em andamento</option>
            <option value="concluido">Status: concluído</option>
          </select>

          <select
            value={filtros.tipo}
            onChange={(e) =>
              setFiltros((f) => ({
                ...f,
                tipo: e.target.value as PainelTarefasFiltrosState['tipo'],
              }))
            }
            className={PAINEL_TAREFAS_SELECT_CLASS}
            aria-label="Filtrar por tipo"
            style={{ color: 'var(--moni-text-primary)' }}
          >
            <option value="todos">Tipo: todos</option>
            <option value="atividade">Tipo: atividade</option>
            <option value="duvida">Tipo: dúvida</option>
          </select>

          <select
            value={filtros.kanban}
            onChange={(e) => setFiltros((f) => ({ ...f, kanban: e.target.value }))}
            className={PAINEL_TAREFAS_SELECT_CLASS}
            aria-label="Filtrar por kanban"
            style={{ color: 'var(--moni-text-primary)' }}
          >
            <option value="todos">Kanban: todos</option>
            {kanbansDisponiveis.map(([id, nome]) => (
              <option key={id} value={id}>
                {nome}
              </option>
            ))}
          </select>

          <select
            value={filtros.time}
            onChange={(e) => setFiltros((f) => ({ ...f, time: e.target.value }))}
            className={PAINEL_TAREFAS_SELECT_CLASS}
            aria-label="Filtrar por time"
            style={{ color: 'var(--moni-text-primary)' }}
          >
            <option value="todos">Time: todos</option>
            {timesDisponiveis.map((time) => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
          </select>

          <select
            value={filtros.responsavel}
            onChange={(e) => setFiltros((f) => ({ ...f, responsavel: e.target.value }))}
            className={PAINEL_TAREFAS_SELECT_CLASS}
            aria-label="Filtrar por responsável"
            style={{ color: 'var(--moni-text-primary)' }}
          >
            <option value="todos">Responsável: todos</option>
            <option value="__sem_responsavel__">Responsável: sem responsável</option>
            {responsaveisDisponiveis.map(([id, nome]) => (
              <option key={id} value={id}>
                {nome}
              </option>
            ))}
          </select>

          <select
            value={filtros.sla_status}
            onChange={(e) =>
              setFiltros((f) => ({
                ...f,
                sla_status: e.target.value as PainelTarefasFiltrosState['sla_status'],
              }))
            }
            className={PAINEL_TAREFAS_SELECT_CLASS}
            aria-label="Filtrar por SLA"
            style={{ color: 'var(--moni-text-primary)' }}
          >
            <option value="todos">SLA: todos</option>
            <option value="atrasado">SLA: atrasado</option>
            <option value="vence_hoje">SLA: vence hoje</option>
            <option value="ok">SLA: ok</option>
            <option value="sem_prazo">SLA: sem prazo</option>
          </select>
        </div>
      </section>

      {filtradas.length === 0 ? (
        <p
          className="rounded-lg border border-dashed p-6 text-center text-sm"
          style={{
            borderColor: 'var(--moni-border-default)',
            background: 'var(--moni-surface-50)',
            color: 'var(--moni-text-tertiary)',
          }}
        >
          Nenhum chamado encontrado.
        </p>
      ) : (
        <div className="space-y-4">
          {renderGrupo('duvidas', 'Dúvidas', '❓', grupos.duvidas)}
          {renderGrupo('a_fazer', 'A fazer', '🔴', grupos.aFazer)}
          {renderGrupo('em_andamento', 'Em andamento', '🟡', grupos.emAndamento)}
          {renderGrupo('concluido', 'Concluído', '✅', grupos.concluido)}
        </div>
      )}
    </div>
  );
}
