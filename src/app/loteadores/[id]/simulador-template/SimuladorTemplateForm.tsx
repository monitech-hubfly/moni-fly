'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  regenerarLinkSimuladorTemplate,
  salvarSimuladorTemplateDoCard,
} from '@/lib/actions/loteamento-simulador-template';
import { CampoNumeroBr } from '@/components/simulador/CampoNumeroBr';
import {
  CONDICAO_LOTE_LABEL,
  PCT_FIELDS,
  PRAZO_OBRA_MESES_MINIMO,
  PRAZO_OBRA_MESES_PADRAO,
  STATUS_SIMULACAO_LABEL,
  TOAST_TEMPLATE_SALVO,
  type LoteamentoSimuladorTemplateDraft,
  type PremissaEntradaTipo,
  type SimulacaoPagamentoResumo,
} from '@/lib/loteamento-simulador-template';
import {
  formatarNumeroInput,
  parsearNumeroInput,
} from '@/lib/simulador/formatar-numero-input';

type Props = {
  cardId: string;
  cardTitulo: string;
  draftInicial: LoteamentoSimuladorTemplateDraft;
  linkInicial: string | null;
  simulacoes: SimulacaoPagamentoResumo[];
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

function qrUrl(link: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(link)}`;
}

function formatarQuando(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function formatarRenda(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function SimuladorTemplateForm({
  cardId,
  cardTitulo,
  draftInicial,
  linkInicial,
  simulacoes: simulacoesInicial,
}: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState(draftInicial);
  const [link, setLink] = useState(linkInicial);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

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

  async function onSalvar() {
    setSalvando(true);
    setErro(null);
    setMensagem(null);
    const res = await salvarSimuladorTemplateDoCard(cardId, draft);
    if (!res.ok) {
      setErro(res.error);
      setSalvando(false);
      return;
    }
    setLink(res.link);
    setMensagem(TOAST_TEMPLATE_SALVO);
    setSalvando(false);
    router.refresh();
    router.push(`/loteadores/${cardId}/simulador-template/ofertas`);
  }

  async function onNovoLink() {
    const ok = window.confirm(
      'Gerar um novo link invalida o QR e o endereço já compartilhado. Continuar?',
    );
    if (!ok) return;
    setSalvando(true);
    setErro(null);
    const res = await regenerarLinkSimuladorTemplate(cardId);
    if (!res.ok) {
      setErro(res.error);
      setSalvando(false);
      return;
    }
    setLink(res.link);
    setMensagem(res.mensagem);
    setSalvando(false);
  }

  async function copiarLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
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
          {PCT_FIELDS.map((f) => (
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
          Link do template para corretores
        </h2>
        {link ? (
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
            <img
              src={qrUrl(link)}
              alt="QR code do simulador"
              width={180}
              height={180}
              className="h-[180px] w-[180px] shrink-0 rounded-[var(--moni-radius-md)]"
              style={{ border: 'var(--moni-border-width) solid var(--moni-border-default)' }}
            />
            <div className="min-w-0 flex-1">
              <p
                className="break-all rounded-[var(--moni-radius-md)] px-3 py-2 text-sm"
                style={{
                  ...fieldStyle,
                  minHeight: 44,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {link}
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  disabled={salvando}
                  onClick={() => void copiarLink()}
                  className="min-h-[44px] rounded-[var(--moni-radius-md)] px-4 text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: 'var(--moni-navy-800)' }}
                >
                  {copiado ? 'Copiado' : 'Copiar link'}
                </button>
                <a
                  href={qrUrl(link)}
                  download="qr-simulador-pagamentos.png"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--moni-radius-md)] px-4 text-sm font-medium"
                  style={{
                    border: 'var(--moni-border-width) solid var(--moni-border-default)',
                    background: 'var(--moni-surface-0)',
                    color: 'var(--moni-text-primary)',
                  }}
                >
                  Baixar QR
                </a>
                <button
                  type="button"
                  disabled={salvando}
                  onClick={() => void onNovoLink()}
                  className="min-h-[44px] rounded-[var(--moni-radius-md)] px-4 text-sm font-medium"
                  style={{
                    border: 'var(--moni-border-width) solid var(--moni-border-default)',
                    background: 'var(--moni-surface-0)',
                    color: 'var(--moni-text-primary)',
                  }}
                >
                  Gerar novo link
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm" style={hintStyle}>
            Salve o template para gerar o link e o QR.
          </p>
        )}
      </section>

      {simulacoesInicial.length > 0 ? (
        <section>
          <h2
            className="text-lg"
            style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
          >
            Simulações salvas
          </h2>
          <p className="mt-1 text-sm" style={hintStyle}>
            Inclui leads do QR (corretor sem login) e simulações do time.
          </p>
          <div
            className="mt-3 overflow-x-auto rounded-[var(--moni-radius-lg)]"
            style={{ border: 'var(--moni-border-width) solid var(--moni-border-default)' }}
          >
            <table className="min-w-full text-left text-sm" style={{ fontFamily: 'var(--moni-font-sans)' }}>
              <thead>
                <tr style={{ color: 'var(--moni-text-tertiary)' }}>
                  <th className="px-3 py-2 font-medium">Quando</th>
                  <th className="px-3 py-2 font-medium">Condição</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Renda</th>
                </tr>
              </thead>
              <tbody>
                {simulacoesInicial.map((s) => (
                  <tr
                    key={s.id}
                    style={{
                      borderTop: 'var(--moni-border-width) solid var(--moni-border-default)',
                      color: 'var(--moni-text-secondary)',
                    }}
                  >
                    <td className="whitespace-nowrap px-3 py-2">{formatarQuando(s.created_at)}</td>
                    <td className="px-3 py-2">{CONDICAO_LOTE_LABEL[s.condicao_lote] ?? s.condicao_lote}</td>
                    <td className="px-3 py-2">{STATUS_SIMULACAO_LABEL[s.status] ?? s.status}</td>
                    <td className="whitespace-nowrap px-3 py-2">{formatarRenda(s.renda_informada_cliente)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <div
        className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-2 border-t px-4 py-3 sm:-mx-0 sm:static sm:flex-row sm:border-0 sm:px-0 sm:py-0"
        style={{
          borderColor: 'var(--moni-border-default)',
          background: 'var(--moni-surface-50)',
        }}
      >
        <button
          type="submit"
          disabled={salvando}
          className="min-h-[44px] rounded-[var(--moni-radius-md)] px-5 text-sm font-medium text-white disabled:opacity-50"
          style={{ background: 'var(--moni-navy-800)' }}
        >
          {salvando ? 'Salvando…' : link ? 'Salvar template' : 'Salvar e gerar link'}
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
}: {
  value: string;
  onChange: (v: string) => void;
  inteiro?: boolean;
  placeholder?: string;
}) {
  const numero = value.trim() === '' ? null : parsearNumeroInput(value);
  return (
    <CampoNumeroBr
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
    <div
      className="rounded-[var(--moni-radius-lg)] p-4"
      style={{ border: 'var(--moni-border-width) solid var(--moni-border-default)' }}
    >
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
