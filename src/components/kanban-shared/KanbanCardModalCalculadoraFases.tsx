'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Pencil, CheckCircle2 } from 'lucide-react';
import { formatIsoDateOnlyPtBr } from '@/lib/dias-uteis';
import {
  CALCULADORA_STATUS_LABEL,
  calcularResumoExecutivoCalculadoraFases,
  calculadoraHojeYmd,
  idxAprovacaoCondominioCalculadora,
  type CalculadoraResumoExecutivo,
  faseUltrapassouSlaCalculadora,
  labelSufixoDataCalculadora,
  labelSufixoDataCalculadoraFase,
  type CalculadoraFaseLinha,
  type CalculadoraStatusGeral,
  type FaseTimelineStatus,
} from '@/lib/kanban/calculadora-fases';
import {
  agruparTimelinePorFunil,
  montarTimelineCalculadoraComMarcos,
  type CalculadoraMarco,
  type CalculadoraMarcoId,
  type CalculadoraMarcosInput,
  type CalculadoraTimelineItem,
} from '@/lib/kanban/calculadora-fases-marcos';
import type { FaseVisit } from '@/lib/kanban/kanban-card-timeline';
import type { KanbanFase } from '@/components/kanban-shared/types';
import type { NegociacaoLinha } from '@/lib/kanban/negociacao-linhas';
import {
  resolverNegociacaoLinhasCalculadora,
  inserirNegociacaoNaTimeline,
  type NegociacaoLinhaCalculadora,
} from '@/lib/kanban/calculadora-negociacao';
import { fmtMoedaKanban } from '@/lib/kanban/kanban-card-modal-detalhes';
import { useCalculadoraShareLink } from '@/hooks/useCalculadoraShareLink';

type Props = {
  linhas: CalculadoraFaseLinha[];
  /** Resumo pré-calculado (sync group) — evita recalcular com contexto local do card. */
  resumo?: CalculadoraResumoExecutivo;
  faseAtualId: string | null;
  cardConcluido?: boolean;
  visits?: FaseVisit[];
  fases?: KanbanFase[];
  marcos?: CalculadoraMarcosInput;
  fasesMeta?: Map<string, KanbanFase>;
  /** painel = centro do drawer (altura livre); compact = legado sidebar */
  variant?: 'painel' | 'compact';
  /** ID do card — habilita botão Compartilhar (omitir em modo público). */
  cardId?: string;
  /** Leitura pública via token — oculta ações internas. */
  modoPublico?: boolean;
  /** Admin/team — habilita edição manual de datas. */
  podeEditarDatas?: boolean;
  /** Persiste override manual (início ou fim) para uma fase. */
  onSalvarData?: (
    faseId: string,
    campo: 'inicio' | 'fim',
    valor: string | null,
  ) => Promise<{ ok: boolean; error?: string }>;
  /** Atualiza override local imediatamente (recálculo otimista antes do persist). */
  onAplicarOverrideLocal?: (
    faseId: string,
    campo: 'inicio' | 'fim',
    valor: string | null,
  ) => void;
  /** Linhas de negociação — intercaladas na timeline como condições. */
  negociacaoLinhas?: NegociacaoLinha[];
  /** Âncora "Aprovação no Condomínio" ativa (limpa datas anteriores + conclui fases). */
  ancoraCondominioAtiva?: boolean;
  /** Ativa/remove a âncora em "Aprovação no Condomínio" (propaga para vínculos). */
  onDefinirAncoraCondominio?: (ativar: boolean) => Promise<{ ok: boolean; error?: string }>;
};

function fmtData(iso: string | null): string {
  if (!iso) return '—';
  return formatIsoDateOnlyPtBr(iso) ?? iso;
}

function fmtSla(dias: number | null, tipo: 'uteis' | 'corridos'): string {
  if (dias == null || dias <= 0) return 'SLA variável';
  return tipo === 'corridos' ? `SLA ${dias} d.c.` : `SLA ${dias} d.u.`;
}

function fmtAtrasoAcumulado(uteis: number, corridos: number): string {
  if (uteis <= 0 && corridos <= 0) return 'Nenhum';
  const parts: string[] = [];
  if (uteis > 0) parts.push(`${uteis} d.u.`);
  if (corridos > 0) parts.push(`${corridos} d.c.`);
  return parts.join(' + ');
}

function fmtGargaloResumo(
  g: NonNullable<ReturnType<typeof calcularResumoExecutivoCalculadoraFases>['maiorGargalo']>,
): string {
  const un = g.unidade === 'corridos' ? 'd.c.' : 'd.u.';
  return `${g.faseNome} +${g.dias} ${un}`;
}

function statusResumoLabel(status: CalculadoraStatusGeral): string {
  if (status === 'atrasado') return 'Atrasada';
  if (status === 'concluido') return 'Concluído';
  return 'No prazo';
}

function statusResumoClass(status: CalculadoraStatusGeral): string {
  if (status === 'atrasado') return 'moni-calculadora-badge-atrasada';
  return 'moni-calculadora-badge-prazo';
}

function statusRowClass(status: FaseTimelineStatus): string {
  const base = 'moni-calculadora-fase-row';
  if (status === 'concluida' || status === 'concluida_atraso') {
    return `${base} moni-calc-row-pass moni-calculadora-fase-row--${status}`;
  }
  if (status === 'atual') return `${base} moni-calc-row-atu moni-calculadora-fase-row--atual`;
  if (status === 'atual_atrasada') {
    return `${base} moni-calc-row-atu-at moni-calculadora-fase-row--atual_atrasada`;
  }
  return `${base} moni-calc-row-fut moni-calculadora-fase-row--futura`;
}

