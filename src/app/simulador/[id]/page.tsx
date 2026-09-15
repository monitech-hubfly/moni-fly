import { notFound } from 'next/navigation';
import { carregarSimuladorPublico } from '@/lib/simulador/carregar-simulador-publico';
import SimuladorClient from './SimuladorClient';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export default async function SimuladorCorretorPage({ params }: Props) {
  const { id } = await params;
  const view = await carregarSimuladorPublico(id);
  if (!view) notFound();
  return <SimuladorClient view={view} />;
}
