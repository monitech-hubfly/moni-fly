'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { submeterIntakePublicoLoteador } from '@/lib/actions/loteador-externo-actions';
import { NovoCardLoteadoresFormCampos } from '@/components/kanban-shared/NovoCardLoteadoresFormCampos';
import {
  emptyNovoCardLoteadoresFormulario,
  type NovoCardLoteadoresFormulario,
} from '@/lib/kanban/loteadores-novo-card-form';

type Props = { token: string };

export function FormularioIntakeLoteadorForm({ token }: Props) {
  const [form, setForm] = useState<NovoCardLoteadoresFormulario>(emptyNovoCardLoteadoresFormulario);
  const [website, setWebsite] = useState('');
  const [saving, setSaving] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSaving(true);
    try {
      const res = await submeterIntakePublicoLoteador({
        token,
        website,
        parceiro: form,
      });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setForm(emptyNovoCardLoteadoresFormulario());
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
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
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

      <NovoCardLoteadoresFormCampos
        idPrefix="intake"
        tokenPublico={token}
        value={form}
        onChange={(patch) => setForm((atual) => ({ ...atual, ...patch }))}
        disabled={saving}
      />

      {erro ? (
        <p className="text-sm" role="alert" style={{ color: 'var(--moni-danger)' }}>
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
