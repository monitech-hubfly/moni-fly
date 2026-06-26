'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { formatDataEnvioCreditoObraExibicao } from '@/lib/pre-obra/credito-obra-envio-data';

type Props = {
  open: boolean;
  tituloCard: string;
  dataEnvioExibicao: string | null;
  dataEnvioIso: string | null;
  onAutorizar: () => void;
  onRecusar: (novaPrevisaoPrefeitura: string) => void;
  pending?: boolean;
};

export function CreditoObraAberturaAutorizacaoModal({
  open,
  tituloCard,
  dataEnvioExibicao,
  dataEnvioIso,
  onAutorizar,
  onRecusar,
  pending = false,
}: Props) {
  const [modoRecusa, setModoRecusa] = useState(false);
  const [novaPrefeitura, setNovaPrefeitura] = useState('');
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setModoRecusa(false);
      setNovaPrefeitura('');
      setErroLocal(null);
    }
  }, [open]);

  if (!open) return null;

  const dataLabel = dataEnvioExibicao ?? formatDataEnvioCreditoObraExibicao(dataEnvioIso) ?? '—';

  const handleRecusar = () => {
    if (!novaPrefeitura.trim()) {
      setErroLocal('Informe a nova previsão de aprovação na prefeitura.');
      return;
    }
    setErroLocal(null);
    onRecusar(novaPrefeitura.trim());
  };

  return (
    <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="credito-obra-abertura-titulo"
      >
        <h3 id="credito-obra-abertura-titulo" className="text-base font-semibold text-stone-900">
          Abrir card no Funil Cash Me?
        </h3>
        <p className="mt-2 text-sm text-stone-600">
          O card <span className="font-medium text-stone-800">{tituloCard}</span> está na fase{' '}
          <span className="font-medium">Aprovação na Prefeitura</span>. A data de envio para Crédito Obra (
          <span className="font-medium">{dataLabel}</span>) foi atingida.
        </p>
        <p className="mt-2 text-sm text-stone-600">
          Autoriza a criação automática de um card na esteira <strong>Funil Cash Me</strong> (fase Novo
          Projeto)?
        </p>

        {modoRecusa ? (
          <div className="mt-4">
            <label className="block text-xs font-medium text-stone-600">
              Nova previsão de aprovação na prefeitura
              <input
                type="date"
                value={novaPrefeitura}
                onChange={(e) => {
                  setNovaPrefeitura(e.target.value);
                  setErroLocal(null);
                }}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-1 focus:ring-stone-400"
                disabled={pending}
              />
            </label>
            <p className="mt-1 text-[11px] text-stone-500">
              A data de envio para Crédito Obra será recalculada (prefeitura − 30 dias corridos, próximo dia
              útil).
            </p>
          </div>
        ) : null}

        {erroLocal ? <p className="mt-2 text-xs text-red-600">{erroLocal}</p> : null}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          {!modoRecusa ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setModoRecusa(true);
                  setErroLocal(null);
                }}
                disabled={pending}
                className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
              >
                Não autorizar
              </button>
              <button
                type="button"
                onClick={onAutorizar}
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Autorizar abertura
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setModoRecusa(false);
                  setErroLocal(null);
                }}
                disabled={pending}
                className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleRecusar}
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Confirmar nova previsão
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
