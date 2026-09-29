'use client';

import {
  formatCidadeEstadoCondominio,
  formatCondominioInteiro,
  formatEnderecoNumero,
  formatTicketCadastro,
  type CondominioRow,
} from '@/lib/condominios';
import type { CondominioFormDraft } from '@/lib/condominios-form';
import { UFS_BRASIL } from '@/lib/uf';
import { SearchableSelect } from '@/components/SearchableSelect';
import { CondominioPrazosAprovacaoFields } from './CondominioPrazosAprovacaoFields';

const inputCls =
  'mt-0.5 w-full rounded border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800';

type Props = {
  draft: CondominioFormDraft;
  onChange: (patch: Partial<CondominioFormDraft>) => void;
  readOnly?: boolean;
  row?: CondominioRow | null;
  /** Omitir bloco de prazos (ex.: painel do card já renderiza seção editável separada). */
  omitPrazos?: boolean;
};

function formatDateBr(iso: string | null | undefined): string {
  const s = (iso ?? '').trim().slice(0, 10);
  if (!s) return '';
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return s;
  return `${d}/${m}/${y}`;
}

function FieldView({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-[var(--moni-text-secondary)]">{label}</div>
      <div className="text-xs text-[var(--moni-text-primary)]">{value || '—'}</div>
    </div>
  );
}

