'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { criarCardsDesdeRedeFranqueados } from './actions';
import { redeAlertError, redeAlertSuccess, redeBtnPrimary, redePanel } from './rede-ui';

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
      setMensagem({
        tipo: 'sucesso',
        texto:
          result.criados === 0
            ? result.mensagem
            : `${result.mensagem} Atualize a página do Painel para ver os cards.`,
      });
      router.refresh();
    } else {
      setMensagem({ tipo: 'erro', texto: result.error });
    }
  };

  if (linhasSemCard === 0) {
    return (
      <div className={redeAlertSuccess} role="status">
        Todas as linhas da tabela já possuem um card no Painel Novos Negócios.
      </div>
    );
  }

  return (
    <div className={redePanel}>
      <p className="text-sm font-medium text-stone-800">Criar cards no Painel (Step 1)</p>
      <p className="mt-1 text-xs text-stone-600">
        {linhasSemCard} linha(s) ainda sem card. Será criado um processo para cada uma.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={handleCriar} disabled={loading} className={redeBtnPrimary}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Criando…
            </>
          ) : (
            'Criar todos os cards'
          )}
        </button>
      </div>
      {mensagem ? (
        <div
          className={`mt-3 ${mensagem.tipo === 'sucesso' ? redeAlertSuccess : redeAlertError}`}
          role="status"
        >
          {mensagem.texto}
        </div>
      ) : null}
    </div>
  );
}
