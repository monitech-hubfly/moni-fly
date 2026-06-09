'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { criarCardsDesdeRedeFranqueados, garantirCardsFunilStepOneDesdeRede } from './actions';
import { redeAlertError, redeAlertSuccess, redeBtnGhost } from './rede-ui';

type Props = {
  linhasSemCard: number;
  linhasSemFunil: number;
};

export function CriarCardsDesdeRedeButton({ linhasSemCard, linhasSemFunil }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  const pendente = linhasSemCard > 0 || linhasSemFunil > 0;
  if (!pendente) return null;

  const handleCriar = async () => {
    setMensagem(null);
    setLoading(true);

    const partes: string[] = [];

    if (linhasSemCard > 0) {
      const result = await criarCardsDesdeRedeFranqueados();
      if (!result.ok) {
        setLoading(false);
        setMensagem({ tipo: 'erro', texto: result.error });
        return;
      }
      partes.push(result.mensagem);
    } else if (linhasSemFunil > 0) {
      const result = await garantirCardsFunilStepOneDesdeRede();
      setLoading(false);
      if (!result.ok) {
        setMensagem({ tipo: 'erro', texto: result.error });
        return;
      }
      partes.push(result.mensagem);
      setMensagem({ tipo: 'sucesso', texto: partes.join(' ') });
      router.refresh();
      return;
    }

    setLoading(false);
    setMensagem({
      tipo: 'sucesso',
      texto: partes.length ? `${partes.join(' ')} Atualize o Painel e o Funil Step One.` : 'Sincronização concluída.',
    });
    router.refresh();
  };

  const label =
    linhasSemCard > 0 && linhasSemFunil > 0
      ? `Sincronizar cards (${linhasSemCard} Painel · ${linhasSemFunil} Funil)`
      : linhasSemCard > 0
        ? `Criar cards no Painel (${linhasSemCard})`
        : `Criar cards no Funil (${linhasSemFunil})`;

  const title =
    linhasSemCard > 0 && linhasSemFunil > 0
      ? `${linhasSemCard} linha(s) sem card no Painel; ${linhasSemFunil} sem card no Funil Step One`
      : linhasSemCard > 0
        ? `${linhasSemCard} linha(s) sem card no Painel Step 1`
        : `${linhasSemFunil} linha(s) sem card no Funil Step One`;

  return (
    <>
      <button
        type="button"
        onClick={() => void handleCriar()}
        disabled={loading}
        className={redeBtnGhost}
        title={title}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sincronizando…
          </>
        ) : (
          label
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
