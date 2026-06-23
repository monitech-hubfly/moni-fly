'use client';

import { useMemo } from 'react';
import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import type { PipelineCardRow, PipelineEsteiraHistoricoPorCard } from '@/lib/kanban/pipeline-cards-types';
import {
  ESTEIRA_COLUNAS,
  computarDatasEsteira,
  extrairHistoricoDeSaida,
  parseEnteredFaseAtEsteira,
  resolverColunaEsteira,
} from '@/lib/kanban/pipeline-esteira-datas';

const ESTEIRA_KANBAN_IDS = [KANBAN_IDS.STEP_ONE, KANBAN_IDS.PORTFOLIO, KANBAN_IDS.OPERACOES] as const;

export type PipelineEsteiraTableProps = {
  cards: PipelineCardRow[];
  historico: PipelineEsteiraHistoricoPorCard;
};

function abreviarNome(nome: string | null | undefined): string {
  const parts = String(nome ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '';
  return parts.slice(0, 2).join(' ');
}

function formatDataCelula(date: Date): string {
  return date
    .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    .replace(/\./g, '');
}

function badgeSegmentoEsteira(ordemGlobal: number): 'step' | 'port' | 'op' {
  if (ordemGlobal >= 11) return 'op';
  if (ordemGlobal >= 4) return 'port';
  return 'step';
}

export function PipelineEsteiraTable({ cards, historico }: PipelineEsteiraTableProps) {
  const linhas = useMemo(() => {
    return cards
      .filter((card) => (ESTEIRA_KANBAN_IDS as readonly string[]).includes(card.kanban_id))
      .map((card) => {
        const faseCol = resolverColunaEsteira(card);
        if (!faseCol) return null;

        const hist = extrairHistoricoDeSaida(historico[card.id] ?? []);
        const datas = computarDatasEsteira(
          {
            faseId: card.fase_id,
            faseSlug: card.fase_slug,
            enteredFaseAt: parseEnteredFaseAtEsteira(card.entered_fase_at, card.created_at),
            slaAtual: card.fase_sla_dias,
            slaAtualTipo: card.fase_sla_tipo,
          },
          hist,
          faseCol.ordemGlobal,
        );

        return { card, faseCol, datas };
      })
      .filter((linha): linha is NonNullable<typeof linha> => linha != null)
      .sort((a, b) => {
        if (b.faseCol.ordemGlobal !== a.faseCol.ordemGlobal) {
          return b.faseCol.ordemGlobal - a.faseCol.ordemGlobal;
        }
        const aEnt = parseEnteredFaseAtEsteira(a.card.entered_fase_at, a.card.created_at).getTime();
        const bEnt = parseEnteredFaseAtEsteira(b.card.entered_fase_at, b.card.created_at).getTime();
        return aEnt - bEnt;
      });
  }, [cards, historico]);

  if (linhas.length === 0) {
    return (
      <p
        className="rounded-xl border border-dashed px-4 py-10 text-center text-[11px]"
        style={{ borderColor: 'var(--moni-border-default)', color: 'var(--moni-text-tertiary)' }}
      >
        Nenhum card nas fases-chave da esteira com os filtros atuais.
      </p>
    );
  }

  return (
    <div className="moni-pipeline-esteira-scroll">
      <table className="moni-pipeline-esteira-table">
        <thead>
          <tr>
            <th colSpan={2} className="moni-pipeline-esteira-th-info">
              Projeto
            </th>
            <th colSpan={3} className="moni-pipeline-esteira-th-step">
              Step One
            </th>
            <th colSpan={7} className="moni-pipeline-esteira-th-port">
              Portfólio
            </th>
            <th colSpan={4} className="moni-pipeline-esteira-th-op">
              Pré Obra e Obra
            </th>
          </tr>
          <tr>
            <th className="moni-pipeline-esteira-th cl">Franqueado / Projeto</th>
            <th className="moni-pipeline-esteira-th cl">Fase atual</th>
            {ESTEIRA_COLUNAS.map((col) => (
              <th key={col.slug} className="moni-pipeline-esteira-th">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map(({ card, faseCol, datas }) => {
            const isCurAtrasado = Object.values(datas).some((d) => d.isCurrent && d.tipo === 'at');
            const segmento = badgeSegmentoEsteira(faseCol.ordemGlobal);
            const badgeCls = isCurAtrasado ? 'atrasado' : segmento;
            const nomeAbrev = abreviarNome(card.franqueado_nome);

            return (
              <tr key={card.id}>
                <td className="moni-pipeline-esteira-td-info">
                  <div className="moni-pipeline-esteira-proj-linha">
                    <span className="moni-pipeline-esteira-fk">{card.n_franquia ?? '—'}</span>
                    {nomeAbrev ? <span className="moni-pipeline-esteira-frank-nome">{nomeAbrev}</span> : null}
                  </div>
                  <div className="moni-pipeline-esteira-proj-nome" title={card.titulo}>
                    {card.titulo}
                  </div>
                </td>
                <td className="moni-pipeline-esteira-td-info">
                  <span className={`moni-pipeline-esteira-fase-badge ${badgeCls}`}>{faseCol.label}</span>
                </td>
                {ESTEIRA_COLUNAS.map((col) => {
                  const celula = datas[col.slug];
                  if (!celula?.date) {
                    return (
                      <td key={col.slug} className="moni-pipeline-esteira-dc">
                        <span className="moni-pipeline-esteira-date-none">—</span>
                      </td>
                    );
                  }

                  const dateStr = formatDataCelula(celula.date);
                  const isConcluida = col.ordemGlobal < faseCol.ordemGlobal;
                  const cls = celula.isCurrent
                    ? celula.tipo === 'at'
                      ? 'at'
                      : 'est'
                    : isConcluida
                      ? 'concluida'
                      : celula.tipo === 'real'
                        ? 'real'
                        : celula.tipo === 'at'
                          ? 'at'
                          : 'est';
                  const curCls =
                    celula.isCurrent && celula.tipo === 'at'
                      ? ' cur-at'
                      : celula.isCurrent
                        ? ' cur'
                        : '';

                  return (
                    <td key={col.slug} className={`moni-pipeline-esteira-dc${curCls}`}>
                      <span className={`moni-pipeline-esteira-date-${cls}`}>{dateStr}</span>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
