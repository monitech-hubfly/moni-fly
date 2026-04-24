'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Fase = {
  id: string;
  nome: string;
  ordem: number;
  sla_dias: number | null;
};

type Card = {
  id: string;
  titulo: string;
  status: string;
  created_at: string;
  fase_id: string;
  franqueado_id: string;
  kanban_id: string;
  rede_franqueado_id?: string | null;
  kanban_fases: {
    id: string;
    nome: string;
    sla_dias: number | null;
  } | null;
  profiles: {
    full_name: string | null;
    email: string | null;
  } | null;
};

export function CardDetailClient({
  card,
  fases,
  isAdmin,
}: {
  card: Card;
  fases: Fase[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [titulo, setTitulo] = useState(card.titulo);
  const [faseId, setFaseId] = useState(card.fase_id);
  const [isEditing, setIsEditing] = useState(false);

  const createdDate = new Date(card.created_at);
  const faseAtual = fases.find((f) => f.id === faseId) || card.kanban_fases;
  const slaDias = faseAtual?.sla_dias ?? 999;
  const diasDesdeAbertura = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
  const diasRestantes = slaDias - diasDesdeAbertura;

  let slaClass = '';
  let slaLabel = '';
  if (diasRestantes < 0) {
    slaClass = 'moni-tag-atrasado';
    slaLabel = `Atrasado ${Math.abs(diasRestantes)} dia(s)`;
  } else if (diasRestantes === 0) {
    slaClass = 'moni-tag-atencao';
    slaLabel = 'Vence hoje';
  } else if (diasRestantes === 1) {
    slaClass = 'moni-tag-atencao';
    slaLabel = 'Vence amanhã';
  } else if (diasRestantes <= 2) {
    slaClass = 'moni-tag-atencao';
    slaLabel = `${diasRestantes} dias restantes`;
  } else {
    slaLabel = `${diasRestantes} dias restantes`;
  }

  async function handleSave() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('kanban_cards')
        .update({
          titulo: titulo.trim(),
          fase_id: faseId,
        })
        .eq('id', card.id);

      if (error) throw error;

      setIsEditing(false);
      router.refresh();
    } catch (err) {
      console.error('Erro ao atualizar card:', err);
      alert('Erro ao atualizar card. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Tem certeza que deseja arquivar este card?')) return;

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('kanban_cards')
        .update({ status: 'arquivado' })
        .eq('id', card.id);

      if (error) throw error;

      router.push('/funil-moni-inc');
      router.refresh();
    } catch (err) {
      console.error('Erro ao arquivar card:', err);
      alert('Erro ao arquivar card. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div
        className="bg-white p-4 sm:p-6"
        style={{
          borderRadius: 'var(--moni-radius-lg)',
          border: '0.5px solid var(--moni-border-default)',
          boxShadow: 'var(--moni-shadow-card)',
        }}
      >
        <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:gap-0">
          <div className="flex-1">
            {isEditing ? (
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                style={{
                  border: '0.5px solid var(--moni-border-default)',
                  borderRadius: 'var(--moni-radius-md)',
                }}
                className="w-full px-3 py-2 text-lg font-semibold text-stone-800 focus:border-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-200"
              />
            ) : (
              <h1 className="text-2xl font-bold text-stone-800">{card.titulo}</h1>
            )}
          </div>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              style={{
                border: '0.5px solid var(--moni-border-default)',
                borderRadius: 'var(--moni-radius-md)',
              }}
              className="w-full bg-transparent px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 sm:w-auto"
            >
              Editar
            </button>
          )}
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-stone-600">
          <div>
            Criado em <strong>{createdDate.toLocaleDateString('pt-BR')}</strong>
          </div>
          {slaLabel && (
            <div>
              <span className={slaClass}>{slaLabel}</span>
            </div>
          )}
        </div>

        {isAdmin && card.profiles && (
          <div
            className="mb-6 bg-stone-50 p-4"
            style={{
              border: '0.5px solid var(--moni-border-subtle)',
              borderRadius: 'var(--moni-radius-md)',
            }}
          >
            <p className="text-xs font-medium text-stone-500">RESPONSÁVEL</p>
            <p className="mt-1 text-sm font-semibold text-stone-800">{card.profiles.full_name}</p>
            {card.profiles.email && (
              <p className="mt-0.5 text-xs text-stone-600">{card.profiles.email}</p>
            )}
          </div>
        )}

        <div>
          <label htmlFor="fase" className="block text-sm font-medium text-stone-700">
            Fase atual
          </label>
          <select
            id="fase"
            value={faseId}
            onChange={(e) => {
              setFaseId(e.target.value);
              setIsEditing(true);
            }}
            disabled={!isEditing && loading}
            style={{
              border: '0.5px solid var(--moni-border-default)',
              borderRadius: 'var(--moni-radius-md)',
            }}
            className="mt-1 w-full px-4 py-2 text-sm focus:border-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-200"
          >
            {fases.map((fase) => (
              <option key={fase.id} value={fase.id}>
                {fase.nome}
              </option>
            ))}
          </select>
        </div>

        {isEditing && (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={handleSave}
              disabled={loading || !titulo.trim()}
              style={{
                background: 'var(--moni-text-primary)',
                borderRadius: 'var(--moni-radius-md)',
              }}
              className="w-full px-6 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800 disabled:opacity-50 sm:w-auto"
            >
              {loading ? 'Salvando...' : 'Salvar alterações'}
            </button>
            <button
              onClick={() => {
                setTitulo(card.titulo);
                setFaseId(card.fase_id);
                setIsEditing(false);
              }}
              disabled={loading}
              style={{
                border: '0.5px solid var(--moni-border-default)',
                borderRadius: 'var(--moni-radius-md)',
              }}
              className="w-full bg-transparent px-6 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50 sm:w-auto"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      <div
        className="bg-white p-4 sm:p-6"
        style={{
          borderRadius: 'var(--moni-radius-lg)',
          border: '0.5px solid var(--moni-border-default)',
          boxShadow: 'var(--moni-shadow-card)',
        }}
      >
        <h2 className="mb-4 text-lg font-semibold text-stone-800">Ações</h2>
        <button
          onClick={handleDelete}
          disabled={loading}
          style={{
            border: '0.5px solid var(--moni-status-overdue-border)',
            borderRadius: 'var(--moni-radius-md)',
          }}
          className="w-full bg-red-50 px-6 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50 sm:w-auto"
        >
          Arquivar card
        </button>
      </div>
    </div>
  );
}
