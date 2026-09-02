import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { createClient } from '@/lib/supabase/server';
import { getFaqArtigoPorSlug, getFaqMesmaCategoria, getFaqRelacionados } from '@/lib/faq/queries';
import { FaqArtigoInteracoes } from './FaqArtigoInteracoes';

export const dynamic = 'force-dynamic';

const PROSE =
  'max-w-none space-y-3 text-sm leading-relaxed text-stone-800 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mt-5 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-stone-900 [&_h2:first-child]:mt-0 [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5';

export default async function FaqArtigoPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const slug = decodeURIComponent(params.slug);
  if (!user) redirect(`/login?next=/universidade/faq/${slug}`);

  const artigo = await getFaqArtigoPorSlug(supabase, slug);
  if (!artigo) notFound();

  let relacionados = await getFaqRelacionados(supabase, artigo.id);
  if (relacionados.length === 0) {
    relacionados = await getFaqMesmaCategoria(supabase, artigo.category_id, artigo.id, 4);
  }

  const revisado = artigo.reviewed_at ?? artigo.updated_at;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-1 text-xs text-stone-500" aria-label="Trilha">
        <Link href="/universidade" className="text-moni-primary hover:underline">
          Universidade Moní
        </Link>
        <ChevronRight className="h-3 w-3" aria-hidden />
        <Link href="/universidade/faq" className="text-moni-primary hover:underline">
          FAQ
        </Link>
        {artigo.category_name ? (
          <>
            <ChevronRight className="h-3 w-3" aria-hidden />
            <span className="text-stone-600">{artigo.category_name}</span>
          </>
        ) : null}
        <ChevronRight className="h-3 w-3" aria-hidden />
        <span className="truncate text-stone-700">{artigo.question}</span>
      </nav>

      <header>
        {artigo.category_name ? (
          <span className="text-[11px] font-medium uppercase tracking-wide text-stone-500">{artigo.category_name}</span>
        ) : null}
        <h1 className="mt-1 text-2xl font-semibold leading-tight text-stone-900">{artigo.question}</h1>
        {artigo.status !== 'published' ? (
          <span className="mt-2 inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-medium text-amber-800">
            {artigo.status === 'draft' ? 'Rascunho (visível só para gestão)' : 'Arquivado'}
          </span>
        ) : null}
      </header>

      <article className={PROSE}>
        <ReactMarkdown>{artigo.answer}</ReactMarkdown>
      </article>

      {/* Metadados */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-xs text-stone-600">
        {artigo.responsible_area ? (
          <span>
            Responsável: <strong className="font-medium text-stone-800">{artigo.responsible_area}</strong>
          </span>
        ) : null}
        {revisado ? (
          <span>
            Última revisão:{' '}
            <strong className="font-medium text-stone-800">
              {new Date(revisado).toLocaleDateString('pt-BR')}
            </strong>
          </span>
        ) : null}
      </div>

      {/* Interações: feedback, copiar link, chamado, view */}
      <FaqArtigoInteracoes articleId={artigo.id} slug={artigo.slug} />

      {/* Relacionadas */}
      {relacionados.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-stone-800">Perguntas relacionadas</h2>
          <ul className="space-y-1.5">
            {relacionados.map((r) => (
              <li key={r.id}>
                <Link href={`/universidade/faq/${r.slug}`} className="text-sm text-moni-primary hover:underline">
                  {r.question}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Link href="/universidade/faq" className="inline-block text-sm font-medium text-moni-primary hover:underline">
        ← Voltar para a FAQ
      </Link>
    </div>
  );
}
