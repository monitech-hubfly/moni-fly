'use client';

import type {
  ConversionFunnelTreeNode,
  GargaloClassificacao,
  GargaloMotivoTipo,
  GargaloScoreFase,
  PainelInsight,
  PainelRetrocessoDTO,
} from '@/lib/kanban/painel-performance-types';
import { insightSeveridade } from '@/lib/kanban/painel-dashboard-derive';

export type FunnelBarTone = 'normal' | 'sla' | 'critico' | 'conversao';

export function resolveFunnelBarTone(
  node: ConversionFunnelTreeNode,
  gargaloClassificacao: GargaloClassificacao | undefined,
  hasSlaDelay: boolean,
): FunnelBarTone {
  if (node.faseConversao) return 'conversao';
  if (gargaloClassificacao === 'critico') return 'critico';
  if (hasSlaDelay || gargaloClassificacao === 'atencao') return 'sla';
  return 'normal';
}

export function funnelBarToneColor(tone: FunnelBarTone): string {
  if (tone === 'conversao') return 'var(--moni-navy-600)';
  if (tone === 'critico') return 'var(--moni-status-overdue-border)';
  if (tone === 'sla') return 'var(--moni-gold-400)';
  return 'var(--moni-navy-400)';
}

export function FunnelVolumeBar({
  value,
  max,
  tone,
}: {
  value: number;
  max: number;
  tone: FunnelBarTone;
}) {
  const pct = max > 0 ? Math.max(value > 0 ? 4 : 0, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex min-w-[80px] flex-1 items-center gap-2">
      <div
        className="h-3 min-w-[48px] flex-1 overflow-hidden rounded-full"
        style={{ background: 'var(--moni-surface-200)' }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: funnelBarToneColor(tone) }}
        />
      </div>
    </div>
  );
}

export function gargaloScoreBarColor(score: number): string {
  if (score >= 70) return 'var(--moni-status-overdue-border)';
  if (score >= 40) return 'var(--moni-gold-400)';
  return 'var(--moni-green-800)';
}

export function GargaloScoreBar({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  return (
    <div className="flex min-w-[72px] items-center gap-2">
      <div
        className="h-2 min-w-[48px] flex-1 overflow-hidden rounded-full"
        style={{ background: 'var(--moni-surface-200)' }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${clamped}%`, background: gargaloScoreBarColor(score) }}
        />
      </div>
      <span
        className="w-6 shrink-0 text-right text-[11px] font-semibold tabular-nums"
        style={{ color: 'var(--moni-navy-800)' }}
      >
        {score}
      </span>
    </div>
  );
}

const GARGALO_MOTIVO_ICON: Partial<Record<GargaloMotivoTipo, string>> = {
  atraso: 'ti-clock-pause',
  inatividade: 'ti-zzz',
  chamados: 'ti-message-circle',
  arquivamento: 'ti-archive',
  arquivamento_sem_motivo: 'ti-archive',
  perda_conversao: 'ti-trending-down',
  volume: 'ti-stack-2',
};

export function GargaloMotivoIcon({
  tipo,
  title,
}: {
  tipo: GargaloMotivoTipo;
  title?: string;
}) {
  const icon = GARGALO_MOTIVO_ICON[tipo] ?? 'ti-info-circle';
  return (
    <i
      className={`ti ${icon} shrink-0`}
      aria-hidden={title ? undefined : true}
      title={title}
      style={{ fontSize: 16, color: 'var(--moni-text-secondary)', lineHeight: 1 }}
    />
  );
}

export function GargaloPrincipalFactor({ g }: { g: GargaloScoreFase }) {
  const label = g.principalMotivoTexto || g.principalMotivo;
  return (
    <div className="mb-2 flex items-center gap-2">
      <GargaloMotivoIcon tipo={g.principalMotivoTipo} title={label} />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function slaPctBarColor(pct: number): string {
  if (pct > 60) return 'var(--moni-green-800)';
  if (pct >= 30) return 'var(--moni-gold-400)';
  return 'var(--moni-status-overdue-border)';
}

export function SlaProgressBar({ pct }: { pct: number | null }) {
  if (pct == null || !Number.isFinite(pct)) return null;
  const fill = Math.max(0, Math.min(100, pct));
  return (
    <div
      className="mt-2 h-1.5 w-full overflow-hidden rounded-full"
      style={{ background: 'var(--moni-surface-200)' }}
      role="presentation"
      aria-hidden
    >
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${fill}%`, background: slaPctBarColor(fill) }}
      />
    </div>
  );
}

export function insightSeverityAccent(sev: ReturnType<typeof insightSeveridade>): string {
  if (sev === 'critico') return 'var(--moni-status-overdue-border)';
  if (sev === 'positivo') return 'var(--moni-status-done-border)';
  return 'var(--moni-status-attention-border)';
}

export function extractRetrocessoDiasAdicionados(
  detalhe: PainelRetrocessoDTO['detalhe'] | Record<string, unknown> | null | undefined,
): number | null {
  if (!detalhe || typeof detalhe !== 'object') return null;
  const keys = ['dias_adicionados', 'dias_ciclo_adicionados', 'dias_uteis_adicionados', 'diasAdicionados'];
  for (const key of keys) {
    const v = (detalhe as Record<string, unknown>)[key];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) return Math.round(v);
    if (typeof v === 'string' && v.trim()) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) return Math.round(n);
    }
  }
  return null;
}

export function buildRetrocessoDiasByCardId(rows: PainelRetrocessoDTO[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const dias = extractRetrocessoDiasAdicionados(r.detalhe);
    if (dias == null) continue;
    const cur = m.get(r.card_id);
    m.set(r.card_id, cur != null ? Math.max(cur, dias) : dias);
  }
  return m;
}