export function CondominioCamposForm({
  draft,
  onChange,
  readOnly = false,
  row,
  omitPrazos = false,
}: Props) {
  if (readOnly && row) {
    return (
      <div className="grid grid-cols-2 gap-x-2 gap-y-2">
        <FieldView label="Nome" value={row.nome} />
        <FieldView label="CEP" value={row.cep ?? ''} />
        <FieldView label="Endereço + Nº" value={formatEnderecoNumero(row.endereco, row.numero)} />
        <FieldView label="Cidade / Estado" value={formatCidadeEstadoCondominio(row.cidade, row.estado)} />
        <FieldView label="Descrição breve" value={row.descricao_breve ?? ''} />
        <FieldView label="Ticket médio lote" value={formatTicketCadastro(row.ticket_medio_lote)} />
        <FieldView label="Ticket médio casas" value={formatTicketCadastro(row.ticket_medio_casas)} />
        <FieldView
          label="Est. casas vendidas/ano"
          value={formatCondominioInteiro(row.estimativa_casas_vendidas_ano)}
        />
        <FieldView label="Extrato — Como eram essas casas" value={row.extrato_como_eram_casas ?? ''} />
        <FieldView label="Extrato — Tempo para vender" value={row.extrato_tempo_venda ?? ''} />
        <FieldView label="Data de lançamento (vendas de lote)" value={formatDateBr(row.data_lancamento_vendas)} />
        <FieldView
          label="Data liberação TVO (permissão de construir casas)"
          value={formatDateBr(row.data_liberacao_tvo)}
        />
        <FieldView label="Quantidade de lotes" value={formatCondominioInteiro(row.quantidade_lotes)} />
        <FieldView label="Metragem dos lotes (média ou faixas)" value={row.metragem_lotes ?? ''} />
        <FieldView
          label="Metragem / tipologia média das casas (média ou faixas)"
          value={row.metragem_casas ?? ''}
        />
        <FieldView
          label="Planta cadastral do condomínio / lotes com medidas (frente e lateral)"
          value={row.planta_cadastral ?? ''}
        />
        <FieldView label="Manual de obras" value={row.manual_obras ?? ''} />
        <FieldView label="Exemplo / links de casas concorrentes" value={row.casas_concorrentes ?? ''} />
        {!omitPrazos ? (
          <div
            className="col-span-2 pt-2"
            style={{ borderTop: '0.5px solid var(--moni-border-subtle)' }}
          >
            <p className="mb-2 text-[11px] font-semibold text-[var(--moni-text-secondary)]">
              Prazos de aprovação
            </p>
            <CondominioPrazosAprovacaoFields draft={draft} onChange={() => {}} readOnly row={row} />
          </div>
        ) : null}
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
        <SearchableSelect
          value={draft.estado}
          onChange={(v) => onChange({ estado: v })}
          placeholder="UF"
          searchPlaceholder="Buscar UF"
          size="sm"
          className="mt-0.5"
          triggerClassName={inputCls.replace('mt-0.5 ', '')}
          options={UFS_BRASIL.map((uf) => ({ value: uf.sigla, label: uf.sigla }))}
        />
      </label>
      <label className="col-span-2 block">
        <span className="text-[11px] font-medium text-stone-500">Descrição breve</span>
        <textarea
          rows={2}
          value={draft.descricao_breve}
          onChange={(e) => onChange({ descricao_breve: e.target.value })}
          className={inputCls}
          placeholder="Resumo do condomínio…"
        />
      </label>
      <label className="block">
        <span className="text-[11px] font-medium text-stone-500">Ticket médio lote</span>
        <input
          type="text"
          value={draft.ticket_medio_lote}
          onChange={(e) => onChange({ ticket_medio_lote: e.target.value })}
          className={inputCls}
          placeholder="Valor ou faixa"
        />
      </label>
      <label className="block">
        <span className="text-[11px] font-medium text-stone-500">Ticket médio casas</span>
        <input
          type="text"
          value={draft.ticket_medio_casas}
          onChange={(e) => onChange({ ticket_medio_casas: e.target.value })}
          className={inputCls}
          placeholder="Valor ou faixa"
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
      <label className="block">
        <span className="text-[11px] font-medium text-stone-500">Data de lançamento (vendas de lote)</span>
        <input
          type="date"
          value={draft.data_lancamento_vendas}
          onChange={(e) => onChange({ data_lancamento_vendas: e.target.value })}
          className={inputCls}
        />
      </label>
      <label className="block">
        <span className="text-[11px] font-medium text-stone-500">
          Data liberação TVO (permissão de construir casas)
        </span>
        <input
          type="date"
          value={draft.data_liberacao_tvo}
          onChange={(e) => onChange({ data_liberacao_tvo: e.target.value })}
          className={inputCls}
        />
      </label>
      <label className="block">
        <span className="text-[11px] font-medium text-stone-500">Quantidade de lotes</span>
        <input
          type="text"
          inputMode="numeric"
          value={draft.quantidade_lotes}
          onChange={(e) => onChange({ quantidade_lotes: e.target.value })}
          className={inputCls}
        />
      </label>
      <label className="block">
        <span className="text-[11px] font-medium text-stone-500">Metragem dos lotes (média ou faixas)</span>
        <input
          type="text"
          value={draft.metragem_lotes}
          onChange={(e) => onChange({ metragem_lotes: e.target.value })}
          className={inputCls}
        />
      </label>
      <label className="col-span-2 block">
        <span className="text-[11px] font-medium text-stone-500">
          Metragem / tipologia média das casas (média ou faixas)
        </span>
        <input
          type="text"
          value={draft.metragem_casas}
          onChange={(e) => onChange({ metragem_casas: e.target.value })}
          className={inputCls}
        />
      </label>
      <label className="col-span-2 block">
        <span className="text-[11px] font-medium text-stone-500">
          Planta cadastral do condomínio / lotes com medidas (frente e lateral)
        </span>
        <input
          type="text"
          value={draft.planta_cadastral}
          onChange={(e) => onChange({ planta_cadastral: e.target.value })}
          className={inputCls}
          placeholder="Link ou referência"
        />
      </label>
      <label className="col-span-2 block">
        <span className="text-[11px] font-medium text-stone-500">Manual de obras</span>
        <input
          type="text"
          value={draft.manual_obras}
          onChange={(e) => onChange({ manual_obras: e.target.value })}
          className={inputCls}
          placeholder="Link ou referência"
        />
      </label>
      <label className="col-span-2 block">
        <span className="text-[11px] font-medium text-stone-500">Exemplo / links de casas concorrentes</span>
        <input
          type="text"
          value={draft.casas_concorrentes}
          onChange={(e) => onChange({ casas_concorrentes: e.target.value })}
          className={inputCls}
          placeholder="Links"
        />
      </label>
      <div className="col-span-2 border-t border-stone-100 pt-2">
        <p className="mb-2 text-[11px] font-semibold text-stone-600">Prazos de aprovação</p>
        <CondominioPrazosAprovacaoFields
          draft={{
            prazo_aprovacao_condominio_dias: draft.prazo_aprovacao_condominio_dias,
            prazo_aprovacao_condominio_sla_tipo: draft.prazo_aprovacao_condominio_sla_tipo,
            prazo_aprovacao_prefeitura_dias: draft.prazo_aprovacao_prefeitura_dias,
            prazo_aprovacao_prefeitura_sla_tipo: draft.prazo_aprovacao_prefeitura_sla_tipo,
          }}
          onChange={onChange}
        />
      </div>
    </div>
  );
}
