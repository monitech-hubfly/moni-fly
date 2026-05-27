'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSignedUrlRedeAnexo, uploadRedeFranqueadoAssinado } from '../actions';

function nomeDoPath(path: string) {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] || path;
}

type AnexoTipo = 'cof' | 'contrato' | 'numero_franquia';

type DocCardConfig = {
  tipo: AnexoTipo;
  titulo: string;
  path: string | null;
};

type Props = {
  redeId: string;
  pathCof: string | null;
  pathContrato: string | null;
  pathNumeroFranquia: string | null;
};

function DocUploadCard({
  config,
  uploading,
  onUpload,
  onDownload,
}: {
  config: DocCardConfig;
  uploading: AnexoTipo | null;
  onUpload: (tipo: AnexoTipo, e: React.ChangeEvent<HTMLInputElement>) => void;
  onDownload: (path: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { tipo, titulo, path } = config;
  const busy = uploading !== null;
  const sending = uploading === tipo;

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-stone-800">{titulo}</h2>
      {path ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="truncate text-xs text-stone-600" title={path}>
            {nomeDoPath(path)}
          </span>
          <button
            type="button"
            onClick={() => void onDownload(path)}
            className="rounded-lg border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-800 hover:bg-stone-100"
          >
            Baixar
          </button>
        </div>
      ) : (
        <p className="mt-2 text-xs text-stone-500">Nenhum arquivo cadastrado.</p>
      )}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(ev) => void onUpload(tipo, ev)}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="mt-3 rounded-lg bg-moni-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {sending ? 'Enviando…' : path ? 'Substituir arquivo' : 'Enviar arquivo'}
      </button>
      <p className="mt-1 text-[10px] text-stone-400">Até 10 MB · qualquer tipo</p>
    </div>
  );
}

export function RedeFranqueadoDetalheDocs({
  redeId,
  pathCof,
  pathContrato,
  pathNumeroFranquia,
}: Props) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [up, setUp] = useState<AnexoTipo | null>(null);

  const cards: DocCardConfig[] = [
    { tipo: 'cof', titulo: 'COF assinado', path: pathCof },
    { tipo: 'contrato', titulo: 'Contrato assinado', path: pathContrato },
    { tipo: 'numero_franquia', titulo: 'Documento de número de franquia', path: pathNumeroFranquia },
  ];

  async function download(path: string) {
    setMsg(null);
    const r = await getSignedUrlRedeAnexo(path);
    if (!r.ok) {
      setMsg({ tipo: 'erro', texto: r.error });
      return;
    }
    window.open(r.url, '_blank', 'noopener,noreferrer');
  }

  async function onFile(tipo: AnexoTipo, e: React.ChangeEvent<HTMLInputElement>) {
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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((config) => (
          <DocUploadCard
            key={config.tipo}
            config={config}
            uploading={up}
            onUpload={onFile}
            onDownload={download}
          />
        ))}
      </div>
    </div>
  );
}
