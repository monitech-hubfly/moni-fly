'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import {
  getPainelColumnSlaHeaderBadgeDias,
  isPainelKanbanDropBlocked,
  type PainelColumnKey,
} from './painelColumns';
import { PainelCard } from './PainelCard';
import { atualizarEtapaPainel } from './actions';
import type { ReactNode } from 'react';

export type ProcessoCard = {
  id: string;
  cidade: string;
  estado: string | null;
  status: string;
  cancelado_motivo?: string | null;
  removido_motivo?: string | null;
  cancelado_em?: string | null;
  removido_em?: string | null;
  etapa_atual: number;
  updated_at: string | null;
  franqueado_nome?: string | null;
  numero_franquia?: string | null;
  nome_condominio?: string | null;
  quadra_lote?: string | null;
  step_atual?: number;
  etapa_painel: PainelColumnKey | string;
  trava_painel?: boolean;
  /** Se = 'Permuta', a etapa Crédito Terreno é desconsiderada (card não aparece na coluna). */
  tipo_aquisicao_terreno?: string | null;
  /** Observações do formulário de abertura. */
  observacoes?: string | null;
  has_atividade_atrasada?: boolean;
  has_atividade_atencao?: boolean;
  has_comite_aprovado?: boolean;
  /** Ordem dentro da coluna `etapa_painel` (menor = mais acima). */
  ordem_coluna_painel?: number | null;
  /** Data de criação do processo (SLA como no Funil Step One: referência + dias úteis da coluna). */
  created_at?: string | null;
};

export type CardStatusFilter = 'ativos' | 'cancelados' | 'removidos' | 'concluidos' | 'todos';
export type CardTagFilter = 'todas' | 'atrasado' | 'atencao';

