import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { DocumentoGuiaLeituraPublica } from '@/components/universidade/DocumentoGuiaLeituraPublica';

export const metadata = {
  title: 'Carta Fiança | Moní',
  description:
    'Guia operacional Moní sobre carta fiança — link público compartilhável, com ou sem login.',
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Link público fixo: /carta-fianca/leitura (sem query). */
export default async function CartaFiancaLeituraPublicaPage({ searchParams }: Props) {
  const sp = await searchParams;
  if (Object.keys(sp).length > 0) {
    redirect('/carta-fianca/leitura');
  }
  return (
    <Suspense fallback={<div className="px-4 py-6 text-sm text-stone-600">Carregando…</div>}>
      <DocumentoGuiaLeituraPublica slug="carta-fianca" layoutHub voltarHref="/universidade/ferramentas" />
    </Suspense>
  );
}
