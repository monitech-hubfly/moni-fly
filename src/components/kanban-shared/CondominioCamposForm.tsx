'use client';

import {
  formatCidadeEstadoCondominio,
  formatCondominioInteiro,
  formatCondominioMoeda,
  formatEnderecoNumero,
  type CondominioRow,
} from '@/lib/condominios';
import type { CondominioFormDraft } from '@/lib/condominios-form';
import { UFS_BRASIL } from '@/lib/uf';

const inputCls =
  'mt-0.5 w-full rounded border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800';

type Props = {
  draft: CondominioFormDraft;
  onChange: (patch: Partial<CondominioFormDraft>) => void;
  readOnly?: boolean;
  row?: CondominioRow | null;
};

function FieldView({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-stone-500">{label}</div>
      <div className="text-xs text-stone-800">{value || '—'}</div>
    </div>
  );
}

export function CondominioCamposForm({ draft, onChange, readOnly = false, row }: Props) {
  if (readOnly && row) {
    return (
      <div className="grid grid-cols-2 gap-x-2 gap-y-2">
        <FieldView label="Nome" value={row.nome} />
        <FieldView label="CEP" value={row.cep ?? ''} />
        <FieldView label="Endereço + Nº" value={formatEnderecoNumero(row.endereco, row.numero)} />
        <FieldView label="Cidade / Estado" value={formatCidadeEstadoCondominio(row.cidade, row.estado)} />
        <FieldView label="Ticket médio lote" value={formatCondominioMoeda(row.ticket_medio_lote)} />
        <FieldView label="Ticket médio casas" value={formatCondominioMoeda(row.ticket_medio_casas)} />
        <FieldView
          label="Ticket médio casas (R$/m²)"
          value={formatCondominioMoeda(row.ticket_medio_casas_rsm2)}
        />
        <FieldView
          label="Est. casas vendidas/ano"
          value={formatCondominioInteiro(row.estimativa_casas_vendidas_ano)}
        />
        <FieldView label="Extrato — Como eram essas casas" value={row.extrato_como_eram_casas ?? ''} />
        <FieldView label="Extrato — Tempo para vender" value={row.extrato_tempo_venda ?? ''} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-2 gap-y-2">
      <label className="col-span-2 block">
        <span className="text-[11px] font-medium text-stone-500">Nome *</span>
        <input
          type="text"
          value={draft.nome}
          onChange={(e) => onChange({ nome: e.target.value })}
          className={inputCls}
          required
        />
      </label>
      <label className="block">
        <span className="text-[11px] font-medium text-stone-500">Endereço</span>
        <input
          type="text"
          value={draft.endereco}
          onChange={(e) => onChange({ endereco: e.target.value })}
          className={inputCls}
        />
      </label>
      <label className="block">
        <span className="text-[11px] font-medium text-stone-500">Número</span>
        <input
          type="text"
          value={draft.numero}
          onChange={(e) => onChange({ numero: e.target.value })}
          className={inputCls}
        />
      </label>
      <label className="block">
        <span className="text-[11px] font-medium text-stone-500">CEP</span>
        <input
          type="text"
          value={draft.cep}
          onChange={(e) => onChange({ cep: e.target.value })}
          className={inputCls}
        />
      </label>
      <label className="block">
        <span className="text-[11px] font-medium text-stone-500">Cidade</span>
        <input
          type="text"
          value={draft.cidade}
          onChange={(e) => onChange({ cidade: e.target.value })}
          className={inputCls}
        />
      </label>
      <label className="block">
        <span className="text-[11px] font-medium text-stone-500">Estado</span>
        <select
          value={draft.estado}
          onChange={(e) => onChange({ estado: e.target.value })}
          className={inputCls}
        >
          <option value="">UF</option>
          {UFS_BRASIL.map((uf) => (
            <option key={uf.sigla} value={uf.sigla}>
              {uf.sigla}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-[11px] font-medium text-stone-500">Ticket médio lote</span>
        <input
          type="text"
          inputMode="decimal"
          value={draft.ticket_medio_lote}
          onChange={(e) => onChange({ ticket_medio_lote: e.target.value })}
          className={inputCls}
          placeholder="R$"
        />
      </label>
      <label className="block">
        <span className="text-[11px] font-medium text-stone-500">Ticket médio casas</span>
        <input
          type="text"
          inputMode="decimal"
          value={draft.ticket_medio_casas}
          onChange={(e) => onChange({ ticket_medio_casas: e.target.value })}
          className={inputCls}
          placeholder="R$"
        />
      </label>
      <label className="block">
        <span className="text-[11px] font-medium text-stone-500">Ticket médio casas (R$/m²)</span>
        <input
          type="text"
          inputMode="decimal"
          value={draft.ticket_medio_casas_rsm2}
          onChange={(e) => onChange({ ticket_medio_casas_rsm2: e.target.value })}
          className={inputCls}
          placeholder="R$/m²"
        />
      </label>
      <label className="block">
        <span className="text-[11px] font-medium text-stone-500">Est. casas vendidas/ano</span>
        <input
          type="text"
          inputMode="numeric"
          value={draft.estimativa_casas_vendidas_ano}
          onChange={(e) => onChange({ estimativa_casas_vendidas_ano: e.target.value })}
          className={inputCls}
        />
      </label>
      <label className="col-span-2 block">
        <span className="text-[11px] font-medium text-stone-500">Extrato — Como eram essas casas</span>
        <textarea
          rows={2}
          value={draft.extrato_como_eram_casas}
          onChange={(e) => onChange({ extrato_como_eram_casas: e.target.value })}
          className={inputCls}
        />
      </label>
      <label className="col-span-2 block">
        <span className="text-[11px] font-medium text-stone-500">Extrato — Quanto tempo demorou pra vender</span>
        <textarea
          rows={2}
          value={draft.extrato_tempo_venda}
          onChange={(e) => onChange({ extrato_tempo_venda: e.target.value })}
          className={inputCls}
        />
      </label>
    </div>
  );
}
