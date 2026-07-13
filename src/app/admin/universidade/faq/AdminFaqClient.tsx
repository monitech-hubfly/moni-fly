'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Archive, Eye, EyeOff, Pencil, Plus, RotateCcw, Star, Trash2, X } from 'lucide-react';
import type { FaqArticleView, FaqCategory, FaqStatus } from '@/lib/faq/types';
import {
  criarArtigoFaq,
  editarArtigoFaq,
  definirStatusArtigoFaq,
  excluirArtigoFaq,
  definirRelacionadosFaq,
  criarCategoriaFaq,
  editarCategoriaFaq,
  type FaqArtigoInput,
} from '@/lib/faq/actions';

type Aba = 'perguntas' | 'categorias';
const ROLES = ['frank', 'team', 'admin'] as const;
const STATUS_LABEL: Record<FaqStatus, string> = { draft: 'Rascunho', published: 'Publicado', archived: 'Arquivado' };

export function AdminFaqClient({
  artigos,
  categorias,
}: {
  artigos: FaqArticleView[];
  categorias: FaqCategory[];
}) {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>('perguntas');
  const [editor, setEditor] = useState<FaqArticleView | 'novo' | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [filtroStatus, setFiltroStatus] = useState<'todos' | FaqStatus>('todos');
  const [filtroCat, setFiltroCat] = useState<string>('todas');
  const [q, setQ] = useState('');

  const filtrados = useMemo(() => {
    return artigos.filter((a) => {
      if (filtroStatus !== 'todos' && a.status !== filtroStatus) return false;
      if (filtroCat !== 'todas' && a.category_id !== filtroCat) return false;
      if (q.trim() && !a.question.toLowerCase().includes(q.trim().toLowerCase())) return false;
      return true;
    });
  }, [artigos, filtroStatus, filtroCat, q]);

  async function acao(id: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(id);
    const r = await fn();
    setBusy(null);
    if (!r.ok) {
      alert(r.error ?? 'Erro');
      return;
    }
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Gestão da FAQ</h1>
          <p className="mt-1 text-sm text-stone-600">
            Administração independente das perguntas da FAQ da Universidade — sem relação com cursos, aulas ou progresso.
          </p>
        </div>
        <Link href="/universidade/faq" className="text-sm font-medium text-moni-primary hover:underline">
          Ver FAQ pública →
        </Link>
      </header>

      <div className="flex gap-1 border-b border-stone-200">
        {(['perguntas', 'categorias'] as Aba[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setAba(t)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium ${
              aba === t ? 'border-green-600 text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            {t === 'perguntas' ? `Perguntas (${artigos.length})` : `Categorias (${categorias.length})`}
          </button>
        ))}
      </div>

      {aba === 'perguntas' ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar pergunta…"
              className="min-w-[200px] flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-moni-primary"
            />
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value as 'todos' | FaqStatus)}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
            >
              <option value="todos">Todos os status</option>
              <option value="published">Publicado</option>
              <option value="draft">Rascunho</option>
              <option value="archived">Arquivado</option>
            </select>
            <select
              value={filtroCat}
              onChange={(e) => setFiltroCat(e.target.value)}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
            >
              <option value="todas">Todas as categorias</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setEditor('novo')}
              className="inline-flex items-center gap-2 rounded-lg bg-moni-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              <Plus className="h-4 w-4" aria-hidden /> Nova pergunta
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase text-stone-500">
                <tr>
                  <th className="px-4 py-3">Pergunta</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Ordem</th>
                  <th className="px-4 py-3">Views</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((a) => (
                  <tr key={a.id} className="border-b border-stone-100 align-top">
                    <td className="px-4 py-3 font-medium text-stone-900">
                      <span className="flex items-center gap-1.5">
                        {a.is_featured ? <Star className="h-3.5 w-3.5 text-amber-500" aria-hidden /> : null}
                        {a.question}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-stone-600">{a.category_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          a.status === 'published'
                            ? 'bg-emerald-100 text-emerald-800'
                            : a.status === 'draft'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-stone-200 text-stone-600'
                        }`}
                      >
                        {STATUS_LABEL[a.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-stone-600">{a.display_order}</td>
                    <td className="px-4 py-3 text-stone-600">{a.view_count}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title="Editar"
                          onClick={() => setEditor(a)}
                          className="rounded p-1.5 text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                        >
                          <Pencil className="h-4 w-4" aria-hidden />
                        </button>
                        {a.status === 'published' ? (
                          <button
                            type="button"
                            title="Despublicar"
                            disabled={busy === a.id}
                            onClick={() => acao(a.id, () => definirStatusArtigoFaq(a.id, 'draft'))}
                            className="rounded p-1.5 text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                          >
                            <EyeOff className="h-4 w-4" aria-hidden />
                          </button>
                        ) : (
                          <button
                            type="button"
                            title="Publicar"
                            disabled={busy === a.id}
                            onClick={() => acao(a.id, () => definirStatusArtigoFaq(a.id, 'published'))}
                            className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50"
                          >
                            <Eye className="h-4 w-4" aria-hidden />
                          </button>
                        )}
                        {a.status === 'archived' ? (
                          <button
                            type="button"
                            title="Restaurar"
                            disabled={busy === a.id}
                            onClick={() => acao(a.id, () => definirStatusArtigoFaq(a.id, 'draft'))}
                            className="rounded p-1.5 text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                          >
                            <RotateCcw className="h-4 w-4" aria-hidden />
                          </button>
                        ) : (
                          <button
                            type="button"
                            title="Arquivar"
                            disabled={busy === a.id}
                            onClick={() => acao(a.id, () => definirStatusArtigoFaq(a.id, 'archived'))}
                            className="rounded p-1.5 text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                          >
                            <Archive className="h-4 w-4" aria-hidden />
                          </button>
                        )}
                        <button
                          type="button"
                          title="Excluir"
                          disabled={busy === a.id}
                          onClick={() => {
                            if (confirm('Excluir esta pergunta definitivamente?')) {
                              void acao(a.id, () => excluirArtigoFaq(a.id));
                            }
                          }}
                          className="rounded p-1.5 text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-stone-500">
                      Nenhuma pergunta com esses filtros.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <CategoriasAdmin categorias={categorias} onChange={() => router.refresh()} />
      )}

      {editor ? (
        <EditorArtigo
          artigo={editor === 'novo' ? null : editor}
          categorias={categorias}
          todosArtigos={artigos}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function EditorArtigo({
  artigo,
  categorias,
  todosArtigos,
  onClose,
  onSaved,
}: {
  artigo: FaqArticleView | null;
  categorias: FaqCategory[];
  todosArtigos: FaqArticleView[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [question, setQuestion] = useState(artigo?.question ?? '');
  const [shortAnswer, setShortAnswer] = useState(artigo?.short_answer ?? '');
  const [answer, setAnswer] = useState(artigo?.answer ?? '');
  const [categoryId, setCategoryId] = useState(artigo?.category_id ?? '');
  const [keywords, setKeywords] = useState((artigo?.keywords ?? []).join(', '));
  const [synonyms, setSynonyms] = useState((artigo?.synonyms ?? []).join(', '));
  const [visibility, setVisibility] = useState<string[]>(artigo?.visibility ?? ['frank', 'team', 'admin']);
  const [status, setStatus] = useState<FaqStatus>(artigo?.status ?? 'draft');
  const [isFeatured, setIsFeatured] = useState(artigo?.is_featured ?? false);
  const [displayOrder, setDisplayOrder] = useState(String(artigo?.display_order ?? 0));
  const [responsibleArea, setResponsibleArea] = useState(artigo?.responsible_area ?? '');
  const [reviewDue, setReviewDue] = useState(artigo?.review_due_at ? artigo.review_due_at.slice(0, 10) : '');
  const [relacionados, setRelacionados] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function toggleRole(r: string) {
    setVisibility((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));
  }

  async function salvar() {
    setErro(null);
    if (!question.trim() || !answer.trim()) {
      setErro('Pergunta e resposta são obrigatórias.');
      return;
    }
    setSalvando(true);
    const payload: FaqArtigoInput = {
      question,
      answer,
      short_answer: shortAnswer,
      category_id: categoryId || null,
      keywords: keywords.split(',').map((s) => s.trim()).filter(Boolean),
      synonyms: synonyms.split(',').map((s) => s.trim()).filter(Boolean),
      visibility,
      status,
      is_featured: isFeatured,
      display_order: Number(displayOrder) || 0,
      responsible_area: responsibleArea,
      review_due_at: reviewDue ? new Date(reviewDue).toISOString() : null,
    };
    const r = artigo ? await editarArtigoFaq(artigo.id, payload) : await criarArtigoFaq(payload);
    if (!r.ok) {
      setSalvando(false);
      setErro(r.error ?? 'Erro ao salvar.');
      return;
    }
    const idAlvo = artigo?.id ?? (r as { id?: string }).id;
    if (idAlvo && artigo) {
      await definirRelacionadosFaq(idAlvo, relacionados);
    }
    setSalvando(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4">
      <button type="button" aria-label="Fechar" className="fixed inset-0 bg-stone-900/40" onClick={onClose} />
      <div className="relative z-10 my-8 w-full max-w-2xl rounded-2xl border border-stone-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-stone-900">{artigo ? 'Editar pergunta' : 'Nova pergunta'}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
          <Campo label="Pergunta *">
            <input value={question} onChange={(e) => setQuestion(e.target.value)} className={inputCls} />
          </Campo>
          <Campo label="Resposta resumida (opcional)">
            <textarea value={shortAnswer} onChange={(e) => setShortAnswer(e.target.value)} rows={2} className={inputCls} />
          </Campo>
          <Campo label="Resposta completa * (markdown)">
            <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={8} className={`${inputCls} font-mono text-xs`} />
          </Campo>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo label="Categoria">
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
                <option value="">— sem categoria —</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="Status">
              <select value={status} onChange={(e) => setStatus(e.target.value as FaqStatus)} className={inputCls}>
                <option value="draft">Rascunho</option>
                <option value="published">Publicado</option>
                <option value="archived">Arquivado</option>
              </select>
            </Campo>
            <Campo label="Ordem de exibição">
              <input type="number" value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} className={inputCls} />
            </Campo>
            <Campo label="Área responsável">
              <input value={responsibleArea} onChange={(e) => setResponsibleArea(e.target.value)} className={inputCls} />
            </Campo>
            <Campo label="Palavras-chave (vírgula)">
              <input value={keywords} onChange={(e) => setKeywords(e.target.value)} className={inputCls} />
            </Campo>
            <Campo label="Sinônimos (vírgula)">
              <input value={synonyms} onChange={(e) => setSynonyms(e.target.value)} className={inputCls} />
            </Campo>
            <Campo label="Próxima revisão">
              <input type="date" value={reviewDue} onChange={(e) => setReviewDue(e.target.value)} className={inputCls} />
            </Campo>
            <Campo label="Destaque">
              <label className="flex items-center gap-2 text-sm text-stone-700">
                <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} />
                Marcar como pergunta em destaque
              </label>
            </Campo>
          </div>
          <Campo label="Visibilidade (papéis)">
            <div className="flex flex-wrap gap-3">
              {ROLES.map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm text-stone-700">
                  <input type="checkbox" checked={visibility.includes(r)} onChange={() => toggleRole(r)} />
                  {r}
                </label>
              ))}
            </div>
          </Campo>
          {artigo ? (
            <Campo label="Perguntas relacionadas">
              <select
                multiple
                value={relacionados}
                onChange={(e) => setRelacionados(Array.from(e.target.selectedOptions).map((o) => o.value))}
                className={`${inputCls} h-32`}
              >
                {todosArtigos
                  .filter((x) => x.id !== artigo.id)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.question}
                    </option>
                  ))}
              </select>
              <p className="mt-1 text-[11px] text-stone-400">Segure Ctrl/Cmd para selecionar múltiplas. Salvar substitui as relacionadas.</p>
            </Campo>
          ) : null}
          {erro ? <p className="text-sm font-medium text-red-700">{erro}</p> : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-stone-100 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
            Cancelar
          </button>
          <button
            type="button"
            disabled={salvando}
            onClick={() => void salvar()}
            className="rounded-lg bg-moni-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoriasAdmin({ categorias, onChange }: { categorias: FaqCategory[]; onChange: () => void }) {
  const [novoNome, setNovoNome] = useState('');
  const [busy, setBusy] = useState(false);

  async function criar() {
    if (!novoNome.trim()) return;
    setBusy(true);
    const r = await criarCategoriaFaq({ name: novoNome, display_order: (categorias.length + 1) * 10 });
    setBusy(false);
    if (!r.ok) {
      alert(r.error ?? 'Erro');
      return;
    }
    setNovoNome('');
    onChange();
  }

  async function alternarAtiva(c: FaqCategory) {
    const r = await editarCategoriaFaq(c.id, { is_active: !c.is_active });
    if (!r.ok) alert(r.error ?? 'Erro');
    else onChange();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          placeholder="Nome da nova categoria"
          className="min-w-[220px] flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-moni-primary"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void criar()}
          className="inline-flex items-center gap-2 rounded-lg bg-moni-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden /> Criar categoria
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase text-stone-500">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Ordem</th>
              <th className="px-4 py-3">Ativa</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {categorias.map((c) => (
              <CategoriaLinha key={c.id} categoria={c} onChange={onChange} onToggle={() => void alternarAtiva(c)} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CategoriaLinha({
  categoria,
  onChange,
  onToggle,
}: {
  categoria: FaqCategory;
  onChange: () => void;
  onToggle: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(categoria.name);
  const [ordem, setOrdem] = useState(String(categoria.display_order));
  const [icon, setIcon] = useState(categoria.icon ?? '');

  async function salvar() {
    const r = await editarCategoriaFaq(categoria.id, {
      name: nome,
      display_order: Number(ordem) || 0,
      icon,
    });
    if (!r.ok) {
      alert(r.error ?? 'Erro');
      return;
    }
    setEditando(false);
    onChange();
  }

  if (editando) {
    return (
      <tr className="border-b border-stone-100">
        <td className="px-4 py-2">
          <input value={nome} onChange={(e) => setNome(e.target.value)} className={inputCls} />
        </td>
        <td className="px-4 py-2 text-xs text-stone-400">{categoria.slug}</td>
        <td className="px-4 py-2">
          <input type="number" value={ordem} onChange={(e) => setOrdem(e.target.value)} className={`${inputCls} w-20`} />
        </td>
        <td className="px-4 py-2">
          <input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="Ícone" className={`${inputCls} w-28`} />
        </td>
        <td className="px-4 py-2 text-right">
          <button type="button" onClick={() => void salvar()} className="text-xs font-semibold text-moni-primary hover:underline">
            Salvar
          </button>
          <button type="button" onClick={() => setEditando(false)} className="ml-3 text-xs text-stone-500 hover:underline">
            Cancelar
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-stone-100">
      <td className="px-4 py-3 font-medium text-stone-900">{categoria.name}</td>
      <td className="px-4 py-3 text-xs text-stone-400">{categoria.slug}</td>
      <td className="px-4 py-3 text-stone-600">{categoria.display_order}</td>
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
            categoria.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'
          }`}
        >
          {categoria.is_active ? 'Ativa' : 'Inativa'}
        </button>
      </td>
      <td className="px-4 py-3 text-right">
        <button type="button" onClick={() => setEditando(true)} className="text-xs font-semibold text-moni-primary hover:underline">
          Editar
        </button>
      </td>
    </tr>
  );
}

const inputCls =
  'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-moni-primary focus:ring-2 focus:ring-moni-primary/20';

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-stone-600">{label}</span>
      {children}
    </label>
  );
}
