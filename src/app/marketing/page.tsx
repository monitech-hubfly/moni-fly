import type { Metadata } from 'next';
import { requireFunisInternosNegocioAccess } from '@/lib/guards/kanban-funil-access';
import { MarketingHubClient } from './MarketingHubClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sessão Marketing | Hub de Funis',
};

export default async function MarketingSessaoPage() {
  await requireFunisInternosNegocioAccess();
  return <MarketingHubClient />;
}
