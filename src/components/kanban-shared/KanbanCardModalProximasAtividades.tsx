'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { KanbanProximaAtividadeRegistro } from '@/components/kanban-shared/types';
import {
  adicionarProximaAtividadeClient,
  concluirProximaAtividadeClient,
  definirResponsavelProximaAtividadeClient,
  limparProximaAtividadeLegadoClient,
  listarProximasAtividadesRegistroClient,
} from '@/lib/kanban/proxima-atividade-client';

const LEGADO_ID = 'legado-card';

export type ProximasAtividadesResumo = {
  abertas: number;
  total: number;
  proxima_atividade?: string | null;
  prazo_atividade?: string | null;
  atualizarBoard?: boolean;
};

type ResponsavelOpcao = { id: string; nome: string };

type Props = {
  cardId: string;
  basePath: string;
  responsaveis: ResponsavelOpcao[];
  podeEditar: boolean;
  proximaAtividadeCard: string | null;
  prazoAtividadeCard: string | null;
  onVoltar: () => void;
  onResumo: (resumo: ProximasAtividadesResumo) => void;
};

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatarData(valor: string | null | undefined): string {
  if (!valor) return 'Sem data';
  const iso = String(valor).slice(0, 10);
  const [ano, mes, dia] = iso.split('-');
  if (!ano || !mes || !dia || ano.length !== 4) return 'Sem data';
  return `${dia}/${mes}/${ano}`;
}

function urgencia(prazo: string | null, hoje: string): number {
  if (prazo && prazo < hoje) return 0;
  if (prazo && prazo === hoje) return 1;
  return 2;
}

export function resumoProximasAtividades(
  items: KanbanProximaAtividadeRegistro[],
  proximaAtividade?: string | null,
): { abertas: number; total: number } {
  const abertasTabela = items.filter((item) => !item.concluidoEm).length;
  if (abertasTabela > 0) return { abertas: abertasTabela, total: items.length };
  const desc = String(proximaAtividade ?? '').trim();
  const legado = desc ? 1 : 0;
  return { abertas: legado, total: items.length + legado };
}

function tagDaAtividade(item: KanbanProximaAtividadeRegistro, hoje: string): { classe: string; rotulo: string } {
  if (item.concluidoEm) return { classe: 'moni-tag-concluido', rotulo: 'Concluída' };
  if (item.prazo && item.prazo < hoje) return { classe: 'moni-tag-atrasado', rotulo: 'Atrasada' };
  if (item.prazo && item.prazo === hoje) return { classe: 'moni-tag-atencao', rotulo: 'Vence hoje' };
  if (!item.prazo) return { classe: 'moni-tag-arquivado', rotulo: 'A fazer · sem prazo' };
  return { classe: 'moni-tag-arquivado', rotulo: 'A fazer' };
}

function incluirLegado(
  items: KanbanProximaAtividadeRegistro[],
  descricaoCard: string | null,
  prazoCard: string | null,
): KanbanProximaAtividadeRegistro[] {
  const desc = String(descricaoCard ?? '').trim();
  if (!desc || items.some((item) => !item.concluidoEm)) return items;
  return [
    {
      id: LEGADO_ID,
      descricao: desc,
      prazo: prazoCard,
      responsavelId: null,
      responsavelNome: null,
      criadoEm: null,
      criadoPorNome: null,
      concluidoEm: null,
      concluidoPorNome: null,
    },
    ...items,
  ];
}

