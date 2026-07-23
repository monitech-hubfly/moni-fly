'use client';

import { useMemo } from 'react';
import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import type {
  PipelineCardRow,
  PipelineEsteiraCalculadoraPorGrupo,
} from '@/lib/kanban/pipeline-cards-types';
import {
  ESTEIRA_CALCULADORA_COLUNAS,
  ESTEIRA_CALCULADORA_COLUNAS_OP,
  ESTEIRA_CALCULADORA_COLUNAS_PORT,
} from '@/lib/kanban/pipeline-esteira-calculadora-colunas';
import {
  agruparCardsEsteiraCalculadora,
  chaveGrupoEsteiraCalculadora,
  resolverPackEsteiraCalculadora,
} from '@/lib/kanban/fetch-pipeline-esteira-calculadora';
import {
  computarDatasEsteiraCalculadora,
  formatDataCelulaEsteira,
  labelFaseAtualCalculadora,
  ordemGlobalFaseCalculadora,
  resolverFaseAtualCalculadora,
  segmentoBadgeFaseCalculadora,
  type CelulaEsteiraCalculadora,
} from '@/lib/kanban/pipeline-esteira-calculadora-datas';

const ESTEIRA_KANBAN_IDS = new Set<string>([KANBAN_IDS.PORTFOLIO, KANBAN_IDS.OPERACOES]);

export type PipelineEsteiraTableProps = {
  cards: PipelineCardRow[];
  esteiraCalculadora?: PipelineEsteiraCalculadoraPorGrupo;
};

