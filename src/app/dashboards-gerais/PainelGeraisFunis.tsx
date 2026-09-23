'use client';

import { useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// DADOS MOCK — substituir por queries Supabase em sprint futura
// ─────────────────────────────────────────────────────────────────────────────

const FUNIS = [
  { nome: 'Step One',        grupo: 'Novos Negócios', cards: 85, slaOk: 22, slaVencido: 63, slaHoje: 0, score: 18, nivel: 'critico', slaOkPct: 26, ppEmDia: 67, chamResolvidos: 70 },
  { nome: 'Portfólio',       grupo: 'Novos Negócios', cards: 52, slaOk: 19, slaVencido: 33, slaHoje: 0, score: 32, nivel: 'critico', slaOkPct: 37, ppEmDia: 69, chamResolvidos: 80 },
  { nome: 'Funding',         grupo: 'Moní Capital',   cards: 34, slaOk:  7, slaVencido: 26, slaHoje: 1, score: 35, nivel: 'critico', slaOkPct: 24, ppEmDia: 50, chamResolvidos: 85 },
  { nome: 'Loteadores',      grupo: 'Novos Negócios', cards: 28, slaOk: 13, slaVencido: 15, slaHoje: 0, score: 42, nivel: 'atencao', slaOkPct: 46, ppEmDia: 48, chamResolvidos: 90 },
  { nome: 'Crédito Obra',    grupo: 'Moní Capital',   cards: 22, slaOk: 10, slaVencido: 12, slaHoje: 0, score: 55, nivel: 'atencao', slaOkPct: 45, ppEmDia: 50, chamResolvidos: 75 },
  { nome: 'Contabilidade',   grupo: 'Operações',      cards: 14, slaOk:  8, slaVencido:  6, slaHoje: 0, score: 62, nivel: 'atencao', slaOkPct: 57, ppEmDia: 79, chamResolvidos: 90 },
  { nome: 'Proj. Locais',    grupo: 'Operações',      cards: 12, slaOk:  8, slaVencido:  4, slaHoje: 0, score: 68, nivel: 'atencao', slaOkPct: 67, ppEmDia: 83, chamResolvidos: 50 },
  { nome: 'Pré Obra e Obra', grupo: 'Operações',      cards: 18, slaOk: 16, slaVencido:  2, slaHoje: 0, score: 75, nivel: 'ok',      slaOkPct: 89, ppEmDia: 94, chamResolvidos: 40 },
  { nome: 'Divify',          grupo: 'Moní Capital',   cards:  8, slaOk:  7, slaVencido:  1, slaHoje: 0, score: 88, nivel: 'ok',      slaOkPct: 88, ppEmDia: 100, chamResolvidos: 100 },
];

const FASES = [
  { fase: 'Dados dos Condomínios', funil: 'Step One',      area: 'Novos Negócios', score: 91, nivel: 'critico', cards: 27, atrasados: 27, parados: 18, chamAtivos:  4, chamAcum: 12, ganhos:  3, arquivados:  8, retornoFase: 5, tempoMedio: 35, slaDias: 14, pctSlaVencido: 100, responsaveis: 'Marcos R., Lucas T., +4', avgPP: 5.2 },
  { fase: 'Step 4 — Acoplamento',  funil: 'Portfólio',     area: 'Novos Negócios', score: 85, nivel: 'critico', cards: 18, atrasados: 18, parados: 14, chamAtivos:  2, chamAcum:  9, ganhos:  4, arquivados:  6, retornoFase: 4, tempoMedio: 39, slaDias: 30, pctSlaVencido: 100, responsaveis: 'Carlos M., Ana S., +2',   avgPP: 4.8 },
  { fase: 'Qualificação',          funil: 'Funding',        area: 'Moní Capital',   score: 79, nivel: 'critico', cards: 14, atrasados: 14, parados:  9, chamAtivos:  2, chamAcum:  7, ganhos:  3, arquivados:  5, retornoFase: 2, tempoMedio: 47, slaDias: 30, pctSlaVencido: 100, responsaveis: 'Pedro L., +3',             avgPP: 4.2 },
  { fase: 'Diligência',            funil: 'Loteadores',     area: 'Novos Negócios', score: 73, nivel: 'critico', cards:  9, atrasados:  9, parados:  5, chamAtivos:  1, chamAcum:  5, ganhos:  1, arquivados:  4, retornoFase: 3, tempoMedio: 50, slaDias: 45, pctSlaVencido: 100, responsaveis: 'Ana S., +1',               avgPP: 6.1 },
  { fase: 'Em Obra',               funil: 'Pré Obra',       area: 'Operações',      score: 62, nivel: 'atencao', cards: 18, atrasados:  2, parados:  3, chamAtivos:  7, chamAcum: 19, ganhos:  8, arquivados:  2, retornoFase: 1, tempoMedio: 60, slaDias: 180, pctSlaVencido: 11,  responsaveis: 'Fernanda P., +5',          avgPP: 2.1 },
  { fase: 'Lotes Disponíveis',     funil: 'Step One',       area: 'Novos Negócios', score: 58, nivel: 'atencao', cards: 12, atrasados: 10, parados:  6, chamAtivos:  1, chamAcum:  4, ganhos:  5, arquivados:  6, retornoFase: 2, tempoMedio: 18, slaDias: 14,  pctSlaVencido: 83,  responsaveis: 'Lucas T., Marcos R.',      avgPP: 3.9 },
  { fase: 'Mapa Competidores',     funil: 'Step One',       area: 'Novos Negócios', score: 52, nivel: 'atencao', cards:  8, atrasados:  6, parados:  3, chamAtivos:  0, chamAcum:  2, ganhos:  3, arquivados:  2, retornoFase: 1, tempoMedio: 14, slaDias: 14,  pctSlaVencido: 75,  responsaveis: 'Lucas T., +2',             avgPP: 2.8 },
  { fase: 'Step 6 — Jurídico',     funil: 'Portfólio',      area: 'Novos Negócios', score: 48, nivel: 'atencao', cards:  7, atrasados:  7, parados:  4, chamAtivos:  0, chamAcum:  3, ganhos:  2, arquivados:  3, retornoFase: 1, tempoMedio: 27, slaDias: 21,  pctSlaVencido: 100, responsaveis: 'Ingrid B.',               avgPP: 3.3 },
  { fase: 'Doc. / Alvará',         funil: 'Crédito Obra',   area: 'Moní Capital',   score: 41, nivel: 'atencao', cards:  7, atrasados:  0, parados:  2, chamAtivos:  3, chamAcum:  8, ganhos:  3, arquivados:  1, retornoFase: 0, tempoMedio: 31, slaDias:  0,  pctSlaVencido:  0,  responsaveis: 'Fernanda P., +1',           avgPP: 1.8 },
  { fase: 'Contabilidade SPE',     funil: 'Contabilidade',  area: 'Operações',      score: 32, nivel: 'ok',      cards:  5, atrasados:  4, parados:  2, chamAtivos:  1, chamAcum:  3, ganhos:  4, arquivados:  1, retornoFase: 1, tempoMedio: 19, slaDias: 21,  pctSlaVencido: 80,  responsaveis: 'Ingrid B., +1',            avgPP: 2.5 },
  { fase: 'Aprovação Prefeitura',  funil: 'Proj. Locais',   area: 'Operações',      score: 28, nivel: 'ok',      cards:  4, atrasados:  4, parados:  2, chamAtivos:  8, chamAcum: 14, ganhos:  5, arquivados:  0, retornoFase: 0, tempoMedio: 22, slaDias: 21,  pctSlaVencido: 100, responsaveis: 'Fernanda P., +1',           avgPP: 1.9 },
];

const CHAMADOS_FUNIL = [
  { funil: 'Proj. Locais', chamados: 13 },
  { funil: 'Pré Obra',     chamados: 13 },
  { funil: 'Step One',     chamados:  8 },
  { funil: 'Portfólio',    chamados:  5 },
  { funil: 'Crédito Obra', chamados:  4 },
  { funil: 'Funding',      chamados:  3 },
  { funil: 'Loteadores',   chamados:  2 },
];
const CHAMADOS_FASE = [
  { fase: 'Aprovação Prefeitura', funil: 'Proj. Locais', chamados: 8 },
  { fase: 'Em Obra',              funil: 'Pré Obra',      chamados: 7 },
  { fase: 'Dados dos Condom.',    funil: 'Step One',      chamados: 4 },
  { fase: 'Doc. / Alvará',        funil: 'Crédito Obra',  chamados: 3 },
  { fase: 'Step 4 — Acoplam.',    funil: 'Portfólio',     chamados: 2 },
  { fase: 'Qualificação',         funil: 'Funding',       chamados: 2 },
];

const PP_TEMPO_FUNIL = [
  { funil: 'Funding',       avgDias: 4.2, ppAtrasados:  8 },
  { funil: 'Loteadores',    avgDias: 3.8, ppAtrasados: 11 },
  { funil: 'Portfólio',     avgDias: 2.9, ppAtrasados:  9 },
  { funil: 'Step One',      avgDias: 2.1, ppAtrasados: 14 },
  { funil: 'Crédito Obra',  avgDias: 1.8, ppAtrasados:  6 },
  { funil: 'Contabilidade', avgDias: 1.4, ppAtrasados:  3 },
  { funil: 'Proj. Locais',  avgDias: 1.2, ppAtrasados:  2 },
];
const PP_FASES = [
  { fase: 'Diligência',           funil: 'Loteadores',   avgAtraso: 38, total:  9, semPP: 4 },
  { fase: 'Step 4 — Acoplamento', funil: 'Portfólio',    avgAtraso: 31, total: 18, semPP: 6 },
  { fase: 'Qualificação',         funil: 'Funding',      avgAtraso: 28, total: 14, semPP: 5 },
  { fase: 'Dados dos Condom.',    funil: 'Step One',     avgAtraso: 22, total: 27, semPP: 9 },
  { fase: 'Step 6 — Jurídico',    funil: 'Portfólio',    avgAtraso: 20, total:  7, semPP: 2 },
  { fase: 'Doc. / Alvará',        funil: 'Crédito Obra', avgAtraso: 18, total:  7, semPP: 1 },
  { fase: 'Lotes Disponíveis',    funil: 'Step One',     avgAtraso: 14, total: 12, semPP: 4 },
];

const PIPELINE_REDE = [
  { fase: 'Hipóteses',     funil: 'Step One',  cards: 85, atrasados: 63, slaOk: 22, taxaConv: 61 },
  { fase: 'Opção',         funil: 'Portfólio', cards: 52, atrasados: 33, slaOk: 19, taxaConv: 35 },
  { fase: 'Comitê',        funil: 'Portfólio', cards: 18, atrasados: 10, slaOk:  8, taxaConv: 78 },
  { fase: 'Contrato',      funil: 'Portfólio', cards: 14, atrasados:  6, slaOk:  8, taxaConv: 86 },
  { fase: 'Pass. Wayser',  funil: 'Portfólio', cards: 12, atrasados:  4, slaOk:  8, taxaConv: 83 },
  { fase: 'Planialt.',     funil: 'Operações', cards: 10, atrasados:  3, slaOk:  7, taxaConv: 80 },
  { fase: 'Aguard. Créd.', funil: 'Operações', cards:  8, atrasados:  2, slaOk:  6, taxaConv: 75 },
  { fase: 'Em Obra',       funil: 'Pré Obra',  cards: 18, atrasados:  2, slaOk: 16, taxaConv: 17 },
  { fase: 'Entregue',      funil: 'Pré Obra',  cards:  3, atrasados:  0, slaOk:  3, taxaConv:  0 },
];
const PIPELINE_LOTEADORES = [
  { fase: '1º Contato',  funil: 'Loteadores', cards: 6, atrasados: 2, slaOk: 4, taxaConv: 67 },
  { fase: 'Reunião R1',  funil: 'Loteadores', cards: 5, atrasados: 2, slaOk: 3, taxaConv: 60 },
  { fase: 'NDA',         funil: 'Loteadores', cards: 4, atrasados: 2, slaOk: 2, taxaConv: 75 },
  { fase: 'Opção',       funil: 'Loteadores', cards: 4, atrasados: 2, slaOk: 2, taxaConv: 75 },
  { fase: 'Viabilidade', funil: 'Loteadores', cards: 3, atrasados: 1, slaOk: 2, taxaConv: 67 },
  { fase: 'Comitê',      funil: 'Loteadores', cards: 2, atrasados: 1, slaOk: 1, taxaConv: 50 },
  { fase: 'Contrato',    funil: 'Loteadores', cards: 2, atrasados: 1, slaOk: 1, taxaConv: 100 },
  { fase: 'Assinado',    funil: 'Loteadores', cards: 2, atrasados: 0, slaOk: 2, taxaConv: 0 },
];

const CONVERSAO = [
  { transicao: 'Loteadores → Contrato',  taxa: 22, convertidos:  6, total: 28, perda: 22 },
  { transicao: 'Funding → Contrato',     taxa: 29, convertidos: 10, total: 34, perda: 24 },
  { transicao: 'Portfólio → Operações',  taxa: 35, convertidos: 18, total: 52, perda: 34 },
  { transicao: 'Step One → Portfólio',   taxa: 61, convertidos: 52, total: 85, perda: 33 },
  { transicao: 'Acoplamento → Aprovado', taxa: 80, convertidos: 12, total: 15, perda:  3 },
];
const RESPONSAVEIS_GARGALO = [
  { nome: 'Pedro L.',    cargo: 'Consultor',  cards: 12, slaVencido:  9, ppAtrasados: 6, chamados: 2, score: 82 },
  { nome: 'Marcos R.',   cargo: 'Franqueado', cards: 15, slaVencido: 11, ppAtrasados: 7, chamados: 1, score: 75 },
  { nome: 'Lucas T.',    cargo: 'Franqueado', cards: 14, slaVencido: 10, ppAtrasados: 5, chamados: 3, score: 71 },
  { nome: 'Ana S.',      cargo: 'Consultora', cards:  9, slaVencido:  7, ppAtrasados: 5, chamados: 1, score: 68 },
  { nome: 'Carlos M.',   cargo: 'Consultor',  cards:  8, slaVencido:  6, ppAtrasados: 3, chamados: 2, score: 62 },
  { nome: 'Ingrid B.',   cargo: 'Consultora', cards:  7, slaVencido:  5, ppAtrasados: 3, chamados: 0, score: 55 },
  { nome: 'Fernanda P.', cargo: 'Consultora', cards:  5, slaVencido:  3, ppAtrasados: 2, chamados: 1, score: 42 },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS DE ESTILO
// ─────────────────────────────────────────────────────────────────────────────

type Nivel = 'critico' | 'atencao' | 'ok';

function nivelLabel(n: string) {
  return n === 'critico' ? 'Crítico' : n === 'atencao' ? 'Atenção' : 'OK';
}

function nivelBadgeClass(n: string) {
  if (n === 'critico') return 'badge-danger';
  if (n === 'atencao') return 'badge-warning';
  return 'badge-ok';
}

function nivelRowBg(n: string) {
  if (n === 'critico') return 'bg-red-50/40';
  if (n === 'atencao') return 'bg-yellow-50/40';
  return '';
}

function slaRowBg(vencidoFrac: number) {
  if (vencidoFrac > 0.5) return 'bg-red-50/40';
  if (vencidoFrac > 0.2) return 'bg-yellow-50/40';
  return '';
}

// Barra de progresso inline
function MiniBar({
  value, total, color, minWidth = 80,
}: {
  value: number; total: number; color: string; minWidth?: number;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div
      className="rounded-full overflow-hidden"
      style={{ height: 6, background: 'var(--moni-surface-200)', minWidth }}
    >
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

// Barra segmentada (SLA ok / hoje / vencido)
function SlaBar({
  ok, hoje, vencido, total, minWidth = 120,
}: {
  ok: number; hoje: number; vencido: number; total: number; minWidth?: number;
}) {
  const pOk     = total > 0 ? (ok     / total) * 100 : 0;
  const pHoje   = total > 0 ? (hoje   / total) * 100 : 0;
  const pVenc   = total > 0 ? (vencido / total) * 100 : 0;
  return (
    <div className="flex flex-col gap-1" style={{ minWidth }}>
      <div className="flex text-[10px] justify-between" style={{ color: 'var(--moni-text-tertiary)' }}>
        <span>{Math.round(pOk)}% ok</span>
        <span>{Math.round(pVenc)}% atras.</span>
      </div>
      <div className="flex rounded-full overflow-hidden" style={{ height: 6, background: 'var(--moni-surface-200)' }}>
        <div style={{ width: `${pOk}%`,   background: '#4A7C59' }} />
        <div style={{ width: `${pHoje}%`, background: '#D4AD68' }} />
        <div style={{ width: `${pVenc}%`, background: '#9B3B3B' }} />
      </div>
    </div>
  );
}

// Barra bicolor (ganho/arquivado ou chamado ativo/acumulado)
function BiBar({
  a, b, labelA, labelB, colorA, colorB, minWidth = 80,
}: {
  a: number; b: number; labelA: string; labelB: string;
  colorA: string; colorB: string; minWidth?: number;
}) {
  const total = a + b || 1;
  const pA = (a / total) * 100;
  const pB = (b / total) * 100;
  return (
    <div className="flex flex-col gap-1" style={{ minWidth }}>
      <div className="flex text-[10px] gap-2" style={{ color: 'var(--moni-text-tertiary)' }}>
        <span>{a} {labelA}</span>
        <span>/ {b} {labelB}</span>
      </div>
      <div className="flex rounded-full overflow-hidden" style={{ height: 6, background: 'var(--moni-surface-200)' }}>
        <div style={{ width: `${pA}%`, background: colorA }} />
        <div style={{ width: `${pB}%`, background: colorB }} />
      </div>
    </div>
  );
}

// Score bar
function ScoreBar({ value, nivel }: { value: number; nivel: string }) {
  const color = nivel === 'critico' ? '#9B3B3B' : nivel === 'atencao' ? '#D4AD68' : '#4A7C59';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 6, background: 'var(--moni-surface-200)', minWidth: 64 }}>
        <div style={{ width: `${value}%`, background: color, height: '100%' }} />
      </div>
      <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--moni-text-primary)', minWidth: 24 }}>{value}</span>
    </div>
  );
}

