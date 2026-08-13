'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { criarCard } from '@/lib/actions/card-actions';
import { createClient } from '@/lib/supabase/client';
import type { KanbanNomeDisplay } from '@/components/kanban-shared/types';

type Fase = { id: string; nome: string; ordem: number };

export function NovoCardMarketingModal({
  kanbanId,
  kanbanNome,
  basePath,
  onClose,
}: {
  kanbanId: string;
  kanbanNome: KanbanNomeDisplay;
  basePath: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [titulo, setTitulo] = useState('');
  const [faseId, setFaseId] = useState('');
  const [fases, setFases] = useState<Fase[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('kanban_fases')
        .select('id, nome, ordem')
        .eq('kanban_id', kanbanId)
        .eq('ativo', true)
        .order('ordem');
      const list = (data ?? []) as Fase[];
      setFases(list);
      if (list[0]?.id) setFaseId(list[0].id);
    })();
  }, [kanbanId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nome = titulo.trim();
    if (!nome || !faseId) return;
    setLoading(true);
    setErro(null);
    try {
      const res = await criarCard({
        titulo: nome,
        kanban_nome: kanbanNome,
        fase_id: faseId,
        basePath,
      });
      if (!res.ok) throw new Error(res.error);
      router.refresh();
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar card.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'color-mix(in srgb, var(--moni-navy-900) 45%, transparent)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full bg-[var(--moni-surface-0)]"
        style={{
          maxWidth: 480,
          borderRadius: 'var(--moni-radius-lg)',
          border: '0.5px solid var(--moni-border-default)',
          boxShadow: 'var(--moni-shadow-card)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '0.5px solid var(--moni-border-default)' }}
        >
          <h2
            className="text-lg font-semibold"
            style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-display)' }}
          >
            Novo card
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--moni-radius-md)]"
            style={{ color: 'var(--moni-text-tertiary)' }}
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label
              htmlFor="mkt-titulo"
              className="block text-sm font-medium"
              style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' }}
            >
              Título
            </label>
            <input
              id="mkt-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
              disabled={loading}
              placeholder="Ex.: Evento em Campinas"
              className="mt-1 w-full px-3 py-2 text-sm"
              style={{
                minHeight: 44,
                borderRadius: 'var(--moni-radius-md)',
                border: '0.5px solid var(--moni-border-default)',
                color: 'var(--moni-text-primary)',
                fontFamily: 'var(--moni-font-sans)',
              }}
            />
          </div>
          <div>
            <label
              htmlFor="mkt-fase"
              className="block text-sm font-medium"
              style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' }}
            >
              Fase inicial
            </label>
            <select
              id="mkt-fase"
              value={faseId}
              onChange={(e) => setFaseId(e.target.value)}
              disabled={loading}
              className="mt-1 w-full px-3 py-2 text-sm"
              style={{
                minHeight: 44,
                borderRadius: 'var(--moni-radius-md)',
                border: '0.5px solid var(--moni-border-default)',
                color: 'var(--moni-text-primary)',
                fontFamily: 'var(--moni-font-sans)',
                background: 'var(--moni-surface-0)',
              }}
            >
              {fases.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </div>
          {erro ? (
            <p className="text-sm" style={{ color: 'var(--moni-text-secondary)' }} role="alert">
              {erro}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 text-sm"
              style={{
                minHeight: 44,
                borderRadius: 'var(--moni-radius-md)',
                border: '0.5px solid var(--moni-border-default)',
                color: 'var(--moni-text-secondary)',
                fontFamily: 'var(--moni-font-sans)',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !titulo.trim() || !faseId}
              className="px-4 text-sm text-white disabled:opacity-50"
              style={{
                minHeight: 44,
                borderRadius: 'var(--moni-radius-md)',
                background: 'var(--moni-navy-800)',
                fontFamily: 'var(--moni-font-sans)',
              }}
            >
              {loading ? 'Criando…' : 'Criar card'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
