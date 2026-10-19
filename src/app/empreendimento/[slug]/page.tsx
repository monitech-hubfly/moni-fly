// src/app/empreendimento/[slug]/page.tsx
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { carregarEmpreendimento } from '@/lib/empreendimento/carregar-empreendimento';
import JornadaClient from './JornadaClient';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const emp = await carregarEmpreendimento(slug);
  if (!emp) return { title: 'Empreendimento | Casa Moní' };
  return {
    title: `${emp.titulo} | Casa Moní`,
    description: emp.descricao ?? `Conheça ${emp.titulo} e simule seu investimento.`,
  };
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function EmpreendimentoPage({ params }: Props) {
  const { slug } = await params;
  const empreendimento = await carregarEmpreendimento(slug);
  if (!empreendimento) notFound();

  return <JornadaClient empreendimento={empreendimento} />;
}
