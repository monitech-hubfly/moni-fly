'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { listarAreas } from '@/utils/areasOrder';
import { isoWeek, semanasIsoAnoCalendario } from '@/utils/periodos';
import {
  aceitarCard,
  createCard,
  deleteCard,
  fetchCardDetail,
  fetchCardHoras,
  fetchCards,
  fetchPastelariaAreaPessoas,
  PastelariaApiError,
  reclassificarCard,
  updateCard,
  upsertCardHoras,
  type PastelariaCardView,
} from '@/lib/pastelaria/api-client';
import { totalHorasConvertidas } from '@/lib/pastelaria/converter';
import type { PastelariaColuna, PastelariaHorasRow } from '@/lib/pastelaria/types';
import {
  responsavelAvatarStyle,
  responsavelDisplayNome,
  responsavelIniciais,
  responsavelNomeEhDoUsuario,
} from '@/lib/pastelaria/responsavel';
import { semanaAtualLabel, semanaLabelFromNum } from '@/lib/pastelaria/week';
import {
  PastelariaKanban,
  type PastelariaColunaConfig,
} from '@/components/carometro/pastelaria/PastelariaKanban';
import { PastelariaModals, type NovoPastelForm } from '@/components/carometro/pastelaria/PastelariaModals';
import { PastelariaToast } from '@/components/carometro/pastelaria/PastelariaToast';

const COLUNAS: PastelariaColunaConfig[] = [
  {
    id: 'inbox',
    title: 'Direcionados p/ Tratativas',
    color: '#7F77DD',
    border: '#AFA9EC',
    badge: 'Push automático de outros módulos',
    showAdd: false,
  },
  {
    id: 'mapped',
    title: 'Mapeados',
    color: '#378ADD',
    border: '#5ca3e8',
    showAdd: true,
  },
  {
    id: 'doing',
    title: 'Em Andamento',
    color: '#EF9F27',
    border: '#f5c76a',
    showAdd: true,
  },
  {
    id: 'done',
    title: 'Concluídos',
    color: '#639922',
    border: '#8bc34a',
    showAdd: false,
  },
];

const PROXIMA_COLUNA: Partial<Record<PastelariaColuna, PastelariaColuna>> = {
  mapped: 'doing',
  doing: 'done',
};

type ResponsavelFilter = 'mine' | 'all' | 'none' | string;

