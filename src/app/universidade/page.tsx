import { TabuleiroView } from './TabuleiroView';

export const dynamic = 'force-dynamic';

export default async function UniversidadePage() {
  return <TabuleiroView nextPath="/universidade" />;
}
