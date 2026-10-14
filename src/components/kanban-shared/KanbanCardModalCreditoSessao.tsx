'use client';

import { useRef, useState } from 'react';
import { KanbanCardModalMoedaField } from '@/components/kanban-shared/KanbanCardModalMoedaField';
import {
  adicionarTranche,
  formatCreditoMoeda,
  restanteCredito,
  rotuloNumeroTranche,
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
  'mt-0.5 w-full rounded-[var(--moni-radius-md)] border-[length:var(--moni-border-width)] border-[var(--moni-border-default)] bg-white px-2 py-1 text-xs font-[family-name:var(--moni-font-sans)] text-[var(--moni-text-primary)] min-h-[44px] sm:min-h-0';
const moedaCls =
  'mt-0.5 flex min-h-[44px] items-center rounded-[var(--moni-radius-md)] border-[length:var(--moni-border-width)] border-[var(--moni-border-default)] bg-white px-2 py-1 sm:min-h-0';

function rotuloMoeda(base: string, tranches: readonly CreditoTranche[]): string {
  const restante = restanteCredito(base, tranches);
  if (restante == null) return '';
  return fmtMoedaKanban(formatCreditoMoeda(restante));
}

function CampoLeitura({ label, valor }: { label: string; valor: string }) {
  return (
    <label className="block min-w-0">
      <span className={labelCls} style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
        {label}
      </span>
      <input
        type="text"
        readOnly
        value={valor}
        placeholder="—"
        className={inputCls}
      />
    </label>
  );
}

function TituloBloco({ children }: { children: string }) {
  return (
    <p className="text-[11px] font-semibold" style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' }}>
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
  const [pedindoNumero, setPedindoNumero] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const criandoRef = useRef(false);

  function atualizar(alvo: number, patch: Partial<CreditoTranche>) {
    onChange(tranches.map((tranche) => (tranche.numero === alvo ? { ...tranche, ...patch } : tranche)));
  }

  function criar() {
    if (criandoRef.current) return;
    const texto = numero.trim();
    if (!texto) {
      setPedindoNumero(false);
      setErro(null);
      return;
    }
    criandoRef.current = true;
    const res = adicionarTranche(tranches, texto);
    if (!res.ok) {
      criandoRef.current = false;
      setErro(res.error);
      return;
    }
    setErro(null);
    setNumero('');
    setPedindoNumero(false);
    onChange(res.tranches);
  }

  return (
    <div className="space-y-3">
      {tranches.map((tranche) => {
        const rotulo = rotuloNumeroTranche(tranche.numero);
        return (
          <div key={tranche.numero} className="space-y-3">
            <label className="block min-w-0">
              <span className={labelCls} style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
                Tranche {rotulo}
              </span>
              <KanbanCardModalMoedaField
                value={tranche.valor}
                disabled={!podeEditar}
                className={moedaCls}
                onChange={(valor) => atualizar(tranche.numero, { valor })}
              />
            </label>
            <div className="flex items-end gap-1.5">
              <label className="block min-w-0 flex-1">
                <span className={labelCls} style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
                  Data Tranche {rotulo}
                </span>
                <input
                  type="date"
                  value={tranche.data}
                  disabled={!podeEditar}
                  onChange={(e) => atualizar(tranche.numero, { data: e.target.value })}
                  className={inputCls}
                />
              </label>
              {podeEditar && tranche.numero !== 1 ? (
                <button
                  type="button"
                  onClick={() => onChange(tranches.filter((item) => item.numero !== tranche.numero))}
                  className="mb-0.5 shrink-0 rounded-[var(--moni-radius-md)] border-[length:var(--moni-border-width)] border-[var(--moni-border-default)] px-2 text-[11px] text-[var(--moni-text-secondary)] min-h-[44px] sm:min-h-8"
                  style={{ fontFamily: 'var(--moni-font-sans)' }}
                >
                  Remover
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
      {podeEditar && !pedindoNumero ? (
        <button
          type="button"
          className="text-[11px] font-medium underline-offset-2 hover:underline min-h-[44px] sm:min-h-0"
          style={{ color: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-sans)' }}
          onClick={() => {
            criandoRef.current = false;
            setErro(null);
            setNumero('');
            setPedindoNumero(true);
          }}
        >
          + Tranche
        </button>
      ) : null}
      {podeEditar && pedindoNumero ? (
        <label className="block min-w-0">
          <span className={labelCls} style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
            Número da nova tranche
          </span>
          <input
            type="text"
            inputMode="decimal"
            autoFocus
            value={numero}
            onChange={(e) => {
              setNumero(e.target.value);
              setErro(null);
            }}
            onBlur={criar}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                criar();
              }
            }}
            placeholder="Ex.: 1,5"
            className={inputCls}
          />
          {erro ? (
            <p className="mt-0.5 text-[11px]" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
              {erro}
            </p>
          ) : null}
        </label>
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
  const travado = !podeEditar;
  return (
    <div className="space-y-3">
      <TituloBloco>Terreno</TituloBloco>
      <CampoLeitura label="Valor do Terreno" valor={valorTerreno.trim() ? fmtMoedaKanban(valorTerreno) : ''} />
      <CampoLeitura label="Valor do Terreno em aberto" valor={rotuloMoeda(valorTerreno, draft.terreno_tranches)} />
      <TranchesEditor
        tranches={draft.terreno_tranches}
        podeEditar={podeEditar}
        onChange={(terreno_tranches) => onChange({ ...draft, terreno_tranches })}
      />

      <TituloBloco>Obra</TituloBloco>
      <CampoLeitura label="Valor da Obra" valor={valorObra.trim() ? fmtMoedaKanban(valorObra) : ''} />
      <CampoLeitura label="Valor da Obra em aberto" valor={rotuloMoeda(valorObra, draft.obra_tranches)} />
      <TranchesEditor
        tranches={draft.obra_tranches}
        podeEditar={podeEditar}
        onChange={(obra_tranches) => onChange({ ...draft, obra_tranches })}
      />

      <TituloBloco>Demais alavancagens</TituloBloco>
      <label className="block min-w-0">
        <span className={labelCls} style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
          Valor da alavancagem
        </span>
        <KanbanCardModalMoedaField
          value={draft.alavancagem_valor}
          disabled={travado}
          className={moedaCls}
          onChange={(alavancagem_valor) => onChange({ ...draft, alavancagem_valor })}
        />
      </label>
      <CampoLeitura label="Valor restante" valor={rotuloMoeda(draft.alavancagem_valor, draft.alavancagem_tranches)} />
      <TranchesEditor
        tranches={draft.alavancagem_tranches}
        podeEditar={podeEditar}
        onChange={(alavancagem_tranches) => onChange({ ...draft, alavancagem_tranches })}
      />

      {podeEditar ? (
        <button
          type="button"
          onClick={onSalvar}
          disabled={salvando}
          className="w-full rounded-[var(--moni-radius-md)] border-[length:var(--moni-border-width)] border-transparent px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px] sm:min-h-0"
          style={{
            background: 'var(--moni-navy-800)',
            fontFamily: 'var(--moni-font-sans)',
          }}
        >
          {salvando ? 'Salvando…' : 'Salvar crédito'}
        </button>
      ) : null}
    </div>
  );
}
