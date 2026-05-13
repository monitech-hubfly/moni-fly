'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Paperclip, FileText, Image as ImageIcon, File, X, Loader2 } from 'lucide-react';
import {
  adicionarAnexoChamado,
  getSignedUrlAnexo,
  listarAnexosChamado,
  removerAnexoChamado,
  type ChamadoAnexoRow,
} from '@/lib/actions/card-actions';

function formatBytes(n: number | null | undefined): string {
  const b = n != null && Number.isFinite(n) ? Math.max(0, n) : 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(b < 10 * 1024 ? 1 : 0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(b < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function formatDataPt(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function iconeTipo(mime: string | null, nome: string) {
  const m = String(mime ?? '').toLowerCase();
  const ext = nome.split('.').pop()?.toLowerCase() ?? '';
  const cls = 'h-4 w-4 shrink-0 text-stone-500';
  if (m.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
    return <ImageIcon className={cls} aria-hidden />;
  }
  if (m === 'application/pdf' || ext === 'pdf') return <FileText className={cls} aria-hidden />;
  if (
    m.startsWith('text/') ||
    m.includes('word') ||
    m.includes('document') ||
    ['doc', 'docx', 'odt', 'txt', 'rtf'].includes(ext)
  ) {
    return <FileText className={cls} aria-hidden />;
  }
  return <File className={cls} aria-hidden />;
}

export type AnexosChamadoProps = {
  chamadoId: string;
  portalFrank: boolean;
  uploader_nome: string;
  basePath?: string;
  /** Quem abriu o chamado (portal: Frank só anexa se for o criador). */
  chamadoCriadoPor: string | null;
  sessionUserId: string | null;
  sessionEhAdminOuTeam: boolean;
  /** Chamados de demonstração: não carrega nem envia. */
  demo?: boolean;
};

export function AnexosChamado({
  chamadoId,
  portalFrank,
  uploader_nome,
  basePath = '/',
  chamadoCriadoPor,
  sessionUserId,
  sessionEhAdminOuTeam,
  demo = false,
}: AnexosChamadoProps) {
  const [aberto, setAberto] = useState(false);
  const [items, setItems] = useState<ChamadoAnexoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const recarregar = useCallback(async () => {
    if (demo || !chamadoId) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await listarAnexosChamado(chamadoId);
      if (r.ok) setItems(r.items);
      else setErr(r.error);
    } finally {
      setLoading(false);
    }
  }, [chamadoId, demo]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const podeUpload =
    !demo &&
    (sessionEhAdminOuTeam ||
      (!portalFrank && Boolean(sessionUserId)) ||
      (portalFrank && Boolean(sessionUserId) && chamadoCriadoPor != null && chamadoCriadoPor === sessionUserId));

  const podeDeletarAnexo = (row: ChamadoAnexoRow) => {
    if (demo || portalFrank) return false;
    if (sessionEhAdminOuTeam) return true;
    return Boolean(sessionUserId && row.uploader_id === sessionUserId);
  };

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !podeUpload) return;
    setUploading(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.set('chamadoId', chamadoId);
      fd.set('uploaderNome', uploader_nome);
      fd.set('file', f);
      if (portalFrank) fd.set('portalFrank', 'true');
      const r = await adicionarAnexoChamado(fd, basePath);
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      await recarregar();
    } finally {
      setUploading(false);
    }
  }

  async function baixar(row: ChamadoAnexoRow) {
    setErr(null);
    const r = await getSignedUrlAnexo('chamados-attachments', row.storage_path);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    window.open(r.url, '_blank', 'noopener,noreferrer');
  }

  async function excluir(row: ChamadoAnexoRow) {
    if (!podeDeletarAnexo(row)) return;
    if (!window.confirm(`Remover o anexo "${row.nome_original}"?`)) return;
    setErr(null);
    const r = await removerAnexoChamado(row.id, row.storage_path, basePath);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    await recarregar();
  }

  if (demo) return null;

  const count = items.length;

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="inline-flex items-center gap-1 rounded p-0.5 text-stone-500 hover:bg-stone-200/80 hover:text-stone-700"
        aria-expanded={aberto}
        title="Anexos do chamado"
      >
        <Paperclip className="h-3.5 w-3.5" aria-hidden />
        {count > 0 ? (
          <span
            className="min-w-[1.1rem] rounded-full bg-stone-600 px-1 text-center text-[9px] font-bold leading-tight text-white"
            aria-label={`${count} anexo(s)`}
          >
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </button>

      {aberto ? (
        <div className="absolute left-0 top-full z-[70] mt-1 w-[min(92vw,28rem)] rounded-lg border border-stone-200 bg-white p-2 text-left shadow-lg">
          {err ? <p className="mb-2 text-[11px] text-red-600">{err}</p> : null}
          {loading ? (
            <p className="flex items-center gap-1 text-[11px] text-stone-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Carregando…
            </p>
          ) : items.length === 0 ? (
            <p className="text-[11px] text-stone-500">Nenhum anexo.</p>
          ) : (
            <ul className="mb-2 max-h-48 space-y-2 overflow-y-auto">
              {items.map((row) => (
                <li
                  key={row.id}
                  className="flex items-start gap-2 rounded border border-stone-100 bg-stone-50/80 px-2 py-1.5 text-[11px]"
                >
                  <span className="mt-0.5">{iconeTipo(row.tipo_mime, row.nome_original)}</span>
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => void baixar(row)}
                      className="block w-full truncate text-left font-medium text-moni-primary hover:underline"
                    >
                      {row.nome_original}
                    </button>
                    <p className="text-stone-500">
                      {formatBytes(row.tamanho)} · {row.uploader_nome?.trim() || '—'} · {formatDataPt(row.criado_em)}
                    </p>
                  </div>
                  {podeDeletarAnexo(row) ? (
                    <button
                      type="button"
                      onClick={() => void excluir(row)}
                      className="shrink-0 rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-600"
                      aria-label="Remover anexo"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {podeUpload ? (
            <>
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                onChange={(ev) => void onPickFile(ev)}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
                className="text-[11px] font-medium text-stone-700 underline-offset-2 hover:underline disabled:opacity-50"
              >
                {uploading ? 'Enviando…' : '+ Anexar arquivo'}
              </button>
              <p className="mt-0.5 text-[10px] text-stone-400">Até 10 MB · qualquer tipo</p>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