function responsavelCellClass(val: string | null | undefined, status: FaseTimelineStatus): string {
  const v = String(val ?? '').trim();
  if (!v || v === '—') return 'moni-calculadora-fase-responsavel resp moni-calculadora-fase-responsavel--empty';
  if (status === 'futura') return 'moni-calculadora-fase-responsavel resp moni-calculadora-fase-responsavel--futura';
  if (/^mon[ií]/i.test(v)) return 'moni-calculadora-fase-responsavel resp moni-calculadora-fase-responsavel--moni';
  if (/franqueado/i.test(v)) return 'moni-calculadora-fase-responsavel resp moni-calculadora-fase-responsavel--franqueado';
  return 'moni-calculadora-fase-responsavel resp';
}

function statusBadgeClass(status: FaseTimelineStatus): string {
  const base = 'moni-calculadora-fase-status';
  if (status === 'concluida' || status === 'concluida_atraso') {
    return `${base} moni-calc-badge-pass`;
  }
  if (status === 'atual') return `${base} moni-calc-badge-atu`;
  if (status === 'atual_atrasada') return `${base} moni-calc-badge-atu-at`;
  return `${base} moni-calc-badge-fut`;
}

/** Marcos: status sempre texto simples (sem pill), com cor de atraso quando aplicável. */
function marcoStatusBadgeClass(status: FaseTimelineStatus): string {
  const base = 'moni-calculadora-fase-status';
  if (status === 'concluida' || status === 'concluida_atraso') {
    return `${base} moni-calc-badge-pass`;
  }
  if (status === 'atual_atrasada') {
    return `${base} moni-calc-badge-atraso-text`;
  }
  if (status === 'atual') return `${base} moni-calc-badge-pass`;
  return `${base} moni-calc-badge-fut`;
}

function CalculadoraStatusLabel({
  status,
  atrasado,
}: {
  status: FaseTimelineStatus;
  atrasado?: boolean;
}) {
  if (status === 'atual_atrasada') {
    return (
      <>
        <span className="moni-calc-status-stacked-line">Em andamento</span>
        <span className="moni-calc-status-stacked-sub">(atrasado)</span>
      </>
    );
  }
  if (status === 'concluida_atraso') {
    return (
      <>
        <span className="moni-calc-status-stacked-line">Concluída</span>
        <span className="moni-calc-status-stacked-sub">(atrasado)</span>
      </>
    );
  }
  if (status === 'futura' && atrasado) {
    return (
      <>
        <span className="moni-calc-status-stacked-line">Futura</span>
        <span className="moni-calc-status-stacked-sub">(atrasado)</span>
      </>
    );
  }
  return <>{CALCULADORA_STATUS_LABEL[status]}</>;
}

function prazoPillClass(atrasada: boolean): string {
  return `moni-calc-prazo-pill${atrasada ? ' at' : ' undef'}`;
}

function funilEsteiraKind(label: string): 'stepone' | 'portfolio' | 'operacoes' | 'negociacao' {
  if (/negocia/i.test(label)) return 'negociacao';
  if (/step\s*one|stepone/i.test(label)) return 'stepone';
  if (/portf[oó]lio/i.test(label)) return 'portfolio';
  return 'operacoes';
}

