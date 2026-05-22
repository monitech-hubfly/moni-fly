'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import type { PastelariaGanttSemanaRow } from '@/lib/pastelaria/types';
import {
  parseSemanaNumero,
  responsavelAvatarStyleGantt,
  responsavelIniciais,
  SEM_RESPONSAVEL_LABEL,
  sortResponsavelLabels,
} from '@/lib/pastelaria/responsavel';
import { normalizeSemanaLabel, semanaLabelFromNum } from '@/lib/pastelaria/week';
import { labelSemanaIsoOpcao } from '@/utils/semanaIsoUi';

type GanttCardJson = {
  id?: string;
  nome?: string;
  coluna?: string;
  responsavel_nome?: string | null;
  total_horas_semana?: number;
};

type ActivityRow = {
  id: string;
  nome: string;
  coluna: string;
  responsavelKey: string;
  responsavelLabel: string;
  semana: string;
  horas: number;
};

const WK_CUR_BORDER: CSSProperties = {
  borderLeft: '1px solid #B4B2A9',
  borderRight: '1px solid #B4B2A9',
};

function wkCurStyle(isAtual: boolean): CSSProperties {
  return isAtual ? WK_CUR_BORDER : {};
}

function totalsPorSemana(semanasData: PastelariaGanttSemanaRow[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const row of semanasData) {
    const key = normalizeSemanaLabel(String(row.semana ?? ''));
    map[key] = Number(row.total_horas ?? 0);
  }
  return map;
}

function countUniqueCards(semanasData: PastelariaGanttSemanaRow[]): number {
  const ids = new Set<string>();
  for (const row of semanasData) {
    const list = Array.isArray(row.cards) ? (row.cards as GanttCardJson[]) : [];
    for (const c of list) {
      const id = String(c.id ?? '');
      if (id) ids.add(id);
    }
  }
  return ids.size;
}

function flattenActivities(semanasData: PastelariaGanttSemanaRow[]): ActivityRow[] {
  const rows: ActivityRow[] = [];
  for (const row of semanasData) {
    const semana = normalizeSemanaLabel(String(row.semana ?? ''));
    const list = Array.isArray(row.cards) ? (row.cards as GanttCardJson[]) : [];
    for (const c of list) {
      const id = String(c.id ?? '');
      if (!id) continue;
      const respLabel = (c.responsavel_nome ?? '').trim() || SEM_RESPONSAVEL_LABEL;
      rows.push({
        id,
        nome: String(c.nome ?? '—'),
        coluna: String(c.coluna ?? ''),
        responsavelKey: respLabel,
        responsavelLabel: respLabel,
        semana,
        horas: Number(c.total_horas_semana ?? 0),
      });
    }
  }
  return rows;
}

function statusPastelaria(coluna: string): { label: string; bg: string; color: string; border: string } {
  if (coluna === 'done') {
    return { label: 'Concluído', bg: '#EAF3DE', color: '#27500A', border: '#97C459' };
  }
  return { label: 'Parcial', bg: '#FAEEDA', color: '#633806', border: '#FAC775' };
}

function buildResponsavelGroups(
  activities: ActivityRow[],
  semanasGrid: string[],
): { label: string; semanas: { semana: string; activities: ActivityRow[] }[] }[] {
  const byResp = new Map<string, ActivityRow[]>();
  for (const a of activities) {
    const list = byResp.get(a.responsavelKey) ?? [];
    list.push(a);
    byResp.set(a.responsavelKey, list);
  }

  const labels = sortResponsavelLabels(Array.from(byResp.keys()), '');

  return labels.map((label) => {
    const acts = byResp.get(label) ?? [];
    const semanaSet = new Set(acts.map((a) => a.semana));
    const semanasOrdenadas = semanasGrid
      .filter((s) => semanaSet.has(s))
      .sort((a, b) => parseSemanaNumero(a) - parseSemanaNumero(b));

    return {
      label,
      semanas: semanasOrdenadas.map((semana) => ({
        semana,
        activities: acts
          .filter((a) => a.semana === semana)
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      })),
    };
  });
}

