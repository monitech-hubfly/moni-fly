import { TabuleiroView } from '../TabuleiroView';

export const dynamic = 'force-dynamic';

export default async function UniversidadeTabuleiroPage() {
  return <TabuleiroView nextPath="/universidade/tabuleiro" />;
}
