import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DocumentoInternoIframe } from '@/components/universidade/DocumentoInternoIframe';
import { createClient } from '@/lib/supabase/server';
import { iframeSrcDocumentoInterno } from '@/lib/universidade/biblioteca-documentos';
import { getBibliotecaDocumentoPorSlug } from '@/lib/universidade/queries';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export default async function UniversidadeFerramentasDocumentoPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const nextPath = `/universidade/ferramentas/${encodeURIComponent(slug)}`;
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);

  const doc = await getBibliotecaDocumentoPorSlug(supabase, slug);
  if (!doc?.slug) redirect('/universidade/ferramentas');

  const iframeSrc = iframeSrcDocumentoInterno(doc.slug);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-stone-50">
      <header className="shrink-0 border-b border-stone-200 bg-white px-4 py-3 md:px-6">
        <nav className="text-xs text-stone-500" aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1">
            <li>
              <Link href="/universidade" className="hover:text-moni-primary hover:underline">
                Universidade
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/universidade/ferramentas" className="hover:text-moni-primary hover:underline">
                Ferramentas
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="font-medium text-stone-800">{doc.titulo}</li>
          </ol>
        </nav>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-stone-900 md:text-xl">{doc.titulo}</h1>
          <Link
            href="/universidade/ferramentas"
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            ← Voltar
          </Link>
        </div>
      </header>
      <DocumentoInternoIframe src={iframeSrc} title={doc.titulo} />
    </div>
  );
}
