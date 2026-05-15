'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import {
  BarChart3,
  ClipboardList,
  ExternalLink,
  FileText,
  Home,
  Link2,
  Map,
  Trophy,
  Video,
  X,
  MessageCircle,
} from 'lucide-react';
import type { UniBibliotecaItem } from '@/lib/universidade/types';
import type { FerramentaBiblioteca, FerramentaBibliotecaIcon } from '@/lib/universidade/ferramentas-biblioteca';
import { FERRAMENTAS_BIBLIOTECA } from '@/lib/universidade/ferramentas-biblioteca';

type AbaBiblioteca = 'ferramentas' | 'documentos';

function iconeFerramenta(tipo: FerramentaBibliotecaIcon, className: string) {
  const c = `h-5 w-5 shrink-0 ${className}`;
  switch (tipo) {
    case 'bca':
      return <BarChart3 className={c} aria-hidden />;
    case 'mapa':
      return <Map className={c} aria-hidden />;
    case 'batalha':
      return <Trophy className={c} aria-hidden />;
    case 'casa':
      return <Home className={c} aria-hidden />;
    case 'clipboard':
      return <ClipboardList className={c} aria-hidden />;
    case 'demanda':
      return <MessageCircle className={c} aria-hidden />;
    default:
      return <FileText className={c} aria-hidden />;
  }
}

function resolveLinkPrincipalHref(href: string, nomeFranqueado: string | null | undefined) {
  const normalized = href.startsWith('/treinamento-bca.html') ? '/treinamento-bca/introducao' : href;
  if (!normalized.startsWith('/treinamento-bca')) return href;

  const name = (nomeFranqueado || '').trim();
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://localhost';
  const u = new URL(normalized, base);
  if (name) u.searchParams.set('frank', name);
  return u.pathname + u.search;
}

