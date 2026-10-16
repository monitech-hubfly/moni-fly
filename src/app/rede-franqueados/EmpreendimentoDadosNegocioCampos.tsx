'use client';

import { useEffect, useState } from 'react';
import { SearchableSelect } from '@/components/SearchableSelect';
import { KanbanCardModalMoedaField } from '@/components/kanban-shared/KanbanCardModalMoedaField';
import { KanbanCardModalNegocioPrazoField } from '@/components/kanban-shared/KanbanCardModalNegocioPrazoField';
import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import type { NegocioPrazoDraft, FaseNegocioPrazoOpcao } from '@/lib/kanban/dados-negocio-prazo';
import { moedaCampoValorInicial } from '@/lib/kanban/moeda-campo';
import {
  opcoesProdutoModeloCasaComValorAtual,
  opcoesTipoNegociacaoComValorAtual,
} from '@/lib/kanban/tipo-negociacao-terreno';
import {
  CAMPOS_NEGOCIO_EMPREENDIMENTO,
  type EmpreendimentoNegocioKey,
  type ImobEmpreendimentoRow,
} from '@/lib/imob-empreendimentos';
import { createClient } from '@/lib/supabase/client';

type NegocioValor = Pick<ImobEmpreendimentoRow, EmpreendimentoNegocioKey>;

type Props = {
  value: NegocioValor;
  onChange: (patch: Partial<NegocioValor>) => void;
};

const inputClass =
  'mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:border-[var(--moni-navy-800)] focus:outline-none focus:ring-1 focus:ring-[var(--moni-navy-800)]';

function numStr(v: number | null): string {
  return v == null ? '' : String(v);
}

export function EmpreendimentoDadosNegocioCampos({ value, onChange }: Props) {
  const [fases, setFases] = useState<FaseNegocioPrazoOpcao[]>([]);

  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from('kanban_fases')
      .select('id, nome')
      .eq('kanban_id', KANBAN_IDS.PORTFOLIO)
      .eq('ativo', true)
      .order('ordem', { ascending: true })
      .then(({ data }) => {
        setFases(
          (data ?? []).map((f) => ({
            id: String((f as { id?: string }).id ?? ''),
            label: String((f as { nome?: string }).nome ?? '').trim() || 'Fase',
          })),
        );
      });
  }, []);

  return (
    <div className="space-y-4 border-t border-stone-100 pt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Dados do negócio</p>
      {CAMPOS_NEGOCIO_EMPREENDIMENTO.map((campo) => {
        if (campo.kind === 'select-tipo') {
          return (
            <label key={campo.key} className="block">
              <span className="block text-xs font-medium text-stone-700">{campo.label}</span>
              <SearchableSelect
                value={value.tipo_negocio ?? ''}
                onChange={(v) => onChange({ tipo_negocio: v || null })}
                placeholder="Selecione"
                className="mt-1"
                options={opcoesTipoNegociacaoComValorAtual(value.tipo_negocio)}
              />
            </label>
          );
        }
        if (campo.kind === 'select-produto') {
          return (
            <label key={campo.key} className="block">
              <span className="block text-xs font-medium text-stone-700">{campo.label}</span>
              <SearchableSelect
                value={value.produto_modelo ?? ''}
                onChange={(v) => onChange({ produto_modelo: v || null })}
                placeholder="Selecione"
                className="mt-1"
                options={opcoesProdutoModeloCasaComValorAtual(value.produto_modelo)}
              />
            </label>
          );
        }
        if (campo.kind === 'moeda') {
          const atual = String(value[campo.key] ?? '');
          return (
            <label key={campo.key} className="block">
              <span className="block text-xs font-medium text-stone-700">{campo.label}</span>
              <KanbanCardModalMoedaField
                value={moedaCampoValorInicial(atual)}
                onChange={(v) => onChange({ [campo.key]: v || null } as Partial<NegocioValor>)}
                className="mt-1 flex min-h-[38px] items-center rounded-md border border-stone-300 bg-white px-3 py-2"
              />
            </label>
          );
        }
        if (campo.kind === 'percent' || campo.kind === 'm2') {
          const atual = value[campo.key];
          return (
            <label key={campo.key} className="block">
              <span className="block text-xs font-medium text-stone-700">{campo.label}</span>
              <input
                type="number"
                step="0.01"
                min="0"
                max={campo.kind === 'percent' ? 100 : undefined}
                value={numStr(typeof atual === 'number' ? atual : null)}
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  const n = raw === '' ? null : Number(raw.replace(',', '.'));
                  onChange({
                    [campo.key]: n != null && Number.isFinite(n) ? n : null,
                  } as Partial<NegocioValor>);
                }}
                className={inputClass}
              />
            </label>
          );
        }
        if (campo.kind === 'prazo') {
          const draft = value[campo.key] as NegocioPrazoDraft;
          return (
            <KanbanCardModalNegocioPrazoField
              key={campo.key}
              label={campo.label}
              draft={draft}
              faseOpcoes={fases}
              onChange={(next) => onChange({ [campo.key]: next } as Partial<NegocioValor>)}
            />
          );
        }
        if (campo.kind === 'data') {
          return (
            <label key={campo.key} className="block">
              <span className="block text-xs font-medium text-stone-700">{campo.label}</span>
              <input
                type="date"
                value={String(value[campo.key] ?? '')}
                onChange={(e) => onChange({ [campo.key]: e.target.value || null } as Partial<NegocioValor>)}
                className={inputClass}
              />
            </label>
          );
        }
        return (
          <label key={campo.key} className="block">
            <span className="block text-xs font-medium text-stone-700">{campo.label}</span>
            <input
              type="url"
              placeholder="https://"
              value={String(value[campo.key] ?? '')}
              onChange={(e) => onChange({ [campo.key]: e.target.value || null } as Partial<NegocioValor>)}
              className={inputClass}
            />
          </label>
        );
      })}
    </div>
  );
}
