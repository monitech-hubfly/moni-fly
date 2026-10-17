'use client';

import { startTransition, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { salvarSimuladorTemplateDoCard } from '@/lib/actions/loteamento-simulador-template';
import { CampoNumeroBr } from '@/components/simulador/CampoNumeroBr';
import {
  PCT_FIELDS,
  PCT_TAXA_GESTAO_PADRAO_UI,
  PRAZO_OBRA_MESES_MINIMO,
  PRAZO_OBRA_MESES_PADRAO,
  TOAST_TEMPLATE_SALVO,
  VALOR_TAXA_GESTAO_FIXO_PADRAO_UI,
  rowToSimuladorTemplateDraft,
  type LoteamentoSimuladorTemplateDraft,
  type PremissaEntradaTipo,
  type TipoJurosCp,
  type TipoTaxaGestao,
} from '@/lib/loteamento-simulador-template';
import { marcarSimuladorTemplateSalvo } from '@/lib/simulador/simulador-card-ui-state';
import {
  formatarNumeroInput,
  parsearNumeroInput,
} from '@/lib/simulador/formatar-numero-input';

type Props = {
  cardId: string;
  cardTitulo: string;
  draftInicial: LoteamentoSimuladorTemplateDraft;
  jaSalvoInicial: boolean;
  pageSlugInicial: string | null;
  linkMoniInicial: string | null;
};

const fieldCls =
  'mt-1 min-h-[44px] w-full rounded-[var(--moni-radius-md)] px-3 py-2 text-sm outline-none';
const fieldStyle = {
  border: 'var(--moni-border-width) solid var(--moni-border-default)',
  background: 'var(--moni-surface-0)',
  color: 'var(--moni-text-primary)',
  fontFamily: 'var(--moni-font-sans)',
} as const;
const labelCls = 'text-xs font-medium';
const labelStyle = { color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' } as const;
const hintStyle = { color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' } as const;

export function SimuladorTemplateForm({
  cardId,
  cardTitulo,
  draftInicial,
  jaSalvoInicial,
  pageSlugInicial,
  linkMoniInicial,
}: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState(draftInicial);
  const [rascunhoBase, setRascunhoBase] = useState(() => JSON.stringify(draftInicial));
  const [pageSlug, setPageSlug] = useState(() => String(pageSlugInicial ?? '').trim());
  const [pageSlugSalvo, setPageSlugSalvo] = useState(() => String(pageSlugInicial ?? '').trim());
  const [linkMoni, setLinkMoni] = useState<string | null>(linkMoniInicial);
  const [jaSalvo, setJaSalvo] = useState(jaSalvoInicial);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiadoMoni, setCopiadoMoni] = useState(false);

  useEffect(() => {
    setDraft(draftInicial);
    setRascunhoBase(JSON.stringify(draftInicial));
    setPageSlug(String(pageSlugInicial ?? '').trim());
    setPageSlugSalvo(String(pageSlugInicial ?? '').trim());
    setLinkMoni(linkMoniInicial);
    setJaSalvo(jaSalvoInicial);
  }, [draftInicial, pageSlugInicial, linkMoniInicial, jaSalvoInicial]);

  useEffect(() => {
    if (!mensagem) return;
    const t = window.setTimeout(() => setMensagem(null), 8000);
    return () => window.clearTimeout(t);
  }, [mensagem]);

  const setCampo = <K extends keyof LoteamentoSimuladorTemplateDraft>(
    key: K,
    value: LoteamentoSimuladorTemplateDraft[K],
  ) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setMensagem(null);
    setErro(null);
  };

  const prazoNum = useMemo(
    () => (draft.prazo_obra_meses.trim() === '' ? NaN : parsearNumeroInput(draft.prazo_obra_meses)),
    [draft.prazo_obra_meses],
  );

  const temAlteracoes =
    JSON.stringify(draft) !== rascunhoBase || pageSlug.trim().toLowerCase() !== pageSlugSalvo.trim().toLowerCase();
  const podeSalvar = !salvando && (!jaSalvo || temAlteracoes);

  async function onSalvar() {
    if (!podeSalvar) return;
    const snapshot: LoteamentoSimuladorTemplateDraft = { ...draft };
    const slugSnapshot = pageSlug;
    setSalvando(true);
    setErro(null);
    setMensagem(null);
    startTransition(() => {
      void (async () => {
        const res = await salvarSimuladorTemplateDoCard(cardId, snapshot, slugSnapshot);
        if (!res.ok) {
          setErro(res.error);
          setSalvando(false);
          return;
        }
        marcarSimuladorTemplateSalvo(cardId);
        setJaSalvo(true);
        const nextDraft = res.template ? rowToSimuladorTemplateDraft(res.template) : snapshot;
        setDraft(nextDraft);
        setRascunhoBase(JSON.stringify(nextDraft));
        const slugSalvo = String(res.pageSlug ?? '').trim();
        setPageSlug(slugSalvo);
        setPageSlugSalvo(slugSalvo);
        setLinkMoni(res.linkMoni);
        setMensagem(TOAST_TEMPLATE_SALVO);
        setSalvando(false);
        router.refresh();
      })();
    });
  }

  async function copiarLinkMoni() {
    if (!linkMoni) return;
    try {
      await navigator.clipboard.writeText(linkMoni);
      setCopiadoMoni(true);
      window.setTimeout(() => setCopiadoMoni(false), 2000);
    } catch {
      setErro('Não foi possível copiar. Selecione o link e copie manualmente.');
    }
  }

  return (
    <form
      className="flex flex-col gap-8"
      onSubmit={(e) => {
        e.preventDefault();
        void onSalvar();
      }}
    >
      {erro ? (
        <div
          className="moni-tag-atrasado px-4 py-3 text-sm"
          role="alert"
          style={{ borderRadius: 'var(--moni-radius-md)' }}
        >
          {erro}
        </div>
      ) : null}
      {mensagem ? (
        <div
          className="fixed right-4 top-4 z-[80] max-w-sm px-4 py-3 text-sm"
          role="status"
          style={{
            background: 'var(--moni-surface-0)',
            color: 'var(--moni-text-primary)',
            border: 'var(--moni-border-width) solid var(--moni-border-default)',
            borderRadius: 'var(--moni-radius-md)',
            boxShadow: 'var(--moni-shadow-card)',
            fontFamily: 'var(--moni-font-sans)',
          }}
        >
          {mensagem}
        </div>
      ) : null}

      <section>
        <label className="block">
          <span className={labelCls} style={labelStyle}>
            Nome do template
          </span>
          <input
            className={fieldCls}
            style={fieldStyle}
            value={draft.nome}
            onChange={(e) => setCampo('nome', e.target.value)}
            placeholder={cardTitulo}
          />
          <span className="mt-1 block text-[11px]" style={hintStyle}>
            Se vazio, usamos o título do card.
          </span>
        </label>
      </section>

      <section>
        <h2
          className="text-lg"
          style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
        >
          Percentuais do empreendimento
        </h2>
        <p className="mt-1 text-sm" style={hintStyle}>
          Informe em % (ex.: 3 para 3%). Use vírgula decimal (3,5).
        </p>
        <div className="moni-form-novo-card mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {PCT_FIELDS.filter(
            (f) =>
              f.key !== 'pct_taxa_plataforma' &&
              f.key !== 'taxa_juros_credito_ponte' &&
              f.key !== 'taxa_juros_financiamento_anual' &&
              f.key !== 'pct_lucro_loteadora' &&
              f.key !== 'pct_lucro_moni' &&
              f.key !== 'pct_lucro_franqueado' &&
              f.key !== 'pct_comissao_corretor',
          ).map((f) => (
            <label key={f.key} className="block">
              <span className={labelCls} style={labelStyle}>
                {f.label}
                {'suffix' in f && f.suffix ? f.suffix : ' (%)'}
              </span>
              <CampoDraftNumero
                value={draft[f.key]}
                onChange={(v) => setCampo(f.key, v)}
                placeholder={'placeholder' in f && f.placeholder ? f.placeholder : '0'}
              />
              <span className="mt-1 block text-[11px]" style={hintStyle}>
                {f.hint}
              </span>
            </label>
          ))}
        </div>
        <div className="moni-form-novo-card mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {PCT_FIELDS.filter((f) => f.key === 'taxa_juros_credito_ponte').map((f) => (
            <label key={f.key} className="block">
              <span className={labelCls} style={labelStyle}>
                {f.label}
                {'suffix' in f && f.suffix ? f.suffix : ' (%)'}
              </span>
              <CampoDraftNumero
                value={draft[f.key]}
                onChange={(v) => setCampo(f.key, v)}
                placeholder={'placeholder' in f && f.placeholder ? f.placeholder : '0'}
              />
              <span className="mt-1 block text-[11px]" style={hintStyle}>
                {f.hint}
              </span>
            </label>
          ))}
          <label className="block">
            <span className={labelCls} style={labelStyle}>
              Método de cálculo dos juros CP
            </span>
            <select
              className={fieldCls}
              style={fieldStyle}
              value={draft.tipo_juros_cp ?? 'mes_a_mes'}
              onChange={(e) => setCampo('tipo_juros_cp', e.target.value as TipoJurosCp)}
            >
              <option value="mes_a_mes">Mês a mês (sobre saldo)</option>
              <option value="total">Total (sobre valor da obra)</option>
            </select>
            <span className="mt-1 block text-[11px]" style={hintStyle}>
              Ambos incluem 3 meses de buffer de segurança. O fluxo não ganha linhas extras.
            </span>
          </label>
        </div>
        <div className="moni-form-novo-card mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {PCT_FIELDS.filter((f) => f.key === 'taxa_juros_financiamento_anual').map((f) => (
            <label key={f.key} className="block">
              <span className={labelCls} style={labelStyle}>
                {f.label}
                {'suffix' in f && f.suffix ? f.suffix : ' (%)'}
              </span>
              <CampoDraftNumero
                value={draft[f.key]}
                onChange={(v) => setCampo(f.key, v)}
                placeholder={'placeholder' in f && f.placeholder ? f.placeholder : '0'}
              />
              <span className="mt-1 block text-[11px]" style={hintStyle}>
                {f.hint}
              </span>
            </label>
          ))}
        </div>
        <div className="moni-form-novo-card mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {PCT_FIELDS.filter((f) => f.key === 'pct_taxa_plataforma').map((f) => (
            <label key={f.key} className="block">
              <span className={labelCls} style={labelStyle}>
                {f.label}
                {'suffix' in f && f.suffix ? f.suffix : ' (%)'}
              </span>
              <CampoDraftNumero
                value={draft[f.key]}
                onChange={(v) => setCampo(f.key, v)}
                placeholder={'placeholder' in f && f.placeholder ? f.placeholder : '0'}
              />
              <span className="mt-1 block text-[11px]" style={hintStyle}>
                {f.hint}
              </span>
            </label>
          ))}
          <label className="block">
            <span className={labelCls} style={labelStyle}>
              Percentual da taxa de plataforma pago na entrada (%)
            </span>
            <CampoDraftNumero
              name="percentual_plataforma_entrada"
              value={draft.percentual_plataforma_entrada}
              onChange={(v) => setCampo('percentual_plataforma_entrada', v)}
              placeholder="0"
            />
            <span className="mt-1 block text-[11px]" style={hintStyle}>
              Quando maior que zero, esse percentual da taxa total é cobrado na entrada. O restante
              é pago nos 3 primeiros meses de obra.
            </span>
          </label>
        </div>
        <div className="moni-form-novo-card mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelCls} style={labelStyle}>
              Tipo da taxa de gestão
            </span>
            <select
              className={fieldCls}
              style={fieldStyle}
              value={draft.tipo_taxa_gestao}
              onChange={(e) => {
                const tipo = e.target.value as TipoTaxaGestao;
                setDraft((prev) => ({
                  ...prev,
                  tipo_taxa_gestao: tipo,
                  pct_taxa_gestao:
                    tipo === 'percentual' && prev.pct_taxa_gestao.trim() === ''
                      ? PCT_TAXA_GESTAO_PADRAO_UI
                      : prev.pct_taxa_gestao,
                  taxa_gestao_valor:
                    tipo === 'fixo' && prev.taxa_gestao_valor.trim() === ''
                      ? VALOR_TAXA_GESTAO_FIXO_PADRAO_UI
                      : prev.taxa_gestao_valor,
                }));
                setMensagem(null);
                setErro(null);
              }}
            >
              <option value="percentual">Percentual (%)</option>
              <option value="fixo">Valor fixo (R$)</option>
            </select>
          </label>
          <label className="block">
            <span className={labelCls} style={labelStyle}>
              {draft.tipo_taxa_gestao === 'fixo' ? 'Taxa de gestão (R$)' : 'Taxa de gestão (%)'}
            </span>
            {draft.tipo_taxa_gestao === 'fixo' ? (
              <CampoDraftNumero
                name="taxa_gestao_valor"
                value={draft.taxa_gestao_valor}
                onChange={(v) => setCampo('taxa_gestao_valor', v)}
                placeholder={VALOR_TAXA_GESTAO_FIXO_PADRAO_UI}
              />
            ) : (
              <CampoDraftNumero
                name="pct_taxa_gestao"
                value={draft.pct_taxa_gestao}
                onChange={(v) => setCampo('pct_taxa_gestao', v)}
                placeholder={PCT_TAXA_GESTAO_PADRAO_UI}
              />
            )}
            <span className="mt-1 block text-[11px]" style={hintStyle}>
              {draft.tipo_taxa_gestao === 'fixo'
                ? 'Valor absoluto em R$, rateado igualmente na obra.'
                : 'Sobre custo da casa + customização; parcelas iguais na obra.'}
            </span>
          </label>
        </div>
        <div className="moni-form-novo-card mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {PCT_FIELDS.filter(
            (f) =>
              f.key === 'pct_lucro_loteadora' ||
              f.key === 'pct_lucro_moni' ||
              f.key === 'pct_lucro_franqueado' ||
              f.key === 'pct_comissao_corretor',
          ).map((f) => (
            <label key={f.key} className="block">
              <span className={labelCls} style={labelStyle}>
                {f.label}
                {'suffix' in f && f.suffix ? f.suffix : ' (%)'}
              </span>
              <CampoDraftNumero
                value={draft[f.key]}
                onChange={(v) => setCampo(f.key, v)}
                placeholder={'placeholder' in f && f.placeholder ? f.placeholder : '0'}
              />
              <span className="mt-1 block text-[11px]" style={hintStyle}>
                {f.hint}
              </span>
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2
          className="text-lg"
          style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
        >
          Prazo de obra
        </h2>
        <p className="mt-1 text-sm" style={hintStyle}>
          Prazo de desembolsos da obra. Padrão {PRAZO_OBRA_MESES_PADRAO} meses, mínimo{' '}
          {PRAZO_OBRA_MESES_MINIMO}.
        </p>
        <div className="mt-4 max-w-sm">
          <label className="block">
            <span className={labelCls} style={labelStyle}>
              Prazo de obra (meses)
            </span>
            <CampoDraftNumero
              value={draft.prazo_obra_meses}
              onChange={(v) => setCampo('prazo_obra_meses', v)}
              inteiro
              placeholder={String(PRAZO_OBRA_MESES_PADRAO)}
            />
            {Number.isFinite(prazoNum) && prazoNum < PRAZO_OBRA_MESES_PADRAO ? (
              <span className="mt-1 block text-[11px]" style={hintStyle}>
                Curva comprimida.
              </span>
            ) : null}
          </label>
        </div>
      </section>

      <section>
        <h2
          className="text-lg"
          style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
        >
          Premissas da Loteadora
        </h2>
        <p className="mt-1 text-sm" style={hintStyle}>
          O valor já pago pelo cliente será informado na criação de cada oferta.
        </p>
        <div className="mt-4 flex flex-col gap-4">
          <PremissaFields
            titulo="Entrada mínima exigida pela loteadora"
            tipo={draft.entrada_minima_tipo}
            valor={draft.entrada_minima_valor}
            onTipo={(v) => setCampo('entrada_minima_tipo', v)}
            onValor={(v) => setCampo('entrada_minima_valor', v)}
          />
          <label className="block max-w-sm">
            <span className={labelCls} style={labelStyle}>
              Taxa de juros para pagamento parcelado (% ao mês)
            </span>
            <CampoDraftNumero
              value={draft.taxa_juros_parcelado_mes}
              onChange={(v) => setCampo('taxa_juros_parcelado_mes', v)}
              placeholder="2"
            />
            <span className="mt-1 block text-[11px]" style={hintStyle}>
              Conforme a loteadora. Sem padrão — deixe em branco se não houver.
            </span>
          </label>
        </div>
      </section>

      <section>
        <label className="block">
          <span className={labelCls} style={labelStyle}>
            Slug da jornada pública
          </span>
          <input
            className={fieldCls}
            style={fieldStyle}
            value={pageSlug}
            onChange={(e) => {
              setPageSlug(e.target.value);
              setMensagem(null);
              setErro(null);
            }}
            placeholder="ex: residencial-alfa-goiania"
            autoComplete="off"
            spellCheck={false}
          />
          <span className="mt-1 block text-[11px]" style={hintStyle}>
            Usado na URL da jornada do cliente. Use apenas letras minúsculas, números e hífens. Ex:
            /empreendimento/residencial-alfa
          </span>
        </label>
      </section>

      <section
        className="rounded-[var(--moni-radius-lg)] p-4 sm:p-5"
        style={{
          border: 'var(--moni-border-width) solid var(--moni-border-default)',
          background: 'var(--moni-surface-0)',
          boxShadow: 'var(--moni-shadow-card)',
        }}
      >
        <h2
          className="text-lg"
          style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
        >
          Link Moní
        </h2>
        <p className="mt-1 text-sm" style={hintStyle}>
          Jornada pública do empreendimento, sem corretor.
        </p>
        {linkMoni ? (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <p
              className="min-w-0 flex-1 break-all rounded-[var(--moni-radius-md)] px-3 py-2 text-sm"
              style={{
                ...fieldStyle,
                minHeight: 44,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {linkMoni}
            </p>
            <button
              type="button"
              onClick={() => void copiarLinkMoni()}
              className="min-h-[44px] shrink-0 rounded-[var(--moni-radius-md)] px-4 text-sm font-medium text-white"
              style={{ background: 'var(--moni-navy-800)' }}
            >
              {copiadoMoni ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        ) : (
          <p className="mt-3 text-sm" style={hintStyle}>
            Este empreendimento ainda não tem slug da jornada pública.
          </p>
        )}
      </section>

      <div
        className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-2 border-t px-4 py-3 sm:-mx-0 sm:static sm:flex-row sm:flex-wrap sm:border-0 sm:px-0 sm:py-0"
        style={{
          borderColor: 'var(--moni-border-default)',
          background: 'var(--moni-surface-50)',
        }}
      >
        <button
          type="submit"
          disabled={!podeSalvar}
          className="min-h-[44px] rounded-[var(--moni-radius-md)] px-5 text-sm font-medium disabled:cursor-not-allowed"
          style={{
            background: podeSalvar ? 'var(--moni-navy-800)' : 'var(--moni-surface-200)',
            color: podeSalvar ? 'var(--moni-text-inverse)' : 'var(--moni-text-tertiary)',
            fontFamily: 'var(--moni-font-sans)',
          }}
        >
          {salvando ? 'Salvando…' : 'Salvar template'}
        </button>
      </div>
    </form>
  );
}

function CampoDraftNumero({
  value,
  onChange,
  inteiro,
  placeholder,
  name,
}: {
  value: string;
  onChange: (v: string) => void;
  inteiro?: boolean;
  placeholder?: string;
  name?: string;
}) {
  const numero = value.trim() === '' ? null : parsearNumeroInput(value);
  return (
    <CampoNumeroBr
      name={name}
      className={fieldCls}
      style={fieldStyle}
      valor={numero}
      inteiro={inteiro}
      placeholder={placeholder}
      onChange={(n) => {
        if (n == null) {
          onChange('');
          return;
        }
        onChange(formatarNumeroInput(n, { inteiro }));
      }}
    />
  );
}

function PremissaFields({
  titulo,
  tipo,
  valor,
  onTipo,
  onValor,
}: {
  titulo: string;
  tipo: PremissaEntradaTipo;
  valor: string;
  onTipo: (v: PremissaEntradaTipo) => void;
  onValor: (v: string) => void;
}) {
  return (
    <div>
      <p className={labelCls} style={labelStyle}>
        {titulo}
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-[11px]" style={hintStyle}>
            Tipo
          </span>
          <select
            className={fieldCls}
            style={fieldStyle}
            value={tipo}
            onChange={(e) => onTipo(e.target.value as PremissaEntradaTipo)}
          >
            <option value="percentual">Percentual do lote</option>
            <option value="valor_fixo">Valor fixo (R$)</option>
          </select>
        </label>
        <label className="block">
          <span className="text-[11px]" style={hintStyle}>
            {tipo === 'percentual' ? 'Valor (%)' : 'Valor (R$)'}
          </span>
          <CampoDraftNumero
            value={valor}
            onChange={onValor}
            placeholder={tipo === 'percentual' ? '30' : '50.000'}
          />
        </label>
      </div>
    </div>
  );
}
