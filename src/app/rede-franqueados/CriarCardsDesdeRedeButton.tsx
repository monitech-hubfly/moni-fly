'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { criarCardsDesdeRedeFranqueados } from './actions';

type Props = {
  linhasSemCard: number;
};

export function CriarCardsDesdeRedeButton({ linhasSemCard }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  const handleCriar = async () => {
    setMensagem(null);
    setLoading(true);
    const result = await criarCardsDesdeRedeFranqueados();
    setLoading(false);
    if (result.ok) {
      setMensagem({ tipo: 'sucesso', texto: result.criados === 0 ? result.mensagem : `${result.mensagem} Atualize a página do Painel para ver os cards.` });
      router.refresh();
    } else {
      setMensagem({ tipo: 'erro', texto: result.error });
    }
  };

  if (linhasSemCard === 0) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        Todas as linhas da tabela já possuem um card no Painel Novos Negócios.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-stone-700">
        Criar cards no Painel Novos Negócios (Step 1) a partir da tabela
      </p>
      <p className="mt-1 text-xs text-stone-500">
        {linhasSemCard} linha(s) ainda sem card. Será criado um processo (card) para cada uma, na fase Step 1.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleCriar}
          disabled={loading}
          className="rounded-lg bg-moni-primary px-4 py-2 text-sm font-medium text-white hover:bg-moni-secondary disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              Criando…
            </>
          ) : (
            'Criar todos os cards'
          )}
        </button>
      </div>
      {mensagem && (
        <p className={`mt-3 text-sm ${mensagem.tipo === 'sucesso' ? 'text-green-700' : 'text-red-600'}`}>
          {mensagem.texto}
        </p>
      )}
    </div>
  );
}
