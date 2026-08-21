'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MencaoContentEditable } from '@/components/kanban-shared/MencaoContentEditable';
import {
  listarComentarios,
  criarComentario,
  excluirComentario,
  uploadAnexoComentarioAgenda,
  urlAssinadaAnexoAgenda,
  buscarTeamAdminsParaMencao,
  resolverIdsMencoes,
  type ComentarioItem,
} from '@/lib/actions/agenda-comentarios';

type Props = {
  ganttId: string;
  ganttTitulo: string;
  profileId: string;
};

function formatarData(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatarBytes(b: number | null): string {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function iconeArquivo(mime: string | null): string {
  if (!mime) return '📎';
  if (mime.startsWith('image/')) return '🖼';
  if (mime === 'application/pdf') return '📄';
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) return '📊';
  if (mime.includes('word') || mime.includes('document')) return '📝';
  return '📎';
}

export function AgendaComentarios({ ganttId, ganttTitulo, profileId }: Props) {
  const [comentarios, setComentarios] = useState<ComentarioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [htmlTexto, setHtmlTexto] = useState('');
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [mencoesTodos, setMencoesTodos] = useState(false);
  const [loadingUrl, setLoadingUrl] = useState<string | null>(null);

  const editorRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Busca usuários somente team+admin para o dropdown de @menções
  const buscarUsuarios = useCallback(
    (query: string) => buscarTeamAdminsParaMencao(query),
    [],
  );

  const carregar = useCallback(async () => {
    setLoading(true);
    const res = await listarComentarios(ganttId);
    if (res.ok) setComentarios(res.items);
    setLoading(false);
  }, [ganttId]);

  useEffect(() => { void carregar(); }, [carregar]);

  const limparEditor = useCallback(() => {
    if (editorRef.current) editorRef.current.innerHTML = '';
    setHtmlTexto('');
    setArquivos([]);
    setMencoesTodos(false);
    setErroEnvio(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleEnviar = useCallback(async () => {
    const textoLimpo = htmlTexto.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    if (!textoLimpo && arquivos.length === 0) return;

    setEnviando(true);
    setErroEnvio(null);

    try {
      // Extrair IDs de mencionados do HTML
      const idsMencoes = await resolverIdsMencoes(htmlTexto);

      // Se "mencionar todos" está ativo, buscar todos team+admin
      let todasMencoes = [...new Set(idsMencoes)];
      if (mencoesTodos) {
        const todos = await buscarTeamAdminsParaMencao('');
        const idsAll = todos.map(u => u.id);
        todasMencoes = [...new Set([...todasMencoes, ...idsAll])];
      }

      // Criar comentário
      const res = await criarComentario({
        ganttId,
        htmlTexto,
        mencoes: todasMencoes,
        ganttTitulo,
      });

      if (!res.ok) {
        setErroEnvio(res.error);
        return;
      }

      // Upload dos arquivos
      for (const file of arquivos) {
        const fd = new FormData();
        fd.append('comentario_id', res.id);
        fd.append('gantt_id', ganttId);
        fd.append('file', file);
        const uploadRes = await uploadAnexoComentarioAgenda(fd);
        if (!uploadRes.ok) {
          setErroEnvio(`Erro ao enviar "${file.name}": ${uploadRes.error}`);
        }
      }

      limparEditor();
      await carregar();
    } finally {
      setEnviando(false);
    }
  }, [htmlTexto, arquivos, mencoesTodos, ganttId, ganttTitulo, limparEditor, carregar]);

  const handleExcluir = useCallback(async (id: string) => {
    if (!confirm('Excluir este comentário?')) return;
    await excluirComentario(id);
    await carregar();
  }, [carregar]);

  const handleAbrirAnexo = useCallback(async (path: string) => {
    setLoadingUrl(path);
    const res = await urlAssinadaAnexoAgenda(path);
    setLoadingUrl(null);
    if (res.ok) window.open(res.url, '_blank');
  }, []);

  const handleArquivos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setArquivos(prev => {
      const nomes = new Set(prev.map(f => f.name));
      return [...prev, ...files.filter(f => !nomes.has(f.name))];
    });
  };

  const removerArquivo = (idx: number) => {
    setArquivos(prev => prev.filter((_, i) => i !== idx));
  };

  const textoSimples = htmlTexto.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  const podEnviar = (textoSimples.length > 0 || arquivos.length > 0) && !enviando;

  return (
    <div className="mt-2 flex flex-col gap-3">

      {/* ── Área de input ── */}
      <div className="border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-300">
        {/* Editor */}
        <MencaoContentEditable
          editorRef={editorRef}
          onInput={setHtmlTexto}
          buscarUsuarios={buscarUsuarios}
          placeholder="Escreva um comentário… use @ para mencionar"
          className="min-h-[72px] max-h-40 overflow-y-auto px-3 py-2 text-xs text-gray-800 focus:outline-none"
        />

        {/* Arquivos pendentes */}
        {arquivos.length > 0 && (
          <div className="px-3 pb-2 flex flex-wrap gap-1.5">
            {arquivos.map((f, i) => (
              <div key={i} className="flex items-center gap-1 bg-gray-100 rounded px-2 py-0.5 text-[10px] text-gray-600">
                <span>{iconeArquivo(f.type)}</span>
                <span className="max-w-[120px] truncate">{f.name}</span>
                <span className="opacity-60">({formatarBytes(f.size)})</span>
                <button
                  type="button"
                  onClick={() => removerArquivo(i)}
                  className="ml-0.5 text-gray-400 hover:text-red-500 leading-none"
                >✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center gap-1.5">
            {/* Anexar arquivo */}
            <button
              type="button"
              title="Anexar arquivo"
              onClick={() => fileInputRef.current?.click()}
              className="text-gray-400 hover:text-blue-500 transition-colors p-1 rounded"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleArquivos}
            />

            {/* Mencionar todos */}
            <button
              type="button"
              title="Notificar todos (Team + Admin)"
              onClick={() => setMencoesTodos(prev => !prev)}
              className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                mencoesTodos
                  ? 'bg-blue-50 border-blue-300 text-blue-600'
                  : 'border-gray-200 text-gray-400 hover:border-blue-200 hover:text-blue-500'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              @todos
            </button>
          </div>

          {/* Enviar */}
          <button
            type="button"
            disabled={!podEnviar}
            onClick={handleEnviar}
            className="flex items-center gap-1 text-xs px-3 py-1 rounded-md bg-blue-500 text-white disabled:opacity-40 hover:bg-blue-600 transition-colors"
          >
            {enviando ? (
              <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
            Enviar
          </button>
        </div>
      </div>

      {erroEnvio && (
        <p className="text-[11px] text-red-500">{erroEnvio}</p>
      )}

      {/* ── Lista de comentários ── */}
      {loading ? (
        <p className="text-[11px] text-gray-400 text-center py-2">Carregando…</p>
      ) : comentarios.length === 0 ? (
        <p className="text-[11px] text-gray-400 text-center py-2">Nenhum comentário ainda.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {comentarios.map(c => (
            <div key={c.id} className="group flex gap-2.5">
              {/* Avatar */}
              <div className="shrink-0 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-semibold text-blue-700 mt-0.5">
                {(c.autor_nome ?? '?')[0]?.toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                {/* Header */}
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-[11px] font-semibold text-gray-700">
                    {c.autor_nome ?? 'Usuário'}
                  </span>
                  <span className="text-[10px] text-gray-400">{formatarData(c.criado_em)}</span>
                  {c.mencoes.length > 0 && (
                    <span className="text-[9px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-full">
                      {c.mencoes.length === 1 ? '1 mencionado' : `${c.mencoes.length} mencionados`}
                    </span>
                  )}
                  {/* Excluir (só o próprio autor) */}
                  {c.profile_id === profileId && (
                    <button
                      type="button"
                      onClick={() => handleExcluir(c.id)}
                      className="ml-auto opacity-0 group-hover:opacity-100 text-[10px] text-red-400 hover:text-red-600 transition-opacity"
                    >
                      Excluir
                    </button>
                  )}
                </div>

                {/* Texto */}
                <p className="text-xs text-gray-700 whitespace-pre-wrap break-words mt-0.5">
                  {c.texto}
                </p>

                {/* Anexos */}
                {c.anexos.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {c.anexos.map(a => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => handleAbrirAnexo(a.storage_path)}
                        disabled={loadingUrl === a.storage_path}
                        className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded px-2 py-0.5 transition-colors max-w-[180px] disabled:opacity-60"
                        title={a.nome_original}
                      >
                        <span>{loadingUrl === a.storage_path ? '⏳' : iconeArquivo(a.mime_type)}</span>
                        <span className="truncate">{a.nome_original}</span>
                        {a.tamanho_bytes && (
                          <span className="opacity-60 shrink-0">({formatarBytes(a.tamanho_bytes)})</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
