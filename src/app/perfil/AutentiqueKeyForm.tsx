'use client';

import { useState } from 'react';
import { atualizarChaveAutentique } from './actions';

type Props = {
  temChaveConfigurada: boolean;
};

export function AutentiqueKeyForm({ temChaveConfigurada }: Props) {
  const [value, setValue] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setPending(true);
    const res = await atualizarChaveAutentique(value || null);
    setPending(false);
    if (res.ok) {
      setMessage({ type: 'ok', text: value ? 'Chave do Autentique salva.' : 'Chave removida.' });
      setValue('');
      window.location.reload();
    } else {
      setMessage({ type: 'error', text: res.error ?? 'Erro ao salvar.' });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 rounded-lg border border-stone-200 bg-stone-50 p-4">
      <h2 className="text-sm font-semibold text-stone-800">Chave do Autentique</h2>
      <p className="mt-1 text-xs text-stone-600">
        Quem pode enviar documentos para assinatura deve usar a chave da <strong>própria conta</strong> no
        Autentique (grupo da empresa). Ao enviar, o documento será vinculado ao seu login no Autentique.
      </p>
      {temChaveConfigurada && (
        <p className="mt-2 text-xs text-green-700">Você já tem uma chave configurada. Preencha de novo apenas para trocar ou deixe em branco e salve para remover.</p>
      )}
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Chave API Autentique</span>
          <input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={temChaveConfigurada ? 'Nova chave (deixe em branco para remover)' : 'Cole sua chave do painel Autentique'}
            className="w-full max-w-md rounded border border-stone-300 px-3 py-2 text-sm"
            autoComplete="off"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-moni-accent px-4 py-2 text-sm font-medium text-white hover:bg-moni-accent/90 disabled:opacity-50"
        >
          {pending ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
      {message && (
        <p className={`mt-2 text-sm ${message.type === 'ok' ? 'text-green-700' : 'text-red-700'}`}>
          {message.text}
        </p>
      )}
    </form>
  );
}