function ModalFerramenta({
  ferramenta,
  nomeFranqueado,
  onClose,
}: {
  ferramenta: FerramentaBiblioteca | null;
  nomeFranqueado: string | null | undefined;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!ferramenta) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [ferramenta, onClose]);

  if (!ferramenta) return null;

  const link = ferramenta.linkPrincipal;
  const linkHref = link ? resolveLinkPrincipalHref(link.href, nomeFranqueado) : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="ferramenta-modal-titulo">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-stone-900/40 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[min(85vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-stone-100 px-5 py-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">Ferramenta</p>
            <h2 id="ferramenta-modal-titulo" className="mt-0.5 text-lg font-semibold leading-snug text-stone-900">
              {ferramenta.titulo}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-800"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="max-w-none space-y-3 text-sm leading-relaxed text-stone-800 [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-stone-900 [&_h2:first-child]:mt-0 [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5">
            <ReactMarkdown>{ferramenta.conteudoExplicativoMd}</ReactMarkdown>
          </div>
          {link ? (
            <div className="mt-6 border-t border-stone-100 pt-4">
              <a
                href={linkHref}
                target={linkHref.startsWith('http') ? '_blank' : undefined}
                rel={linkHref.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="inline-flex items-center gap-2 rounded-lg bg-moni-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
              >
                {link.label}
                {linkHref.startsWith('http') ? <ExternalLink className="h-4 w-4 opacity-90" aria-hidden /> : null}
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function BibliotecaClient({
  itens,
  nomeFranqueado,
}: {
  itens: UniBibliotecaItem[];
  nomeFranqueado?: string | null;
}) {
  const router = useRouter();
  const [aba, setAba] = useState<AbaBiblioteca>('ferramentas');
  const [ferramentaModal, setFerramentaModal] = useState<FerramentaBiblioteca | null>(null);
  const [cat, setCat] = useState<string>('Todos');

  const categoriasDoc = useMemo(() => {
    const set = new Set(itens.map((i) => i.categoria).filter(Boolean));
    return ['Todos', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))];
  }, [itens]);

  const filtrados = useMemo(() => {
    if (cat === 'Todos') return itens;
    return itens.filter((i) => i.categoria === cat);
  }, [itens, cat]);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Biblioteca</h1>
        <p className="mt-1 text-sm text-stone-600">Ferramentas operacionais e documentos do time Moní.</p>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-stone-200 pb-px">
        <button
          type="button"
          onClick={() => setAba('ferramentas')}
          className={`relative -mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
            aba === 'ferramentas'
              ? 'border-green-600 text-stone-900'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          Ferramentas
        </button>
        <button
          type="button"
          onClick={() => setAba('documentos')}
          className={`relative -mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
            aba === 'documentos'
              ? 'border-green-600 text-stone-900'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          Documentos
        </button>
      </div>

      {aba === 'ferramentas' ? (
        <section aria-labelledby="ferramentas-heading" className="space-y-4">
          <h2 id="ferramentas-heading" className="text-sm font-semibold text-stone-800">
            Ferramentas operacionais
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FERRAMENTAS_BIBLIOTECA.map((f, index) => {
              const destaque = index === 0;
              const abrirTreinoNoHub =
                f.id === 'bca-analise-viabilidade' && f.linkPrincipal?.href?.startsWith('/treinamento-bca');
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    if (abrirTreinoNoHub && f.linkPrincipal) {
                      router.push(resolveLinkPrincipalHref(f.linkPrincipal.href, nomeFranqueado));
                      return;
                    }
                    setFerramentaModal(f);
                  }}
                  className={`flex flex-col rounded-xl bg-white p-5 text-left shadow-sm ring-offset-2 transition hover:shadow-md focus-visible:outline focus-visible:ring-2 focus-visible:ring-moni-primary ${
                    destaque
                      ? 'border-2 border-green-600 ring-1 ring-green-600/30'
                      : 'border border-stone-200 ring-0'
                  }`}
                >
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-lg ${f.iconBgClass}`}
                    aria-hidden
                  >
                    {iconeFerramenta(f.icon, f.iconColorClass)}
                  </div>
                  <h3 className="mt-3 text-[15px] font-semibold leading-snug text-stone-900">{f.titulo}</h3>
                  <p className="mt-2 flex-1 text-sm font-normal leading-[1.45] text-stone-600">{f.descricaoCurta}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {f.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-stone-200 bg-white px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-stone-600"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        <section aria-labelledby="documentos-heading" className="space-y-4">
          <h2 id="documentos-heading" className="text-sm font-semibold text-stone-800">
            Documentos
          </h2>
          <div className="flex flex-wrap gap-2">
            {categoriasDoc.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setCat(f)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  cat === f ? 'bg-moni-primary text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                {f === 'Todos' ? 'Todos' : f}
              </button>
            ))}
          </div>
          {filtrados.length === 0 ? (
            <p className="rounded-xl border border-dashed border-stone-200 bg-stone-50 p-8 text-center text-sm text-stone-600">
              Nenhum item nesta categoria ainda
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filtrados.map((it) => (
                <article key={it.id} className="flex flex-col rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-stone-600">
                    {it.tipo === 'video' ? (
                      <Video className="h-4 w-4" aria-hidden />
                    ) : it.tipo === 'arquivo' ? (
                      <FileText className="h-4 w-4" aria-hidden />
                    ) : (
                      <Link2 className="h-4 w-4" aria-hidden />
                    )}
                    <span className="text-xs uppercase text-stone-500">{it.categoria}</span>
                  </div>
                  <h2 className="mt-2 text-sm font-semibold text-stone-900">{it.titulo}</h2>
                  {it.descricao ? <p className="mt-1 line-clamp-3 text-xs text-stone-600">{it.descricao}</p> : null}
                  {it.url ? (
                    <a
                      href={it.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex text-xs font-semibold text-moni-primary hover:underline"
                    >
                      Acessar
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <ModalFerramenta
        ferramenta={ferramentaModal}
        nomeFranqueado={nomeFranqueado}
        onClose={() => setFerramentaModal(null)}
      />
    </div>
  );
}
