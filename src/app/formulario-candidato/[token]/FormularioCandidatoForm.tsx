'use client';

import { useState, type ReactNode } from 'react';
import { Loader2, CheckCircle2, Download, Upload } from 'lucide-react';
import { salvarRespostaCandidato, type FaseChecklistItem } from '@/lib/actions/candidato-actions';
import { ChecklistDocumentDiffModal } from '@/components/kanban-shared/ChecklistDocumentDiffModal';

type Props = {
  token: string;
  cardId: string;
  itens: FaseChecklistItem[];
  respostasIniciais: Record<string, string>;
  arquivosIniciais?: Record<string, string | null>;
};

export function FormularioCandidatoForm({
  token,
  cardId,
  itens,
  respostasIniciais,
  arquivosIniciais = {},
}: Props) {
  const [valores, setValores] = useState<Record<string, string>>(respostasIniciais);
  const [arquivos, setArquivos] = useState<Record<string, string | null>>(() => ({ ...arquivosIniciais }));
  const [enviando, setEnviando] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviado, setEnviado] = useState(false);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [diffModal, setDiffModal] = useState<{ open: boolean; lines: string[] }>({ open: false, lines: [] });

  function set(itemId: string, valor: string) {
    setValores((prev) => ({ ...prev, [itemId]: valor }));
    setErros((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  }

  async function baixarModelo(itemId: string) {
    setErroGeral(null);
    try {
      const r = await fetch(
        `/api/candidato/download-template?token=${encodeURIComponent(token)}&item_id=${encodeURIComponent(itemId)}`,
      );
      const j = (await r.json()) as { url?: string; error?: string };
      if (!r.ok || j.error || !j.url) {
        setErros((p) => ({ ...p, [itemId]: j.error ?? 'Não foi possível baixar o modelo.' }));
        return;
      }
      setErros((p) => {
        const n = { ...p };
        delete n[itemId];
        return n;
      });
      window.open(j.url, '_blank', 'noopener,noreferrer');
    } catch {
      setErros((p) => ({ ...p, [itemId]: 'Erro ao baixar o modelo.' }));
    }
  }

  async function enviarAssinado(itemId: string, file: File | null) {
    if (!file) return;
    setUploadingId(itemId);
    setErroGeral(null);
    try {
      const fd = new FormData();
      fd.set('token', token);
      fd.set('item_id', itemId);
      fd.set('file', file);
      const r = await fetch('/api/candidato/upload-assinado', { method: 'POST', body: fd });
      const j = (await r.json()) as { ok?: boolean; path?: string; error?: string };
      if (!r.ok || !j.ok || !j.path) {
        setErros((p) => ({ ...p, [itemId]: j.error ?? 'Falha no envio do arquivo.' }));
        return;
      }
      const path = j.path;
      setArquivos((p) => ({ ...p, [itemId]: path }));
      setErros((p) => {
        const n = { ...p };
        delete n[itemId];
        return n;
      });

      const meta = itens.find((i) => i.id === itemId);
      if (meta?.tipo === 'anexo_template') {
        try {
          const cr = await fetch('/api/candidato/comparar-documentos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, item_id: itemId, card_id: cardId }),
          });
          const cj = (await cr.json()) as {
            ok?: boolean;
            diferencas?: string[];
            temDiferencasRelevantes?: boolean;
          };
          if (cr.ok && cj.ok && cj.temDiferencasRelevantes && Array.isArray(cj.diferencas) && cj.diferencas.length) {
            setDiffModal({ open: true, lines: cj.diferencas });
          }
        } catch {
          /* opcional */
        }
      }
    } finally {
      setUploadingId(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const novosErros: Record<string, string> = {};
    for (const it of itens) {
      if (!it.obrigatorio) continue;
      if (it.tipo === 'anexo_template' || it.tipo === 'anexo') {
        const p = (arquivos[it.id] ?? '').trim();
        if (!p) novosErros[it.id] = 'Anexo obrigatório.';
      } else if (it.tipo === 'checkbox') {
        const v = (valores[it.id] ?? '').trim();
        if (v !== 'true') novosErros[it.id] = 'Campo obrigatório.';
      } else {
        const v = (valores[it.id] ?? '').trim();
        if (!v) novosErros[it.id] = 'Campo obrigatório.';
      }
    }
    if (Object.keys(novosErros).length) {
      setErros(novosErros);
      return;
    }

    setEnviando(true);
    setErroGeral(null);

    for (const it of itens) {
      const path = arquivos[it.id];
      const res = await salvarRespostaCandidato(
        token,
        it.id,
        valores[it.id] ?? '',
        path !== undefined ? path : undefined,
      );
      if (!res.ok) {
        setErroGeral(res.error);
        setEnviando(false);
        return;
      }
    }

    setEnviado(true);
    setEnviando(false);
  }

  if (enviado) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <CheckCircle2 size={48} className="text-green-500" />
        <h2 className="text-xl font-semibold text-gray-800">Respostas enviadas com sucesso!</h2>
        <p className="text-sm text-gray-500">Obrigado pelo preenchimento. Nossa equipe entrará em contato em breve.</p>
      </div>
    );
  }

  const inputBase =
    'w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition focus:ring-2' +
    ' border-gray-200 bg-white text-gray-900 focus:border-violet-400 focus:ring-violet-100';

  const btnOutline =
    'inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50';
  const btnStyle = {
    borderColor: 'var(--moni-border-default)',
    background: 'var(--moni-surface-100)',
    color: 'var(--moni-text-secondary)',
  } as const;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <ChecklistDocumentDiffModal
        open={diffModal.open}
        diferencas={diffModal.lines}
        onClose={() => setDiffModal({ open: false, lines: [] })}
      />
      {itens.map((item) => {
        const valor = valores[item.id] ?? '';
        const erro = erros[item.id];
        const pathArquivo = arquivos[item.id];

        const label = (
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            {item.label}
            {item.obrigatorio && <span className="ml-1 text-red-500">*</span>}
          </label>
        );

        if (item.tipo === 'anexo_template') {
          return (
            <div key={item.id}>
              {label}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void baixarModelo(item.id)}
                  className={btnOutline}
                  style={btnStyle}
                >
                  <Download size={14} />
                  Baixar modelo
                </button>
                <label className={`${btnOutline} cursor-pointer`} style={btnStyle}>
                  <input
                    type="file"
                    className="sr-only"
                    disabled={uploadingId === item.id}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      void enviarAssinado(item.id, f);
                      e.target.value = '';
                    }}
                  />
                  {uploadingId === item.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Upload size={14} />
                  )}
                  Anexar assinado
                </label>
              </div>
              {pathArquivo ? (
                <p className="mt-1.5 truncate text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                  Arquivo enviado: {pathArquivo.split('/').pop()}
                </p>
              ) : null}
              {erro && <p className="mt-1 text-xs text-red-500">{erro}</p>}
            </div>
          );
        }

        if (item.tipo === 'anexo') {
          return (
            <div key={item.id}>
              {label}
              <div className="flex flex-wrap items-center gap-2">
                <label className={`${btnOutline} cursor-pointer`} style={btnStyle}>
                  <input
                    type="file"
                    className="sr-only"
                    disabled={uploadingId === item.id}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      void enviarAssinado(item.id, f);
                      e.target.value = '';
                    }}
                  />
                  {uploadingId === item.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Upload size={14} />
                  )}
                  Anexar arquivo
                </label>
              </div>
              {pathArquivo ? (
                <p className="mt-1.5 truncate text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                  Arquivo: {pathArquivo.split('/').pop()}
                </p>
              ) : null}
              {erro && <p className="mt-1 text-xs text-red-500">{erro}</p>}
            </div>
          );
        }

        let campo: ReactNode;

        if (item.tipo === 'checkbox') {
          campo = (
            <label className="flex cursor-pointer items-center gap-3 text-sm text-gray-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded accent-violet-600"
                checked={valor === 'true'}
                onChange={(e) => set(item.id, e.target.checked ? 'true' : 'false')}
              />
              {item.label}
              {item.obrigatorio && <span className="text-red-500">*</span>}
            </label>
          );
          return (
            <div key={item.id}>
              {campo}
              {erro && <p className="mt-1 text-xs text-red-500">{erro}</p>}
            </div>
          );
        }

        if (item.tipo === 'texto_longo') {
          campo = (
            <textarea
              rows={4}
              className={inputBase + ' resize-none'}
              placeholder={item.placeholder ?? ''}
              value={valor}
              onChange={(e) => set(item.id, e.target.value)}
            />
          );
        } else if (item.tipo === 'data') {
          campo = (
            <input
              type="date"
              className={inputBase}
              value={valor}
              onChange={(e) => set(item.id, e.target.value)}
            />
          );
        } else if (item.tipo === 'hora') {
          campo = (
            <input
              type="time"
              className={inputBase}
              value={valor}
              onChange={(e) => set(item.id, e.target.value)}
            />
          );
        } else {
          const inputType =
            item.tipo === 'email'
              ? 'email'
              : item.tipo === 'telefone'
                ? 'tel'
                : item.tipo === 'numero'
                  ? 'number'
                  : 'text';
          campo = (
            <input
              type={inputType}
              className={inputBase}
              placeholder={item.placeholder ?? ''}
              value={valor}
              onChange={(e) => set(item.id, e.target.value)}
            />
          );
        }

        return (
          <div key={item.id}>
            {label}
            {campo}
            {erro && <p className="mt-1 text-xs text-red-500">{erro}</p>}
          </div>
        );
      })}

      {erroGeral && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erroGeral}</div>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60"
      >
        {enviando && <Loader2 size={16} className="animate-spin" />}
        {enviando ? 'Enviando...' : 'Enviar respostas'}
      </button>
    </form>
  );
}
