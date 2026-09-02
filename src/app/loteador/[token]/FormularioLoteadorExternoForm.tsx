'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { RedeLoteadorFichaForm } from '@/components/RedeLoteadorFichaForm';
import { salvarFichaLoteadorExterna } from '@/lib/actions/loteador-externo-actions';
import type { RedeLoteadorFichaDraft } from '@/lib/rede-loteador-ficha-draft';

type Props = {
  token: string;
  draftInicial: RedeLoteadorFichaDraft;
};

export function FormularioLoteadorExternoForm({ token, draftInicial }: Props) {
  const [draft, setDraft] = useState(draftInicial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const salvar = async () => {
    setSaving(true);
    setErro(null);
    setMsg(null);
    const r = await salvarFichaLoteadorExterna({ token, draft });
    setSaving(false);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    setMsg('Dados salvos com sucesso. As alterações refletem no card em tempo real.');
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        Preencha ou atualize os dados do loteador. Campos de anexo: cole URLs ou paths dos arquivos.
      </p>

      {erro ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{erro}</div>
      ) : null}
      {msg ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">{msg}</div>
      ) : null}

      <RedeLoteadorFichaForm
        draft={draft}
        onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
        showStatus={false}
        sectionIdPrefix="loteador-ext"
      />

      <button
        type="button"
        disabled={saving}
        onClick={() => void salvar()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0c2633] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0c2633]/90 disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Salvar dados do loteador
      </button>
    </div>
  );
}
