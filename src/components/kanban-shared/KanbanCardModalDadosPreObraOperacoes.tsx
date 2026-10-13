'use client';

import { PreObraDatasMultiplasCampo } from '@/components/kanban-shared/PreObraDatasMultiplasCampo';
import { datasPreObraFromValor, valorChecklistDatasPreObra } from '@/lib/kanban/preobra-checklist-sync';
import type { OperacoesPreObraDraft } from '@/lib/kanban/previsibilidade-operacoes';

type Props = {
  draft: OperacoesPreObraDraft;
  onChange: (patch: Partial<OperacoesPreObraDraft>) => void;
  onSalvar: () => void;
  salvando: boolean;
  podeEditar: boolean;
};

const labelCls = 'text-[11px] font-medium';
const inputCls =
  'mt-0.5 w-full rounded-[var(--moni-radius-md)] border-[length:var(--moni-border-width)] border-[var(--moni-border-default)] bg-white px-2 py-1 text-xs font-[family-name:var(--moni-font-sans)] text-[var(--moni-text-primary)] min-h-[44px] sm:min-h-0';

function CampoTexto({
  label,
  value,
  type,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  type: 'url' | 'date';
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-0">
      <span className={labelCls} style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
        {label}
      </span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        placeholder={type === 'url' ? 'https://…' : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      />
    </label>
  );
}

export function KanbanCardModalDadosPreObraOperacoes({
  draft,
  onChange,
  onSalvar,
  salvando,
  podeEditar,
}: Props) {
  const travado = !podeEditar;
  return (
    <div className="space-y-3">
      <CampoTexto
        label="Docs Condomínio"
        type="url"
        value={draft.docs_condominio}
        disabled={travado}
        onChange={(docs_condominio) => onChange({ docs_condominio })}
      />
      <CampoTexto
        label="Docs Lote"
        type="url"
        value={draft.docs_lote}
        disabled={travado}
        onChange={(docs_lote) => onChange({ docs_lote })}
      />
      <CampoTexto
        label="Projeto Legal"
        type="url"
        value={draft.link_projeto_legal}
        disabled={travado}
        onChange={(link_projeto_legal) => onChange({ link_projeto_legal })}
      />
      <CampoTexto
        label="Data Aprovação no Condomínio"
        type="date"
        value={draft.condominio_aprovada_em}
        disabled={travado}
        onChange={(condominio_aprovada_em) => onChange({ condominio_aprovada_em })}
      />
      <PreObraDatasMultiplasCampo
        label="Data Comunique-se Condomínio"
        valor={valorChecklistDatasPreObra(draft.datas_comunique_se_condominio)}
        botao="+ Data Comunique-se Condomínio"
        disabled={travado}
        onCommit={(json) => onChange({ datas_comunique_se_condominio: datasPreObraFromValor(json) })}
      />
      <CampoTexto
        label="Data Aprovação na Prefeitura"
        type="date"
        value={draft.prefeitura_aprovada_em}
        disabled={travado}
        onChange={(prefeitura_aprovada_em) => onChange({ prefeitura_aprovada_em })}
      />
      <PreObraDatasMultiplasCampo
        label="Data Comunique-se Prefeitura"
        valor={valorChecklistDatasPreObra(draft.datas_comunique_se_prefeitura)}
        botao="+ Data Comunique-se Prefeitura"
        disabled={travado}
        onCommit={(json) => onChange({ datas_comunique_se_prefeitura: datasPreObraFromValor(json) })}
      />
      <CampoTexto
        label="Data Emissão do Alvará"
        type="date"
        value={draft.alvara_emitido_em}
        disabled={travado}
        onChange={(alvara_emitido_em) => onChange({ alvara_emitido_em })}
      />
      <CampoTexto
        label="Data Envio p/ Crédito Obra"
        type="date"
        value={draft.data_envio_credito_obra}
        disabled={travado}
        onChange={(data_envio_credito_obra) => onChange({ data_envio_credito_obra })}
      />
      <CampoTexto
        label="Data Aprovação Crédito Obra"
        type="date"
        value={draft.data_aprovacao_credito_obra}
        disabled={travado}
        onChange={(data_aprovacao_credito_obra) => onChange({ data_aprovacao_credito_obra })}
      />
      <CampoTexto
        label="Data Início de Obra"
        type="date"
        value={draft.data_inicio_obra}
        disabled={travado}
        onChange={(data_inicio_obra) => onChange({ data_inicio_obra })}
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
          {salvando ? 'Salvando…' : 'Salvar dados pré-obra'}
        </button>
      ) : null}
    </div>
  );
}
