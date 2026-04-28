'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Fase = {
  id: string;
  nome: string;
  ordem: number;
};

export function NovoCardModal({
  kanbanId,
  onClose,
  isAdmin,
}: {
  kanbanId: string;
  onClose: () => void;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [nFranquia, setNFranquia] = useState('');
  const [franqueadoNome, setFranqueadoNome] = useState('');
  const [franqueadoRedeId, setFranqueadoRedeId] = useState('');
  const [buscandoFranqueado, setBuscandoFranqueado] = useState(false);
  const [erroFranqueado, setErroFranqueado] = useState('');
  const [faseId, setFaseId] = useState('');
  const [fases, setFases] = useState<Fase[]>([]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const n = nFranquia.trim().toUpperCase();
    if (!n) {
      setFranqueadoNome('');
      setFranqueadoRedeId('');
      setErroFranqueado('');
      return;
    }
    const t = setTimeout(async () => {
      setBuscandoFranqueado(true);
      setErroFranqueado('');
      const supabase = createClient();
      const { data } = await supabase
        .from('rede_franqueados')
        .select('id, nome_completo, n_franquia')
        .ilike('n_franquia', n)
        .limit(1)
        .maybeSingle();
      setBuscandoFranqueado(false);
      if (data) {
        setFranqueadoNome(String((data as { nome_completo?: string | null }).nome_completo ?? ''));
        setFranqueadoRedeId(String((data as { id: string }).id));
        setErroFranqueado('');
      } else {
        setFranqueadoNome('');
        setFranqueadoRedeId('');
        setErroFranqueado('Franqueado não encontrado');
      }
    }, 500);
    return () => clearTimeout(t);
  }, [nFranquia]);

  async function loadData() {
    try {
      const supabase = createClient();

      // Busca as fases
      const { data: fasesData } = await supabase
        .from('kanban_fases')
        .select('id, nome, ordem')
        .eq('kanban_id', kanbanId)
        .eq('ativo', true)
        .order('ordem');

      if (fasesData && fasesData.length > 0) {
        setFases(fasesData);
        setFaseId(fasesData[0].id); // Primeira fase como padrão
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!franqueadoRedeId || !faseId) return;

    setLoading(true);
    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const nomeFranqueado = franqueadoNome || 'Sem nome';
      const faseNome = fases.find((f) => f.id === faseId)?.nome || 'Fase';

      // Gera título automático: "Franqueado - Fase"
      const tituloAuto = `${nomeFranqueado} - ${faseNome}`;

      const { error } = await supabase.from('kanban_cards').insert({
        kanban_id: kanbanId,
        fase_id: faseId,
        franqueado_id: user.id,
        rede_franqueado_id: franqueadoRedeId || null,
        titulo: tituloAuto,
        status: 'ativo',
      });

      if (error) throw error;

      router.refresh();
      onClose();
    } catch (err) {
      console.error('Erro ao criar card:', err);
      alert('Erro ao criar card. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  // Preview do título
  const getFranqueadoNome = () => {
    return franqueadoNome || 'Franqueado';
  };

  const getFaseNome = () => {
    return fases.find((f) => f.id === faseId)?.nome || 'Fase';
  };

  const tituloPreview = `${getFranqueadoNome()} - ${getFaseNome()}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full overflow-hidden bg-white"
        style={{
          maxWidth: '500px',
          borderRadius: 'var(--moni-radius-xl)',
          border: '0.5px solid var(--moni-border-default)',
          boxShadow: 'var(--moni-shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b bg-white px-6 py-4"
          style={{
            borderColor: 'var(--moni-border-default)',
            borderTopLeftRadius: 'var(--moni-radius-xl)',
            borderTopRightRadius: 'var(--moni-radius-xl)',
          }}
        >
          <h2 className="text-lg font-bold" style={{ color: 'var(--moni-text-primary)' }}>
            Novo Card
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Campo Franqueado (apenas para admin) */}
            <div>
              <label className="block text-sm font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                N° da Franquia <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={nFranquia}
                onChange={(e) => setNFranquia(e.target.value.toUpperCase())}
                placeholder="Ex: FK0012"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                disabled={loading}
              />
              {buscandoFranqueado && <p className="mt-1 text-xs text-stone-400">Buscando...</p>}
              {franqueadoNome && !buscandoFranqueado && (
                <p className="mt-1 text-xs font-medium text-green-700">✓ {franqueadoNome}</p>
              )}
              {erroFranqueado && <p className="mt-1 text-xs text-red-500">{erroFranqueado}</p>}
            </div>

            {/* Campo Fase Inicial */}
            <div>
              <label htmlFor="fase" className="block text-sm font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                Fase inicial <span className="text-red-500">*</span>
              </label>
              <select
                id="fase"
                value={faseId}
                onChange={(e) => setFaseId(e.target.value)}
                required
                disabled={loading}
                className="mt-1 w-full px-4 py-2 text-sm focus:outline-none disabled:bg-stone-50"
                style={{
                  border: '0.5px solid var(--moni-border-default)',
                  borderRadius: 'var(--moni-radius-md)',
                }}
              >
                <option value="">Selecione a fase</option>
                {fases.map((fase) => (
                  <option key={fase.id} value={fase.id}>
                    {fase.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Preview do Título Automático */}
            <div
              className="rounded-lg p-4"
              style={{
                background: 'var(--moni-surface-50)',
                border: '0.5px solid var(--moni-border-default)',
              }}
            >
              <p className="mb-2 text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
                PREVIEW DO TÍTULO
              </p>
              <p className="text-sm font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
                {franqueadoRedeId && faseId ? tituloPreview : 'Selecione os campos acima'}
              </p>
              <p className="mt-1 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                O título será gerado automaticamente ao criar o card
              </p>
            </div>

            {/* Botões */}
            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <button
                type="submit"
                disabled={loading || !faseId || !franqueadoRedeId}
                className="flex-1 px-6 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                style={{
                  background: 'var(--moni-navy-800)',
                  borderRadius: 'var(--moni-radius-md)',
                }}
              >
                {loading ? 'Criando...' : 'Criar Card'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-6 py-2.5 text-sm font-medium transition hover:bg-stone-50"
                style={{
                  background: 'transparent',
                  color: 'var(--moni-text-secondary)',
                  border: '0.5px solid var(--moni-border-default)',
                  borderRadius: 'var(--moni-radius-md)',
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
