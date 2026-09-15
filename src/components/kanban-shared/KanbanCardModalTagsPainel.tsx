import { Lock, Tag, X } from 'lucide-react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import {
  classificarKanbanTagGrupo,
  estiloChipTagKanban,
  isKanbanTagTrancheNome,
  ordenarTagsPorIndiceOrdinal,
} from '@/lib/kanban/kanban-tag-especial';
import {
  criarTagKanban,
  desvincularTagCard,
  listarTagsKanban,
  vincularTagCard,
} from '@/lib/actions/card-actions';

export type KanbanModalTagKanban = { id: string; nome: string; cor: string };
export type KanbanModalTagCard = { id: string; tag_id: string; nome: string; cor: string };

type Props = {
  cardId: string;
  kanbanId: string;
  basePath: string;
  tagsKanban: KanbanModalTagKanban[];
  tagsCard: KanbanModalTagCard[];
  setTagsKanban: Dispatch<SetStateAction<KanbanModalTagKanban[]>>;
  setTagsCard: Dispatch<SetStateAction<KanbanModalTagCard[]>>;
  tagsOpen: boolean;
  setTagsOpen: Dispatch<SetStateAction<boolean>>;
  ocultarGestaoCard: boolean;
  podeCriarChamados: boolean;
  novatagsNome: string;
  setNovaTagNome: (v: string) => void;
  novaTagCor: string;
  setNovaTagCor: (v: string) => void;
  criandoTag: boolean;
  setCriandoTag: (v: boolean) => void;
};

function ehFunilRodadas(kanbanId: string): boolean {
  return kanbanId === KANBAN_IDS.OPERACOES || kanbanId === KANBAN_IDS.MONI_CAPITAL;
}

function ehFunilTranches(kanbanId: string): boolean {
  return kanbanId === KANBAN_IDS.OPERACOES || kanbanId === KANBAN_IDS.CREDITO_OBRA;
}

function GrupoTitulo({ children }: { children: ReactNode }) {
  return (
    <p
      className="text-[9px] font-semibold uppercase tracking-wide"
      style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}
    >
      {children}
    </p>
  );
}

