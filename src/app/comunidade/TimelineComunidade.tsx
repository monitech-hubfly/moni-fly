'use client';

import { useEffect, useMemo, useState } from 'react';
import { Heart, MessageSquare } from 'lucide-react';

type PostRow = {
  id: string;
  author_type: string | null;
  tipo: string | null;
  titulo: string | null;
  conteudo: string | null;
  sino_html: string | null;
  franqueado_id: string | null;
  created_at: string | null;
  community_likes?: { count: number }[] | null;
  community_comments?: { count: number }[] | null;
  liked_by_me?: boolean | null;
};

function countRel(v: { count: number }[] | null | undefined): number {
  return Array.isArray(v) && v[0] ? Number(v[0].count ?? 0) : 0;
}

export function TimelineComunidade() {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, Array<{ id: string; autor_nome: string | null; texto: string; created_at: string | null }>>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/community/posts');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Falha ao carregar posts');
      const list = (data?.posts ?? []) as PostRow[];
      setPosts(list);

      // Pré-carrega comentários apenas para posts que já possuem comentários (evita muitas requisições).
      const ids = list
        .filter((p) => countRel(p.community_comments) > 0)
        .map((p) => p.id);
      if (ids.length > 0) {
        await Promise.all(
          ids.map(async (postId) => {
            const cr = await fetch(`/api/community/comments?post_id=${encodeURIComponent(postId)}`);
            const cd = await cr.json();
            if (cr.ok && Array.isArray(cd?.comments)) {
              setCommentsByPost((prev) => ({
                ...prev,
                [postId]: (cd.comments ?? []).map((c: any) => ({
                  id: String(c.id ?? ''),
                  autor_nome: c.autor_nome ?? null,
                  texto: String(c.texto ?? ''),
                  created_at: c.created_at ?? null,
                })),
              }));
            }
          }),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar timeline');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const items = useMemo(
    () =>
      posts.map((p) => ({
        ...p,
        likes: countRel(p.community_likes),
        comments: countRel(p.community_comments),
      })),
    [posts],
  );

  const like = async (postId: string, on: boolean) => {
    setBusy(postId);
    try {
      const res = await fetch('/api/community/likes', {
        method: on ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Falha ao curtir');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao curtir');
    } finally {
      setBusy(null);
    }
    // atualiza timeline e comentários
    await load();
  };

  const comment = async (postId: string) => {
    setBusy(postId);
    try {
      const res = await fetch('/api/community/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId, texto: 'Bem-vindo' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Falha ao comentar');
      // atualiza comentários daquele post
      const cr = await fetch(`/api/community/comments?post_id=${encodeURIComponent(postId)}`);
      const cd = await cr.json();
      if (cr.ok && Array.isArray(cd?.comments)) {
        setCommentsByPost((prev) => ({
          ...prev,
          [postId]: (cd.comments ?? []).map((c: any) => ({
            id: String(c.id ?? ''),
            autor_nome: c.autor_nome ?? null,
            texto: String(c.texto ?? ''),
            created_at: c.created_at ?? null,
          })),
        }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao comentar');
    } finally {
      setBusy(null);
    }
    await load();
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-6 text-sm text-stone-600">
        Carregando timeline…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-6 text-sm text-stone-600">
        Nenhuma publicação ainda.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {items.map((p) => (
        <div key={p.id} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <div className="border-b border-stone-200 px-5 py-4">
            <div className="text-sm font-semibold text-moni-dark">{p.titulo ?? 'Publicação'}</div>
            <div className="mt-1 text-xs text-stone-500">
              {p.created_at ? new Date(p.created_at).toLocaleString('pt-BR') : ''}
            </div>
            {p.conteudo && <p className="mt-3 text-sm text-stone-700">{p.conteudo}</p>}
          </div>

          {p.sino_html ? (
            <div className="bg-[#0a1820] overflow-hidden rounded-xl">
              <div
                className="w-full"
                // Conteúdo vem do backend (service role). Não incluir dados sensíveis.
                dangerouslySetInnerHTML={{ __html: p.sino_html }}
              />
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div className="text-xs text-stone-500">
              ❤️ {p.likes} · 💬 {p.comments}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={busy === p.id}
                onClick={() => like(p.id, !(p.liked_by_me ?? false))}
                className="rounded-lg p-2 text-stone-600 hover:bg-stone-50 disabled:opacity-50"
                aria-label={p.liked_by_me ? 'Descurtir' : 'Curtir'}
              >
                <Heart
                  className="h-5 w-5"
                  fill={p.liked_by_me ? 'rgb(244 63 94)' : 'transparent'}
                  stroke={p.liked_by_me ? 'rgb(244 63 94)' : 'currentColor'}
                />
              </button>
              <button
                type="button"
                disabled={busy === p.id}
                onClick={() => comment(p.id)}
                className="rounded-lg p-2 text-stone-600 hover:bg-stone-50 disabled:opacity-50"
                aria-label="Comentar"
              >
                <MessageSquare className="h-5 w-5" />
              </button>
            </div>
          </div>

          {commentsByPost[p.id]?.length ? (
            <div className="px-5 pb-5">
              <div className="mt-1 space-y-2 border-t border-stone-200 pt-4">
                {commentsByPost[p.id].map((c) => (
                  <div key={c.id} className="rounded-lg border border-stone-200 bg-stone-50/40 p-3">
                    <p className="text-xs font-medium text-stone-700">{c.autor_nome ?? 'Anônimo'}</p>
                    <p className="mt-1 text-sm text-stone-700 whitespace-pre-wrap">{c.texto}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