export function StepsKanbanColumn({
  title,
  subtitle,
  processos,
  etapaKey,
  step2HeaderActions,
  initialOpenProcessId,
  statusFilter = 'ativos',
  tagFilter = 'todas',
  kanbanReadOnly = false,
  openCardViaUrl = false,
  cardBasePath,
}: {
  title: string;
  subtitle?: string;
  processos: ProcessoCard[];
  etapaKey: PainelColumnKey;
  step2HeaderActions?: ReactNode;
  initialOpenProcessId?: string;
  statusFilter?: CardStatusFilter;
  tagFilter?: CardTagFilter;
  /** Sem sessão (ex.: painel público): esconde controles de reordenar. */
  kanbanReadOnly?: boolean;
  /** Abre detalhe via query (?card=id) em vez do CardDetalheModal embutido (ex.: Crédito). */
  openCardViaUrl?: boolean;
  /** Caminho base para `?card=` (ex.: `/painel-credito`). Obrigatório se `openCardViaUrl`. */
  cardBasePath?: string;
}) {
  const router = useRouter();

  const processosFiltrados = useMemo(() => {
    return processos.filter((p) => {
      const st = String(p.status ?? '').toLowerCase();
      const isCancelado = st === 'cancelado' || Boolean(p.cancelado_em);
      const isRemovido = st === 'removido' || Boolean(p.removido_em);
      const isConcluido = st === 'concluido';
      if (statusFilter !== 'todos') {
        const wanted = statusFilter;
        if (wanted === 'ativos' && (isCancelado || isRemovido || isConcluido)) return false;
        if (wanted === 'cancelados' && !isCancelado) return false;
        if (wanted === 'removidos' && !isRemovido) return false;
        if (wanted === 'concluidos' && !isConcluido) return false;
      }

      if (tagFilter !== 'todas') {
        // Cards cancelados/removidos/concluídos não exibem tags de prazo.
        if (isCancelado || isRemovido || isConcluido) return false;
        const hasAtrasado = Boolean(p.has_atividade_atrasada);
        const hasAtencao = Boolean(p.has_atividade_atencao) && !hasAtrasado;
        if (tagFilter === 'atrasado' && !hasAtrasado) return false;
        if (tagFilter === 'atencao' && !hasAtencao) return false;
      }

      return true;
    });
  }, [processos, statusFilter, tagFilter]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as { processoId?: string; fromEtapa?: string };
      if (!data.processoId) return;
      if (!data.fromEtapa) return;
      if (data.fromEtapa === etapaKey) return;
      const from = data.fromEtapa as PainelColumnKey;
      if (isPainelKanbanDropBlocked(from, etapaKey)) return;
      const res = await atualizarEtapaPainel(data.processoId, etapaKey);
      if (res.ok) router.refresh();
    } catch {
      // ignora drops inválidos
    }
  };

  const isStep1 = etapaKey === 'step_1';
  const isStep2 = etapaKey === 'step_2';

  /** Faixa superior das colunas: mesma cor do Funil Step One (`moni-tokens.css`). */
  const kanbanColumnTopStrip = 'var(--moni-kanban-stepone)';

  // Cores do cabeçalho da coluna (faixa superior unificada com o Funil)
  const getColumnColors = () => {
    if (etapaKey.startsWith('contabilidade_')) {
      return {
        borderTop: kanbanColumnTopStrip,
        bgHeader: 'var(--moni-navy-50)',
        textTitle: 'var(--moni-navy-800)',
        textCount: 'var(--moni-navy-600)',
      };
    }
    if (etapaKey.startsWith('credito_')) {
      return {
        borderTop: kanbanColumnTopStrip,
        bgHeader: 'var(--moni-navy-50)',
        textTitle: 'var(--moni-navy-800)',
        textCount: 'var(--moni-navy-600)',
      };
    }
    // Portfolio/Operações (padrão)
    return {
      borderTop: kanbanColumnTopStrip,
      bgHeader: 'var(--moni-navy-50)',
      textTitle: 'var(--moni-navy-800)',
      textCount: 'var(--moni-navy-600)',
    };
  };

  const colors = getColumnColors();
  const slaBadgeDias = getPainelColumnSlaHeaderBadgeDias(etapaKey);

  return (
    <div
      className="w-80 shrink-0 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm"
      style={{ borderTop: `3px solid ${colors.borderTop}` }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div
        className="border-b px-4 py-3"
        style={{ 
          background: colors.bgHeader,
          borderBottom: '0.5px solid var(--moni-border-default)'
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-semibold" style={{ color: colors.textTitle }}>{title}</h2>
          <div className="flex items-start gap-2">
            {isStep1 && (
              <div className="flex flex-col items-stretch gap-1">
                <Link
                  href="/painel-novos-negocios/novo-step-1"
                  className="shrink-0 rounded-md px-2 py-1 text-center text-[11px] font-medium text-white transition hover:opacity-90"
                  style={{ background: colors.borderTop }}
                >
                  Novo Step 1
                </Link>
              </div>
            )}
            {isStep2 && (
              <div className="flex flex-col items-stretch gap-1">
                <Link
                  href="/painel-novos-negocios/novo"
                  className="w-full whitespace-nowrap rounded-md px-2 py-1 text-center text-[11px] font-medium text-white transition hover:opacity-90"
                  style={{ background: colors.borderTop }}
                >
                  Novo Negócio
                </Link>
                {step2HeaderActions ? <div className="w-full">{step2HeaderActions}</div> : null}
              </div>
            )}
          </div>
        </div>
        {subtitle && (
          <p className="mt-1 text-[10px] leading-tight" style={{ color: colors.textCount }}>
            {subtitle}
          </p>
        )}
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className="text-xs" style={{ color: colors.textCount }}>
            {processosFiltrados.length} processo(s)
          </p>
          {slaBadgeDias ? (
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                background: 'rgba(255, 255, 255, 0.7)',
                color: colors.textTitle,
                border: '0.5px solid var(--moni-navy-200)',
              }}
            >
              SLA: {slaBadgeDias}d
            </span>
          ) : null}
        </div>
      </div>
      <div className="max-h-[70vh] space-y-2 overflow-y-auto p-3">
        {processosFiltrados.map((p, i) => (
          <PainelCard
            key={p.id}
            p={p}
            etapaKey={etapaKey}
            autoOpen={p.id === initialOpenProcessId}
            vizinhoAcimaId={i > 0 ? processosFiltrados[i - 1]?.id : undefined}
            vizinhoAbaixoId={i < processosFiltrados.length - 1 ? processosFiltrados[i + 1]?.id : undefined}
            kanbanReadOnly={kanbanReadOnly}
            openCardViaUrl={openCardViaUrl}
            cardBasePath={cardBasePath}
          />
        ))}
        {processosFiltrados.length === 0 && (
          <div className="rounded-lg border border-dashed border-stone-200 p-4 text-center text-sm text-stone-400">
            Nenhum processo
          </div>
        )}
      </div>
    </div>
  );
}