export function KanbanCardModalProximasAtividades({
  cardId,
  basePath,
  responsaveis,
  podeEditar,
  proximaAtividadeCard,
  prazoAtividadeCard,
  onVoltar,
  onResumo,
}: Props) {
  const [itens, setItens] = useState<KanbanProximaAtividadeRegistro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [descricao, setDescricao] = useState('');
  const [prazo, setPrazo] = useState('');
  const [responsavelId, setResponsavelId] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [acaoId, setAcaoId] = useState<string | null>(null);
  const onResumoRef = useRef(onResumo);
  onResumoRef.current = onResumo;

  const publicar = useCallback(
    (
      lista: KanbanProximaAtividadeRegistro[],
      extra?: Pick<ProximasAtividadesResumo, 'proxima_atividade' | 'prazo_atividade' | 'atualizarBoard'>,
    ) => {
      const textoCard =
        extra && Object.prototype.hasOwnProperty.call(extra, 'proxima_atividade')
          ? extra.proxima_atividade
          : proximaAtividadeCard;
      const resumo = resumoProximasAtividades(lista, textoCard);
      onResumoRef.current({ ...resumo, ...extra });
    },
    [proximaAtividadeCard],
  );

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    const res = await listarProximasAtividadesRegistroClient(cardId);
    setCarregando(false);
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    setItens(res.items);
    publicar(res.items);
  }, [cardId, publicar]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const hoje = hojeIso();
  const visiveis = useMemo(
    () => incluirLegado(itens, proximaAtividadeCard, prazoAtividadeCard),
    [itens, prazoAtividadeCard, proximaAtividadeCard],
  );
  const aFazer = useMemo(
    () =>
      visiveis
        .filter((item) => !item.concluidoEm)
        .sort((a, b) => {
          const diff = urgencia(a.prazo, hoje) - urgencia(b.prazo, hoje);
          if (diff !== 0) return diff;
          return String(a.prazo ?? '9999').localeCompare(String(b.prazo ?? '9999'));
        }),
    [hoje, visiveis],
  );
  const concluidas = useMemo(
    () =>
      visiveis
        .filter((item) => Boolean(item.concluidoEm))
        .sort((a, b) => String(b.concluidoEm).localeCompare(String(a.concluidoEm))),
    [visiveis],
  );

  async function adicionar() {
    const texto = descricao.trim();
    if (!texto || salvando) return;
    setSalvando(true);
    setErro(null);
    const res = await adicionarProximaAtividadeClient({
      cardId,
      descricao: texto,
      prazo: prazo.trim() || null,
      responsavelId: responsavelId.trim() || null,
      basePath,
    });
    setSalvando(false);
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    setDescricao('');
    setPrazo('');
    setResponsavelId('');
    const lista = await listarProximasAtividadesRegistroClient(cardId);
    if (!lista.ok) {
      setErro(lista.error);
      return;
    }
    setItens(lista.items);
    publicar(lista.items, {
      proxima_atividade: res.proxima_atividade,
      prazo_atividade: res.prazo_atividade,
      atualizarBoard: true,
    });
  }

  async function concluir(item: KanbanProximaAtividadeRegistro) {
    if (!podeEditar || acaoId) return;
    setAcaoId(item.id);
    setErro(null);
    const res =
      item.id === LEGADO_ID
        ? await limparProximaAtividadeLegadoClient({ cardId, basePath })
        : await concluirProximaAtividadeClient({ itemId: item.id, cardId, basePath });
    setAcaoId(null);
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    const lista = await listarProximasAtividadesRegistroClient(cardId);
    if (!lista.ok) {
      setErro(lista.error);
      return;
    }
    setItens(lista.items);
    publicar(lista.items, {
      proxima_atividade: res.proxima_atividade ?? null,
      prazo_atividade: res.prazo_atividade ?? null,
      atualizarBoard: true,
    });
  }

  async function definirResponsavel(item: KanbanProximaAtividadeRegistro, novoId: string) {
    if (!podeEditar || item.id === LEGADO_ID || acaoId) return;
    setAcaoId(item.id);
    setErro(null);
    const res = await definirResponsavelProximaAtividadeClient({
      cardId,
      itemId: item.id,
      responsavelId: novoId.trim() || null,
    });
    setAcaoId(null);
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    const nome = responsaveis.find((op) => op.id === novoId)?.nome ?? null;
    setItens((prev) =>
      prev.map((row) =>
        row.id === item.id
          ? { ...row, responsavelId: novoId.trim() || null, responsavelNome: nome }
          : row,
      ),
    );
  }

  function renderItem(item: KanbanProximaAtividadeRegistro, primeira: boolean) {
    const tag = tagDaAtividade(item, hoje);
    const ocupado = acaoId === item.id;
    const legado = item.id === LEGADO_ID;
    return (
      <li
        key={item.id}
        className="px-3 py-3"
        style={{
          borderTop: primeira ? 'none' : '0.5px solid var(--moni-border-default)',
          background: 'var(--moni-surface-0)',
        }}
      >
        <div className="flex items-start gap-2">
          {podeEditar && !item.concluidoEm ? (
            <button
              type="button"
              onClick={() => void concluir(item)}
              disabled={ocupado}
              aria-label={`Concluir: ${item.descricao}`}
              className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center"
              style={{
                border: '0.5px solid var(--moni-border-default)',
                borderRadius: 'var(--moni-radius-md)',
                color: 'var(--moni-text-primary)',
              }}
            >
              <span
                className="block h-3.5 w-3.5"
                style={{
                  border: '0.5px solid var(--moni-navy-800)',
                  borderRadius: 'var(--moni-radius-sm, 4px)',
                }}
              />
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className={tag.classe}>{tag.rotulo}</span>
              <span className="text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
                Prazo {formatarData(item.prazo)}
              </span>
            </div>
            <p className="text-sm leading-snug" style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' }}>
              {item.descricao}
            </p>
            <div className="mt-2">
              {podeEditar && !legado ? (
                <label className="block text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
                  Responsável
                  <select
                    value={item.responsavelId ?? ''}
                    disabled={ocupado}
                    onChange={(e) => void definirResponsavel(item, e.target.value)}
                    className="mt-1 w-full min-h-11 px-2 text-xs"
                    style={{
                      border: '0.5px solid var(--moni-border-default)',
                      borderRadius: 'var(--moni-radius-md)',
                      background: 'var(--moni-surface-0)',
                      color: 'var(--moni-text-primary)',
                      fontFamily: 'var(--moni-font-sans)',
                    }}
                  >
                    <option value="">Sem responsável</option>
                    {item.responsavelId && !responsaveis.some((op) => op.id === item.responsavelId) ? (
                      <option value={item.responsavelId}>{item.responsavelNome || 'Responsável atual'}</option>
                    ) : null}
                    {responsaveis.map((op) => (
                      <option key={op.id} value={op.id}>
                        {op.nome}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="text-[11px]" style={{ color: 'var(--moni-text-secondary)' }}>
                  Responsável: {item.responsavelNome || 'Sem responsável'}
                  {legado ? ' · registrada só no card, ainda sem linha na lista' : ''}
                </p>
              )}
            </div>
            {item.criadoEm ? (
              <p className="mt-1 text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
                Registrada em {formatarData(item.criadoEm)}
                {item.criadoPorNome ? ` por ${item.criadoPorNome}` : ''}
              </p>
            ) : null}
            {item.concluidoEm ? (
              <p className="mt-0.5 text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
                Concluída em {formatarData(item.concluidoEm)}
                {item.concluidoPorNome ? ` por ${item.concluidoPorNome}` : ''}
              </p>
            ) : null}
          </div>
        </div>
      </li>
    );
  }

  const campoStyle = {
    border: '0.5px solid var(--moni-border-default)',
    borderRadius: 'var(--moni-radius-md)',
    background: 'var(--moni-surface-0)',
    color: 'var(--moni-text-primary)',
    fontFamily: 'var(--moni-font-sans)',
  } as const;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <button
        type="button"
        onClick={onVoltar}
        className="mb-4 inline-flex min-h-11 w-fit items-center gap-1.5 px-3 text-xs font-semibold"
        style={{
          border: '0.5px solid var(--moni-border-default)',
          borderRadius: 'var(--moni-radius-md)',
          background: 'var(--moni-surface-0)',
          color: 'var(--moni-text-primary)',
        }}
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        Voltar
      </button>

      <h4 className="mb-1 text-sm font-semibold" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
        Próximas atividades
        {visiveis.length > 0 ? (
          <span className="ml-2 text-xs font-normal" style={{ color: 'var(--moni-text-tertiary)' }}>
            ({visiveis.length} registrada{visiveis.length === 1 ? '' : 's'}
            {aFazer.length > 0 ? ` · ${aFazer.length} a fazer` : ''})
          </span>
        ) : null}
      </h4>
      <p className="mb-4 text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
        Todas as atividades deste card, a fazer e já concluídas, com prazo e responsável.
      </p>

      {erro ? (
        <div
          className="mb-3 px-3 py-2.5 text-xs"
          style={{
            border: '0.5px solid var(--moni-status-overdue-border)',
            borderRadius: 'var(--moni-radius-md)',
            background: 'var(--moni-status-overdue-bg)',
            color: 'var(--moni-status-overdue-text)',
          }}
          role="alert"
        >
          <p>{erro}</p>
          <button
            type="button"
            onClick={() => void carregar()}
            className="mt-2 min-h-11 px-3 text-[11px] font-semibold"
            style={{
              border: '0.5px solid var(--moni-border-default)',
              borderRadius: 'var(--moni-radius-md)',
              background: 'var(--moni-surface-0)',
              color: 'var(--moni-text-primary)',
            }}
          >
            Tentar novamente
          </button>
        </div>
      ) : null}

      {podeEditar ? (
        <form
          className="mb-4 grid gap-2 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void adicionar();
          }}
        >
          <label className="block text-[11px] sm:col-span-2" style={{ color: 'var(--moni-text-tertiary)' }}>
            Atividade
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="O que precisa ser feito"
              className="mt-1 w-full min-h-11 px-2 text-xs"
              style={campoStyle}
            />
          </label>
          <label className="block text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
            Prazo
            <input
              type="date"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
              className="mt-1 w-full min-h-11 px-2 text-xs"
              style={campoStyle}
            />
          </label>
          <label className="block text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
            Responsável
            <select
              value={responsavelId}
              onChange={(e) => setResponsavelId(e.target.value)}
              className="mt-1 w-full min-h-11 px-2 text-xs"
              style={campoStyle}
            >
              <option value="">Sem responsável</option>
              {responsaveis.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.nome}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={salvando || !descricao.trim()}
              className="min-h-11 px-4 text-xs font-semibold disabled:opacity-50"
              style={{
                borderRadius: 'var(--moni-radius-md)',
                background: 'var(--moni-navy-800)',
                color: 'var(--moni-text-inverse)',
                fontFamily: 'var(--moni-font-sans)',
              }}
            >
              {salvando ? 'Salvando…' : 'Registrar atividade'}
            </button>
          </div>
        </form>
      ) : null}

      {carregando ? (
        <p className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
          Carregando atividades…
        </p>
      ) : visiveis.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
          Nenhuma próxima atividade registrada neste card.
        </p>
      ) : (
        <div className="space-y-4">
          <section>
            <h5 className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
              A fazer
            </h5>
            {aFazer.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                Nenhuma atividade em aberto.
              </p>
            ) : (
              <ul
                className="overflow-hidden"
                style={{
                  border: '0.5px solid var(--moni-border-default)',
                  borderRadius: 'var(--moni-radius-lg)',
                }}
              >
                {aFazer.map((item, index) => renderItem(item, index === 0))}
              </ul>
            )}
          </section>
          <section>
            <h5 className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
              Já registradas
            </h5>
            {concluidas.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                Nenhuma atividade concluída ainda.
              </p>
            ) : (
              <ul
                className="overflow-hidden"
                style={{
                  border: '0.5px solid var(--moni-border-default)',
                  borderRadius: 'var(--moni-radius-lg)',
                }}
              >
                {concluidas.map((item, index) => renderItem(item, index === 0))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