export function PastelariaPage() {
  const supabase = createClient();
  const semanaAtual = useMemo(() => semanaAtualLabel(), []);

  const [areas, setAreas] = useState<{ id: string; nome: string }[]>([]);
  const [areaId, setAreaId] = useState('');
  const [areaPessoas, setAreaPessoas] = useState<{ id: string; nome: string }[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'ok' | 'err' } | null>(null);
  const [saving, setSaving] = useState(false);

  const [dragCardId, setDragCardId] = useState<string | null>(null);
  const [dragFromColuna, setDragFromColuna] = useState<PastelariaColuna | null>(null);

  const [horasMap, setHorasMap] = useState<Record<string, PastelariaHorasRow>>({});

  const [novoOpen, setNovoOpen] = useState(false);
  const [novoColunaDestino, setNovoColunaDestino] = useState<PastelariaColuna>('mapped');

  const [reclassCard, setReclassCard] = useState<PastelariaCardView | null>(null);
  const [horasCard, setHorasCard] = useState<PastelariaCardView | null>(null);
  const [horasInicial, setHorasInicial] = useState<PastelariaHorasRow[]>([]);
  const [detailCard, setDetailCard] = useState<PastelariaCardView | null>(null);
  const [detailHoras, setDetailHoras] = useState<PastelariaHorasRow[]>([]);

  const [cards, setCards] = useState<PastelariaCardView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loggedUserName, setLoggedUserName] = useState('');
  const [respFilter, setRespFilter] = useState<ResponsavelFilter>('mine');

  const reloadCards = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await fetchCards(areaId || null);
      setCards(list);
    } catch (e) {
      setLoadError(
        e instanceof PastelariaApiError ? e.message : 'Falha ao carregar cards.',
      );
    } finally {
      setLoading(false);
    }
  }, [areaId]);

  useEffect(() => {
    void reloadCards();
  }, [reloadCards]);

  useEffect(() => {
    const onFocus = () => void reloadCards();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [reloadCards]);

  const semanasOpcoes = useMemo(() => {
    const ano = new Date().getFullYear();
    const lista = semanasIsoAnoCalendario(ano);
    const atual = isoWeek(new Date());
    const idx = lista.indexOf(atual);
    const slice = idx >= 0 ? lista.slice(Math.max(0, idx - 7), idx + 1) : lista.slice(-8);
    return slice.map((n) => semanaLabelFromNum(n));
  }, []);

  const showToast = useCallback((message: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    void listarAreas(supabase, 'id, nome').then(({ data }) => {
      const list = data ?? [];
      setAreas(list);
      /* área opcional: vazio = todas as áreas no kanban */
    });
    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
      const nome =
        (profile as { full_name?: string | null } | null)?.full_name?.trim() ||
        user.email?.split('@')[0]?.trim() ||
        '';
      setLoggedUserName(nome);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount
  }, []);

  const loadAreaPessoas = useCallback(async (id: string) => {
    try {
      const list = await fetchPastelariaAreaPessoas(id);
      setAreaPessoas(list);
    } catch {
      setAreaPessoas([]);
    }
  }, []);

  useEffect(() => {
    if (!areaId) {
      setAreaPessoas([]);
      return;
    }
    void loadAreaPessoas(areaId);
  }, [areaId, loadAreaPessoas]);

  const handleAreaChange = useCallback((nextAreaId: string) => {
    setAreaId(nextAreaId);
    setRespFilter('all');
  }, []);

  const filteredCards = useMemo(() => {
    if (respFilter === 'all') return cards;
    if (respFilter === 'none') {
      return cards.filter((c) => !responsavelDisplayNome(c));
    }
    if (respFilter === 'mine') {
      const me = loggedUserName.trim().toLocaleLowerCase('pt-BR');
      if (!me) return cards;
      return cards.filter(
        (c) =>
          responsavelDisplayNome(c)?.trim().toLocaleLowerCase('pt-BR') === me,
      );
    }
    const pessoa = areaPessoas.find((p) => p.id === respFilter);
    if (!pessoa) return cards;
    const alvo = pessoa.nome.trim().toLocaleLowerCase('pt-BR');
    return cards.filter((c) => {
      if (c.responsavel_id === respFilter) return true;
      return responsavelDisplayNome(c)?.trim().toLocaleLowerCase('pt-BR') === alvo;
    });
  }, [cards, respFilter, loggedUserName, areaPessoas]);

  const loadHorasSemanaAtual = useCallback(async (list: PastelariaCardView[]) => {
    const alvo = list.filter((c) => c.coluna === 'doing' || c.coluna === 'done');
    if (alvo.length === 0) {
      setHorasMap({});
      return;
    }
    const entries = await Promise.all(
      alvo.map(async (c) => {
        try {
          const rows = await fetchCardHoras(c.id);
          const row = rows.find((r) => r.semana === semanaAtual) ?? null;
          return [c.id, row] as const;
        } catch {
          return [c.id, null] as const;
        }
      }),
    );
    const map: Record<string, PastelariaHorasRow> = {};
    for (const [id, row] of entries) {
      if (row) map[id] = row;
    }
    setHorasMap(map);
  }, [semanaAtual]);

  useEffect(() => {
    void loadHorasSemanaAtual(cards);
  }, [cards, loadHorasSemanaAtual]);

  const cardsByColuna = useMemo(() => {
    const out: Record<PastelariaColuna, PastelariaCardView[]> = {
      inbox: [],
      mapped: [],
      doing: [],
      done: [],
    };
    for (const c of filteredCards) {
      const col = c.coluna as PastelariaColuna;
      if (out[col]) out[col].push(c);
    }
    return out;
  }, [filteredCards]);

  const stats = useMemo(() => {
    let horasConsumidas = 0;
    for (const c of cards) {
      if (c.coluna !== 'doing' && c.coluna !== 'done') continue;
      const h = horasMap[c.id];
      if (!h) continue;
      horasConsumidas += totalHorasConvertidas(h);
    }
    return {
      inbox: cardsByColuna.inbox.length,
      mapped: cardsByColuna.mapped.length,
      doing: cardsByColuna.doing.length,
      horasConsumidas,
    };
  }, [cards, cardsByColuna, horasMap]);

  const optimisticMove = useCallback(
    async (cardId: string, toColuna: PastelariaColuna, patch: Parameters<typeof updateCard>[1]) => {
      const snapshot = cards;
      setCards((current) =>
        current.map((c) =>
          c.id === cardId ? { ...c, coluna: toColuna, ...patch } : c,
        ),
      );
      try {
        const updated = await updateCard(cardId, { coluna: toColuna, ...patch });
        setCards((current) => current.map((c) => (c.id === cardId ? updated : c)));
        showToast('Card atualizado.');
        void loadHorasSemanaAtual(
          snapshot.map((c) => (c.id === cardId ? updated : c)),
        );
      } catch (e) {
        setCards(snapshot);
        const msg = e instanceof PastelariaApiError ? e.message : 'Erro ao mover card.';
        showToast(msg, 'err');
      }
    },
    [cards, showToast, loadHorasSemanaAtual],
  );

  const handleDrop = useCallback(
    (toColuna: PastelariaColuna) => {
      if (!dragCardId || !dragFromColuna) return;
      const from = dragFromColuna;
      setDragCardId(null);
      setDragFromColuna(null);
      if (from === toColuna) return;

      if (from === 'inbox' && toColuna !== 'mapped') {
        showToast('Da triagem, arraste apenas para Mapeados.', 'err');
        return;
      }

      const patch: Parameters<typeof updateCard>[1] = { coluna: toColuna };
      if (toColuna === 'done') patch.completed_week = semanaAtual;

      void optimisticMove(dragCardId, toColuna, patch);
    },
    [dragCardId, dragFromColuna, optimisticMove, semanaAtual, showToast],
  );

  const handleAceitar = useCallback(
    async (card: PastelariaCardView) => {
      setSaving(true);
      try {
        const updated = await aceitarCard(card.id);
        setCards((list) => list.map((c) => (c.id === card.id ? updated : c)));
        setDetailCard((d) => (d?.id === card.id ? updated : d));
        showToast('Card aceito.');
      } catch (e) {
        showToast(e instanceof PastelariaApiError ? e.message : 'Erro ao aceitar.', 'err');
      } finally {
        setSaving(false);
      }
    },
    [showToast],
  );

  const handleSaveNovo = useCallback(
    async (form: NovoPastelForm, colunaDestino: PastelariaColuna) => {
      setSaving(true);
      try {
        let card = await createCard({
          nome: form.nome.trim(),
          area_id: form.area_id || null,
          estimativa_valor: Number(form.estimativa_valor) || 1,
          estimativa_unidade: form.estimativa_unidade,
          semana_origem: form.semana_origem,
          responsavel_id: form.responsavel_id || null,
        });
        if (colunaDestino === 'doing') {
          card = await updateCard(card.id, { coluna: 'doing' });
        }
        setCards((list) => [card, ...list]);
        setNovoOpen(false);
        showToast('Pastel criado.');
      } catch (e) {
        showToast(e instanceof PastelariaApiError ? e.message : 'Erro ao criar pastel.', 'err');
      } finally {
        setSaving(false);
      }
    },
    [showToast],
  );

  const openDetail = useCallback(async (card: PastelariaCardView) => {
    setDetailCard(card);
    try {
      const { horas } = await fetchCardDetail(card.id);
      setDetailHoras(horas);
    } catch {
      setDetailHoras([]);
    }
  }, []);

  const openHoras = useCallback(async (card: PastelariaCardView) => {
    setHorasCard(card);
    setHorasInicial([]);
    try {
      const rows = await fetchCardHoras(card.id);
      setHorasInicial(rows);
    } catch {
      setHorasInicial([]);
    }
  }, []);

  const handleMoverProxima = useCallback(async () => {
    if (!detailCard) return;
    const next = PROXIMA_COLUNA[detailCard.coluna];
    if (!next) return;
    setDetailCard(null);
    const patch: Parameters<typeof updateCard>[1] = { coluna: next };
    if (next === 'done') patch.completed_week = semanaAtual;
    await optimisticMove(detailCard.id, next, patch);
  }, [detailCard, optimisticMove, semanaAtual]);

  return (
    <div className="pastelaria-page-moni gantt-page-moni">
      <PastelariaToast message={toast?.message ?? null} type={toast?.type} />

      <header className="gantt-page-header">
        <div className="gantt-page-header__left">
          <h1 className="carometro-page-title">🥟 Pastelaria</h1>
          <p className="carometro-page-subtitle">
            Atividades não planejadas · {semanaAtual}
          </p>
        </div>
        <div className="gantt-page-header__right">
          <button
            type="button"
            className="pastelaria-btn-novo"
            onClick={() => {
              setNovoColunaDestino('mapped');
              setNovoOpen(true);
            }}
            aria-label="Criar novo pastel"
          >
            + Novo Pastel
          </button>
          <div className="gantt-page-header__area-wrap">
            <label className="gantt-page-header__area-label" htmlFor="pastelaria-area-select">
              Área
            </label>
            <select
              id="pastelaria-area-select"
              className="gantt-page-header__area-select"
              value={areaId}
              onChange={(e) => handleAreaChange(e.target.value)}
              aria-label="Área"
            >
              <option value="">Todas</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <div className="pastelaria-resp-filter" role="group" aria-label="Filtrar por responsável">
        <button
          type="button"
          className={`pastelaria-resp-filter__pill${respFilter === 'mine' ? ' pastelaria-resp-filter__pill--active' : ''}`}
          onClick={() => setRespFilter('mine')}
        >
          Meus
        </button>
        {areaPessoas.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`pastelaria-resp-filter__pill${respFilter === p.id ? ' pastelaria-resp-filter__pill--active' : ''}`}
            onClick={() => setRespFilter(p.id)}
          >
            <span
              className="pastelaria-resp-avatar pastelaria-resp-avatar--sm"
              style={responsavelAvatarStyle(p.nome)}
              aria-hidden
            >
              {responsavelIniciais(p.nome)}
            </span>
            {p.nome}
            {responsavelNomeEhDoUsuario(p.nome, loggedUserName) ? (
              <span className="pastelaria-resp-badge-meu pastelaria-resp-badge-meu--pill">meu</span>
            ) : null}
          </button>
        ))}
        <button
          type="button"
          className={`pastelaria-resp-filter__pill${respFilter === 'none' ? ' pastelaria-resp-filter__pill--active' : ''}`}
          onClick={() => setRespFilter('none')}
        >
          Sem resp.
        </button>
        <button
          type="button"
          className={`pastelaria-resp-filter__pill${respFilter === 'all' ? ' pastelaria-resp-filter__pill--active' : ''}`}
          onClick={() => setRespFilter('all')}
        >
          Todos
        </button>
      </div>

      {loadError ? (
        <div className="alert alert-danger" role="alert">
          {loadError}
        </div>
      ) : null}

      <div className="pastelaria-stats">
        <div className="pastelaria-stat">
          <span className="pastelaria-stat__label">Aguardando triagem</span>
          <strong className="pastelaria-stat__value">{stats.inbox}</strong>
        </div>
        <div className="pastelaria-stat">
          <span className="pastelaria-stat__label">Mapeados</span>
          <strong className="pastelaria-stat__value">{stats.mapped}</strong>
        </div>
        <div className="pastelaria-stat">
          <span className="pastelaria-stat__label">Em andamento</span>
          <strong className="pastelaria-stat__value">{stats.doing}</strong>
        </div>
        <div className="pastelaria-stat">
          <span className="pastelaria-stat__label">Horas consumidas</span>
          <strong className="pastelaria-stat__value">{stats.horasConsumidas}h</strong>
        </div>
      </div>

      {loading && cards.length === 0 ? (
        <p className="pastelaria-loading">Carregando…</p>
      ) : (
        <PastelariaKanban
          columns={COLUNAS}
          cardsByColuna={cardsByColuna}
          loggedUserName={loggedUserName}
          groupByResponsavel={respFilter !== 'mine'}
          horasMap={horasMap}
          dragCardId={dragCardId}
          onDragStart={(id, col) => {
            setDragCardId(id);
            setDragFromColuna(col);
          }}
          onDragEnd={() => {
            setDragCardId(null);
            setDragFromColuna(null);
          }}
          onDrop={handleDrop}
          onAceitar={(card) => void handleAceitar(card)}
          onReclassificar={setReclassCard}
          onOpenHoras={(card) => void openHoras(card)}
          onOpenDetail={(card) => void openDetail(card)}
          onAdd={(col) => {
            setNovoColunaDestino(col === 'doing' ? 'doing' : 'mapped');
            setNovoOpen(true);
          }}
        />
      )}

      <PastelariaModals
        areas={areas}
        semanaAtual={semanaAtual}
        semanasOpcoes={semanasOpcoes}
        areaPessoas={areaPessoas}
        loggedUserName={loggedUserName}
        defaultAreaId={areaId}
        onReloadAreaPessoas={loadAreaPessoas}
        novoOpen={novoOpen}
        novoColunaDestino={novoColunaDestino}
        saving={saving}
        onCloseNovo={() => setNovoOpen(false)}
        onSaveNovo={(form, col) => void handleSaveNovo(form, col)}
        reclassCard={reclassCard}
        onCloseReclass={() => setReclassCard(null)}
        onSaveReclass={async (payload) => {
          if (!reclassCard) return;
          setSaving(true);
          try {
            const res = await reclassificarCard(reclassCard.id, payload);
            setCards((list) => list.filter((c) => c.id !== reclassCard.id));
            setReclassCard(null);
            setDetailCard(null);
            const toastMsg =
              res.action === 'redirect' && res.destino
                ? `Reclassificado → ${res.destino}. Justificativa registrada.`
                : 'Devolvido ao solicitante. Justificativa registrada.';
            showToast(toastMsg);
          } catch (e) {
            showToast(e instanceof PastelariaApiError ? e.message : 'Erro ao reclassificar.', 'err');
          } finally {
            setSaving(false);
          }
        }}
        horasCard={horasCard}
        horasInicial={horasInicial}
        onCloseHoras={() => setHorasCard(null)}
        onSaveHoras={async (row) => {
          if (!horasCard) return;
          setSaving(true);
          try {
            const saved = await upsertCardHoras(horasCard.id, row);
            if (row.semana === semanaAtual) {
              setHorasMap((m) => ({ ...m, [horasCard.id]: saved }));
            }
            setHorasInicial((prev) => {
              const idx = prev.findIndex((r) => r.semana === row.semana);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = saved;
                return next;
              }
              return [...prev, saved];
            });
            showToast('Horas registradas.');
          } catch (e) {
            showToast(e instanceof PastelariaApiError ? e.message : 'Erro ao salvar horas.', 'err');
          } finally {
            setSaving(false);
          }
        }}
        detailCard={detailCard}
        detailHoras={detailHoras}
        onCloseDetail={() => setDetailCard(null)}
        onDetailAceitar={() => detailCard && void handleAceitar(detailCard)}
        onDetailReclassificar={() => {
          if (detailCard) {
            setDetailCard(null);
            setReclassCard(detailCard);
          }
        }}
        onDetailHoras={() => {
          if (detailCard) {
            const c = detailCard;
            setDetailCard(null);
            void openHoras(c);
          }
        }}
        onDetailMoverProxima={() => void handleMoverProxima()}
        onSaveDetailResponsavel={async (payload) => {
          if (!detailCard) return;
          setSaving(true);
          try {
            const updated = await updateCard(detailCard.id, payload);
            setCards((list) => list.map((c) => (c.id === updated.id ? updated : c)));
            setDetailCard(updated);
            showToast('Responsável atualizado.');
          } catch (e) {
            showToast(
              e instanceof PastelariaApiError ? e.message : 'Erro ao salvar responsável.',
              'err',
            );
          } finally {
            setSaving(false);
          }
        }}
        onDetailExcluir={async () => {
          if (!detailCard) return;
          if (!window.confirm(`Excluir "${detailCard.nome}"?`)) return;
          setSaving(true);
          try {
            await deleteCard(detailCard.id);
            setCards((list) => list.filter((c) => c.id !== detailCard.id));
            setDetailCard(null);
            showToast('Card excluído.');
          } catch (e) {
            showToast(e instanceof PastelariaApiError ? e.message : 'Erro ao excluir.', 'err');
          } finally {
            setSaving(false);
          }
        }}
      />

      <style>{`
        .pastelaria-page-moni .pastelaria-btn-novo {
          background: #1a3d28;
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .pastelaria-page-moni .pastelaria-btn-novo:hover {
          background: #245a38;
        }
        .pastelaria-toast--err {
          position: fixed;
          top: 16px;
          right: 16px;
          z-index: 100002;
          max-width: 340px;
          padding: 12px 14px;
          background: #5c1f1f;
          color: #ffeaea;
          border-radius: 8px;
          font-size: 13px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        }
        .pastelaria-resp-filter {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
          margin-bottom: 14px;
          padding: 10px 12px;
          background: var(--moni-branco, #fff);
          border: 1px solid var(--moni-borda, #e5e2dc);
          border-radius: 10px;
        }
        .pastelaria-resp-filter__pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid var(--moni-borda, #e5e2dc);
          background: #faf9f6;
          color: var(--moni-texto, #333);
          border-radius: 999px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s, color 0.15s;
        }
        .pastelaria-resp-avatar--sm {
          width: 22px;
          height: 22px;
          font-size: 9px;
        }
        .pastelaria-resp-badge-meu--pill {
          margin-left: 2px;
        }
        .pastelaria-resp-filter__pill:hover {
          border-color: #1a3d28;
          color: #1a3d28;
        }
        .pastelaria-resp-filter__pill--active {
          background: #1a3d28;
          border-color: #1a3d28;
          color: #fff;
        }
        .pastelaria-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 18px;
        }
        .pastelaria-stat {
          background: var(--moni-branco, #fff);
          border: 1px solid var(--moni-borda, #e5e2dc);
          border-radius: 10px;
          padding: 12px 14px;
        }
        .pastelaria-stat__label {
          display: block;
          font-size: 12px;
          color: var(--moni-texto-suave, #666);
          margin-bottom: 4px;
        }
        .pastelaria-stat__value {
          font-size: 1.35rem;
          color: var(--moni-verde-escuro, #1a3d28);
        }
        .pastelaria-loading {
          color: var(--moni-texto-suave);
          padding: 2rem 0;
        }
        .pastelaria-kanban {
          display: grid;
          grid-template-columns: repeat(4, minmax(220px, 1fr));
          gap: 12px;
          align-items: start;
        }
        .pastelaria-kanban-col {
          background: #faf9f6;
          border: 1px solid var(--pastelaria-col-border, #ddd);
          border-top: 4px solid var(--pastelaria-col-accent, #999);
          border-radius: 10px;
          min-height: 320px;
          display: flex;
          flex-direction: column;
        }
        .pastelaria-kanban-col__head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px 6px;
        }
        .pastelaria-kanban-col__title {
          margin: 0;
          font-size: 13px;
          font-weight: 700;
          color: var(--pastelaria-col-accent);
        }
        .pastelaria-kanban-col__count {
          font-size: 12px;
          font-weight: 600;
          color: var(--moni-texto-suave);
        }
        .pastelaria-kanban-col__badge {
          margin: 0 12px 8px;
          font-size: 11px;
          color: #7F77DD;
        }
        .pastelaria-kanban-col__body {
          flex: 1;
          padding: 0 8px 8px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-height: 120px;
        }
        .pastelaria-kanban-col__add {
          margin: 8px;
          padding: 8px;
          border: 1px dashed var(--pastelaria-col-accent);
          border-radius: 8px;
          background: transparent;
          color: var(--pastelaria-col-accent);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .pastelaria-kanban-card {
          background: #fff;
          border: 1px solid var(--moni-borda, #e5e2dc);
          border-radius: 8px;
          padding: 10px;
          cursor: grab;
          box-shadow: 0 1px 3px rgba(0,0,0,0.06);
        }
        .pastelaria-kanban-card--inbox:not(.pastelaria-kanban-card--resp-meu):not(.pastelaria-kanban-card--resp-outro) {
          border-left: 4px solid #7F77DD;
        }
        .pastelaria-kanban-card--resp-meu {
          border-left: 4px solid #1D9E75 !important;
          border-radius: 0 8px 8px 0;
        }
        .pastelaria-kanban-card--resp-outro {
          border-left: 4px solid #85B7EB !important;
          border-radius: 0 8px 8px 0;
        }
        .pastelaria-kanban-grupo-wrap {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .pastelaria-kanban-grupo-divider {
          height: 0;
          border-top: 0.5px solid var(--moni-borda, #e5e2dc);
          margin: 4px 0;
        }
        .pastelaria-kanban-grupo {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 2px 0 4px;
        }
        .pastelaria-kanban-grupo__nome {
          font-size: 12px;
          font-weight: 600;
          color: var(--moni-texto, #333);
        }
        .pastelaria-kanban-grupo__count {
          font-size: 11px;
          color: var(--moni-texto-suave, #666);
        }
        .pastelaria-kanban-card__responsavel {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 8px;
          min-height: 28px;
        }
        .pastelaria-resp-avatar {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 700;
          flex-shrink: 0;
        }
        .pastelaria-resp-nome {
          font-size: 12px;
          font-weight: 600;
          color: var(--moni-texto, #333);
          line-height: 1.2;
        }
        .pastelaria-resp-badge-meu {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 999px;
          background: #EAF3DE;
          color: #1D9E75;
          border: 1px solid #97C459;
        }
        .pastelaria-resp-vazio {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-style: italic;
          color: #9ca3af;
        }
        .pastelaria-kanban-card__head {
          display: flex;
          align-items: flex-start;
          gap: 6px;
        }
        .pastelaria-kanban-card__nome {
          margin: 0;
          flex: 1;
          font-size: 13px;
          font-weight: 600;
          line-height: 1.3;
        }
        .pastelaria-kanban-card__menu {
          border: none;
          background: transparent;
          cursor: pointer;
          padding: 0 4px;
          color: var(--moni-texto-suave);
        }
        .pastelaria-kanban-card__pills {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-top: 8px;
        }
        .pastelaria-pill {
          font-size: 10px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 999px;
        }
        .pastelaria-pill--area { background: #e3f0fc; color: #1a5a8a; }
        .pastelaria-pill--estimativa { background: #fff3e0; color: #b45309; }
        .pastelaria-pill--source { background: #ffebee; color: #c62828; }
        .pastelaria-pill--done { background: #e8f5e9; color: #2e7d32; margin-top: 6px; display: inline-block; }
        .pastelaria-kanban-card__opened {
          margin: 6px 0 0;
          font-size: 11px;
          color: var(--moni-texto-suave);
        }
        .pastelaria-kanban-card__actions {
          display: flex;
          gap: 6px;
          margin-top: 8px;
        }
        .pastelaria-btn {
          flex: 1;
          border: none;
          border-radius: 6px;
          padding: 6px 8px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
        }
        .pastelaria-btn--aceitar { background: #e8f5e9; color: #2e7d32; }
        .pastelaria-btn--reclass { background: #fff3e0; color: #e65100; }
        .pastelaria-horas-mini {
          width: 100%;
          margin-top: 8px;
          padding: 6px;
          border: 1px solid #f5c76a;
          border-radius: 6px;
          background: #fffdf5;
          cursor: pointer;
          text-align: left;
        }
        .pastelaria-horas-mini__label {
          font-size: 10px;
          font-weight: 700;
          color: #b45309;
        }
        .pastelaria-horas-mini__bars {
          display: flex;
          align-items: flex-end;
          gap: 3px;
          height: 28px;
          margin: 4px 0;
        }
        .pastelaria-horas-mini__bar {
          flex: 1;
          min-height: 2px;
          background: #EF9F27;
          border-radius: 2px 2px 0 0;
        }
        .pastelaria-horas-mini__total {
          font-size: 10px;
          color: var(--moni-texto-suave);
        }
        .pastelaria-alert-warn {
          background: #fff8e1;
          border: 1px solid #ffe082;
          color: #6d4c00;
          padding: 8px 10px;
          border-radius: 8px;
          font-size: 12px;
        }
        .pastelaria-input-invalid {
          border-color: #c62828 !important;
          outline-color: #c62828;
        }
        .pastelaria-detail-dl {
          display: grid;
          gap: 8px;
          margin: 0;
        }
        .pastelaria-detail-dl dt {
          font-size: 11px;
          color: var(--moni-texto-suave);
        }
        .pastelaria-detail-dl dd { margin: 0; font-weight: 600; }
        .pastelaria-detail-h3 { margin: 1rem 0 0.5rem; font-size: 14px; }
        .pastelaria-detail-horas {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .pastelaria-detail-horas li {
          display: grid;
          grid-template-columns: 48px 1fr 40px;
          align-items: center;
          gap: 8px;
          font-size: 12px;
        }
        .pastelaria-detail-bar {
          height: 8px;
          background: #eee;
          border-radius: 4px;
          overflow: hidden;
        }
        .pastelaria-detail-bar span {
          display: block;
          height: 100%;
          background: #378ADD;
        }
        .pastelaria-detail-footer {
          flex-wrap: wrap;
        }
        @media (max-width: 1100px) {
          .pastelaria-kanban { grid-template-columns: repeat(2, 1fr); }
          .pastelaria-stats { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </div>
  );
}
