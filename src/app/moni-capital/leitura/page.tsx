import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { DocumentoGuiaLeituraPublica } from '@/components/universidade/DocumentoGuiaLeituraPublica';

export const metadata = {
  title: 'Moní Capital | Moní',
  description:
    'Guia da plataforma Moní Capital — link público compartilhável, com ou sem login.',
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Link público fixo: /moni-capital/leitura (sem query). */
export default async function MoniCapitalLeituraPublicaPage({ searchParams }: Props) {
  const sp = await searchParams;
  if (Object.keys(sp).length > 0) {
    redirect('/moni-capital/leitura');
  }
  return (
    <Suspense fallback={<div className="px-4 py-6 text-sm text-stone-600">Carregando…</div>}>
      <DocumentoGuiaLeituraPublica slug="moni-capital" />
    </Suspense>
  );
}
