'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  RedeFrankCadastroPayload,
  RedeFrankFranquiaSomenteLeitura,
} from '@/lib/portal-frank/rede-cadastro-types';
import { submeterValidacaoTrimestralFrank } from '@/app/portal-frank/actions';
import { RedeFrankDadosCampos } from './RedeFrankDadosCampos';

type Props = {
  periodo: string;
  titulo: string;
  valoresEditaveis: RedeFrankCadastroPayload;
  franquiaSomenteLeitura: RedeFrankFranquiaSomenteLeitura;
};

export function FrankValidacaoBloqueante({
  periodo,
  titulo,
  valoresEditaveis,
  franquiaSomenteLeitura,
}: Props) {
  const router = useRouter();
  const [dados, setDados] = useState<RedeFrankCadastroPayload>(valoresEditaveis);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await submeterValidacaoTrimestralFrank(periodo, dados);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    } catch {
      setError('Não foi possível enviar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4">
      <div
        className="max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-xl border bg-white p-6 shadow-xl"
        style={{ borderColor: 'var(--moni-border-default)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="frank-validacao-titulo"
      >
        <h2 id="frank-validacao-titulo" className="text-lg font-semibold text-stone-900">
          Confirme seus dados na rede
        </h2>
        <p className="mt-1 text-sm text-stone-600">{titulo}</p>
        <p className="mt-2 text-xs text-stone-500">
          Por lei interna de qualidade, é obrigatório revisar e confirmar os dados abaixo neste período (
          {periodo}). O portal permanece bloqueado até o envio.
        </p>
        <form className="mt-6 space-y-4" onSubmit={(ev) => void handleSubmit(ev)}>
          <div className="border-t border-stone-200 pt-4">
            <h3 className="text-sm font-semibold text-stone-800">Dados do franqueado</h3>
            <div className="mt-3">
              <RedeFrankDadosCampos
                franquiaSomenteLeitura={franquiaSomenteLeitura}
                value={dados}
                onChange={setDados}
              />
            </div>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: 'var(--moni-navy-800)' }}
          >
            {loading ? 'Enviando…' : 'Confirmar dados e liberar portal'}
          </button>
        </form>
      </div>
    </div>
  );
}
