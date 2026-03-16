'use client';

import { useState, useTransition } from 'react';
import { approveDocumentInstance, rejectDocumentInstance, enviarParaAutentique } from './actions';

export type InstanceForRevisao = {
  id: string;
  versao: number;
  status: string;
  created_at: string;
  diff_json: {
    changes?: Array<{
      type: string;
      templateSlice?: string;
      documentSlice?: string;
      context?: string;
    }>;
    summary?: { total: number };
  } | null;
  motivo_reprovacao: string | null;
  arquivo_assinado_path?: string | null;
};

type Props = {
  instance: InstanceForRevisao;
  stepLabel: string;
};

export function RevisaoDocumentoCard({ instance, stepLabel }: Props) {
  const [showReject, setShowReject] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const handleApprove = () => {
    setMessage(null);
    startTransition(async () => {
      const res = await approveDocumentInstance(instance.id);
      if (res.ok) {
        setMessage({ type: 'ok', text: 'Documento aprovado.' });
        window.location.reload();
      } else {
        setMessage({ type: 'error', text: res.error ?? 'Erro ao aprovar.' });
      }
    });
  };

  const handleReject = () => {
    if (!motivo.trim() && !showReject) {
      setShowReject(true);
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const res = await rejectDocumentInstance(instance.id, motivo.trim() || 'Reprovado.');
      if (res.ok) {
        setMessage({ type: 'ok', text: 'Documento reprovado. O franqueado verá o parecer.' });
        window.location.reload();
      } else {
        setMessage({ type: 'error', text: res.error ?? 'Erro ao reprovar.' });
      }
    });
  };

  const handleEnviarAssinatura = () => {
    setMessage(null);
    startTransition(async () => {
      const res = await enviarParaAutentique(instance.id);
      if (res.ok) {
        setMessage({ type: 'ok', text: 'Documento enviado para assinatura no Autentique.' });
        window.location.reload();
      } else {
        setMessage({ type: 'error', text: res.error ?? 'Erro ao enviar para assinatura.' });
      }
    });
  };

  const diff = instance.diff_json;
  const totalDiffs = diff?.summary?.total ?? 0;
  const changes = diff?.changes ?? [];
  const isAguardando = instance.status === 'aguardando_revisao';
  const isAprovado = instance.status === 'aprovado';
  const isEnviadoAssinatura = instance.status === 'enviado_assinatura';
  const isAssinado = instance.status === 'assinado';

  return (
    <div className="rounded border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-sm font-medium text-stone-800">Versão {instance.versao}</span>
          <span className="ml-2 text-xs uppercase text-stone-500">{instance.status}</span>
          <span className="ml-2 text-xs text-stone-400">
            {new Date(instance.created_at).toLocaleString('pt-BR')}
          </span>
        </div>
        {(isAguardando || isAprovado) && (
          <div className="flex flex-wrap items-center gap-2">
            {isAguardando && (
              <>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={pending}
                  className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Aprovar
                </button>
                <button
                  type="button"
                  onClick={() => (showReject ? handleReject() : setShowReject(true))}
                  disabled={pending}
                  className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  Reprovado
                </button>
              </>
            )}
            {isAprovado && (
              <button
                type="button"
                onClick={handleEnviarAssinatura}
                disabled={pending}
                className="rounded-lg bg-moni-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-moni-accent/90 disabled:opacity-50"
              >
                Enviar para assinatura (Autentique)
              </button>
            )}
          </div>
        )}
        {isEnviadoAssinatura && (
          <span className="text-xs text-stone-500">Enviado para assinatura no Autentique</span>
        )}
        {isAssinado && <span className="text-xs font-medium text-green-700">Assinado</span>}
      </div>

      {instance.status === 'reprovado' && instance.motivo_reprovacao && (
        <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-sm text-amber-800">
          Parecer: {instance.motivo_reprovacao}
        </p>
      )}

      {message && (
        <p className={`mt-2 text-sm ${message.type === 'ok' ? 'text-green-700' : 'text-red-700'}`}>
          {message.text}
        </p>
      )}

      {showReject && (
        <div className="mt-3 rounded border border-stone-200 bg-stone-50 p-3">
          <label className="block text-sm font-medium text-stone-700">
            Parecer / motivo da reprovação (o franqueado verá este texto)
          </label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: Ajustar valor do item X na cláusula 2..."
            className="mt-1 w-full rounded border border-stone-200 px-2 py-1.5 text-sm"
            rows={3}
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={handleReject}
              disabled={pending || !motivo.trim()}
              className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700 disabled:opacity-50"
            >
              Enviar reprovação
            </button>
            <button
              type="button"
              onClick={() => setShowReject(false)}
              className="rounded border border-stone-200 px-3 py-1 text-sm text-stone-600 hover:bg-stone-100"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {totalDiffs > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium text-stone-700">
            Divergências em relação ao template ({totalDiffs})
          </summary>
          <ul className="mt-2 max-h-60 overflow-y-auto rounded border border-stone-200 bg-stone-50 p-2 text-sm">
            {changes.slice(0, 30).map((c, i) => (
              <li key={i} className="border-b border-stone-100 py-1.5 last:border-0">
                <span className="text-xs font-medium text-stone-500">{c.context}</span>
                {c.type === 'add' && (
                  <p className="mt-0.5 text-green-800">
                    <span className="font-medium">+ </span>
                    {c.documentSlice}
                  </p>
                )}
                {c.type === 'remove' && (
                  <p className="mt-0.5 text-red-800">
                    <span className="font-medium">− </span>
                    {c.templateSlice}
                  </p>
                )}
                {c.type === 'replace' && (
                  <>
                    <p className="mt-0.5 text-red-800">
                      <span className="font-medium">− </span>
                      {c.templateSlice}
                    </p>
                    <p className="mt-0.5 text-green-800">
                      <span className="font-medium">+ </span>
                      {c.documentSlice}
                    </p>
                  </>
                )}
              </li>
            ))}
            {changes.length > 30 && (
              <li className="py-1 text-stone-500">… e mais {changes.length - 30} divergência(s)</li>
            )}
          </ul>
        </details>
      )}

      {totalDiffs === 0 && diff && (
        <p className="mt-2 text-xs text-stone-500">
          Nenhuma divergência detectada em relação ao template.
        </p>
      )}

      {isAssinado && instance.arquivo_assinado_path && (
        <p className="mt-2">
          <a
            href={`/api/documentos/assinado/${instance.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-moni-accent hover:underline"
          >
            Baixar documento assinado
          </a>
        </p>
      )}
    </div>
  );
}
