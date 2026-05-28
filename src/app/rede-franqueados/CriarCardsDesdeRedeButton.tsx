'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { criarCardsDesdeRedeFranqueados } from './actions';
import { redeAlertError, redeAlertSuccess, redeBtnGhost } from './rede-ui';

type Props = {
  linhasSemCard: number;
};

export function CriarCardsDesdeRedeButton({ linhasSemCard }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  if (linhasSemCard === 0) return null;

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
            : `${result.mensagem} Atualize o Painel para ver os cards.`,
      });
      router.refresh();
    } else {
      setMensagem({ tipo: 'erro', texto: result.error });
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleCriar}
        disabled={loading}
        className={redeBtnGhost}
        title={`${linhasSemCard} linha(s) sem card no Painel Step 1`}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Criando cards…
          </>
        ) : (
          `Criar cards no Painel (${linhasSemCard})`
        )}
      </button>
      {mensagem ? (
        <div
          className={`absolute right-0 top-full z-20 mt-2 min-w-[16rem] max-w-lg shadow-md ${mensagem.tipo === 'sucesso' ? redeAlertSuccess : redeAlertError}`}
          role="status"
        >
          {mensagem.texto}
        </div>
      ) : null}
    </>
  );
}
