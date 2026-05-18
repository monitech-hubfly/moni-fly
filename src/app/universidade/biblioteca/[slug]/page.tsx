import { redirect } from 'next/navigation';

type Props = { params: Promise<{ slug: string }> };

/** Legado: documentos internos em /universidade/ferramentas/[slug] */
export default async function UniversidadeBibliotecaDocumentoRedirectPage({ params }: Props) {
  const { slug } = await params;
  redirect(`/universidade/ferramentas/${encodeURIComponent(slug)}`);
}
