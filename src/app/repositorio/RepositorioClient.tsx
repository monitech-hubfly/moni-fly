'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Download, FileText, FolderOpen, Loader2, Plus, Trash2 } from 'lucide-react';
import {
  adicionarDocumento,
  adicionarSecao,
  baixarDocumento,
  deletarDocumento,
  type SecaoComDocumentos,
} from './actions';

type Props = {
  initialSecoes: SecaoComDocumentos[];
  isAdmin: boolean;
};

export function RepositorioClient({ initialSecoes, isAdmin }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [novaSecaoNome, setNovaSecaoNome] = useState('');
  const [mostrarNovaSecao, setMostrarNovaSecao] = useState(false);
  const [docSecaoId, setDocSecaoId] = useState<string | null>(null);
  const [docNome, setDocNome] = useState('');
  const [docDescricao, setDocDescricao] = useState('');
  const [docArquivo, setDocArquivo] = useState<File | null>(null);
  const [baixandoId, setBaixandoId] = useState<string | null>(null);

  function feedback(ok: boolean, text: string) {
    setMsg({ type: ok ? 'ok' : 'err', text });
    if (ok) setTimeout(() => setMsg(null), 4000);
  }

  function refresh() {
    startTransition(() => {
      router.refresh();
    });
  }

  async function handleNovaSecao(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await adicionarSecao(novaSecaoNome);
    if (!res.ok) {
      feedback(false, res.error);
      return;
    }
    setNovaSecaoNome('');
    setMostrarNovaSecao(false);
    feedback(true, 'Seção criada.');
    refresh();
  }

  async function handleNovoDocumento(e: React.FormEvent) {
    e.preventDefault();
    if (!docSecaoId || !docArquivo) return;
    setMsg(null);
    const fd = new FormData();
    fd.append('secao_id', docSecaoId);
    fd.append('nome', docNome);
    fd.append('descricao', docDescricao);
    fd.append('arquivo', docArquivo);
    const res = await adicionarDocumento(fd);
    if (!res.ok) {
      feedback(false, res.error);
      return;
    }
    setDocSecaoId(null);
    setDocNome('');
    setDocDescricao('');
    setDocArquivo(null);
    feedback(true, 'Documento adicionado.');
    refresh();
  }

  async function handleBaixar(id: string) {
    setBaixandoId(id);
    setMsg(null);
    const res = await baixarDocumento(id);
    setBaixandoId(null);
    if (!res.ok) {
      feedback(false, res.error);
      return;
    }
    window.open(res.url, '_blank', 'noopener,noreferrer');
  }

  async function handleDeletar(id: string) {
    if (!confirm('Remover este documento do repositório?')) return;
    setMsg(null);
    const res = await deletarDocumento(id);
    if (!res.ok) {
      feedback(false, res.error);
      return;
    }
    feedback(true, 'Documento removido.');
    refresh();
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Repositório de documentos</h1>
          <p className="mt-1 text-sm text-stone-600">
            Modelos e arquivos de apoio organizados por seção. Use <strong>Baixar</strong> para obter o
            ficheiro.
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              setMostrarNovaSecao((v) => !v);
              setMsg(null);
            }}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-moni-primary shadow-sm hover:bg-stone-50"
          >
            <Plus className="h-4 w-4" />
            Adicionar seção
          </button>
        )}
      </div>

      {msg && (
        <div
          className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
            msg.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {msg.text}
        </div>
      )}

      {isAdmin && mostrarNovaSecao && (
        <form
          onSubmit={handleNovaSecao}
          className="mb-8 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-sm font-semibold text-stone-800">Nova seção</h2>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1 text-xs text-stone-600">
              Nome
              <input
                value={novaSecaoNome}
                onChange={(e) => setNovaSecaoNome(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-900"
                placeholder="Ex.: Contratos"
                required
              />
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-moni-primary px-4 py-2 text-sm font-medium text-white hover:bg-moni-secondary disabled:opacity-60"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setMostrarNovaSecao(false)}
                className="rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </form>
      )}

      {docSecaoId !== null && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
          <form
            onSubmit={handleNovoDocumento}
            className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl"
          >
            <h2 className="text-lg font-semibold text-stone-900">Adicionar documento</h2>
            <label className="mt-4 block text-xs font-medium text-stone-600">
              Nome
              <input
                value={docNome}
                onChange={(e) => setDocNome(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="mt-3 block text-xs font-medium text-stone-600">
              Descrição (opcional)
              <textarea
                value={docDescricao}
                onChange={(e) => setDocDescricao(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="mt-3 block text-xs font-medium text-stone-600">
              Ficheiro
              <input
                type="file"
                onChange={(e) => setDocArquivo(e.target.files?.[0] ?? null)}
                className="mt-1 w-full text-sm text-stone-700"
                required
              />
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDocSecaoId(null);
                  setDocNome('');
                  setDocDescricao('');
                  setDocArquivo(null);
                }}
                className="rounded-lg border border-stone-200 px-4 py-2 text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pending || !docArquivo}
                className="inline-flex items-center gap-2 rounded-lg bg-moni-primary px-4 py-2 text-sm font-medium text-white hover:bg-moni-secondary disabled:opacity-60"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Enviar
              </button>
            </div>
          </form>
        </div>
      )}

      {initialSecoes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/80 p-10 text-center text-stone-600">
          <FolderOpen className="mx-auto mb-3 h-10 w-10 text-stone-400" />
          <p className="text-sm">Ainda não há seções no repositório.</p>
          {isAdmin && (
            <p className="mt-2 text-xs text-stone-500">Use &quot;Adicionar seção&quot; para começar.</p>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {initialSecoes.map((secao) => (
            <section
              key={secao.id}
              className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex flex-col gap-3 border-b border-stone-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-moni-light/80 text-moni-primary">
                    <FolderOpen className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-stone-900">{secao.nome}</h2>
                    <p className="text-xs text-stone-500">
                      {secao.documentos.length === 0
                        ? 'Nenhum documento nesta seção.'
                        : `${secao.documentos.length} documento(s)`}
                    </p>
                  </div>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setDocSecaoId(secao.id);
                      setDocNome('');
                      setDocDescricao('');
                      setDocArquivo(null);
                      setMsg(null);
                    }}
                    className="inline-flex items-center gap-2 self-start rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-semibold text-moni-primary hover:bg-white"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar documento
                  </button>
                )}
              </div>

              <ul className="space-y-3">
                {secao.documentos.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex flex-col gap-3 rounded-xl border border-stone-100 bg-stone-50/50 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 flex-1 gap-3">
                      <FileText className="mt-0.5 h-5 w-5 shrink-0 text-stone-400" />
                      <div className="min-w-0">
                        <p className="font-medium text-stone-900">{doc.nome}</p>
                        {doc.descricao ? (
                          <p className="mt-1 text-xs leading-relaxed text-stone-600">{doc.descricao}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleBaixar(doc.id)}
                        disabled={baixandoId === doc.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-moni-primary px-3 py-2 text-xs font-semibold text-white hover:bg-moni-secondary disabled:opacity-60"
                      >
                        {baixandoId === doc.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                        Baixar
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => void handleDeletar(doc.id)}
                          disabled={pending}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                          title="Remover"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
