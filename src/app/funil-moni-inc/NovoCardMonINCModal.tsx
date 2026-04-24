'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { criarCard } from '@/lib/actions/card-actions';

const KANBAN_NOME = 'Funil Moní INC' as const;

export function NovoCardMonINCModal({
  faseId,
  kanbanId: _kanbanId,
  isAdmin: _isAdmin,
  onClose,
}: {
  faseId: string;
  kanbanId: string;
  isAdmin: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const t = nome.trim();
    if (!t) {
      setErro('Informe o nome.');
      return;
    }
    if (!faseId) {
      setErro('Fase inicial não configurada. Recarregue após aplicar a migration.');
      return;
    }
    setLoading(true);
    try {
      const res = await criarCard({
        titulo: t,
        kanban_nome: KANBAN_NOME,
        fase_id: faseId,
        basePath: '/funil-moni-inc',
      });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      onClose();
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative w-full overflow-hidden bg-white"
        style={{
          maxWidth: '480px',
          borderRadius: 'var(--moni-radius-xl)',
          border: '0.5px solid var(--moni-border-default)',
          boxShadow: 'var(--moni-shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="novo-card-moni-inc-titulo"
      >
        <div
          className="flex items-center justify-between border-b bg-white px-6 py-4"
          style={{ borderColor: 'var(--moni-border-default)' }}
        >
          <h2 id="novo-card-moni-inc-titulo" className="text-lg font-bold" style={{ color: 'var(--moni-text-primary)' }}>
            Novo card
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label htmlFor="nome-card-moni-inc" className="block text-sm font-medium text-stone-700">
              Nome <span className="text-red-500">*</span>
            </label>
            <input
              id="nome-card-moni-inc"
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              disabled={loading}
              autoFocus
              className="mt-1 w-full px-4 py-2 text-sm text-stone-800 focus:outline-none disabled:bg-stone-50"
              style={{
                border: '0.5px solid var(--moni-border-default)',
                borderRadius: 'var(--moni-radius-md)',
              }}
              placeholder="Nome do card"
            />
          </div>
          {erro ? <p className="text-sm text-red-600">{erro}</p> : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !nome.trim()}
              className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              style={{ background: 'var(--moni-text-primary)' }}
            >
              {loading ? 'Salvando…' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