// Badge de nível
function NivelBadge({ nivel }: { nivel: string }) {
  const styles: Record<string, string> = {
    critico: 'bg-red-100 text-red-800 border-red-200',
    atencao: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    ok:      'bg-green-100 text-green-800 border-green-200',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${styles[nivel] ?? styles.ok}`}
      style={{ letterSpacing: '0.02em' }}
    >
      {nivelLabel(nivel)}
    </span>
  );
}

// KPI Card
function KpiCard({ value, label, tone }: { value: number | string; label: string; tone?: 'danger' | 'warning' }) {
  const textColor = tone === 'danger' ? 'var(--moni-status-overdue-text)' : tone === 'warning' ? '#92650a' : 'var(--moni-text-primary)';
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-1"
      style={{ background: 'var(--moni-surface-0)', border: '0.5px solid var(--moni-border-default)', boxShadow: 'var(--moni-shadow-card)' }}
    >
      <span className="text-2xl font-bold tabular-nums" style={{ color: textColor, fontFamily: 'var(--moni-font-display)' }}>
        {value}
      </span>
      <span className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>{label}</span>
    </div>
  );
}

// Seção colapsável
function SecaoColapsavel({
  titulo, descricao, children, defaultOpen = false,
}: {
  titulo: string; descricao: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 py-2 group"
      >
        <div className="flex flex-col items-start gap-0.5">
          <h2
            className="text-lg font-semibold tracking-tight"
            style={{ color: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-display)' }}
          >
            {titulo}
          </h2>
          <p className="text-xs text-left" style={{ color: 'var(--moni-text-tertiary)' }}>{descricao}</p>
        </div>
        <span
          className="shrink-0 text-xs px-3 py-1 rounded-lg transition-colors"
          style={{
            background: 'var(--moni-surface-100)',
            color: 'var(--moni-text-secondary)',
            border: '0.5px solid var(--moni-border-default)',
          }}
        >
          {open ? 'Recolher ▲' : 'Expandir ▼'}
        </span>
      </button>
      {open && <div className="mt-4">{children}</div>}
    </div>
  );
}

// Bloco de fase para a esteira
function FaseBlock({
  fase, funil, cards, atrasados, slaOk, taxaConv, isLast,
}: {
  fase: string; funil: string; cards: number; atrasados: number;
  slaOk: number; taxaConv: number; isLast: boolean;
}) {
  return (
    <div className="flex items-stretch">
      <div
        className="flex flex-col items-center gap-2 px-3 py-3"
        style={{
          minWidth: 90,
          background: 'var(--moni-surface-0)',
          border: '0.5px solid var(--moni-border-default)',
          borderRadius: 'var(--moni-radius-md)',
        }}
      >
        <span className="text-[10px] text-center" style={{ color: 'var(--moni-text-tertiary)' }}>{funil}</span>
        <span className="text-xs font-semibold text-center" style={{ color: 'var(--moni-text-primary)' }}>{fase}</span>
        <span className="text-xl font-bold tabular-nums" style={{ color: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-display)' }}>{cards}</span>
        <SlaBar ok={slaOk} hoje={0} vencido={atrasados} total={cards} minWidth={72} />
        {atrasados > 0
          ? <span className="text-[10px]" style={{ color: '#9B3B3B' }}>{atrasados} atras.</span>
          : <span className="text-[10px]" style={{ color: '#4A7C59' }}>sem atraso</span>
        }
      </div>
      {!isLast && (
        <div className="flex flex-col items-center justify-center px-1.5 shrink-0">
          <span className="text-base" style={{ color: 'var(--moni-text-tertiary)' }}>→</span>
          <span className="text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>{taxaConv}%</span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export function PainelGeraisFunis() {
  const [grupo, setGrupo]                 = useState('Todos');
  const [pipeline, setPipeline]           = useState<'rede' | 'loteadores'>('rede');
  const [showEsteira, setShowEsteira]     = useState(false);
  const [showTodasFases, setShowTodasFases] = useState(false);
  const [abaAtividade, setAbaAtividade]   = useState<'chamados' | 'pp'>('chamados');

  const funisFiltrados = grupo === 'Todos' ? FUNIS : FUNIS.filter((f) => f.grupo === grupo);
  const totalCards     = funisFiltrados.reduce((s, f) => s + f.cards,     0);
  const totalVencidos  = funisFiltrados.reduce((s, f) => s + f.slaVencido, 0);
  const fasesVisiveis  = showTodasFases ? FASES : FASES.slice(0, 6);
  const pipelineData   = pipeline === 'rede' ? PIPELINE_REDE : PIPELINE_LOTEADORES;

  const grupos = ['Todos', 'Novos Negócios', 'Moní Capital', 'Operações'];

  // ─── Estilos de seção ───────────────────────────────────────────────────
  const secaoTitle = {
    fontFamily: 'var(--moni-font-display)',
    color: 'var(--moni-navy-800)',
  };
  const secaoDesc = { color: 'var(--moni-text-tertiary)' };
  const thStyle   = {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.06em',
    color: 'var(--moni-text-tertiary)',
    textTransform: 'uppercase' as const,
    padding: '10px 12px',
    borderBottom: '0.5px solid var(--moni-border-default)',
    background: 'var(--moni-surface-50)',
    whiteSpace: 'nowrap' as const,
  };
  const tdStyle = {
    padding: '10px 12px',
    borderBottom: '0.5px solid var(--moni-border-default)',
    verticalAlign: 'middle' as const,
  };
  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse' as const,
    background: 'var(--moni-surface-0)',
    border: '0.5px solid var(--moni-border-default)',
    borderRadius: 'var(--moni-radius-lg)',
    overflow: 'hidden',
    fontSize: 13,
  };

  return (
    <div className="space-y-10 pb-16">

      {/* ── HEADER + FILTROS ── */}
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2
              className="text-2xl font-semibold tracking-tight"
              style={{ color: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-display)' }}
            >
              Painel Geral de Funis
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
              Visão gerencial consolidada: SLA, gargalos, saúde, chamados e próximos passos
            </p>
          </div>
          <span className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
            Dados mock — integração com banco em breve
          </span>
        </div>

        {/* Filtro de grupo */}
        <div className="flex gap-2 flex-wrap">
          {grupos.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGrupo(g)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: grupo === g ? 'var(--moni-navy-800)' : 'var(--moni-surface-100)',
                color:      grupo === g ? '#fff' : 'var(--moni-text-secondary)',
                border:     '0.5px solid var(--moni-border-default)',
              }}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* ── ALERTA ── */}
      <div
        className="rounded-xl px-5 py-4"
        style={{ background: '#fef2f2', border: '0.5px solid #fca5a5' }}
      >
        <p className="text-sm font-semibold" style={{ color: '#991b1b' }}>
          {totalVencidos} cards com SLA vencido em {funisFiltrados.length} funis
        </p>
        <p className="text-xs mt-1" style={{ color: '#7f1d1d' }}>
          Step One concentra 39% dos atrasos · Pré Obra e Proj. Locais lideram chamados (13 cada) ·
          Loteadores: maior T. médio em fase (45d) · Funding: 4,2d para registrar primeiro PP
        </p>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard value={totalCards}    label="Cards Ativos" />
        <KpiCard value={totalVencidos} label="SLA Vencido"      tone="danger" />
        <KpiCard value={38}            label="Chamados Abertos" />
        <KpiCard value={54}            label="PP Atrasados"      tone="warning" />
        <KpiCard value={61}            label="Cards Sem PP"      tone="warning" />
      </div>
      <div className="flex flex-wrap gap-4 text-xs" style={{ color: 'var(--moni-text-secondary)' }}>
        {[
          ['23', 'sem responsável de fase'],
          ['38', 'checklists incompletos'],
          ['17', 'bastões aguardando sub-funis'],
          ['12', 'arquivados (últimos 30d)'],
        ].map(([v, l]) => (
          <span key={l} className="flex items-center gap-1.5">
            <span
              className="px-2 py-0.5 rounded-md font-semibold"
              style={{ background: 'var(--moni-surface-100)', border: '0.5px solid var(--moni-border-default)' }}
            >
              {v}
            </span>
            {l}
          </span>
        ))}
      </div>

      <hr style={{ borderColor: 'var(--moni-border-default)', borderWidth: '0.5px' }} />

      {/* ══════════════════════════════════════════════════════════════════════
          BLOCO 1 — MAPA DE FUNIS (com Score de Saúde integrado)
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight" style={secaoTitle}>Mapa de Funis</h2>
          <p className="text-xs mt-0.5" style={secaoDesc}>
            Distribuição SLA + Score de Saúde por funil · ordenado do mais crítico ao mais saudável
          </p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={{ ...thStyle, textAlign: 'left' }}>Funil</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Cards</th>
                <th style={{ ...thStyle, textAlign: 'left', minWidth: 160 }}>Distribuição SLA</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>SLA Vencido</th>
                <th style={{ ...thStyle, textAlign: 'left', minWidth: 160 }}>Score Saúde</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Nível</th>
              </tr>
            </thead>
            <tbody>
              {funisFiltrados.map((f) => (
                <tr key={f.nome} className={slaRowBg(f.slaVencido / f.cards)}>
                  <td style={tdStyle}>
                    <div className="font-semibold" style={{ color: 'var(--moni-text-primary)' }}>{f.nome}</div>
                    <div className="text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>{f.grupo}</div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, fontFamily: 'var(--moni-font-display)' }}>
                    {f.cards}
                  </td>
                  <td style={tdStyle}>
                    <SlaBar ok={f.slaOk} hoje={f.slaHoje} vencido={f.slaVencido} total={f.cards} />
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: f.slaVencido > 0 ? '#9B3B3B' : 'inherit' }}>
                    {f.slaVencido}
                  </td>
                  <td style={tdStyle}>
                    <ScoreBar value={f.score} nivel={f.nivel} />
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <NivelBadge nivel={f.nivel} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <hr style={{ borderColor: 'var(--moni-border-default)', borderWidth: '0.5px' }} />

      {/* ══════════════════════════════════════════════════════════════════════
          BLOCO 2 — FASES GARGALO (dataset unificado)
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold tracking-tight" style={secaoTitle}>Fases Gargalo</h2>
            <p className="text-xs mt-0.5" style={secaoDesc}>
              Score composto: SLA + parados + chamados + retorno de fase · T. Médio Real vs SLA configurado · maior gargalo primeiro
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowTodasFases((v) => !v)}
            className="text-xs px-3 py-1.5 rounded-lg transition-colors shrink-0"
            style={{
              background: 'var(--moni-surface-100)',
              border: '0.5px solid var(--moni-border-default)',
              color: 'var(--moni-text-secondary)',
            }}
          >
            {showTodasFases ? 'Ver menos' : `Ver todas (${FASES.length})`}
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={{ ...thStyle, textAlign: 'center', width: 32 }}>#</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>Fase / Funil / Área</th>
                <th style={{ ...thStyle, textAlign: 'left', minWidth: 130 }}>Score</th>
                <th style={{ ...thStyle, textAlign: 'left', minWidth: 120 }}>Cards (SLA / Parados)</th>
                <th style={{ ...thStyle, textAlign: 'left', minWidth: 110 }}>Chamados (Ab./Ac.)</th>
                <th style={{ ...thStyle, textAlign: 'left', minWidth: 110 }}>Resultado (G/A)</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Retro.</th>
                <th style={{ ...thStyle, textAlign: 'right', minWidth: 130 }}>T.Médio vs SLA</th>
                <th style={{ ...thStyle, textAlign: 'left', minWidth: 140 }}>Responsáveis</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Avg PP</th>
              </tr>
            </thead>
            <tbody>
              {fasesVisiveis.map((f, i) => (
                <tr key={`${f.fase}-${f.funil}`} className={nivelRowBg(f.nivel)}>
                  <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700, color: 'var(--moni-text-tertiary)' }}>{i + 1}</td>
                  <td style={tdStyle}>
                    <div className="font-semibold text-sm" style={{ color: 'var(--moni-text-primary)' }}>{f.fase}</div>
                    <div className="text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>{f.funil} · {f.area}</div>
                  </td>
                  <td style={tdStyle}>
                    <div className="flex items-center gap-2">
                      <ScoreBar value={f.score} nivel={f.nivel} />
                      <NivelBadge nivel={f.nivel} />
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <div className="font-bold text-sm" style={{ color: 'var(--moni-text-primary)' }}>{f.cards} ativos</div>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {f.atrasados > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-800 border border-red-200">{f.atrasados} SLA</span>
                      )}
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--moni-surface-100)', color: 'var(--moni-text-tertiary)', border: '0.5px solid var(--moni-border-default)' }}>{f.parados} par.</span>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <div className="text-[11px]" style={{ color: 'var(--moni-text-secondary)' }}>
                      <span className="font-semibold">{f.chamAtivos}</span> ab. / <span className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>{f.chamAcum} ac.</span>
                    </div>
                    <MiniBar value={f.chamAtivos} total={f.chamAcum || 1} color={f.chamAtivos > 2 ? '#9B3B3B' : '#D4AD68'} minWidth={72} />
                  </td>
                  <td style={tdStyle}>
                    <BiBar
                      a={f.ganhos} b={f.arquivados}
                      labelA="gan." labelB="arq."
                      colorA="#4A7C59" colorB="#9B3B3B"
                      minWidth={80}
                    />
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <div className="font-bold text-base" style={{ color: f.retornoFase > 2 ? '#9B3B3B' : 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-display)' }}>
                      {f.retornoFase}
                    </div>
                    <div className="text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>retro.</div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <div className="flex items-center justify-end gap-2">
                      <span className="font-bold text-sm" style={{ color: 'var(--moni-text-primary)' }}>{f.tempoMedio}d</span>
                      {f.slaDias > 0 && f.tempoMedio > f.slaDias && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-800 border border-red-200">
                          +{f.tempoMedio - f.slaDias}d
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] mt-0.5" style={{ color: 'var(--moni-text-tertiary)' }}>
                      {f.slaDias > 0 ? `SLA: ${f.slaDias}d` : 'SLA: pausado'}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, fontSize: 11, color: 'var(--moni-text-secondary)', maxWidth: 140 }}>
                    <span className="line-clamp-2">{f.responsaveis}</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontSize: 12, fontWeight: 600 }}>
                    {f.avgPP}d
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <hr style={{ borderColor: 'var(--moni-border-default)', borderWidth: '0.5px' }} />

      {/* ══════════════════════════════════════════════════════════════════════
          BLOCO 3 — ATIVIDADE OPERACIONAL (Chamados / PP em abas)
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight" style={secaoTitle}>Atividade Operacional</h2>
          <p className="text-xs mt-0.5" style={secaoDesc}>Chamados abertos e atrasos em próximos passos — por funil e por fase</p>
        </div>

        {/* Abas */}
        <div className="flex gap-0 rounded-lg overflow-hidden w-fit" style={{ border: '0.5px solid var(--moni-border-default)' }}>
          {(['chamados', 'pp'] as const).map((aba) => (
            <button
              key={aba}
              type="button"
              onClick={() => setAbaAtividade(aba)}
              className="px-4 py-2 text-sm font-medium transition-colors"
              style={{
                background: abaAtividade === aba ? 'var(--moni-navy-800)' : 'var(--moni-surface-0)',
                color:      abaAtividade === aba ? '#fff' : 'var(--moni-text-secondary)',
              }}
            >
              {aba === 'chamados' ? 'Chamados Sirene' : 'Próximos Passos'}
            </button>
          ))}
        </div>

        {abaAtividade === 'chamados' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Por funil */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--moni-text-primary)' }}>Por Funil — mais chamados primeiro</h3>
              <div
                className="rounded-xl overflow-hidden"
                style={{ border: '0.5px solid var(--moni-border-default)', background: 'var(--moni-surface-0)' }}
              >
                {CHAMADOS_FUNIL.map((c, i) => (
                  <div
                    key={c.funil}
                    className="flex items-center gap-3 px-4 py-3"
                    style={{ borderBottom: i < CHAMADOS_FUNIL.length - 1 ? '0.5px solid var(--moni-border-default)' : 'none' }}
                  >
                    <span className="w-6 text-xs font-bold text-center" style={{ color: 'var(--moni-text-tertiary)' }}>{i + 1}</span>
                    <span className="flex-1 text-sm font-medium" style={{ color: 'var(--moni-text-primary)' }}>{c.funil}</span>
                    <div className="flex items-center gap-3">
                      <MiniBar value={c.chamados} total={13} color={i < 2 ? '#9B3B3B' : '#2F4A3A'} minWidth={80} />
                      <span className="text-sm font-bold tabular-nums" style={{ color: i < 2 ? '#9B3B3B' : 'var(--moni-text-primary)', minWidth: 20, textAlign: 'right' }}>{c.chamados}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Por fase */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--moni-text-primary)' }}>Por Fase — mais chamados primeiro</h3>
              <table style={{ ...tableStyle }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, textAlign: 'left' }}>Fase / Funil</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Chamados</th>
                    <th style={{ ...thStyle, textAlign: 'left' }}>Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {CHAMADOS_FASE.map((c, i) => (
                    <tr key={`${c.fase}-${c.funil}`} className={i < 2 ? 'bg-red-50/40' : i < 4 ? 'bg-yellow-50/40' : ''}>
                      <td style={tdStyle}>
                        <div className="text-sm font-semibold" style={{ color: 'var(--moni-text-primary)' }}>{c.fase}</div>
                        <div className="text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>{c.funil}</div>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: i < 2 ? '#9B3B3B' : 'var(--moni-text-primary)' }}>{c.chamados}</td>
                      <td style={tdStyle}>
                        <MiniBar value={c.chamados} total={8} color={i < 2 ? '#9B3B3B' : '#D4AD68'} minWidth={80} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {abaAtividade === 'pp' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tempo por funil */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--moni-text-primary)' }}>Tempo Médio para Registrar PP — por Funil</h3>
              <div
                className="rounded-xl overflow-hidden"
                style={{ border: '0.5px solid var(--moni-border-default)', background: 'var(--moni-surface-0)' }}
              >
                {PP_TEMPO_FUNIL.map((p, i) => (
                  <div
                    key={p.funil}
                    className="flex items-center gap-3 px-4 py-3"
                    style={{ borderBottom: i < PP_TEMPO_FUNIL.length - 1 ? '0.5px solid var(--moni-border-default)' : 'none' }}
                  >
                    <span className="w-6 text-xs font-bold text-center" style={{ color: 'var(--moni-text-tertiary)' }}>{i + 1}</span>
                    <span className="flex-1 text-sm font-medium" style={{ color: 'var(--moni-text-primary)' }}>{p.funil}</span>
                    <div className="flex items-center gap-3">
                      <MiniBar value={p.avgDias} total={4.2} color={p.avgDias > 2 ? '#9B3B3B' : '#D4AD68'} minWidth={80} />
                      <span className="text-sm font-bold tabular-nums" style={{ minWidth: 32, textAlign: 'right', color: p.avgDias > 2 ? '#9B3B3B' : 'var(--moni-text-primary)' }}>{p.avgDias}d</span>
                    </div>
                  </div>
                ))}
              </div>
              <div
                className="rounded-xl px-4 py-3 text-xs"
                style={{ background: '#fffbeb', border: '0.5px solid #fcd34d', color: '#92650a' }}
              >
                <span className="font-semibold">Funding e Loteadores acima do ideal (2d).</span>{' '}
                61 cards sem nenhum próximo passo cadastrado.
              </div>
            </div>

            {/* Fases com maior atraso */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--moni-text-primary)' }}>Fases com Maior Atraso de PP</h3>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, textAlign: 'left' }}>Fase / Funil</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Cards</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Atraso Médio</th>
                    <th style={{ ...thStyle, textAlign: 'left' }}>Sem PP</th>
                  </tr>
                </thead>
                <tbody>
                  {PP_FASES.map((p) => (
                    <tr key={`${p.fase}-${p.funil}`} className={p.avgAtraso > 30 ? 'bg-red-50/40' : p.avgAtraso > 18 ? 'bg-yellow-50/40' : ''}>
                      <td style={tdStyle}>
                        <div className="text-sm font-semibold" style={{ color: 'var(--moni-text-primary)' }}>{p.fase}</div>
                        <div className="text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>{p.funil}</div>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{p.total}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: p.avgAtraso > 30 ? '#9B3B3B' : 'var(--moni-text-primary)' }}>{p.avgAtraso}d</td>
                      <td style={tdStyle}>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">{p.semPP}</span>
                          <MiniBar value={p.semPP} total={p.total} color="#D4AD68" minWidth={48} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
                Sem PP = cards na fase sem próximo passo · Atraso Médio = dias desde a data prevista
              </p>
            </div>
          </div>
        )}
      </div>

      <hr style={{ borderColor: 'var(--moni-border-default)', borderWidth: '0.5px' }} />

      {/* ══════════════════════════════════════════════════════════════════════
          BLOCO 4 — VISÃO DA ESTEIRA (colapsável)
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold tracking-tight" style={secaoTitle}>Visão da Esteira</h2>
            <p className="text-xs mt-0.5" style={secaoDesc}>Jornada completa dos projetos — volume por fase, SLA e taxa de conversão</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap shrink-0">
            {showEsteira && (
              <div className="flex gap-1 rounded-lg overflow-hidden" style={{ border: '0.5px solid var(--moni-border-default)' }}>
                {(['rede', 'loteadores'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPipeline(p)}
                    className="px-3 py-1.5 text-xs font-medium transition-colors"
                    style={{
                      background: pipeline === p ? 'var(--moni-navy-800)' : 'var(--moni-surface-0)',
                      color:      pipeline === p ? '#fff' : 'var(--moni-text-secondary)',
                    }}
                  >
                    {p === 'rede' ? 'Portfólio / Rede' : 'Loteadores'}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowEsteira((v) => !v)}
              className="text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{
                background: 'var(--moni-surface-100)',
                border: '0.5px solid var(--moni-border-default)',
                color: 'var(--moni-text-secondary)',
              }}
            >
              {showEsteira ? 'Ocultar esteira ▲' : 'Ver esteira ▼'}
            </button>
          </div>
        </div>

        {showEsteira && (
          <div
            className="rounded-xl p-4 overflow-x-auto"
            style={{ background: 'var(--moni-surface-0)', border: '0.5px solid var(--moni-border-default)' }}
          >
            <div
              className="flex items-stretch"
              style={{ minWidth: pipeline === 'rede' ? 900 : 720 }}
            >
              {pipelineData.map((item, i) => (
                <FaseBlock
                  key={item.fase}
                  {...item}
                  isLast={i === pipelineData.length - 1}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <hr style={{ borderColor: 'var(--moni-border-default)', borderWidth: '0.5px' }} />

      {/* ══════════════════════════════════════════════════════════════════════
          BLOCO 5 — ANÁLISES AVANÇADAS (colapsável)
      ══════════════════════════════════════════════════════════════════════ */}
      <SecaoColapsavel
        titulo="Análises Avançadas"
        descricao="Taxa de conversão por transição de funil e concentração de gargalos por responsável"
      >
        <div className="space-y-8">
          {/* Taxa de Conversão */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--moni-text-primary)' }}>Taxa de Conversão por Transição</h3>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: 'left' }}>Transição</th>
                  <th style={{ ...thStyle, textAlign: 'left', minWidth: 160 }}>Taxa de Conversão</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Convertidos</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Perdas</th>
                </tr>
              </thead>
              <tbody>
                {CONVERSAO.map((c) => (
                  <tr key={c.transicao} className={c.taxa < 30 ? 'bg-red-50/40' : c.taxa < 60 ? 'bg-yellow-50/40' : ''}>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{c.transicao}</td>
                    <td style={tdStyle}>
                      <div className="flex items-center gap-3">
                        <BiBar a={c.convertidos} b={c.perda} labelA="conv." labelB="perda" colorA="#4A7C59" colorB="#9B3B3B" minWidth={100} />
                        <span className="font-bold text-sm" style={{ color: c.taxa < 30 ? '#9B3B3B' : 'var(--moni-text-primary)', minWidth: 36 }}>{c.taxa}%</span>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: '#4A7C59' }}>{c.convertidos}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#9B3B3B' }}>{c.perda}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div
              className="rounded-xl px-4 py-3 text-xs"
              style={{ background: '#fef2f2', border: '0.5px solid #fca5a5', color: '#991b1b' }}
            >
              <span className="font-semibold">Loteadores e Funding com menores taxas.</span>{' '}
              Loteadores converte apenas 22% em contrato (78% de perda em 28 cards ativos).
              Portfólio → Operações: apenas 35% — gargalo principal do funil principal da rede.
            </div>
          </div>

          {/* Gargalo por Responsável */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--moni-text-primary)' }}>Gargalo por Responsável</h3>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: 'left' }}>Responsável</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Cards</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>SLA Vencido</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>PP Atrasados</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Chamados</th>
                  <th style={{ ...thStyle, textAlign: 'left', minWidth: 140 }}>Score Gargalo</th>
                </tr>
              </thead>
              <tbody>
                {RESPONSAVEIS_GARGALO.map((r) => {
                  const nv = r.score > 70 ? 'critico' : r.score > 40 ? 'atencao' : 'ok';
                  return (
                    <tr key={r.nome} className={nivelRowBg(nv)}>
                      <td style={tdStyle}>
                        <div className="font-semibold text-sm" style={{ color: 'var(--moni-text-primary)' }}>{r.nome}</div>
                        <div className="text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>{r.cargo}</div>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{r.cards}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: r.slaVencido > 7 ? '#9B3B3B' : 'var(--moni-text-primary)' }}>{r.slaVencido}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{r.ppAtrasados}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{r.chamados}</td>
                      <td style={tdStyle}>
                        <ScoreBar value={r.score} nivel={nv} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </SecaoColapsavel>

    </div>
  );
}
