import type { Metadata } from 'next';
import { requireFunisInternosNegocioAccess } from '@/lib/guards/kanban-funil-access';
import { MarketingHubClient } from '@/app/marketing/MarketingHubClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sessão Manutenções | Hub de Funis',
};

export default async function ManutencoesSessaoPage() {
  await requireFunisInternosNegocioAccess();
  return <MarketingHubClient sessaoInicial="Manutenções" />;
}