function abreviarNome(nome: string | null | undefined): string {
  const parts = String(nome ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '';
  return parts.slice(0, 2).join(' ');
}

/** Nome do projeto na esteira — sem repetir o número de franquia (já exibido acima). */
function tituloProjetoEsteira(
  card: Pick<PipelineCardRow, 'titulo' | 'n_franquia' | 'projeto_titulo'>,
): string {
  const projeto = String(card.projeto_titulo ?? '').trim();
  if (projeto) return projeto;

  const titulo = String(card.titulo ?? '').trim();
  if (!titulo || titulo === '(sem título)') return '—';

  const fk = String(card.n_franquia ?? '').trim();
  if (!fk) return titulo;

  const prefixo = new RegExp(`^${fk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[-–—]\\s*`, 'i');
  const semFk = titulo.replace(prefixo, '').trim();
  return semFk || titulo;
}

function clsCelula(celula: CelulaEsteiraCalculadora, concluida: boolean): string {
  if (!celula.date) return 'none';
  if (celula.isCurrent) {
    return celula.tipo === 'at' ? 'at' : 'est';
  }
  if (concluida) return 'concluida';
  return celula.tipo === 'real' ? 'real' : celula.tipo === 'at' ? 'at' : 'est';
}

function CelulaData({
  celula,
  concluida,
}: {
  celula: CelulaEsteiraCalculadora;
  concluida: boolean;
}) {
  if (!celula.date) {
    return <span className="moni-pipeline-esteira-date-none">—</span>;
  }

  const cls = clsCelula(celula, concluida);

  return (
    <span className={`moni-pipeline-esteira-date-${cls}`}>{formatDataCelulaEsteira(celula.date)}</span>
  );
}

export function PipelineEsteiraTable({ cards, esteiraCalculadora = {} }: PipelineEsteiraTableProps) {
  const linhas = useMemo(() => {
    const grupos = agruparCardsEsteiraCalculadora(cards);

    return [...grupos.entries()]
      .map(([chave, { rep }]) => {
        const pack =
          esteiraCalculadora[chave] ?? resolverPackEsteiraCalculadora(rep, esteiraCalculadora);
        if (!pack || pack.linhas.length === 0) return null;

        const datas = computarDatasEsteiraCalculadora(pack.linhas);
        const faseAtual = resolverFaseAtualCalculadora(pack.linhas);
        const ordemAtual = ordemGlobalFaseCalculadora(pack.linhas, faseAtual);

        return {
          chave,
          card: rep,
          datas,
          faseAtual,
          ordemAtual,
          isCurAtrasado: faseAtual?.status === 'atual_atrasada',
        };
      })
      .filter((linha): linha is NonNullable<typeof linha> => linha != null)
      .sort((a, b) => {
        if (b.ordemAtual !== a.ordemAtual) return b.ordemAtual - a.ordemAtual;
        return String(a.card.titulo ?? '').localeCompare(String(b.card.titulo ?? ''), 'pt-BR');
      });
  }, [cards, esteiraCalculadora]);

  if (linhas.length === 0) {
    return (
      <p
        className="rounded-xl border border-dashed px-4 py-10 text-center text-[11px]"
        style={{ borderColor: 'var(--moni-border-default)', color: 'var(--moni-text-tertiary)' }}
      >
        Nenhum card em Portfólio ou Pré Obra e Obra com os filtros atuais.
      </p>
    );
  }

  const colPort = ESTEIRA_CALCULADORA_COLUNAS_PORT.length;
  const colOp = ESTEIRA_CALCULADORA_COLUNAS_OP.length;
  const larguraProjeto = '28%';
  const larguraFase = '68px';
  const larguraData = `calc((100% - 28% - 68px) / ${ESTEIRA_CALCULADORA_COLUNAS.length})`;

  return (
    <div className="moni-pipeline-esteira-scroll">
      <table className="moni-pipeline-esteira-table">
        <colgroup>
          <col style={{ width: larguraProjeto }} />
          <col style={{ width: larguraFase }} />
          {ESTEIRA_CALCULADORA_COLUNAS.map((col) => (
            <col key={col.slug} style={{ width: larguraData }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th colSpan={2} className="moni-pipeline-esteira-th-info">
              Projeto
            </th>
            <th colSpan={colPort} className="moni-pipeline-esteira-th-port">
              Portfólio
            </th>
            <th colSpan={colOp} className="moni-pipeline-esteira-th-op">
              Pré Obra e Obra
            </th>
          </tr>
          <tr>
            <th className="moni-pipeline-esteira-th cl">Franqueado / Projeto</th>
            <th className="moni-pipeline-esteira-th cl moni-pipeline-esteira-th-fase">Fase atual</th>
            {ESTEIRA_CALCULADORA_COLUNAS.map((col) => (
              <th key={col.slug} className="moni-pipeline-esteira-th">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map(({ chave, card, datas, faseAtual, ordemAtual, isCurAtrasado }) => {
            const segmento = segmentoBadgeFaseCalculadora(faseAtual);
            const badgeCls = isCurAtrasado ? 'atrasado' : segmento;
            const nomeAbrev = abreviarNome(card.franqueado_nome);
            const faseLabel = labelFaseAtualCalculadora(faseAtual);
            const projetoLabel = tituloProjetoEsteira(card);

            return (
              <tr key={chave} className={isCurAtrasado ? 'linha-atrasada' : ''}>
                <td className="moni-pipeline-esteira-td-info">
                  <div className="moni-pipeline-esteira-proj-linha">
                    <span className="moni-pipeline-esteira-fk">{card.n_franquia ?? '—'}</span>
                    {nomeAbrev ? (
                      <span className="moni-pipeline-esteira-frank-nome">{nomeAbrev}</span>
                    ) : null}
                  </div>
                  <div className="moni-pipeline-esteira-proj-nome" title={projetoLabel}>
                    {projetoLabel}
                  </div>
                </td>
                <td className="moni-pipeline-esteira-td-info moni-pipeline-esteira-td-fase">
                  <span className={`moni-pipeline-esteira-fase-badge ${badgeCls}`}>{faseLabel}</span>
                </td>
                {ESTEIRA_CALCULADORA_COLUNAS.map((col) => {
                  const val = datas[col.slug];
                  if (!val) {
                    return (
                      <td key={col.slug} className="moni-pipeline-esteira-dc">
                        <span className="moni-pipeline-esteira-date-none">—</span>
                      </td>
                    );
                  }

                  const celula = val as CelulaEsteiraCalculadora;
                  const curCls =
                    celula.isCurrent && celula.tipo === 'at'
                      ? ' cur-at'
                      : celula.isCurrent
                        ? ' cur'
                        : '';

                  return (
                    <td key={col.slug} className={`moni-pipeline-esteira-dc${curCls}`}>
                      <CelulaData celula={celula} concluida={ordemAtual > 0 && !celula.isCurrent} />
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

/** Filtra cards elegíveis para a esteira calculadora (export para testes). */
export function cardsElegiveisEsteiraCalculadora(cards: PipelineCardRow[]): PipelineCardRow[] {
  return cards.filter((c) => ESTEIRA_KANBAN_IDS.has(c.kanban_id));
}

/** Chave de grupo exposta para testes. */
export { chaveGrupoEsteiraCalculadora };