export function KanbanCardModalTagsPainel({
  cardId,
  kanbanId,
  basePath,
  tagsKanban,
  tagsCard,
  setTagsKanban,
  setTagsCard,
  tagsOpen,
  setTagsOpen,
  ocultarGestaoCard,
  podeCriarChamados,
  novatagsNome,
  setNovaTagNome,
  novaTagCor,
  setNovaTagCor,
  criandoTag,
  setCriandoTag,
}: Props) {
  const mostrarRodadas = ehFunilRodadas(kanbanId);
  const mostrarTranches = ehFunilTranches(kanbanId);

  const tagsKanbanRodada = ordenarTagsPorIndiceOrdinal(
    tagsKanban.filter((t) => classificarKanbanTagGrupo(t.nome) === 'rodada'),
  );
  const tagsKanbanTranche = ordenarTagsPorIndiceOrdinal(
    tagsKanban.filter((t) => classificarKanbanTagGrupo(t.nome) === 'tranche'),
  );
  const tagsKanbanEspecial = tagsKanban.filter(
    (t) => classificarKanbanTagGrupo(t.nome) === 'especial',
  );

  const tagsCardTranche = ordenarTagsPorIndiceOrdinal(
    tagsCard.filter((t) => classificarKanbanTagGrupo(t.nome) === 'tranche'),
  );

  const rodadasDisponiveis = tagsKanbanRodada.filter(
    (t) => !tagsCard.some((tc) => tc.tag_id === t.id),
  );
  const especiaisDisponiveis = tagsKanbanEspecial.filter(
    (t) => !tagsCard.some((tc) => tc.tag_id === t.id),
  );

  const temGrupoRodadas = mostrarRodadas && tagsKanbanRodada.length > 0;
  const temGrupoTranches = mostrarTranches && tagsKanbanTranche.length > 0;
  const temGrupoEspeciais = tagsKanbanEspecial.length > 0 || podeCriarChamados;

  const selecionaveisRestantes = [
    ...(temGrupoRodadas ? rodadasDisponiveis : []),
    ...(temGrupoEspeciais ? especiaisDisponiveis : []),
  ];

  function removerTagCard(t: KanbanModalTagCard) {
    if (isKanbanTagTrancheNome(t.nome)) return;
    const cardTagId = t.id;
    setTagsCard((prev) => prev.filter((x) => x.id !== cardTagId));
    void desvincularTagCard(cardTagId, basePath).then((res) => {
      if (!res.ok) {
        setTagsCard((prev) => (prev.some((x) => x.id === cardTagId) ? prev : [...prev, t]));
        alert('Erro ao remover tag: ' + res.error);
      }
    });
  }

  function adicionarTag(t: KanbanModalTagKanban) {
    if (isKanbanTagTrancheNome(t.nome)) return;
    const tempId = `temp-${t.id}`;
    setTagsCard((prev) => [...prev, { id: tempId, tag_id: t.id, nome: t.nome, cor: t.cor }]);
    setTagsOpen(false);
    void vincularTagCard(cardId, t.id, basePath).then((res) => {
      if (!res.ok) {
        setTagsCard((prev) => prev.filter((x) => x.id !== tempId));
        alert('Erro ao vincular tag: ' + res.error);
        return;
      }
      setTagsCard((prev) => prev.map((x) => (x.id === tempId ? { ...x, id: res.id } : x)));
    });
  }

  return (
    <>
      <div className="mb-1.5 flex flex-wrap gap-1">
        {tagsCard.map((t) => {
          const chip = estiloChipTagKanban(t.nome, t.cor);
          const trancheLock = isKanbanTagTrancheNome(t.nome);
          return (
            <span key={t.id} className={chip.className} style={chip.style}>
              {trancheLock ? (
                <Lock className="h-2.5 w-2.5 shrink-0 opacity-80" aria-hidden />
              ) : null}
              <span className="truncate">{t.nome}</span>
              {!ocultarGestaoCard && !trancheLock ? (
                <button
                  type="button"
                  onClick={() => removerTagCard(t)}
                  className="shrink-0 rounded-full p-0.5 text-current opacity-60 transition hover:bg-black/5 hover:opacity-100"
                  aria-label={`Remover tag ${t.nome}`}
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              ) : null}
            </span>
          );
        })}
        {tagsCard.length === 0 ? (
          <p className="text-[10px] text-stone-400">Nenhuma tag</p>
        ) : null}
      </div>

      {!ocultarGestaoCard ? (
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => setTagsOpen((v) => !v)}
            className="flex w-full items-center justify-center gap-1 rounded border border-dashed border-stone-300 bg-stone-50/80 px-2 py-1 text-[10px] font-medium text-stone-700 transition hover:border-stone-400 hover:bg-white"
          >
            <Tag className="h-3 w-3 shrink-0 text-stone-500" aria-hidden />
            {tagsOpen ? 'Fechar' : 'Adicionar tag'}
          </button>

          {tagsOpen ? (
            <div className="space-y-2 rounded border border-stone-200 bg-stone-50/50 p-1.5">
              {temGrupoRodadas ? (
                <div className="space-y-1">
                  <GrupoTitulo>Rodadas</GrupoTitulo>
                  {rodadasDisponiveis.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {rodadasDisponiveis.map((t) => {
                        const chip = estiloChipTagKanban(t.nome, t.cor);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => adicionarTag(t)}
                            className={`${chip.className} transition hover:opacity-90`}
                            style={chip.style}
                          >
                            {t.nome}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
                      Todas as rodadas já estão no card.
                    </p>
                  )}
                </div>
              ) : null}

              {temGrupoTranches ? (
                <div className="space-y-1">
                  <GrupoTitulo>Tranches</GrupoTitulo>
                  {tagsCardTranche.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {tagsCardTranche.map((t) => {
                        const chip = estiloChipTagKanban(t.nome, t.cor);
                        return (
                          <span
                            key={t.id}
                            className={`${chip.className} cursor-default opacity-90`}
                            style={chip.style}
                            title="Tranche aplicada automaticamente — não editável"
                          >
                            <Lock className="h-2.5 w-2.5 shrink-0" aria-hidden />
                            {t.nome}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
                      Nenhuma tranche ativa neste card.
                    </p>
                  )}
                </div>
              ) : null}

              {temGrupoEspeciais ? (
                <div className="space-y-1">
                  <GrupoTitulo>Especiais</GrupoTitulo>
                  {especiaisDisponiveis.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {especiaisDisponiveis.map((t) => {
                        const chip = estiloChipTagKanban(t.nome, t.cor);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => adicionarTag(t)}
                            className={`${chip.className} transition hover:opacity-90`}
                            style={chip.style}
                          >
                            {t.nome}
                          </button>
                        );
                      })}
                    </div>
                  ) : selecionaveisRestantes.length === 0 && !podeCriarChamados ? (
                    <p className="text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
                      Todas as tags do funil já estão no card.
                    </p>
                  ) : especiaisDisponiveis.length === 0 ? (
                    <p className="text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
                      Nenhuma tag especial disponível.
                    </p>
                  ) : null}

                  {podeCriarChamados ? (
                    <div className="space-y-1.5 border-t border-stone-200 pt-1.5">
                      <p className="text-[10px] font-medium text-stone-600">Nova tag (Especiais)</p>
                      <input
                        type="text"
                        value={novatagsNome}
                        onChange={(e) => setNovaTagNome(e.target.value)}
                        placeholder="Nome da tag"
                        className="w-full rounded border border-stone-300 bg-white px-2 py-1 text-[10px] focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-400"
                      />
                      <div className="flex items-center gap-1.5">
                        <label className="sr-only" htmlFor="kanban-modal-nova-tag-cor">
                          Cor da tag
                        </label>
                        <input
                          id="kanban-modal-nova-tag-cor"
                          type="color"
                          value={novaTagCor}
                          onChange={(e) => setNovaTagCor(e.target.value)}
                          className="h-7 w-7 shrink-0 cursor-pointer rounded border border-stone-200 bg-white p-0.5"
                        />
                        <button
                          type="button"
                          disabled={criandoTag || !novatagsNome.trim()}
                          onClick={() =>
                            void (async () => {
                              if (!kanbanId) return;
                              const nome = novatagsNome.trim();
                              if (/^\d+[ªº]\s*(rodada|tranche)$/i.test(nome)) {
                                alert(
                                  'Tags de rodada/tranche são gerenciadas pelo sistema. Use outro nome.',
                                );
                                return;
                              }
                              setCriandoTag(true);
                              const res = await criarTagKanban(kanbanId, nome, novaTagCor, basePath);
                              if (res.ok) {
                                const tk = await listarTagsKanban(kanbanId);
                                setTagsKanban(tk);
                                setNovaTagNome('');
                              }
                              setCriandoTag(false);
                            })()
                          }
                          className="min-w-0 flex-1 rounded px-2 py-1 text-[10px] font-semibold text-white transition disabled:opacity-50"
                          style={{ background: 'var(--moni-text-primary)' }}
                        >
                          {criandoTag ? 'Criando…' : 'Criar tag'}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {!temGrupoRodadas && !temGrupoTranches && !temGrupoEspeciais ? (
                <p className="text-[11px] text-stone-500">Nenhuma tag disponível neste funil.</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
