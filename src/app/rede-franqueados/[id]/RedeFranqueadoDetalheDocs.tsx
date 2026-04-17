'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSignedUrlRedeAnexo, uploadRedeFranqueadoAssinado } from '../actions';

function nomeDoPath(path: string) {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] || path;
}

type Props = {
  redeId: string;
  pathCof: string | null;
  pathContrato: string | null;
};

export function RedeFranqueadoDetalheDocs({ redeId, pathCof, pathContrato }: Props) {
  const router = useRouter();
  const refCof = useRef<HTMLInputElement>(null);
  const refCtr = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [up, setUp] = useState<'cof' | 'contrato' | null>(null);

  async function download(path: string) {
    setMsg(null);
    const r = await getSignedUrlRedeAnexo(path);
    if (!r.ok) {
      setMsg({ tipo: 'erro', texto: r.error });
      return;
    }
    window.open(r.url, '_blank', 'noopener,noreferrer');
  }

  async function onFile(tipo: 'cof' | 'contrato', e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setUp(tipo);
    setMsg(null);
    const fd = new FormData();
    fd.set('tipo', tipo);
    fd.set('redeId', redeId);
    fd.set('file', f);
    const r = await uploadRedeFranqueadoAssinado(fd);
    setUp(null);
    if (!r.ok) {
      setMsg({ tipo: 'erro', texto: r.error });
      return;
    }
    setMsg({ tipo: 'ok', texto: 'Arquivo enviado com sucesso.' });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {msg ? (
        <div
          className={`rounded-lg border p-3 text-sm ${
            msg.tipo === 'ok' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {msg.texto}
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-stone-800">COF assinado</h2>
          {pathCof ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="truncate text-xs text-stone-600" title={pathCof}>
                {nomeDoPath(pathCof)}
              </span>
              <button
                type="button"
                onClick={() => void download(pathCof)}
                className="rounded-lg border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-800 hover:bg-stone-100"
              >
                Baixar
              </button>
            </div>
          ) : (
            <p className="mt-2 text-xs text-stone-500">Nenhum arquivo cadastrado.</p>
          )}
          <input ref={refCof} type="file" className="hidden" onChange={(ev) => void onFile('cof', ev)} />
          <button
            type="button"
            disabled={up !== null}
            onClick={() => refCof.current?.click()}
            className="mt-3 rounded-lg bg-moni-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {up === 'cof' ? 'Enviando…' : pathCof ? 'Substituir arquivo' : 'Enviar arquivo'}
          </button>
          <p className="mt-1 text-[10px] text-stone-400">Até 10 MB · qualquer tipo</p>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-stone-800">Contrato assinado</h2>
          {pathContrato ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="truncate text-xs text-stone-600" title={pathContrato}>
                {nomeDoPath(pathContrato)}
              </span>
              <button
                type="button"
                onClick={() => void download(pathContrato)}
                className="rounded-lg border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-800 hover:bg-stone-100"
              >
                Baixar
              </button>
            </div>
          ) : (
            <p className="mt-2 text-xs text-stone-500">Nenhum arquivo cadastrado.</p>
          )}
          <input ref={refCtr} type="file" className="hidden" onChange={(ev) => void onFile('contrato', ev)} />
          <button
            type="button"
            disabled={up !== null}
            onClick={() => refCtr.current?.click()}
            className="mt-3 rounded-lg bg-moni-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {up === 'contrato' ? 'Enviando…' : pathContrato ? 'Substituir arquivo' : 'Enviar arquivo'}
          </button>
          <p className="mt-1 text-[10px] text-stone-400">Até 10 MB · qualquer tipo</p>
        </div>
      </div>
    </div>
  );
}
