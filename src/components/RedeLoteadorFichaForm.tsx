'use client';

import { ExternalLink, Paperclip } from 'lucide-react';
import { RedeDocsSecaoColapsavel } from '@/app/rede-franqueados/[id]/rede-docs-secao-colapsavel';
import type { RedeLoteadorFichaDraft } from '@/lib/rede-loteador-ficha-draft';
import { UFS_BRASIL } from '@/lib/uf';

export const redeLoteadorInputCls = 'w-full min-w-0 rounded-md border border-stone-300 px-3 py-2 text-sm';
const sidebarInputCls = 'w-full min-w-0 rounded-md border border-stone-300 px-2 py-1.5 text-[11px]';
const labelCls = 'mb-1 block text-xs font-medium text-stone-600';
const sidebarLabelCls = 'mb-0.5 block text-[10px] font-medium text-stone-600';
const hintCls = 'mt-0.5 text-[11px] text-stone-500';
const sidebarHintCls = 'mt-0.5 text-[10px] leading-snug text-stone-500';

function Field({
  label,
  hint,
  children,
  sidebar,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  sidebar?: boolean;
}) {
  return (
    <div>
      <label className={sidebar ? sidebarLabelCls : labelCls}>{label}</label>
      {children}
      {hint ? <p className={sidebar ? sidebarHintCls : hintCls}>{hint}</p> : null}
    </div>
  );
}

function AnexoField({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  sidebar,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  sidebar?: boolean;
}) {
  const inputCls = sidebar ? sidebarInputCls : redeLoteadorInputCls;
  const href = value.trim();
  const isUrl = /^https?:\/\//i.test(href);
  return (
    <Field label={label} hint="Cole a URL ou path do arquivo" sidebar={sidebar}>
      <div className="flex gap-1.5">
        <span className="mt-1.5 shrink-0 text-stone-400" aria-hidden>
          <Paperclip className={sidebar ? 'h-3 w-3' : 'h-4 w-4'} />
        </span>
        {multiline ? (
          <textarea
            rows={2}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`${inputCls} resize-y`}
            placeholder={placeholder ?? 'Anexar / colar link'}
          />
        ) : (
          <input
            type="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={inputCls}
            placeholder={placeholder ?? 'https://… ou path do arquivo'}
          />
        )}
        {isUrl ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 shrink-0 rounded-md border border-stone-200 p-1.5 text-stone-600 hover:bg-stone-50"
            title="Abrir link"
          >
            <ExternalLink className={sidebar ? 'h-3 w-3' : 'h-4 w-4'} />
          </a>
        ) : null}
      </div>
    </Field>
  );
}

type Props = {
  draft: RedeLoteadorFichaDraft;
  onChange: (patch: Partial<RedeLoteadorFichaDraft>) => void;
  showStatus?: boolean;
  sectionIdPrefix?: string;
  /** `sidebar`: coluna esquerda do card (uma coluna, tipografia compacta). */
  layout?: 'default' | 'sidebar';
};

