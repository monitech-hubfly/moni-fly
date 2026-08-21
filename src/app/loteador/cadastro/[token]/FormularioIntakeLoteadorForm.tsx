'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { submeterIntakePublicoLoteador } from '@/lib/actions/loteador-externo-actions';

type Props = { token: string };

const empty = {
  nomeLoteador: '',
  cnpj: '',
  nomeResponsavel: '',
  cargoFuncao: '',
  telefone: '',
  email: '',
  condominioNome: '',
};

export function FormularioIntakeLoteadorForm({ token }: Props) {
  const [form, setForm] = useState(empty);
  const [website, setWebsite] = useState('');
  const [saving, setSaving] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const inputCls = 'mt-1 w-full px-4 py-2.5 text-sm focus:outline-none';
  const inputStyle = {
    border: '0.5px solid var(--moni-border-default)',
    borderRadius: 'var(--moni-radius-md)',
    color: 'var(--moni-text-primary)',
    background: 'var(--moni-surface-0)',
    minHeight: 44,
  } as const;
  const labelCls = 'block text-sm font-medium';
  const labelStyle = { color: 'var(--moni-text-primary)' } as const;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSaving(true);
    try {
      const res = await submeterIntakePublicoLoteador({
        token,
        website,
        parceiro: {
          nomeLoteador: form.nomeLoteador.trim(),
          nomeResponsavel: form.nomeResponsavel.trim(),
          cargoFuncao: form.cargoFuncao.trim(),
          telefone: form.telefone.trim(),
          email: form.email.trim(),
          cnpj: form.cnpj.trim() || undefined,
          condominioNome: form.condominioNome.trim() || undefined,
        },
      });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setForm(empty);
      setEnviado(true);
    } finally {
      setSaving(false);
    }
  }

  if (enviado) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-base font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
          Cadastro enviado
        </p>
        <p className="text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
          Recebemos seus dados. A Casa Moní entra em contato em breve.
        </p>
        <button
          type="button"
          onClick={() => setEnviado(false)}
          className="min-h-[44px] w-full px-4 py-2 text-sm font-medium text-white"
          style={{
            background: 'var(--moni-navy-800)',
            borderRadius: 'var(--moni-radius-md)',
          }}
        >
          Enviar outro cadastro
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="relative space-y-4">
      <div
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
      >
        <label htmlFor="intake-website">Website</label>
        <input
          id="intake-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="intake-nome" className={labelCls} style={labelStyle}>
          Nome do loteador <span style={{ color: 'var(--moni-danger, #b42318)' }}>*</span>
        </label>
        <input
          id="intake-nome"
          type="text"
          required
          value={form.nomeLoteador}
          onChange={(e) => setForm((f) => ({ ...f, nomeLoteador: e.target.value }))}
          disabled={saving}
          className={inputCls}
          style={inputStyle}
          placeholder="Empresa / loteador"
        />
      </div>

      <div>
        <label htmlFor="intake-cnpj" className={labelCls} style={labelStyle}>
          CNPJ{' '}
          <span className="text-xs font-normal" style={{ color: 'var(--moni-text-tertiary)' }}>
            (opcional)
          </span>
        </label>
        <input
          id="intake-cnpj"
          type="text"
          value={form.cnpj}
          onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))}
          disabled={saving}
          className={inputCls}
          style={inputStyle}
          placeholder="00.000.000/0000-00"
        />
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium" style={labelStyle}>
          Dados do responsável
        </legend>
        <div>
          <label htmlFor="intake-responsavel" className={labelCls} style={labelStyle}>
            Nome do responsável <span style={{ color: 'var(--moni-danger, #b42318)' }}>*</span>
          </label>
          <input
            id="intake-responsavel"
            type="text"
            required
            value={form.nomeResponsavel}
            onChange={(e) => setForm((f) => ({ ...f, nomeResponsavel: e.target.value }))}
            disabled={saving}
            className={inputCls}
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor="intake-cargo" className={labelCls} style={labelStyle}>
            Cargo / função <span style={{ color: 'var(--moni-danger, #b42318)' }}>*</span>
          </label>
          <input
            id="intake-cargo"
            type="text"
            required
            value={form.cargoFuncao}
            onChange={(e) => setForm((f) => ({ ...f, cargoFuncao: e.target.value }))}
            disabled={saving}
            className={inputCls}
            style={inputStyle}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="intake-tel" className={labelCls} style={labelStyle}>
              Telefone <span style={{ color: 'var(--moni-danger, #b42318)' }}>*</span>
            </label>
            <input
              id="intake-tel"
              type="tel"
              required
              value={form.telefone}
              onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
              disabled={saving}
              className={inputCls}
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="intake-email" className={labelCls} style={labelStyle}>
              E-mail <span style={{ color: 'var(--moni-danger, #b42318)' }}>*</span>
            </label>
            <input
              id="intake-email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              disabled={saving}
              className={inputCls}
              style={inputStyle}
            />
          </div>
        </div>
      </fieldset>

      <div>
        <label htmlFor="intake-condo" className={labelCls} style={labelStyle}>
          Condomínio{' '}
          <span className="text-xs font-normal" style={{ color: 'var(--moni-text-tertiary)' }}>
            (opcional)
          </span>
        </label>
        <input
          id="intake-condo"
          type="text"
          value={form.condominioNome}
          onChange={(e) => setForm((f) => ({ ...f, condominioNome: e.target.value }))}
          disabled={saving}
          className={inputCls}
          style={inputStyle}
        />
      </div>

      {erro ? (
        <p className="text-sm" role="alert" style={{ color: 'var(--moni-danger, #b42318)' }}>
          {erro}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={saving}
        className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        style={{
          background: 'var(--moni-navy-800)',
          borderRadius: 'var(--moni-radius-md)',
        }}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Enviar cadastro
      </button>
    </form>
  );
}
