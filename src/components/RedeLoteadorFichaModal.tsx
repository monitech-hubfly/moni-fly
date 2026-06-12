'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, X } from 'lucide-react';
import { atualizarRedeLoteador } from '@/app/rede-franqueados/rede-loteadores-actions';
import { redeAlertError, redeAlertSuccess, redeBtnGhost, redeBtnPrimary } from '@/app/rede-franqueados/rede-ui';
import { RedeLoteadorFichaForm } from '@/components/RedeLoteadorFichaForm';
import {
  redeLoteadorFichaDraftToPatch,
  redeLoteadorRowToFichaDraft,
  type RedeLoteadorFichaDraft,
} from '@/lib/rede-loteador-ficha-draft';
import type { RedeLoteadorRow } from '@/lib/rede-loteadores';

type Props = {
  row: RedeLoteadorRow;
  onClose: () => void;
};

export function RedeLoteadorFichaModal({ row, onClose }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<RedeLoteadorFichaDraft>(() => redeLoteadorRowToFichaDraft(row));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  useEffect(() => {
    setDraft(redeLoteadorRowToFichaDraft(row));
  }, [row]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const r = await atualizarRedeLoteador(row.id, redeLoteadorFichaDraftToPatch(draft));
    setSaving(false);
    if (!r.ok) {
      setMsg({ tipo: 'erro', texto: r.error });
      return;
    }
    setMsg({ tipo: 'ok', texto: r.mensagem });
    router.refresh();
    setTimeout(onClose, 600);
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rede-loteador-ficha-titulo"
      onClick={onClose}
    >
      <div
        className="my-4 w-full max-w-3xl rounded-xl border border-stone-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-stone-200 px-5 py-4">
          <div>
            <h2 id="rede-loteador-ficha-titulo" className="text-lg font-semibold text-stone-900">
              Ficha do loteador
            </h2>
            <p className="mt-0.5 text-sm text-stone-600">{row.nome}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-stone-500 hover:bg-stone-100"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[calc(100vh-8rem)] space-y-4 overflow-y-auto px-5 py-4">
          {msg ? (
            <div className={msg.tipo === 'ok' ? redeAlertSuccess : redeAlertError} role="status">
              {msg.texto}
            </div>
          ) : null}

          <RedeLoteadorFichaForm
            draft={draft}
            onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
            sectionIdPrefix="modal-loteador"
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-stone-200 px-5 py-4">
          <button type="button" onClick={onClose} disabled={saving} className={redeBtnGhost}>
            Cancelar
          </button>
          <button type="button" onClick={() => void save()} disabled={saving} className={redeBtnPrimary}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Salvar ficha
          </button>
        </div>
      </div>
    </div>
  );
}
