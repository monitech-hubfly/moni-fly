'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Fase = {
  id: string;
  nome: string;
  ordem: number;
};

type Franqueado = {
  id: string;
  n_franquia: string | null;
  nome_completo: string | null;
  area_atuacao: string | null;
};

// Retorna lista de áreas a partir de uma string (suporta vírgula como separador)
function splitAreas(area: string | null): string[] {
  if (!area?.trim()) return [''];
  return area
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// Monta o título padrão: "FK0001 - João Silva - Zona Sul de São Paulo"
function buildTitulo(f: Franqueado, area: string): string {
  const parts = [f.n_franquia, f.nome_completo, area].filter(Boolean);
  return parts.join(' - ');
}

export function NovoCardForm({
  kanbanId,
  fases,
  franqueados,
  isAdmin,
}: {
  kanbanId: string;
  fases: Fase[];
  franqueados: Franqueado[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [faseId, setFaseId] = useState(fases[0]?.id || '');
  const [selectedFranqueadoId, setSelectedFranqueadoId] = useState(
    franqueados[0]?.id || '',
  );
  const [areas, setAreas] = useState<string[]>(['']);
  const [criarPorArea, setCriarPorArea] = useState(false);

  // Atualiza áreas ao trocar franqueado
  useEffect(() => {
    const f = franqueados.find((x) => x.id === selectedFranqueadoId);
    if (!f) return;
    const parsed = splitAreas(f.area_atuacao);
    setAreas(parsed);
    setCriarPorArea(parsed.length > 1);
  }, [selectedFranqueadoId, franqueados]);

  const selectedFranqueado = franqueados.find((f) => f.id === selectedFranqueadoId) ?? null;

  // Preview dos títulos que serão criados
  const previews = criarPorArea
    ? areas.map((a) => buildTitulo(selectedFranqueado!, a))
    : [selectedFranqueado ? buildTitulo(selectedFranqueado, areas[0] || '') : ''];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!faseId || !selectedFranqueadoId) return;

    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const cardList = criarPorArea ? areas : [areas[0] || ''];

      for (const area of cardList) {
        const titulo = selectedFranqueado ? buildTitulo(selectedFranqueado, area) : area;
        const { error } = await supabase.from('kanban_cards').insert({
          kanban_id: kanbanId,
          fase_id: faseId,
          franqueado_id: user.id,
          rede_franqueado_id: selectedFranqueadoId || null,
          titulo,
          status: 'ativo',
        });
        if (error) throw error;
      }

      router.push('/funil-stepone');
      router.refresh();
    } catch (err) {
      console.error('Erro ao criar card:', err);
      alert('Erro ao criar card. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="moni-form-novo-card space-y-6">
      {/* Seleção de franqueado */}
      <div>
        <label htmlFor="franqueado" className="block text-sm font-medium text-stone-700">
          Franqueado
        </label>
        {franqueados.length === 0 ? (
          <p className="mt-1 text-sm text-stone-500">
            Nenhum franqueado cadastrado em Rede de Franqueados.
          </p>
        ) : (
          <select
            id="franqueado"
            value={selectedFranqueadoId}
            onChange={(e) => setSelectedFranqueadoId(e.target.value)}
            required
            style={{
              border: '0.5px solid var(--moni-border-default)',
              borderRadius: 'var(--moni-radius-md)',
            }}
            className="mt-1 w-full px-4 py-2 text-sm focus:border-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-200"
          >
            {franqueados.map((f) => (
              <option key={f.id} value={f.id}>
                {[f.n_franquia, f.nome_completo].filter(Boolean).join(' - ')}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Preview do título */}
      {selectedFranqueado && (
        <div
          className="space-y-1 p-3 text-sm"
          style={{
            background: 'var(--moni-navy-50)',
            borderRadius: 'var(--moni-radius-md)',
            border: '0.5px solid var(--moni-border-subtle)',
          }}
        >
          <p className="text-xs font-medium text-stone-500">
            {previews.length > 1 ? `${previews.length} CARDS SERÃO CRIADOS` : 'TÍTULO DO CARD'}
          </p>
          {previews.map((t, i) => (
            <p key={i} className="font-medium text-stone-800">
              {t}
            </p>
          ))}
        </div>
      )}

      {/* Opção de criar um card por área (só quando há múltiplas áreas) */}
      {areas.length > 1 && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="porArea"
            checked={criarPorArea}
            onChange={(e) => setCriarPorArea(e.target.checked)}
            className="h-4 w-4 rounded border-stone-300"
          />
          <label htmlFor="porArea" className="text-sm text-stone-700">
            Criar um card separado para cada área de atuação ({areas.length} áreas)
          </label>
        </div>
      )}

      {/* Fase inicial */}
      <div>
        <label htmlFor="fase" className="block text-sm font-medium text-stone-700">
          Fase inicial
        </label>
        <select
          id="fase"
          value={faseId}
          onChange={(e) => setFaseId(e.target.value)}
          required
          style={{
            border: '0.5px solid var(--moni-border-default)',
            borderRadius: 'var(--moni-radius-md)',
          }}
          className="mt-1 w-full px-4 py-2 text-sm focus:border-[var(--moni-navy-800)] focus:outline-none focus:ring-2 focus:ring-[var(--moni-navy-800)]/20"
        >
          {fases.map((fase) => (
            <option key={fase.id} value={fase.id}>
              {fase.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-3 pt-4 sm:flex-row">
        <button
          type="submit"
          disabled={loading || !selectedFranqueadoId || !faseId}
          style={{
            background: 'var(--moni-text-primary)',
            borderRadius: 'var(--moni-radius-md)',
          }}
          className="w-full px-6 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800 disabled:opacity-50 sm:w-auto"
        >
          {loading
            ? 'Criando...'
            : criarPorArea
              ? `Criar ${previews.length} cards`
              : 'Criar card'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            border: '0.5px solid var(--moni-border-default)',
            borderRadius: 'var(--moni-radius-md)',
          }}
          className="w-full bg-transparent px-6 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50 sm:w-auto"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
