'use client';

import { useState, useEffect, useCallback } from 'react';
import { garantirPastelariaCardParaChamado, salvarHorasChamadoSirene } from './horas-actions';

type Props = {
  chamadoId: number;
  titulo: string;
  onClose: () => void;
  onSaved: () => void;
};

type Unidade = 'horas' | 'minutos';
type Celula = { valor: number; unidade: Unidade };
type GridSemana = { seg: Celula; ter: Celula; qua: Celula; qui: Celula; sex: Celula };

const DIAS = ['seg', 'ter', 'qua', 'qui', 'sex'] as const;
const DIAS_LABEL: Record<string, string> = { seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex' };
const CELULA_VAZIA: Celula = { valor: 0, unidade: 'horas' };

function getSemanas(n = 20): string[] {
  const semanas: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
    const label = `S${String(week).padStart(2, '0')}`;
    if (!semanas.includes(label)) semanas.push(label);
  }
  return semanas.reverse();
}

function getDiasDaSemana(semanaLabel: string): Date[] {
  const year = new Date().getFullYear();
  const weekNum = parseInt(semanaLabel.replace('S', ''), 10);
  const jan1 = new Date(year, 0, 1);
  const daysOffset = (weekNum - 1) * 7;
  const weekStart = new Date(jan1.getTime() + daysOffset * 86400000);
  const monday = new Date(weekStart);
  monday.setDate(weekStart.getDate() - weekStart.getDay() + 1);
  return [0, 1, 2, 3, 4].map((i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function formatDia(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function totalEmHoras(grid: GridSemana): number {
  return DIAS.reduce((acc, d) => {
    const c = grid[d];
    return acc + (c.unidade === 'minutos' ? c.valor / 60 : c.valor);
  }, 0);
}

function formatTotal(grid: GridSemana): string {
  const total = totalEmHoras(grid);
  if (total === 0) return '0h';
  const h = Math.floor(total);
  const m = Math.round((total - h) * 60);
  if (m === 0) return `${h}h`;
  if (h === 0) return `${m}min`;
  return `${h}h ${m}min`;
}

export function SireneModalHoras({ chamadoId, titulo, onClose, onSaved }: Props) {
  const semanas = getSemanas();
  const semanaAtualLabel = semanas[semanas.length - 1];

  const [semanaIdx, setSemanaIdx] = useState(semanas.length - 1);
  const [grid, setGrid] = useState<GridSemana>({ seg: { ...CELULA_VAZIA }, ter: { ...CELULA_VAZIA }, qua: { ...CELULA_VAZIA }, qui: { ...CELULA_VAZIA }, sex: { ...CELULA_VAZIA } });
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const semanaLabel = semanas[semanaIdx] ?? semanaAtualLabel;
  const dias = getDiasDaSemana(semanaLabel);

  function setCelula(dia: typeof DIAS[number], field: 'valor' | 'unidade', value: number | Unidade) {
    setGrid((g) => ({ ...g, [dia]: { ...g[dia], [field]: value } }));
  }

  async function handleSalvar() {
    setSaving(true);
    setErro(null);
    try {
      const cardRes = await garantirPastelariaCardParaChamado(chamadoId, titulo);
      if (!cardRes.ok) { setErro(cardRes.error); setSaving(false); return; }

      const toHoras = (c: Celula) => c.unidade === 'minutos' ? c.valor / 60 : c.valor;

      const res = await salvarHorasChamadoSirene(cardRes.cardId, semanaLabel, {
        seg: toHoras(grid.seg), ter: toHoras(grid.ter), qua: toHoras(grid.qua),
        qui: toHoras(grid.qui), sex: toHoras(grid.sex),
        seg_unidade: grid.seg.unidade, ter_unidade: grid.ter.unidade,
        qua_unidade: grid.qua.unidade, qui_unidade: grid.qui.unidade,
        sex_unidade: grid.sex.unidade,
      });

      if (!res.ok) { setErro(res.error); setSaving(false); return; }
      onSaved();
    } catch (e) {
      setErro(String(e));
      setSaving(false);
    }
  }

  const selectClass = "rounded border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] px-1.5 py-1 text-xs text-[color:var(--moni-text-secondary)]";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-xl border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[color:var(--moni-border-default)] px-5 py-4">
          <div>
            <p className="text-xs text-[color:var(--moni-text-tertiary)]">Registrar horas por dia</p>
            <p className="mt-0.5 max-w-[380px] truncate text-sm font-medium text-[color:var(--moni-text-primary)]">{titulo}</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="text-lg text-[color:var(--moni-text-tertiary)] hover:text-[color:var(--moni-text-primary)]">✕</button>
        </div>

        {/* Semana selector */}
        <div className="flex items-center justify-center gap-3 border-b border-[color:var(--moni-border-default)] px-5 py-3">
          <button type="button" onClick={() => setSemanaIdx((i) => Math.max(0, i - 1))} disabled={semanaIdx === 0} className="rounded px-2 py-1 text-sm text-[color:var(--moni-text-secondary)] hover:bg-[var(--moni-surface-100)] disabled:opacity-30">‹</button>
          <span className="min-w-[120px] text-center text-sm font-medium text-[color:var(--moni-text-primary)]">
            {semanaLabel}
            {semanaLabel === semanaAtualLabel && (
              <span className="ml-1.5 rounded bg-[var(--moni-accent-100)] px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--moni-accent-700)]">semana atual</span>
            )}
          </span>
          <button type="button" onClick={() => setSemanaIdx((i) => Math.min(semanas.length - 1, i + 1))} disabled={semanaIdx === semanas.length - 1} className="rounded px-2 py-1 text-sm text-[color:var(--moni-text-secondary)] hover:bg-[var(--moni-surface-100)] disabled:opacity-30">›</button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <p className="mb-3 text-xs text-[color:var(--moni-text-tertiary)]">Informe o tempo em cada dia útil. A unidade pode ser horas ou minutos, por dia.</p>
          <div className="grid grid-cols-5 gap-3">
            {DIAS.map((d, i) => (
              <div key={d} className="flex flex-col items-center gap-1">
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={grid[d].valor === 0 ? '' : grid[d].valor}
                  placeholder="0"
                  onChange={(e) => setCelula(d, 'valor', Math.max(0, Number(e.target.value) || 0))}
                  className="w-full rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] px-2 py-1.5 text-center text-sm focus:outline-none focus:ring-1"
                />
                <select
                  value={grid[d].unidade}
                  onChange={(e) => setCelula(d, 'unidade', e.target.value as Unidade)}
                  className={selectClass}
                >
                  <option value="horas">horas</option>
                  <option value="minutos">minutos</option>
                </select>
                <span className="text-[11px] font-medium text-[color:var(--moni-text-secondary)]">{DIAS_LABEL[d]}</span>
                <span className="text-[10px] text-[color:var(--moni-text-tertiary)]">{formatDia(dias[i]!)}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-1.5 text-sm">
            <span className="text-[color:var(--moni-text-tertiary)]">Total da semana</span>
            <span className="font-semibold text-[color:var(--moni-text-primary)]">{formatTotal(grid)}</span>
            {totalEmHoras(grid) === 0 && <span className="text-xs text-[color:var(--moni-text-tertiary)]">— nenhum dia preenchido</span>}
          </div>

          {erro ? <p className="mt-2 text-xs text-red-600">{erro}</p> : null}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-[color:var(--moni-border-default)] px-5 py-3">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-[color:var(--moni-border-default)] px-4 py-1.5 text-sm text-[color:var(--moni-text-secondary)] hover:bg-[var(--moni-surface-50)]">
            Cancelar
          </button>
          <button type="button" onClick={handleSalvar} disabled={saving} className="rounded-lg bg-stone-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-60">
            {saving ? 'Salvando…' : 'Salvar horas'}
          </button>
        </div>
      </div>
    </div>
  );
}
