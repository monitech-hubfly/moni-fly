'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createJuridicoTicket } from '../actions';

export function NovaDuvidaForm({ defaultNome = '' }: { defaultNome?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const nome_frank = (formData.get('nome_frank') as string)?.trim();
    const titulo = (formData.get('titulo') as string)?.trim();
    const descricao = (formData.get('descricao') as string)?.trim();
    const nome_condominio = (formData.get('nome_condominio') as string)?.trim() || undefined;
    const lote = (formData.get('lote') as string)?.trim() || undefined;
    if (!nome_frank) {
      setError('Informe seu nome.');
      return;
    }
    if (!titulo || !descricao) {
      setError('Preencha título e descrição.');
      return;
    }
    setLoading(true);
    const result = await createJuridicoTicket({
      nome_frank,
      titulo,
      descricao,
      nome_condominio,
      lote,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.ticketId) router.push(`/juridico/${result.ticketId}`);
    else router.push('/juridico');
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
        </div>
      )}
      <div>
        <label htmlFor="nome_frank" className="block text-sm font-medium text-stone-700">
          Seu nome <span className="text-red-500">*</span>
        </label>
        <input
          id="nome_frank"
          name="nome_frank"
          type="text"
          required
          maxLength={200}
          defaultValue={defaultNome}
          className="mt-1 w-full rounded-xl border border-stone-300 px-4 py-2.5 text-stone-800 focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
          placeholder="Nome completo do franqueado"
        />
      </div>
      <div>
        <label htmlFor="nome_condominio" className="block text-sm font-medium text-stone-700">
          Nome do condomínio <span className="text-stone-400">(opcional)</span>
        </label>
        <input
          id="nome_condominio"
          name="nome_condominio"
          type="text"
          maxLength={200}
          className="mt-1 w-full rounded-xl border border-stone-300 px-4 py-2.5 text-stone-800 focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
          placeholder="Ex.: Condomínio Residencial X"
        />
      </div>
      <div>
        <label htmlFor="lote" className="block text-sm font-medium text-stone-700">
          Lote <span className="text-stone-400">(opcional)</span>
        </label>
        <input
          id="lote"
          name="lote"
          type="text"
          maxLength={100}
          className="mt-1 w-full rounded-xl border border-stone-300 px-4 py-2.5 text-stone-800 focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
          placeholder="Ex.: Lote 15"
        />
      </div>
      <div>
        <label htmlFor="titulo" className="block text-sm font-medium text-stone-700">
          Título
        </label>
        <input
          id="titulo"
          name="titulo"
          type="text"
          required
          maxLength={200}
          className="mt-1 w-full rounded-xl border border-stone-300 px-4 py-2.5 text-stone-800 focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
          placeholder="Ex.: Dúvida sobre cláusula de garantia"
        />
      </div>
      <div>
        <label htmlFor="descricao" className="block text-sm font-medium text-stone-700">
          Descrição da dúvida
        </label>
        <textarea
          id="descricao"
          name="descricao"
          required
          rows={5}
          className="mt-1 w-full rounded-xl border border-stone-300 px-4 py-2.5 text-stone-800 focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
          placeholder="Descreva sua dúvida em detalhes..."
        />
      </div>
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-moni-primary px-6 py-2.5 font-medium text-white hover:bg-moni-secondary disabled:opacity-50"
        >
          {loading ? 'Criando...' : 'Criar dúvida'}
        </button>
        <a
          href="/juridico"
          className="rounded-xl border border-stone-300 px-6 py-2.5 font-medium text-stone-700 hover:bg-stone-50"
        >
          Cancelar
        </a>
      </div>
    </form>
  );
}