function parseFaseSteps(fase: KanbanFase | undefined): string[] {
  if (!fase) return [];
  if (fase.materiais && fase.materiais.length > 0) {
    return fase.materiais.map((m) => m.titulo.trim()).filter(Boolean);
  }
  if (fase.instrucoes?.trim()) {
    return fase.instrucoes
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function CalculadoraResumoExecutivo({
  resumo,
  linhaAtual,
}: {
  resumo: CalculadoraResumoExecutivo;
  linhaAtual: CalculadoraFaseLinha | undefined;
}) {
  const atrasada = resumo.statusGeral === 'atrasado';
  const funilLabel = linhaAtual?.funilLabel ?? '—';
  const slaLabel = linhaAtual ? fmtSla(linhaAtual.slaDias, linhaAtual.slaTipo) : 'SLA variável';

  return (
    <div className="moni-calculadora-resumo">
      <div className="moni-calculadora-resumo-top">
        <div className="moni-calculadora-resumo-headline">
          <p className="moni-calculadora-resumo-fase truncate" title={resumo.faseAtualNome ?? undefined}>
            {resumo.faseAtualNome ?? '—'}
          </p>
          <span
            className="moni-calculadora-resumo-meta truncate"
            title={`${funilLabel} · ${slaLabel}`}
          >
            {funilLabel} · {slaLabel}
          </span>
        </div>
        <div className="moni-calculadora-resumo-badges">
          {resumo.dadosParciais ? (
            <span className="moni-calculadora-badge-parcial">⚠ Dados parciais</span>
          ) : null}
          {linhaAtual?.slaPrazoNaoDefinido ? (
            <span className={prazoPillClass(atrasada)}>Prazo não definido</span>
          ) : null}
          <span className={statusResumoClass(resumo.statusGeral)}>
            {statusResumoLabel(resumo.statusGeral)}
          </span>
        </div>
      </div>

      <div className="moni-calculadora-resumo-progress-row">
        <div className="moni-calc-prog-track min-w-0 flex-1">
          <div
            className={`moni-calc-prog-fill${atrasada ? ' at' : ''}`}
            style={{ width: `${Math.min(100, Math.max(0, resumo.percentualConcluido))}%` }}
          />
        </div>
        <span className="moni-calculadora-resumo-progress-label">
          {resumo.percentualConcluido}% · {resumo.fasesConcluidas}/{resumo.fasesTotal}
        </span>
      </div>

      <dl className="moni-calculadora-resumo-stats">
        <div className="moni-calculadora-resumo-stat">
          <dt className="moni-calculadora-resumo-stat-lbl">Atraso acumulado</dt>
          <dd
            className={`moni-calculadora-resumo-stat-val${
              resumo.atrasoAcumuladoUteis > 0 || resumo.atrasoAcumuladoCorridos > 0
                ? ' moni-calculadora-resumo-stat-val--atraso'
                : ''
            }`}
          >
            {fmtAtrasoAcumulado(resumo.atrasoAcumuladoUteis, resumo.atrasoAcumuladoCorridos)}
          </dd>
        </div>
        <div className="moni-calculadora-resumo-stat">
          <dt className="moni-calculadora-resumo-stat-lbl">Previsão conclusão</dt>
          <dd className="moni-calculadora-resumo-stat-val">{fmtData(resumo.previsaoConclusao)}</dd>
        </div>
        <div className="moni-calculadora-resumo-stat">
          <dt className="moni-calculadora-resumo-stat-lbl">Maior gargalo</dt>
          <dd
            className={`moni-calculadora-resumo-stat-val truncate${resumo.maiorGargalo ? ' moni-calculadora-resumo-stat-val--gargalo' : ''}`}
            title={resumo.maiorGargalo ? fmtGargaloResumo(resumo.maiorGargalo) : undefined}
          >
            {resumo.maiorGargalo ? fmtGargaloResumo(resumo.maiorGargalo) : '—'}
          </dd>
        </div>
      </dl>
    </div>
  );
}

const MARCOS_COM_PREFIXO: ReadonlySet<CalculadoraMarcoId> = new Set(['M0', 'M4', 'M24']);

function marcoDisplayLabel(marco: CalculadoraMarco): string {
  if (MARCOS_COM_PREFIXO.has(marco.id)) return `${marco.id}: ${marco.label}`;
  return marco.label;
}

function CalculadoraMarcoRow({
  marco,
  editandoDatas,
  onSalvarData,
  onRegistrarFlush,
  onAplicarOverrideLocal,
}: {
  marco: CalculadoraMarco;
  editandoDatas?: boolean;
  onSalvarData?: Props['onSalvarData'];
  onRegistrarFlush?: FlushEdicaoDataRegistrar;
  onAplicarOverrideLocal?: Props['onAplicarOverrideLocal'];
}) {
  const id = marco.id as CalculadoraMarcoId;
  const somenteRotulo = marco.somenteRotulo === true;

  if (somenteRotulo) {
    const dataLimite =
      marco.dataFimReal ?? marco.dataFimEstimada ?? marco.dataFim ?? marco.data;
    const limiteLabel = labelSufixoDataCalculadora(
      Boolean(marco.dataFimReal || marco.limiteContratoReal),
    );
    const exibirData = Boolean(dataLimite) || marco.isPrevisto;

    return (
      <div
        className={`moni-calculadora-marco-row moni-calculadora-marco-row--${id} moni-calculadora-marco-row--somente-rotulo${exibirData ? ' moni-calculadora-marco-row--somente-rotulo-com-limite' : ''}`}
        role="separator"
      >
        <div className="moni-calculadora-marco-col min-w-0">
          <div className="moni-calculadora-marco-label-wrap">
            <span className={`moni-calculadora-marco-dot moni-calculadora-marco-dot--${id}`} aria-hidden />
            <span
              className={`moni-calculadora-marco-label moni-calculadora-marco-label--${id}`}
              title={marcoDisplayLabel(marco)}
            >
              {marcoDisplayLabel(marco)}
            </span>
            <span className={`moni-calculadora-marco-badge moni-calculadora-marco-badge--${id}`}>Marco</span>
          </div>
        </div>

        {exibirData ? (
          <>
            <div aria-hidden />
            <div aria-hidden />
            <div className="moni-calculadora-fase-data-cell">
              <span
                className={`moni-calculadora-fase-data fd-val${!dataLimite ? ' fd-val--empty' : ''}`}
              >
                {fmtData(dataLimite)}
              </span>
              <span className="moni-calculadora-fase-data-label">{limiteLabel}</span>
            </div>
            <div aria-hidden />
          </>
        ) : null}
      </div>
    );
  }

  const limiteContrato = marco.dataLimiteContrato;
  const isM4ComLimite = id === 'M4' && Boolean(limiteContrato);
  const inicio = isM4ComLimite
    ? limiteContrato!
    : marco.dataInicioReal ?? marco.dataInicio;
  const fim =
    marco.dataFimReal ??
    marco.dataFimEstimada ??
    marco.dataFim ??
    marco.data;
  const inicioLabel = isM4ComLimite
    ? marco.limiteContratoReal
      ? 'real'
      : 'est. · limite'
    : labelSufixoDataCalculadora(Boolean(marco.dataInicioReal));
  const fimLabel = labelSufixoDataCalculadora(Boolean(marco.dataFimReal));
  const fimAtraso =
    marco.status === 'atual_atrasada' ||
    (marco.status === 'concluida_atraso' && Boolean(marco.dataFimReal));
  const custo = String(marco.custo ?? '').trim();
  const temCusto = custo.length > 0 && custo !== '—';

  return (
    <div className={`moni-calculadora-marco-row moni-calculadora-marco-row--${id}`} role="separator">
      <div className="moni-calculadora-marco-col min-w-0">
        <div className="moni-calculadora-marco-label-wrap">
          <span className={`moni-calculadora-marco-dot moni-calculadora-marco-dot--${id}`} aria-hidden />
          <span className={`moni-calculadora-marco-label moni-calculadora-marco-label--${id}`} title={marcoDisplayLabel(marco)}>
            {marcoDisplayLabel(marco)}
          </span>
          <span className={`moni-calculadora-marco-badge moni-calculadora-marco-badge--${id}`}>Marco</span>
        </div>
      </div>

      <div aria-hidden />

      {editandoDatas && onSalvarData && marco.faseId && !isM4ComLimite ? (
        <CalculadoraFaseDataCell
          faseId={marco.faseId}
          campo="inicio"
          valor={inicio}
          label={inicioLabel}
          editando
          onSalvarData={onSalvarData}
          onRegistrarFlush={onRegistrarFlush}
          onAplicarOverrideLocal={onAplicarOverrideLocal}
        />
      ) : (
        <div className="moni-calculadora-fase-data-cell">
          <span className={`moni-calculadora-fase-data fd-val${!inicio ? ' fd-val--empty' : ''}`}>
            {fmtData(inicio)}
          </span>
          <span className="moni-calculadora-fase-data-label">{inicioLabel}</span>
        </div>
      )}

      {editandoDatas && onSalvarData && marco.faseId ? (
        <CalculadoraFaseDataCell
          faseId={marco.faseId}
          campo="fim"
          valor={fim}
          label={fimLabel}
          atraso={fimAtraso}
          editando
          onSalvarData={onSalvarData}
          onRegistrarFlush={onRegistrarFlush}
          onAplicarOverrideLocal={onAplicarOverrideLocal}
        />
      ) : (
        <div className="moni-calculadora-fase-data-cell">
          <span
            className={`moni-calculadora-fase-data fd-val${fimAtraso ? ' fd-val--atraso' : ''}${!fim ? ' fd-val--empty' : ''}`}
          >
            {fmtData(fim)}
          </span>
          <span className="moni-calculadora-fase-data-label">{fimLabel}</span>
        </div>
      )}

      <div className="moni-calculadora-fase-status-col">
        {marco.status ? (
          <span className={marcoStatusBadgeClass(marco.status)}>
            <CalculadoraStatusLabel status={marco.status} />
          </span>
        ) : null}
      </div>

      {temCusto ? (
        <div className="moni-calc-fcusto-block" title={custo}>
          <span className="moni-calc-fcusto-label">Custo</span>
          <ul className="moni-calc-fcusto-list">
            {custo.split(' · ').map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function CalculadoraNegociacaoRow({ negociacao }: { negociacao: NegociacaoLinhaCalculadora }) {
  const titulo = negociacao.condicao.trim() || '—';
  const fim = negociacao.dataPagamentoResolvida;
  const fimLabel = labelSufixoDataCalculadora(!negociacao.dataPagamentoPrevista);
  const valorFmt = fmtMoedaKanban(negociacao.valor);
  const status = negociacao.status;

  return (
    <div
      className={`moni-calculadora-fase-row moni-calculadora-fase-row--no-expand moni-calculadora-negociacao-row ${statusRowClass(status)}`}
    >
      <div className="moni-calculadora-fase-col min-w-0">
        <div className="moni-calculadora-fase-nome-wrap">
          <span className="moni-calculadora-fase-nome fn" title={titulo}>
            {titulo}
          </span>
          <span className="moni-calculadora-negociacao-badge">Negociação</span>
        </div>
        {valorFmt ? (
          <div className="moni-calculadora-fase-sla-wrap">
            <div className="moni-calculadora-fase-sla fsla">{valorFmt}</div>
          </div>
        ) : null}
      </div>

      <div aria-hidden />

      <div aria-hidden />

      <div className="moni-calculadora-fase-data-cell">
        <span className={`moni-calculadora-fase-data fd-val${!fim ? ' fd-val--empty' : ''}`}>
          {fmtData(fim)}
        </span>
        <span className="moni-calculadora-fase-data-label">{fimLabel}</span>
      </div>

      <div className="moni-calculadora-fase-status-col">
        <span className={statusBadgeClass(status)}>
          <CalculadoraStatusLabel status={status} />
        </span>
      </div>
    </div>
  );
}

/** ISO `YYYY-MM-DD` → draft local `dd/mm/aaaa` (só dígitos/barra enquanto digita). */
function fmtDataDraftPtBr(iso: string | null): string {
  if (!iso) return '';
  return formatIsoDateOnlyPtBr(iso) ?? '';
}

/** Máscara leve: só dígitos, no máx. 8, com barras `dd/mm/aaaa`. */
function mascararDataPtBr(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/**
 * Converte draft `dd/mm/aaaa` (ou ISO) para ISO calendário válido.
 * `null` = vazio intencional; `undefined` = incompleto/inválido (não persistir).
 */
function parseDraftDataParaIso(raw: string): string | null | undefined {
  const t = raw.trim();
  if (!t) return null;
  let y: number;
  let mo: number;
  let d: number;
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    y = Number(iso[1]);
    mo = Number(iso[2]);
    d = Number(iso[3]);
  } else {
    const pt = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!pt) return undefined;
    d = Number(pt[1]);
    mo = Number(pt[2]);
    y = Number(pt[3]);
  }
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return undefined;
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return undefined;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return undefined;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

type FlushEdicaoDataRegistrar = (fn: () => Promise<void>) => () => void;

function CalculadoraFaseDataCell({
  faseId,
  campo,
  valor,
  label,
  atraso,
  editando,
  onSalvarData,
  onRegistrarFlush,
  onAplicarOverrideLocal,
}: {
  faseId: string;
  campo: 'inicio' | 'fim';
  valor: string | null;
  label: string;
  atraso?: boolean;
  editando: boolean;
  onSalvarData?: Props['onSalvarData'];
  onRegistrarFlush?: FlushEdicaoDataRegistrar;
  onAplicarOverrideLocal?: Props['onAplicarOverrideLocal'];
}) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const valorDraftProp = fmtDataDraftPtBr(valor);
  const valorIsoProp = (() => {
    const head = String(valor ?? '').trim().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : null;
  })();
  const [draft, setDraft] = useState(valorDraftProp);
  const draftRef = useRef(valorDraftProp);
  const inputRef = useRef<HTMLInputElement>(null);
  const ultimoSalvoIsoRef = useRef<string | null>(valorIsoProp);
  const salvarFnRef = useRef<(next: string | null) => Promise<void>>(async () => {});
  const aplicarOverrideRef = useRef(onAplicarOverrideLocal);
  aplicarOverrideRef.current = onAplicarOverrideLocal;

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  // Sincroniza do prop só fora do foco — digitação parcial nunca toca o parent.
  useEffect(() => {
    if (focused || salvando) return;
    setDraft(valorDraftProp);
    draftRef.current = valorDraftProp;
    ultimoSalvoIsoRef.current = valorIsoProp;
  }, [valorDraftProp, valorIsoProp, focused, salvando]);

  const salvar = useCallback(
    async (nextIso: string | null) => {
      if (!onSalvarData) return;
      if (nextIso === ultimoSalvoIsoRef.current && nextIso === valorIsoProp) return;
      setErro(null);
      setSalvando(true);
      try {
        const result = await onSalvarData(faseId, campo, nextIso);
        if (!result.ok) {
          setErro(result.error ?? 'Não foi possível salvar a data.');
          const revert = fmtDataDraftPtBr(ultimoSalvoIsoRef.current);
          setDraft(revert);
          draftRef.current = revert;
        } else {
          ultimoSalvoIsoRef.current = nextIso;
          const display = fmtDataDraftPtBr(nextIso);
          setDraft(display);
          draftRef.current = display;
        }
      } finally {
        setSalvando(false);
      }
    },
    [onSalvarData, faseId, campo, valorIsoProp],
  );
  salvarFnRef.current = salvar;

  /** Persistência só no fim da digitação (blur / Enter / sair do modo edição). */
  const commitValor = useCallback(
    async (brutoRaw: string) => {
      const parsed = parseDraftDataParaIso(brutoRaw);
      if (parsed === undefined) {
        const revert = fmtDataDraftPtBr(ultimoSalvoIsoRef.current);
        setDraft(revert);
        draftRef.current = revert;
        return;
      }
      const display = fmtDataDraftPtBr(parsed);
      setDraft(display);
      draftRef.current = display;
      if (parsed !== ultimoSalvoIsoRef.current) {
        aplicarOverrideRef.current?.(faseId, campo, parsed);
      }
      await salvarFnRef.current(parsed);
    },
    [faseId, campo],
  );

  useEffect(() => {
    if (!editando || !onRegistrarFlush) return;
    return onRegistrarFlush(async () => {
      const live = inputRef.current?.value ?? draftRef.current;
      await commitValor(live);
    });
  }, [editando, onRegistrarFlush, commitValor]);

  const stop = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  if (!editando || !onSalvarData) {
    return (
      <div className="moni-calculadora-fase-data-cell">
        <span
          className={`moni-calculadora-fase-data fd-val${atraso ? ' fd-val--atraso' : ''}${!valor ? ' fd-val--empty' : ''}`}
          title={valor ? fmtData(valor) : undefined}
        >
          {fmtData(valor)}
        </span>
        <span className="moni-calculadora-fase-data-label">{label}</span>
      </div>
    );
  }

  // Texto mascarado dd/mm/aaaa: Chromium type=date dispara blur entre segmentos e
  // salvava/recalculava no meio da digitação. Aqui o parent só recebe valor no commit.
  return (
    <div className="moni-calculadora-fase-data-cell moni-calculadora-fase-data-cell--edit" onClick={stop} onKeyDown={stop}>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/aaaa"
        autoComplete="off"
        maxLength={10}
        className={`moni-calculadora-fase-data-input${atraso ? ' moni-calculadora-fase-data-input--atraso' : ''}${salvando ? ' moni-calculadora-fase-data-input--saving' : ''}${erro ? ' moni-calculadora-fase-data-input--erro' : ''}`}
        value={draft}
        aria-label={`${campo === 'inicio' ? 'Início' : 'Fim'} — ${label}`}
        aria-invalid={erro ? true : undefined}
        onClick={stop}
        onFocus={() => setFocused(true)}
        onChange={(e) => {
          setErro(null);
          const next = mascararDataPtBr(e.target.value);
          setDraft(next);
          draftRef.current = next;
        }}
        onBlur={(e) => {
          setFocused(false);
          void commitValor(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
      />
      <span className="moni-calculadora-fase-data-label">{erro ?? label}</span>
    </div>
  );
}

function CalculadoraFaseStatusCell({
  row,
  editandoDatas,
  ordemAtual,
  onSalvarData,
}: {
  row: CalculadoraFaseLinha;
  editandoDatas: boolean;
  ordemAtual: number;
  onSalvarData?: Props['onSalvarData'];
}) {
  const editavel =
    editandoDatas &&
    onSalvarData &&
    (row.status === 'futura' ||
      ((row.status === 'concluida' || row.status === 'concluida_atraso') &&
        row.ordem > ordemAtual &&
        Boolean(row.dataFimReal)));

  const [salvando, setSalvando] = useState(false);

  if (!editavel) {
    const atrasado = faseUltrapassouSlaCalculadora(
      row.status,
      row.dataFimEstimada,
      row.dataFimReal,
      calculadoraHojeYmd(),
    );
    return (
      <span className={statusBadgeClass(row.status)}>
        <CalculadoraStatusLabel status={row.status} atrasado={atrasado} />
      </span>
    );
  }

  const selectValue = row.status === 'futura' ? 'futura' : 'concluida';

  return (
    <select
      className="moni-calculadora-fase-status-select"
      value={selectValue}
      disabled={salvando}
      aria-label={`Status — ${row.faseNome}`}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        void (async () => {
          const next = e.target.value;
          if (!onSalvarData) return;
          setSalvando(true);
          try {
            if (next === 'concluida') {
              await onSalvarData(row.faseId, 'fim', calculadoraHojeYmd());
            } else {
              await onSalvarData(row.faseId, 'fim', null);
            }
          } finally {
            setSalvando(false);
          }
        })();
      }}
    >
      <option value="futura">Futura</option>
      <option value="concluida">Concluída</option>
    </select>
  );
}

function CalculadoraFaseRow({
  row,
  faseMeta,
  expanded,
  onToggle,
  editandoDatas,
  ordemAtual,
  onSalvarData,
  onRegistrarFlush,
  onAplicarOverrideLocal,
}: {
  row: CalculadoraFaseLinha;
  faseMeta: KanbanFase | undefined;
  expanded: boolean;
  onToggle: () => void;
  editandoDatas: boolean;
  ordemAtual: number;
  onSalvarData?: Props['onSalvarData'];
  onRegistrarFlush?: FlushEdicaoDataRegistrar;
  onAplicarOverrideLocal?: Props['onAplicarOverrideLocal'];
}) {
  const steps = parseFaseSteps(faseMeta);
  const custo = String(row.custo ?? '').trim();
  const temCusto = custo.length > 0 && custo !== '—';
  const hasExpand = steps.length > 0;
  const isGargalo = row.atrasoDias !== null && row.atrasoDias > 0;
  const hoje = calculadoraHojeYmd();
  const inicioData = row.dataInicioReal;
  const fimData = row.dataFimReal ?? row.dataFimEstimada;
  const inicioLabel = labelSufixoDataCalculadoraFase(row.status, 'inicio', Boolean(row.dataInicioReal));
  const fimLabel = labelSufixoDataCalculadoraFase(row.status, 'fim', Boolean(row.dataFimReal));
  const unidadeAtraso = row.slaTipo === 'corridos' ? 'd.c.' : 'd.u.';

  const fimAtraso = faseUltrapassouSlaCalculadora(
    row.status,
    row.dataFimEstimada,
    row.dataFimReal,
    hoje,
  );

  return (
    <div
      className={`${statusRowClass(row.status)}${expanded ? ' open' : ''}${hasExpand ? '' : ' moni-calculadora-fase-row--no-expand'}`}
      role={hasExpand ? 'button' : undefined}
      tabIndex={hasExpand ? 0 : undefined}
      onClick={hasExpand ? onToggle : undefined}
      onKeyDown={
        hasExpand
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onToggle();
              }
            }
          : undefined
      }
    >
      <div className="moni-calculadora-fase-col min-w-0">
        <div className="moni-calculadora-fase-nome-wrap">
          <span className="moni-calculadora-fase-nome fn" title={row.faseNome}>
            {row.faseNome}
          </span>
          {hasExpand ? (
            <span className="moni-calculadora-fase-chevron" aria-hidden>
              ›
            </span>
          ) : null}
          {isGargalo ? (
            <span className="moni-calculadora-gargalo-badge">
              gargalo · +{row.atrasoDias} {unidadeAtraso}
            </span>
          ) : null}
        </div>
        <div className="moni-calculadora-fase-sla-wrap">
          <div className="moni-calculadora-fase-sla fsla">{fmtSla(row.slaDias, row.slaTipo)}</div>
          {row.slaPrazoNaoDefinido ? (
            <span className={prazoPillClass(row.status === 'atual_atrasada')}>Prazo não definido</span>
          ) : null}
        </div>
      </div>

      <div>
        <span className={responsavelCellClass(row.responsavelDaFase, row.status)} title={row.responsavelDaFase ?? undefined}>
          {row.responsavelDaFase ?? '—'}
        </span>
      </div>

      <CalculadoraFaseDataCell
        faseId={row.faseId}
        campo="inicio"
        valor={inicioData}
        label={inicioLabel}
        editando={editandoDatas}
        onSalvarData={onSalvarData}
        onRegistrarFlush={onRegistrarFlush}
        onAplicarOverrideLocal={onAplicarOverrideLocal}
      />

      <CalculadoraFaseDataCell
        faseId={row.faseId}
        campo="fim"
        valor={fimData}
        label={fimLabel}
        atraso={fimAtraso}
        editando={editandoDatas}
        onSalvarData={onSalvarData}
        onRegistrarFlush={onRegistrarFlush}
        onAplicarOverrideLocal={onAplicarOverrideLocal}
      />

      <div className="moni-calculadora-fase-status-col">
        <CalculadoraFaseStatusCell
          row={row}
          editandoDatas={editandoDatas}
          ordemAtual={ordemAtual}
          onSalvarData={onSalvarData}
        />
      </div>

      {temCusto ? (
        <div className="moni-calc-fcusto-block" title={custo}>
          <span className="moni-calc-fcusto-label">Custo</span>
          <ul className="moni-calc-fcusto-list">
            {custo.split(' · ').map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {steps.length > 0 ? (
        <ul className="moni-calculadora-fase-steps">
          {steps.map((step) => (
            <li key={step} className="moni-calculadora-fase-step">
              {step}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function isStatusConcluido(status: FaseTimelineStatus): boolean {
  return status === 'concluida' || status === 'concluida_atraso';
}

/** Fases e marcos com status (ex. M0 Contrato) contam como etapas visíveis do funil. */
function etapasVisiveisFunil(items: CalculadoraTimelineItem[]): CalculadoraTimelineItem[] {
  return items.filter(
    (i) =>
      i.kind === 'fase' ||
      (i.kind === 'marco' && !i.marco.somenteRotulo && i.marco.status != null),
  );
}

function etapaVisivelConcluida(item: CalculadoraTimelineItem): boolean {
  if (item.kind === 'fase') return isStatusConcluido(item.linha.status);
  if (item.kind === 'negociacao') return isStatusConcluido(item.negociacao.status);
  if (item.marco.somenteRotulo || item.marco.status == null) return true;
  return isStatusConcluido(item.marco.status);
}

function funilTotalmenteConcluido(items: CalculadoraTimelineItem[]): boolean {
  const etapasVisiveis = etapasVisiveisFunil(items);
  if (etapasVisiveis.length === 0) return false;
  return etapasVisiveis.every(etapaVisivelConcluida);
}

function collapsedFunisIniciais(
  grupos: { label: string; items: CalculadoraTimelineItem[] }[],
): Set<string> {
  const out = new Set<string>();
  for (const grupo of grupos) {
    if (funilTotalmenteConcluido(grupo.items)) out.add(grupo.label);
  }
  return out;
}

function CalculadoraFunilGroup({
  label,
  items,
  fasesMeta,
  collapsed,
  onToggle,
  expandedFases,
  onToggleFase,
  editandoDatas,
  ordemAtual,
  onSalvarData,
  onRegistrarFlush,
  onAplicarOverrideLocal,
}: {
  label: string;
  items: CalculadoraTimelineItem[];
  fasesMeta: Map<string, KanbanFase>;
  collapsed: boolean;
  onToggle: () => void;
  expandedFases: Set<string>;
  onToggleFase: (faseId: string) => void;
  editandoDatas: boolean;
  ordemAtual: number;
  onSalvarData?: Props['onSalvarData'];
  onRegistrarFlush?: FlushEdicaoDataRegistrar;
  onAplicarOverrideLocal?: Props['onAplicarOverrideLocal'];
}) {
  const etapasVisiveis = etapasVisiveisFunil(items);
  const concluidas = etapasVisiveis.filter(etapaVisivelConcluida).length;
  const condicoesNegociacao = items.filter((i) => i.kind === 'negociacao');
  const esteira = funilEsteiraKind(label);
  const isFunilNegociacao = esteira === 'negociacao';

  return (
    <section
      className={`moni-calculadora-funil-group moni-calculadora-funil-group--${esteira}${collapsed ? ' moni-calculadora-funil-collapsed collapsed' : ''}`}
    >
      <button
        type="button"
        className={`moni-calculadora-funil-header moni-calculadora-funil-header--${esteira} w-full text-left`}
        onClick={onToggle}
      >
        <span className={`moni-calculadora-funil-dot moni-calculadora-funil-dot--${esteira}`} aria-hidden />
        <span className="moni-calculadora-funil-title">{label.replace(/^Funil /i, '')}</span>
        <span className="moni-calculadora-funil-count">
          {isFunilNegociacao && condicoesNegociacao.length > 0
            ? `${condicoesNegociacao.length} condição${condicoesNegociacao.length === 1 ? '' : 'ões'}`
            : `${etapasVisiveis.length} fases · ${concluidas} concluídas`}
        </span>
        <span className="moni-calculadora-funil-chev" aria-hidden>
          <ChevronDown size={14} strokeWidth={2} />
        </span>
      </button>

      <div className="moni-calculadora-funil-body">
        <div className="moni-calculadora-table-header">
          <span>Fase</span>
          <span>Resp. fase</span>
          <span>Início</span>
          <span>Fim</span>
          <span>Status</span>
        </div>
        {items.map((item) => {
          if (item.kind === 'marco') {
            return (
              <CalculadoraMarcoRow
                key={`marco-${item.marco.id}-${item.marco.dataFim ?? ''}`}
                marco={item.marco}
                editandoDatas={editandoDatas}
                onSalvarData={onSalvarData}
                onRegistrarFlush={onRegistrarFlush}
                onAplicarOverrideLocal={onAplicarOverrideLocal}
              />
            );
          }
          if (item.kind === 'negociacao') {
            return (
              <CalculadoraNegociacaoRow
                key={`negociacao-${item.index}-${item.negociacao.condicao}`}
                negociacao={item.negociacao}
              />
            );
          }
          return (
            <CalculadoraFaseRow
              key={item.linha.faseId}
              row={item.linha}
              faseMeta={fasesMeta.get(item.linha.faseId)}
              expanded={expandedFases.has(item.linha.faseId)}
              onToggle={() => onToggleFase(item.linha.faseId)}
              editandoDatas={editandoDatas}
              ordemAtual={ordemAtual}
              onSalvarData={onSalvarData}
              onRegistrarFlush={onRegistrarFlush}
              onAplicarOverrideLocal={onAplicarOverrideLocal}
            />
          );
        })}
      </div>
    </section>
  );
}

export function KanbanCardModalCalculadoraFases({
  linhas,
  resumo: resumoProp,
  faseAtualId,
  cardConcluido,
  visits = [],
  fases = [],
  marcos,
  fasesMeta,
  variant = 'compact',
  cardId,
  modoPublico = false,
  podeEditarDatas = false,
  onSalvarData,
  onAplicarOverrideLocal,
  negociacaoLinhas = [],
  ancoraCondominioAtiva = false,
  onDefinirAncoraCondominio,
}: Props) {
  const [collapsedFunis, setCollapsedFunis] = useState<Set<string>>(new Set());
  const [expandedFases, setExpandedFases] = useState<Set<string>>(new Set());
  const [editandoDatas, setEditandoDatas] = useState(false);
  const [salvandoAncora, setSalvandoAncora] = useState(false);
  const flushEdicaoDatasRef = useRef(new Set<() => Promise<void>>());
  const cardInicializadoRef = useRef<string | null>(null);
  const { loading: shareLoading, copied: shareCopied, gerarECopiar } = useCalculadoraShareLink(
    cardId ?? '',
  );

  const metaMap = useMemo(() => {
    if (fasesMeta && fasesMeta.size > 0) return fasesMeta;
    return new Map(fases.map((f) => [f.id, f]));
  }, [fasesMeta, fases]);

  const resumo = useMemo(
    () =>
      resumoProp ??
      calcularResumoExecutivoCalculadoraFases(linhas, { cardConcluido, visits }),
    [resumoProp, linhas, cardConcluido, visits],
  );

  const linhaAtual = useMemo(
    () =>
      linhas.find(
        (l) =>
          l.faseId === faseAtualId || l.status === 'atual' || l.status === 'atual_atrasada',
      ),
    [linhas, faseAtualId],
  );

  const ordemAtual = useMemo(() => {
    const porId = linhas.find((l) => l.faseId === faseAtualId)?.ordem;
    if (porId != null) return porId;
    return (
      linhas.find((l) => l.status === 'atual' || l.status === 'atual_atrasada')?.ordem ??
      Number.MAX_SAFE_INTEGER
    );
  }, [linhas, faseAtualId]);

  const timelineItems = useMemo(() => {
    const base = montarTimelineCalculadoraComMarcos(linhas, fases, marcos ?? { visits });
    const resolvida = resolverNegociacaoLinhasCalculadora(negociacaoLinhas, linhas, base);
    return inserirNegociacaoNaTimeline(base, resolvida);
  }, [linhas, fases, marcos, visits, negociacaoLinhas]);

  const gruposFunil = useMemo(() => agruparTimelinePorFunil(timelineItems), [timelineItems]);

  useEffect(() => {
    const cid = cardId?.trim() ?? '';
    const initKey = modoPublico ? '__publico__' : cid;
    if (!initKey || gruposFunil.length === 0) return;
    if (cardInicializadoRef.current === initKey) return;

    cardInicializadoRef.current = initKey;
    setCollapsedFunis(collapsedFunisIniciais(gruposFunil));
    setExpandedFases(new Set());
    setEditandoDatas(false);
  }, [cardId, modoPublico, gruposFunil]);

  const toggleFunil = (label: string) => {
    setCollapsedFunis((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const toggleFase = (faseId: string) => {
    setExpandedFases((prev) => {
      const next = new Set(prev);
      if (next.has(faseId)) next.delete(faseId);
      else next.add(faseId);
      return next;
    });
  };

  const registrarFlushEdicaoData = useCallback<FlushEdicaoDataRegistrar>((fn) => {
    flushEdicaoDatasRef.current.add(fn);
    return () => {
      flushEdicaoDatasRef.current.delete(fn);
    };
  }, []);

  const alternarEdicaoDatas = useCallback(async () => {
    if (!editandoDatas) {
      setEditandoDatas(true);
      return;
    }
    await Promise.all([...flushEdicaoDatasRef.current].map((fn) => fn()));
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
    setEditandoDatas(false);
  }, [editandoDatas]);

  const temFaseCondominio = useMemo(() => idxAprovacaoCondominioCalculadora(linhas) >= 0, [linhas]);

  const alternarAncoraCondominio = useCallback(async () => {
    if (!onDefinirAncoraCondominio || salvandoAncora) return;
    setSalvandoAncora(true);
    try {
      const result = await onDefinirAncoraCondominio(!ancoraCondominioAtiva);
      if (!result.ok && result.error) {
        alert(result.error);
      }
    } finally {
      setSalvandoAncora(false);
    }
  }, [onDefinirAncoraCondominio, ancoraCondominioAtiva, salvandoAncora]);

  if (linhas.length === 0) {
    return (
      <p className="text-[11px] text-[var(--moni-text-tertiary)]" style={{ fontFamily: 'var(--moni-font-sans)' }}>
        Nenhuma fase configurada para a esteira principal.
      </p>
    );
  }

  const podeEditarDatasEfetivo = podeEditarDatas && !modoPublico && Boolean(onSalvarData);
  const podeAncorarCondominio =
    podeEditarDatas && !modoPublico && Boolean(onDefinirAncoraCondominio) && temFaseCondominio;

  return (
    <div
      className={`${variant === 'painel' ? 'flex h-full min-h-0 flex-col gap-2' : 'space-y-2'}${modoPublico ? ' moni-calculadora--modo-publico' : ''}${editandoDatas ? ' moni-calculadora--modo-edicao-datas' : ''}`}
    >
      {!modoPublico && cardId ? (
        <div className="moni-calculadora-section-header">
          <span className="moni-calculadora-section-title">Calculadora de fases</span>
          <div className="moni-calculadora-section-actions">
            {podeAncorarCondominio ? (
              <button
                type="button"
                onClick={() => void alternarAncoraCondominio()}
                disabled={salvandoAncora}
                className={`moni-calculadora-share-btn moni-calculadora-edit-datas-btn${ancoraCondominioAtiva ? ' moni-calculadora-edit-datas-btn--active' : ''}`}
                aria-pressed={ancoraCondominioAtiva}
                title={
                  ancoraCondominioAtiva
                    ? 'Reexibir datas das fases anteriores à Aprovação no Condomínio'
                    : 'Limpar datas e concluir fases anteriores à Aprovação no Condomínio'
                }
                aria-label={
                  ancoraCondominioAtiva
                    ? 'Reexibir fases anteriores ao Condomínio'
                    : 'Concluir fases anteriores ao Condomínio'
                }
              >
                <CheckCircle2 size={11} strokeWidth={2} aria-hidden />
                {salvandoAncora
                  ? '...'
                  : ancoraCondominioAtiva
                    ? 'Reexibir anteriores'
                    : 'Concluir até Condomínio'}
              </button>
            ) : null}
            {podeEditarDatasEfetivo ? (
              <button
                type="button"
                onClick={() => void alternarEdicaoDatas()}
                className={`moni-calculadora-share-btn moni-calculadora-edit-datas-btn${editandoDatas ? ' moni-calculadora-edit-datas-btn--active' : ''}`}
                aria-pressed={editandoDatas}
                aria-label={editandoDatas ? 'Concluir edição de datas' : 'Editar datas manualmente'}
              >
                <Pencil size={11} strokeWidth={2} aria-hidden />
                {editandoDatas ? 'Concluir' : 'Editar datas'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void gerarECopiar()}
              disabled={shareLoading}
              className="moni-calculadora-share-btn"
              aria-label="Copiar link público da calculadora"
            >
              {shareLoading ? '...' : shareCopied ? '✓ Copiado' : '⤴ Compartilhar'}
            </button>
          </div>
        </div>
      ) : null}

      <CalculadoraResumoExecutivo resumo={resumo} linhaAtual={linhaAtual} />

      <div className={variant === 'painel' ? 'flex min-h-0 flex-1 flex-col' : undefined}>
        <div
          className={
            variant === 'painel'
              ? 'min-h-0 flex-1 overflow-y-auto pr-0.5'
              : 'max-h-72 overflow-y-auto pr-0.5'
          }
        >
          {gruposFunil.map((grupo, idx) => (
            <div key={grupo.label}>
              {idx > 0 ? <hr className="moni-calculadora-funil-separator" /> : null}
              <CalculadoraFunilGroup
                label={grupo.label}
                items={grupo.items}
                fasesMeta={metaMap}
                collapsed={collapsedFunis.has(grupo.label)}
                onToggle={() => toggleFunil(grupo.label)}
                expandedFases={expandedFases}
                onToggleFase={toggleFase}
                editandoDatas={editandoDatas && podeEditarDatasEfetivo}
                ordemAtual={ordemAtual}
                onSalvarData={onSalvarData}
                onRegistrarFlush={registrarFlushEdicaoData}
                onAplicarOverrideLocal={onAplicarOverrideLocal}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
