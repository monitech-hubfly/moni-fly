'use client';

import { ExternalLink, Paperclip } from 'lucide-react';
import { RedeDocsSecaoColapsavel } from '@/app/rede-franqueados/[id]/rede-docs-secao-colapsavel';
import { REDE_LOTEADOR_STATUS_LABEL, type RedeLoteadorStatus } from '@/lib/rede-loteadores';
import type { RedeLoteadorFichaDraft } from '@/lib/rede-loteador-ficha-draft';
import { UFS_BRASIL } from '@/lib/uf';

export const redeLoteadorInputCls = 'w-full min-w-0 rounded-md border border-stone-300 px-3 py-2 text-sm';
const labelCls = 'mb-1 block text-xs font-medium text-stone-600';
const hintCls = 'mt-0.5 text-[11px] text-stone-500';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
      {hint ? <p className={hintCls}>{hint}</p> : null}
    </div>
  );
}

function AnexoField({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const href = value.trim();
  const isUrl = /^https?:\/\//i.test(href);
  return (
    <Field label={label} hint="Cole a URL ou path do arquivo">
      <div className="flex gap-2">
        <span className="mt-2 shrink-0 text-stone-400" aria-hidden>
          <Paperclip className="h-4 w-4" />
        </span>
        {multiline ? (
          <textarea
            rows={2}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`${redeLoteadorInputCls} resize-y`}
            placeholder={placeholder ?? 'Anexar / colar link'}
          />
        ) : (
          <input
            type="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={redeLoteadorInputCls}
            placeholder={placeholder ?? 'https://… ou path do arquivo'}
          />
        )}
        {isUrl ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 shrink-0 rounded-md border border-stone-200 p-2 text-stone-600 hover:bg-stone-50"
            title="Abrir link"
          >
            <ExternalLink className="h-4 w-4" />
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
};

export function RedeLoteadorFichaForm({
  draft,
  onChange,
  showStatus = true,
  sectionIdPrefix = 'loteador',
}: Props) {
  const set = <K extends keyof RedeLoteadorFichaDraft>(k: K, v: RedeLoteadorFichaDraft[K]) => {
    onChange({ [k]: v });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-lg border border-stone-200 bg-stone-50/50 p-4 sm:grid-cols-2">
        <Field label="Nome *">
          <input
            type="text"
            value={draft.nome}
            onChange={(e) => set('nome', e.target.value)}
            className={redeLoteadorInputCls}
          />
        </Field>
        <Field label="CNPJ">
          <input
            type="text"
            value={draft.cnpj}
            onChange={(e) => set('cnpj', e.target.value)}
            className={redeLoteadorInputCls}
          />
        </Field>
        <Field label="Cidade (loteador)">
          <input
            type="text"
            value={draft.cidade}
            onChange={(e) => set('cidade', e.target.value)}
            className={redeLoteadorInputCls}
          />
        </Field>
        <Field label="Estado">
          <select
            value={draft.estado}
            onChange={(e) => set('estado', e.target.value)}
            className={redeLoteadorInputCls}
          >
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
            <select
              value={draft.status}
              onChange={(e) => set('status', e.target.value as RedeLoteadorStatus)}
              className={redeLoteadorInputCls}
            >
              {(Object.keys(REDE_LOTEADOR_STATUS_LABEL) as RedeLoteadorStatus[]).map((s) => (
                <option key={s} value={s}>
                  {REDE_LOTEADOR_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <div className={showStatus ? 'sm:col-span-2' : 'sm:col-span-2'}>
          <Field label="Portfólio">
            <textarea
              rows={2}
              value={draft.portfolio_descricao}
              onChange={(e) => set('portfolio_descricao', e.target.value)}
              className={`${redeLoteadorInputCls} resize-y`}
            />
          </Field>
        </div>
      </div>

      <RedeDocsSecaoColapsavel
        titulo="Informações do Parceiro"
        sectionId={`${sectionIdPrefix}-parceiro`}
        defaultOpen
      >
        <p className="text-xs text-stone-500">
          Contato geral do loteador e interlocutor específico da negociação (podem ser pessoas diferentes).
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Contato — nome">
            <input
              type="text"
              value={draft.contato_nome}
              onChange={(e) => set('contato_nome', e.target.value)}
              className={redeLoteadorInputCls}
            />
          </Field>
          <Field label="Contato — telefone">
            <input
              type="text"
              value={draft.contato_telefone}
              onChange={(e) => set('contato_telefone', e.target.value)}
              className={redeLoteadorInputCls}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Contato — e-mail">
              <input
                type="email"
                value={draft.contato_email}
                onChange={(e) => set('contato_email', e.target.value)}
                className={redeLoteadorInputCls}
              />
            </Field>
          </div>
        </div>
        <hr className="border-stone-200" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Interlocutor — nome">
            <input
              type="text"
              value={draft.interlocutor_nome}
              onChange={(e) => set('interlocutor_nome', e.target.value)}
              className={redeLoteadorInputCls}
            />
          </Field>
          <Field label="Interlocutor — cargo">
            <input
              type="text"
              value={draft.interlocutor_cargo}
              onChange={(e) => set('interlocutor_cargo', e.target.value)}
              className={redeLoteadorInputCls}
            />
          </Field>
          <Field label="Interlocutor — telefone">
            <input
              type="text"
              value={draft.interlocutor_telefone}
              onChange={(e) => set('interlocutor_telefone', e.target.value)}
              className={redeLoteadorInputCls}
            />
          </Field>
          <Field label="Interlocutor — e-mail">
            <input
              type="email"
              value={draft.interlocutor_email}
              onChange={(e) => set('interlocutor_email', e.target.value)}
              className={redeLoteadorInputCls}
            />
          </Field>
        </div>
      </RedeDocsSecaoColapsavel>

      <RedeDocsSecaoColapsavel titulo="Informações do Condomínio" sectionId={`${sectionIdPrefix}-condominio`}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome do condomínio">
            <input
              type="text"
              value={draft.condominio_nome}
              onChange={(e) => set('condominio_nome', e.target.value)}
              className={redeLoteadorInputCls}
            />
          </Field>
          <Field label="Data de lançamento / TVO">
            <input
              type="date"
              value={draft.condominio_data_lancamento}
              onChange={(e) => set('condominio_data_lancamento', e.target.value)}
              className={redeLoteadorInputCls}
            />
          </Field>
          <Field label="Cidade do condomínio">
            <input
              type="text"
              value={draft.condominio_cidade}
              onChange={(e) => set('condominio_cidade', e.target.value)}
              className={redeLoteadorInputCls}
              placeholder="Pode diferir da cidade do loteador"
            />
          </Field>
          <Field label="Quantidade de lotes">
            <input
              type="number"
              min={0}
              value={draft.condominio_qtd_lotes}
              onChange={(e) => set('condominio_qtd_lotes', e.target.value)}
              className={redeLoteadorInputCls}
            />
          </Field>
          <Field label="Preço dos lotes (média ou faixas)">
            <textarea
              rows={2}
              value={draft.condominio_preco_lotes}
              onChange={(e) => set('condominio_preco_lotes', e.target.value)}
              className={`${redeLoteadorInputCls} resize-y`}
            />
          </Field>
          <Field label="Metragem dos lotes (média ou faixas)">
            <textarea
              rows={2}
              value={draft.condominio_metragem_lotes}
              onChange={(e) => set('condominio_metragem_lotes', e.target.value)}
              className={`${redeLoteadorInputCls} resize-y`}
            />
          </Field>
          <Field label="Preço das casas (média ou faixas)">
            <textarea
              rows={2}
              value={draft.condominio_preco_casas}
              onChange={(e) => set('condominio_preco_casas', e.target.value)}
              className={`${redeLoteadorInputCls} resize-y`}
            />
          </Field>
          <Field label="Metragem / tipologia das casas">
            <textarea
              rows={2}
              value={draft.condominio_metragem_casas}
              onChange={(e) => set('condominio_metragem_casas', e.target.value)}
              className={`${redeLoteadorInputCls} resize-y`}
            />
          </Field>
        </div>
        <div className="grid gap-3">
          <AnexoField
            label="Planta cadastral"
            value={draft.anexo_planta_cadastral}
            onChange={(v) => set('anexo_planta_cadastral', v)}
          />
          <AnexoField
            label="Manual de obras"
            value={draft.anexo_manual_obras}
            onChange={(v) => set('anexo_manual_obras', v)}
          />
          <AnexoField
            label="Casas concorrentes"
            value={draft.anexo_casas_concorrentes}
            onChange={(v) => set('anexo_casas_concorrentes', v)}
            multiline
          />
        </div>
      </RedeDocsSecaoColapsavel>

      <RedeDocsSecaoColapsavel titulo="Venda e Carteira" sectionId={`${sectionIdPrefix}-carteira`}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Lotes disponíveis">
            <input
              type="number"
              min={0}
              value={draft.carteira_lotes_disponiveis}
              onChange={(e) => set('carteira_lotes_disponiveis', e.target.value)}
              className={redeLoteadorInputCls}
            />
          </Field>
          <Field label="Vendidos e quitados (sem casa)">
            <input
              type="number"
              min={0}
              value={draft.carteira_lotes_vendidos_quitados}
              onChange={(e) => set('carteira_lotes_vendidos_quitados', e.target.value)}
              className={redeLoteadorInputCls}
            />
          </Field>
          <Field label="Carteira curta — quantidade">
            <input
              type="number"
              min={0}
              value={draft.carteira_carteira_curta_qtd}
              onChange={(e) => set('carteira_carteira_curta_qtd', e.target.value)}
              className={redeLoteadorInputCls}
            />
          </Field>
        </div>
        <Field label="Carteira curta — financiamento (entrada + prestação)">
          <textarea
            rows={2}
            value={draft.carteira_curta_financiamento}
            onChange={(e) => set('carteira_curta_financiamento', e.target.value)}
            className={`${redeLoteadorInputCls} resize-y`}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Carteira longa — quantidade">
            <input
              type="number"
              min={0}
              value={draft.carteira_longa_qtd}
              onChange={(e) => set('carteira_longa_qtd', e.target.value)}
              className={redeLoteadorInputCls}
            />
          </Field>
        </div>
        <Field label="Carteira longa — financiamento (entrada + prestação)">
          <textarea
            rows={2}
            value={draft.carteira_longa_financiamento}
            onChange={(e) => set('carteira_longa_financiamento', e.target.value)}
            className={`${redeLoteadorInputCls} resize-y`}
          />
        </Field>
        <AnexoField
          label="Tabela de preços"
          value={draft.anexo_tabela_precos}
          onChange={(v) => set('anexo_tabela_precos', v)}
        />
      </RedeDocsSecaoColapsavel>

      <RedeDocsSecaoColapsavel titulo="Campo Livre" sectionId={`${sectionIdPrefix}-livre`}>
        <Field label="Informações adicionais">
          <textarea
            rows={4}
            value={draft.campo_livre}
            onChange={(e) => set('campo_livre', e.target.value)}
            className={`${redeLoteadorInputCls} resize-y`}
          />
        </Field>
        <Field label="Observações (cadastro)">
          <textarea
            rows={3}
            value={draft.observacoes}
            onChange={(e) => set('observacoes', e.target.value)}
            className={`${redeLoteadorInputCls} resize-y`}
          />
        </Field>
        <AnexoField
          label="Material extra"
          value={draft.anexo_material_extra}
          onChange={(v) => set('anexo_material_extra', v)}
          multiline
        />
      </RedeDocsSecaoColapsavel>
    </div>
  );
}
