'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Paperclip } from 'lucide-react';
import { RedeDocsSecaoColapsavel } from '@/app/rede-franqueados/[id]/rede-docs-secao-colapsavel';
import { SearchableSelect } from '@/components/SearchableSelect';
import { listarCondominiosCadastro } from '@/lib/actions/kanban-card-condominio';
import { CAMPOS_EXIBICAO_CONDOMINIO } from '@/lib/condominio-campos-exibicao';
import type { CondominioRow } from '@/lib/condominios';
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

function ResumoCondominioVinculado({ row, sidebar }: { row: CondominioRow; sidebar: boolean }) {
  return (
    <dl className={sidebar ? 'mt-2 space-y-1.5' : 'mt-3 grid gap-2 sm:grid-cols-2'}>
      {CAMPOS_EXIBICAO_CONDOMINIO.map((campo) => (
        <div key={campo.key}>
          <dt className={sidebar ? sidebarLabelCls : labelCls}>{campo.label}</dt>
          <dd className={sidebar ? 'text-[11px] text-stone-800' : 'text-sm text-stone-800'}>{campo.valor(row)}</dd>
        </div>
      ))}
    </dl>
  );
}

type Props = {
  draft: RedeLoteadorFichaDraft;
  onChange: (patch: Partial<RedeLoteadorFichaDraft>) => void;
  showStatus?: boolean;
  sectionIdPrefix?: string;
  /** `sidebar`: coluna esquerda do card (uma coluna, tipografia compacta). */
  layout?: 'default' | 'sidebar';
  /** Lista já carregada (formulário externo). Sem isso, busca o cadastro da sessão. */
  condominiosIniciais?: CondominioRow[];
};

export function RedeLoteadorFichaForm({
  draft,
  onChange,
  showStatus = true,
  sectionIdPrefix = 'loteador',
  layout = 'default',
  condominiosIniciais,
}: Props) {
  const sidebar = layout === 'sidebar';
  const inputCls = sidebar ? sidebarInputCls : redeLoteadorInputCls;
  const gridCls = sidebar ? 'grid gap-2' : 'grid gap-3 sm:grid-cols-2';
  const [condominios, setCondominios] = useState<CondominioRow[]>(condominiosIniciais ?? []);

  useEffect(() => {
    if (condominiosIniciais) return;
    let cancelado = false;
    void listarCondominiosCadastro().then((rows) => {
      if (!cancelado) setCondominios(rows);
    });
    return () => {
      cancelado = true;
    };
  }, [condominiosIniciais]);

  const condominioVinculado = condominios.find((c) => c.id === draft.condominio_id) ?? null;

  const set = <K extends keyof RedeLoteadorFichaDraft>(k: K, v: RedeLoteadorFichaDraft[K]) => {
    onChange({ [k]: v });
  };

  return (
    <div className={sidebar ? 'space-y-2' : 'space-y-4'}>
      <Field label="Nome Loteadora *" sidebar={sidebar}>
        <input
          type="text"
          value={draft.nome}
          onChange={(e) => set('nome', e.target.value)}
          className={inputCls}
        />
      </Field>

      <div className={sidebar ? gridCls : 'grid gap-3 rounded-lg border border-stone-200 bg-stone-50/50 p-4 sm:grid-cols-2'}>
          <Field label="CNPJ Loteadora" sidebar={sidebar}>
            <input type="text" value={draft.cnpj} onChange={(e) => set('cnpj', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Cidade Loteadora" sidebar={sidebar}>
            <input type="text" value={draft.cidade} onChange={(e) => set('cidade', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Estado Loteadora" sidebar={sidebar}>
            <select value={draft.estado} onChange={(e) => set('estado', e.target.value)} className={inputCls}>
              <option value="">UF</option>
              {UFS_BRASIL.map((uf) => (
                <option key={uf.sigla} value={uf.sigla}>
                  {uf.sigla}
                </option>
              ))}
            </select>
          </Field>
          {showStatus ? (
            <Field label="Status" sidebar={sidebar}>
              <select value={draft.status} onChange={(e) => set('status', e.target.value as typeof draft.status)} className={inputCls}>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
                <option value="em_analise">Em análise</option>
              </select>
            </Field>
          ) : null}
        </div>

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
        <Field label="Condomínio" sidebar={sidebar}>
          <SearchableSelect
            value={draft.condominio_id}
            onChange={(id) => {
              const escolhido = condominios.find((c) => c.id === id);
              onChange({
                condominio_id: id,
                condominio_nome: escolhido?.nome ?? '',
              });
            }}
            options={condominios.map((c) => ({
              value: c.id,
              label: c.cidade ? `${c.nome} · ${c.cidade}` : c.nome,
            }))}
            emptyOption={{ value: '', label: 'Nenhum condomínio vinculado' }}
            placeholder="Vincular condomínio do cadastro"
            searchPlaceholder="Buscar condomínio"
            size={sidebar ? 'sm' : 'md'}
            menuPortal={sidebar}
            aria-label="Condomínio vinculado"
          />
        </Field>
        {condominioVinculado ? (
          <ResumoCondominioVinculado row={condominioVinculado} sidebar={sidebar} />
        ) : draft.condominio_nome.trim() ? (
          <p className={sidebar ? 'mt-2 text-[11px] text-stone-600' : 'mt-2 text-sm text-stone-600'}>
            Nome informado antes do vínculo: {draft.condominio_nome.trim()}
          </p>
        ) : null}
      </RedeDocsSecaoColapsavel>

      <RedeDocsSecaoColapsavel
        titulo="Informações de venda e carteira"
        sectionId={`${sectionIdPrefix}-carteira`}
        compact={sidebar}
      >
        <div className={gridCls}>
          <Field label="Quantos lotes tem disponíveis para venda?" sidebar={sidebar}>
            <input
              type="number"
              min={0}
              step={1}
              value={draft.carteira_lotes_disponiveis}
              onChange={(e) => set('carteira_lotes_disponiveis', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Quantos lotes foram vendidos e sem casa construída ainda?" sidebar={sidebar}>
            <input
              type="number"
              min={0}
              step={1}
              value={draft.carteira_lotes_vendidos_quitados}
              onChange={(e) => set('carteira_lotes_vendidos_quitados', e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
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
