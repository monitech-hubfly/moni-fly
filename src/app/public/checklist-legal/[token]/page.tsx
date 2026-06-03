'use client';

import { useEffect, useState } from 'react';
import { ChecklistLegalFormWizard } from '@/components/checklist-legal/ChecklistLegalFormWizard';
import {
  EMPTY_CHECKLIST_LEGAL_ARQUIVOS,
  EMPTY_CHECKLIST_LEGAL_RESPOSTAS,
  type ChecklistLegalArquivos,
  type ChecklistLegalFileMeta,
  type ChecklistLegalRespostas,
} from '@/lib/checklist-legal/types';

export default function PublicChecklistLegalPage({ params }: { params: { token: string } }) {
  const token = String(params.token ?? '').trim();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [respostas, setRespostas] = useState<ChecklistLegalRespostas>(EMPTY_CHECKLIST_LEGAL_RESPOSTAS);
  const [arquivos, setArquivos] = useState<ChecklistLegalArquivos>(EMPTY_CHECKLIST_LEGAL_ARQUIVOS);

  useEffect(() => {
    void (async () => {
      if (!token) {
        setErro('Link inválido.');
        setLoading(false);
        return;
      }
      const res = await fetch(`/api/public/checklist-legal/${encodeURIComponent(token)}`);
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        prefill?: Record<string, string>;
        payload?: { respostas_json?: ChecklistLegalRespostas; arquivos_json?: ChecklistLegalArquivos };
      } | null;
      if (!res.ok || !json?.ok) {
        setErro(json?.error ?? 'Não foi possível carregar o formulário.');
        setLoading(false);
        return;
      }
      setRespostas({
        ...EMPTY_CHECKLIST_LEGAL_RESPOSTAS,
        ...(json.prefill ?? {}),
        ...(json.payload?.respostas_json ?? {}),
      });
      setArquivos({ ...EMPTY_CHECKLIST_LEGAL_ARQUIVOS, ...(json.payload?.arquivos_json ?? {}) });
      setLoading(false);
    })();
  }, [token]);

  async function uploadFiles(fieldKey: string, files: File[]): Promise<ChecklistLegalFileMeta[]> {
    const fd = new FormData();
    fd.set('token', token);
    fd.set('fieldKey', fieldKey);
    for (const f of files) fd.append('files', f);
    const res = await fetch('/api/checklist-legal-condominio/upload', { method: 'POST', body: fd });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; files?: ChecklistLegalFileMeta[] };
    if (!res.ok || !json?.ok || !json.files?.length) throw new Error(json?.error ?? 'Falha no upload.');
    return json.files;
  }

  async function persist(concluir: boolean) {
    const res = await fetch(`/api/public/checklist-legal/${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ respostas_json: respostas, arquivos_json: arquivos, concluir }),
    });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string };
    if (!res.ok || !json?.ok) throw new Error(json?.error ?? 'Erro ao salvar.');
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-white px-4 py-8">
      <h1 className="text-xl font-semibold text-stone-800">Checklist Legal — Acoplamento</h1>
      <p className="mt-1 text-sm text-stone-500">
        Preencha por seções. Você pode salvar rascunho e retomar depois com o mesmo link (válido por 30 dias).
      </p>

      {loading ? <p className="mt-6 text-sm text-stone-500">Carregando…</p> : null}
      {erro ? (
        <div className="mt-6 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>
      ) : null}

      {!loading && !erro ? (
        <div className="mt-6">
          <ChecklistLegalFormWizard
            respostas={respostas}
            arquivos={arquivos}
            onChangeRespostas={setRespostas}
            onChangeArquivos={setArquivos}
            onSaveDraft={() => persist(false)}
            onConcluir={() => persist(true)}
            onUploadFiles={uploadFiles}
          />
        </div>
      ) : null}
    </main>
  );
}