export function RedeLoteadorFichaForm({
  draft,
  onChange,
  showStatus = true,
  sectionIdPrefix = 'loteador',
  layout = 'default',
}: Props) {
  const sidebar = layout === 'sidebar';
  const inputCls = sidebar ? sidebarInputCls : redeLoteadorInputCls;
  const gridCls = sidebar ? 'grid gap-2' : 'grid gap-3 sm:grid-cols-2';

  const set = <K extends keyof RedeLoteadorFichaDraft>(k: K, v: RedeLoteadorFichaDraft[K]) => {
    onChange({ [k]: v });
  };

  return (
    <div className={sidebar ? 'space-y-2' : 'space-y-4'}>
      <Field label="Nome do loteador *" sidebar={sidebar}>
        <input
          type="text"
          value={draft.nome}
          onChange={(e) => set('nome', e.target.value)}
          className={inputCls}
        />
      </Field>

      {!sidebar ? (
        <div className="grid gap-3 rounded-lg border border-stone-200 bg-stone-50/50 p-4 sm:grid-cols-2">
          <Field label="CNPJ">
            <input type="text" value={draft.cnpj} onChange={(e) => set('cnpj', e.target.value)} className={redeLoteadorInputCls} />
          </Field>
          <Field label="Cidade (loteador)">
            <input type="text" value={draft.cidade} onChange={(e) => set('cidade', e.target.value)} className={redeLoteadorInputCls} />
          </Field>
          <Field label="Estado (loteador)">
            <select value={draft.estado} onChange={(e) => set('estado', e.target.value)} className={redeLoteadorInputCls}>
              <option value="">UF</option>
              {UFS_BRASIL.map((uf) => (
                <option key={uf.sigla} value={uf.sigla}>
                  {uf.sigla}
                </option>
              ))}
            </select>
          </Field>
          {showStatus ? (
            <Field label="Status">
              <select value={draft.status} onChange={(e) => set('status', e.target.value as typeof draft.status)} className={redeLoteadorInputCls}>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
                <option value="em_analise">Em análise</option>
              </select>
            </Field>
          ) : null}
        </div>
      ) : null}

      <RedeDocsSecaoColapsavel
        titulo="Informações do Parceiro"
        sectionId={`${sectionIdPrefix}-parceiro`}
        defaultOpen={sidebar}
        compact={sidebar}
      >
        <div className={gridCls}>
          <Field label="Nome do responsável / interlocutor da negociação" sidebar={sidebar}>
            <input
              type="text"
              value={draft.interlocutor_nome}
              onChange={(e) => set('interlocutor_nome', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Cargo / função" sidebar={sidebar}>
            <input
              type="text"
              value={draft.interlocutor_cargo}
              onChange={(e) => set('interlocutor_cargo', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Telefone" sidebar={sidebar}>
            <input
              type="tel"
              value={draft.interlocutor_telefone}
              onChange={(e) => set('interlocutor_telefone', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="E-mail" sidebar={sidebar}>
            <input
              type="email"
              value={draft.interlocutor_email}
              onChange={(e) => set('interlocutor_email', e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
      </RedeDocsSecaoColapsavel>

      <RedeDocsSecaoColapsavel
        titulo="Informações do Condomínio"
        sectionId={`${sectionIdPrefix}-condominio`}
        compact={sidebar}
      >
        <div className={gridCls}>
          <Field label="Nome do condomínio" sidebar={sidebar}>
            <input
              type="text"
              value={draft.condominio_nome}
              onChange={(e) => set('condominio_nome', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Data de lançamento / TVO" sidebar={sidebar}>
            <input
              type="date"
              value={draft.condominio_data_lancamento}
              onChange={(e) => set('condominio_data_lancamento', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Cidade" sidebar={sidebar}>
            <input
              type="text"
              value={draft.condominio_cidade}
              onChange={(e) => set('condominio_cidade', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Estado" sidebar={sidebar}>
            <select value={draft.estado} onChange={(e) => set('estado', e.target.value)} className={inputCls}>
              <option value="">UF</option>
              {UFS_BRASIL.map((uf) => (
                <option key={uf.sigla} value={uf.sigla}>
                  {uf.sigla}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Quantidade de lotes" sidebar={sidebar}>
            <input
              type="number"
              min={0}
              value={draft.condominio_qtd_lotes}
              onChange={(e) => set('condominio_qtd_lotes', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field
            label="Preço dos lotes"
            hint="Média ou faixas de preço"
            sidebar={sidebar}
          >
            <textarea
              rows={2}
              value={draft.condominio_preco_lotes}
              onChange={(e) => set('condominio_preco_lotes', e.target.value)}
              className={`${inputCls} resize-y`}
            />
          </Field>
          <Field label="Metragem dos lotes" hint="Média ou faixas" sidebar={sidebar}>
            <textarea
              rows={2}
              value={draft.condominio_metragem_lotes}
              onChange={(e) => set('condominio_metragem_lotes', e.target.value)}
              className={`${inputCls} resize-y`}
            />
          </Field>
          <Field label="Preço de casas" hint="Média ou faixas de preço" sidebar={sidebar}>
            <textarea
              rows={2}
              value={draft.condominio_preco_casas}
              onChange={(e) => set('condominio_preco_casas', e.target.value)}
              className={`${inputCls} resize-y`}
            />
          </Field>
          <Field label="Metragem / tipologia média das casas" hint="Média ou faixas" sidebar={sidebar}>
            <textarea
              rows={2}
              value={draft.condominio_metragem_casas}
              onChange={(e) => set('condominio_metragem_casas', e.target.value)}
              className={`${inputCls} resize-y`}
            />
          </Field>
        </div>
        <div className="mt-2 space-y-2">
          <AnexoField
            label="Planta cadastral do condomínio / lotes com medidas (frente e lateral)"
            value={draft.anexo_planta_cadastral}
            onChange={(v) => set('anexo_planta_cadastral', v)}
            sidebar={sidebar}
          />
          <AnexoField
            label="Manual de obras"
            value={draft.anexo_manual_obras}
            onChange={(v) => set('anexo_manual_obras', v)}
            sidebar={sidebar}
          />
          <AnexoField
            label="Exemplo / links de casas concorrentes (se houver)"
            value={draft.anexo_casas_concorrentes}
            onChange={(v) => set('anexo_casas_concorrentes', v)}
            multiline
            sidebar={sidebar}
          />
        </div>
      </RedeDocsSecaoColapsavel>

      <RedeDocsSecaoColapsavel
        titulo="Informações de venda e carteira"
        sectionId={`${sectionIdPrefix}-carteira`}
        compact={sidebar}
      >
        <div className={sidebar ? 'grid gap-2' : 'grid gap-3 sm:grid-cols-2'}>
          <Field label="Lotes disponíveis para venda" sidebar={sidebar}>
            <input
              type="number"
              min={0}
              value={draft.carteira_lotes_disponiveis}
              onChange={(e) => set('carteira_lotes_disponiveis', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Lotes vendidos e quitados (sem casa construída)" sidebar={sidebar}>
            <input
              type="number"
              min={0}
              value={draft.carteira_lotes_vendidos_quitados}
              onChange={(e) => set('carteira_lotes_vendidos_quitados', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Lotes em quitação — carteira curta" sidebar={sidebar}>
            <input
              type="number"
              min={0}
              value={draft.carteira_carteira_curta_qtd}
              onChange={(e) => set('carteira_carteira_curta_qtd', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Lotes em quitação — carteira longa" sidebar={sidebar}>
            <input
              type="number"
              min={0}
              value={draft.carteira_longa_qtd}
              onChange={(e) => set('carteira_longa_qtd', e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
        <Field
          label="Financiamento padrão — carteira curta (entrada e prestação)"
          sidebar={sidebar}
        >
          <textarea
            rows={2}
            value={draft.carteira_curta_financiamento}
            onChange={(e) => set('carteira_curta_financiamento', e.target.value)}
            className={`${inputCls} resize-y`}
          />
        </Field>
        <Field
          label="Financiamento padrão — carteira longa (entrada e prestação)"
          sidebar={sidebar}
        >
          <textarea
            rows={2}
            value={draft.carteira_longa_financiamento}
            onChange={(e) => set('carteira_longa_financiamento', e.target.value)}
            className={`${inputCls} resize-y`}
          />
        </Field>
        <AnexoField
          label="Tabelas de preço de lotes"
          value={draft.anexo_tabela_precos}
          onChange={(v) => set('anexo_tabela_precos', v)}
          sidebar={sidebar}
        />
      </RedeDocsSecaoColapsavel>

      <RedeDocsSecaoColapsavel
        titulo="Campo livre"
        sectionId={`${sectionIdPrefix}-livre`}
        compact={sidebar}
      >
        <Field
          label="Informações adicionais"
          hint="Ex.: poda de árvores, condomínios concorrentes, interlocutores a incluir, etc."
          sidebar={sidebar}
        >
          <textarea
            rows={sidebar ? 3 : 4}
            value={draft.campo_livre}
            onChange={(e) => set('campo_livre', e.target.value)}
            className={`${inputCls} resize-y`}
          />
        </Field>
        <AnexoField
          label="Material complementar"
          value={draft.anexo_material_extra}
          onChange={(v) => set('anexo_material_extra', v)}
          multiline
          sidebar={sidebar}
        />
      </RedeDocsSecaoColapsavel>
    </div>
  );
}