function buildPastelariaRows(
  semanas: number[],
  semanasData: PastelariaGanttSemanaRow[],
  expandido: boolean,
  onToggle: () => void,
  semanaAtual: number | null,
  anoCalendario: number,
): ReactNode[] {
  const semanaLabels = semanas.map((s) => semanaLabelFromNum(s));
  const horasPorSemana = totalsPorSemana(semanasData);
  const totalHoras = Object.values(horasPorSemana).reduce((s, h) => s + h, 0);
  const qtdCards = countUniqueCards(semanasData);
  const resumo =
    qtdCards === 0
      ? '0 atividades · 0h não planejadas'
      : `${qtdCards} atividade${qtdCards === 1 ? '' : 's'} · ${totalHoras.toFixed(1)}h não planejadas`;

  const captionBase: CSSProperties = {
    background: '#5a1010',
    color: '#fff',
    padding: '8px 12px',
    fontSize: 13,
    verticalAlign: 'middle',
    borderBottom: '0.5px solid rgba(0,0,0,0.08)',
  };

  const rows: ReactNode[] = [
    <tr key="pastelaria-caption" className="gantt-tr gantt-tr--pastelaria-caption" role="row">
      <td colSpan={2} className="gantt-td-pastelaria-caption" style={captionBase}>
        <div
          className="pastelaria-gantt-caption"
          style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}
        >
          <span style={{ fontWeight: 500 }}>PASTELARIA</span>
          <span style={{ color: '#ffb3b3', fontSize: 12 }}>{resumo}</span>
          <span style={{ flex: 1, minWidth: 8 }} />
          <span
            style={{
              fontSize: 10,
              color: '#cc8888',
              padding: '2px 8px',
              borderRadius: 6,
              border: '1px solid rgba(204,136,136,0.35)',
            }}
          >
            somente visualização
          </span>
          <button
            type="button"
            onClick={onToggle}
            style={{
              background: '#7a1a1a',
              border: '1px solid #a03030',
              color: '#ffb3b3',
              borderRadius: 6,
              padding: '5px 12px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
            aria-expanded={expandido}
            aria-label={expandido ? 'Recolher atividades da Pastelaria' : 'Ver atividades da Pastelaria'}
          >
            {expandido ? 'Recolher' : 'Ver atividades'}
          </button>
        </div>
      </td>
      {semanas.map((s) => {
        const label = semanaLabelFromNum(s);
        const total = horasPorSemana[label] ?? 0;
        const isAtual = semanaAtual != null && Number(s) === Number(semanaAtual);
        const weekStyle: CSSProperties = {
          ...captionBase,
          background: '#5a1010',
          textAlign: 'center',
          fontSize: 11,
          ...(isAtual ? wkCurStyle(true) : {}),
          ...(total > 0
            ? { color: '#ffffff', fontWeight: 500 }
            : { color: '#8a3a3a', fontWeight: 400 }),
        };

        return (
          <td
            key={`pastelaria-total-w-${s}`}
            className="gantt-td-week gantt-td-pastelaria-total"
            style={weekStyle}
          >
            {total > 0 ? `${total.toFixed(1)}h` : '—'}
          </td>
        );
      })}
      <td
        className="gantt-td-acoes gantt-td-pastelaria-total"
        style={{ ...captionBase, textAlign: 'center' }}
      >
        —
      </td>
    </tr>,
  ];

  if (!expandido || qtdCards === 0) return rows;

  const activities = flattenActivities(semanasData);
  const groups = buildResponsavelGroups(activities, semanaLabels);

  for (const grupo of groups) {
    const totalGrupo = grupo.semanas.reduce((s, w) => s + w.activities.length, 0);
    const avatarNome = grupo.label === SEM_RESPONSAVEL_LABEL ? '?' : grupo.label;

    rows.push(
      <tr key={`pastelaria-grp-${grupo.label}`} className="gantt-tr gantt-tr--pastelaria-grupo" role="row">
        <td
          colSpan={2}
          style={{
            background: '#FFF5F5',
            padding: '6px 10px',
            verticalAlign: 'middle',
            borderBottom: '0.5px solid rgba(0,0,0,0.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {grupo.label !== SEM_RESPONSAVEL_LABEL ? (
              <span
                style={{
                  ...responsavelAvatarStyleGantt(grupo.label),
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 24,
                  height: 24,
                  borderRadius: 999,
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                {responsavelIniciais(avatarNome)}
              </span>
            ) : null}
            <span style={{ fontWeight: 600, fontSize: 12, color: '#791F1F' }}>{grupo.label}</span>
            <span style={{ fontSize: 11, color: '#A32D2D' }}>· {totalGrupo}</span>
          </div>
        </td>
        {semanaLabels.map((label) => {
          const sn = parseSemanaNumero(label);
          const isAtual = semanaAtual != null && sn === Number(semanaAtual);
          return (
            <td
              key={`grp-${grupo.label}-w-${label}`}
              className="gantt-td-week"
              style={{
                background: '#FFF5F5',
                borderBottom: '0.5px solid rgba(0,0,0,0.06)',
                ...wkCurStyle(isAtual),
              }}
            />
          );
        })}
        <td
          style={{
            background: '#FFF5F5',
            borderBottom: '0.5px solid rgba(0,0,0,0.06)',
          }}
        />
      </tr>,
    );

    for (const blocoSemana of grupo.semanas) {
      const sn = parseSemanaNumero(blocoSemana.semana);
      const tituloSemana = labelSemanaIsoOpcao(anoCalendario, sn);

      const subhdrSemanaBase: CSSProperties = {
        background: '#FEF0F0',
        padding: '5px 12px 5px 24px',
        fontSize: 11,
        fontWeight: 500,
        color: '#A32D2D',
        borderBottom: '0.5px solid rgba(0,0,0,0.06)',
      };

      rows.push(
        <tr
          key={`pastelaria-sem-${grupo.label}-${blocoSemana.semana}`}
          className="gantt-tr gantt-tr--pastelaria-semana"
          role="row"
        >
          <td colSpan={2} style={subhdrSemanaBase}>
            {tituloSemana}
          </td>
          {semanaLabels.map((label) => {
            const isAtual =
              semanaAtual != null && parseSemanaNumero(label) === Number(semanaAtual);
            return (
              <td
                key={`sem-${grupo.label}-${blocoSemana.semana}-w-${label}`}
                className="gantt-td-week"
                style={{
                  background: '#FEF0F0',
                  borderBottom: '0.5px solid rgba(0,0,0,0.06)',
                  ...wkCurStyle(isAtual),
                }}
              />
            );
          })}
          <td
            style={{
              background: '#FEF0F0',
              borderBottom: '0.5px solid rgba(0,0,0,0.06)',
            }}
          />
        </tr>,
      );

      for (const atividade of blocoSemana.activities) {
        const st = statusPastelaria(atividade.coluna);
        rows.push(
          <tr
            key={`pastelaria-act-${atividade.id}-${atividade.semana}`}
            className="gantt-tr gantt-tr--pastelaria-atividade"
            role="row"
          >
            <td
              className="gantt-shell-cell gantt-shell-cell--atividade"
              style={{
                background: '#FFFAFA',
                borderBottom: '0.5px solid rgba(0,0,0,0.06)',
                padding: '6px 8px 6px 26px',
                verticalAlign: 'middle',
                fontSize: 12,
                color: 'var(--moni-texto, #1a1a1a)',
              }}
            >
              {atividade.nome}
            </td>
            <td
              className="gantt-shell-cell gantt-shell-cell--responsavel"
              style={{
                background: '#FFFAFA',
                borderBottom: '0.5px solid rgba(0,0,0,0.06)',
                verticalAlign: 'middle',
              }}
            />
            {semanaLabels.map((label) => {
              const isAtual = semanaAtual != null && parseSemanaNumero(label) === Number(semanaAtual);
              const horas = atividade.semana === label ? atividade.horas : null;
              return (
                <td
                  key={`${atividade.id}-w-${label}`}
                  className="gantt-td-week"
                  style={{
                    background: '#FFFAFA',
                    borderBottom: '0.5px solid rgba(0,0,0,0.06)',
                    textAlign: 'center',
                    fontSize: 11,
                    verticalAlign: 'middle',
                    color: horas != null && horas > 0 ? '#791F1F' : '#D4A0A0',
                    fontWeight: horas != null && horas > 0 ? 700 : 400,
                    ...wkCurStyle(isAtual),
                  }}
                >
                  {horas != null && horas > 0 ? `${horas.toFixed(1)}h` : '—'}
                </td>
              );
            })}
            <td
              className="gantt-td-acoes"
              style={{
                background: '#FFFAFA',
                borderBottom: '0.5px solid rgba(0,0,0,0.06)',
                textAlign: 'center',
                verticalAlign: 'middle',
                padding: '6px',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 8,
                  background: st.bg,
                  color: st.color,
                  border: `1px solid ${st.border}`,
                }}
              >
                {st.label}
              </span>
            </td>
          </tr>,
        );
      }
    }
  }

  return rows;
}

export function usePastelariaGanttBloco(
  areaId: string | null | undefined,
  semanas: number[],
  semanaAtual: number | null | undefined,
) {
  const [expandido, setExpandido] = useState(false);
  const [semanasData, setSemanasData] = useState<PastelariaGanttSemanaRow[]>([]);
  const anoCalendario = useMemo(() => new Date().getFullYear(), []);

  const semanaLabels = useMemo(
    () => (semanas ?? []).map((s) => semanaLabelFromNum(Number(s))),
    [semanas],
  );

  const load = useCallback(async () => {
    if (!areaId) {
      setSemanasData([]);
      return;
    }
    const params = new URLSearchParams({ area_id: areaId });
    for (const label of semanaLabels) {
      params.append('semanas', label);
    }
    try {
      const res = await fetch(`/api/pastelaria/gantt?${params.toString()}`);
      const json = (await res.json().catch(() => ({}))) as {
        semanas?: PastelariaGanttSemanaRow[];
        error?: string;
      };
      if (!res.ok) {
        setSemanasData([]);
        return;
      }
      setSemanasData(json.semanas ?? []);
    } catch {
      setSemanasData([]);
    }
  }, [areaId, semanaLabels]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setExpandido(false);
  }, [areaId]);

  const rows = useMemo(() => {
    if (!areaId || !semanas?.length) return [];
    return buildPastelariaRows(
      semanas,
      semanasData,
      expandido,
      () => setExpandido((v) => !v),
      semanaAtual ?? null,
      anoCalendario,
    );
  }, [areaId, semanas, semanasData, expandido, semanaAtual, anoCalendario]);

  return {
    rows,
    expandido,
    setExpandido,
    reload: load,
  };
}
