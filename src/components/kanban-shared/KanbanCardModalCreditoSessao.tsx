'use client';

import { useState } from 'react';
import { KanbanCardModalMoedaField } from '@/components/kanban-shared/KanbanCardModalMoedaField';
import {
  adicionarTranche,
  formatCreditoMoeda,
  restanteCredito,
  type CreditoLateral,
  type CreditoTranche,
} from '@/lib/kanban/credito-lateral';
import { fmtMoedaKanban } from '@/lib/kanban/kanban-card-modal-detalhes';

type Props = {
  draft: CreditoLateral;
  onChange: (next: CreditoLateral) => void;
  valorTerreno: string;
  valorObra: string;
  onSalvar: () => void;
  salvando: boolean;
  podeEditar: boolean;
};

const labelCls = 'text-[11px] font-medium';
const inputCls =
  'mt-0.5 w-full rounded-[var(--moni-radius-md)] border-[length:var(--moni-border-width)] border-[var(--moni-border-default)] bg-white px-2 py-1 text-xs text-[var(--moni-text-primary)] min-h-[44px] sm:min-h-0';

function rotuloMoeda(base: string, tranches: readonly CreditoTranche[]): string {
  const restante = restanteCredito(base, tranches);
  if (restante == null) return '—';
  return fmtMoedaKanban(formatCreditoMoeda(restante));
}

function CampoLeitura({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <div className={labelCls} style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
        {label}
      </div>
      <div className="text-xs" style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' }}>
        {valor || '—'}
      </div>
    </div>
  );
}

function TituloBloco({ children }: { children: string }) {
  return (
    <p
      className="text-xs font-semibold uppercase tracking-wide"
      style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' }}
    >
      {children}
    </p>
  );
}

function TranchesEditor({
  tranches,
  podeEditar,
  onChange,
}: {
  tranches: CreditoTranche[];
  podeEditar: boolean;
  onChange: (next: CreditoTranche[]) => void;
}) {
  const [numero, setNumero] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  function atualizar(alvo: number, patch: Partial<CreditoTranche>) {
    onChange(tranches.map((tranche) => (tranche.numero === alvo ? { ...tranche, ...patch } : tranche)));
  }

  function criar() {
    const n = Number(numero);
    const res = adicionarTranche(tranches, n);
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    setErro(null);
    setNumero('');
    onChange(res.tranches);
  }

  return (
    <div className="space-y-3">
      {tranches.map((tranche) => (
        <div key={tranche.numero} className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className={labelCls} style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
              Tranche {tranche.numero}
            </span>
            {podeEditar && tranche.numero !== 1 ? (
              <button
                type="button"
                onClick={() => onChange(tranches.filter((item) => item.numero !== tranche.numero))}
                className="min-h-[44px] px-2 text-[11px] sm:min-h-0"
                style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}
              >
                Remover
              </button>
            ) : null}
          </div>
          <KanbanCardModalMoedaField
            value={tranche.valor}
            disabled={!podeEditar}
            onChange={(valor) => atualizar(tranche.numero, { valor })}
          />
          <label className="block">
            <span className={labelCls} style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
              Data Tranche {tranche.numero}
            </span>
            <input
              type="date"
              value={tranche.data}
              disabled={!podeEditar}
              onChange={(e) => atualizar(tranche.numero, { data: e.target.value })}
              className={inputCls}
              style={{ fontFamily: 'var(--moni-font-sans)' }}
            />
          </label>
        </div>
      ))}
      {podeEditar ? (
        <div className="space-y-1">
          <label className="block">
            <span className={labelCls} style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
              Número da nova tranche
            </span>
            <input
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={numero}
              onChange={(e) => {
                setNumero(e.target.value);
                setErro(null);
              }}
              placeholder="Ex.: 2"
              className={inputCls}
              style={{ fontFamily: 'var(--moni-font-sans)' }}
            />
          </label>
          <button
            type="button"
            onClick={criar}
            className="w-full rounded-[var(--moni-radius-md)] border-[length:var(--moni-border-width)] px-3 text-xs font-semibold min-h-[44px]"
            style={{
              borderColor: 'var(--moni-border-default)',
              color: 'var(--moni-text-primary)',
              fontFamily: 'var(--moni-font-sans)',
              background: 'white',
            }}
          >
            Adicionar tranche
          </button>
          {erro ? (
            <p className="text-[11px]" style={{ color: 'var(--moni-text-secondary)' }}>
              {erro}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function KanbanCardModalCreditoSessao({
  draft,
  onChange,
  valorTerreno,
  valorObra,
  onSalvar,
  salvando,
  podeEditar,
}: Props) {
  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <TituloBloco>Terreno</TituloBloco>
        <CampoLeitura label="Valor do Terreno" valor={fmtMoedaKanban(valorTerreno)} />
        <CampoLeitura label="Dívida do Terreno" valor={rotuloMoeda(valorTerreno, draft.terreno_tranches)} />
        <TranchesEditor
          tranches={draft.terreno_tranches}
          podeEditar={podeEditar}
          onChange={(terreno_tranches) => onChange({ ...draft, terreno_tranches })}
        />
      </section>

      <section
        className="space-y-2 pt-3"
        style={{ borderTop: 'var(--moni-border-width) solid var(--moni-border-default)' }}
      >
        <TituloBloco>Obra</TituloBloco>
        <CampoLeitura label="Valor da Obra" valor={fmtMoedaKanban(valorObra)} />
        <CampoLeitura label="Dívida da Obra" valor={rotuloMoeda(valorObra, draft.obra_tranches)} />
        <TranchesEditor
          tranches={draft.obra_tranches}
          podeEditar={podeEditar}
          onChange={(obra_tranches) => onChange({ ...draft, obra_tranches })}
        />
      </section>

      <section
        className="space-y-2 pt-3"
        style={{ borderTop: 'var(--moni-border-width) solid var(--moni-border-default)' }}
      >
        <TituloBloco>Demais alavancagens</TituloBloco>
        <label className="block">
          <span className={labelCls} style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
            Valor da alavancagem
          </span>
          <KanbanCardModalMoedaField
            value={draft.alavancagem_valor}
            disabled={!podeEditar}
            onChange={(alavancagem_valor) => onChange({ ...draft, alavancagem_valor })}
          />
        </label>
        <CampoLeitura
          label="Valor restante"
          valor={rotuloMoeda(draft.alavancagem_valor, draft.alavancagem_tranches)}
        />
        <TranchesEditor
          tranches={draft.alavancagem_tranches}
          podeEditar={podeEditar}
          onChange={(alavancagem_tranches) => onChange({ ...draft, alavancagem_tranches })}
        />
      </section>

      {podeEditar ? (
        <button
          type="button"
          onClick={onSalvar}
          disabled={salvando}
          className="w-full rounded-[var(--moni-radius-md)] border-[length:var(--moni-border-width)] border-transparent px-3 text-xs font-semibold text-white min-h-[44px] disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-sans)' }}
        >
          {salvando ? 'Salvando…' : 'Salvar crédito'}
        </button>
      ) : null}
    </div>
  );
}
