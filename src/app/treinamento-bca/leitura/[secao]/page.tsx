import { redirect } from 'next/navigation';

type Props = {
  params: Promise<{ secao: string }>;
  searchParams: Promise<{ frank?: string }>;
};

/** Compat: URLs antigas `/leitura/:secao` → link único `/treinamento-bca/leitura`. */
export default async function TreinamentoBcaLeituraSecaoParaLinkFixo(props: Props) {
  await props.params;
  const sp = await props.searchParams;
  const q = new URLSearchParams();
  if (sp.frank) q.set('frank', sp.frank);
  const qs = q.toString();
  redirect(`/treinamento-bca/leitura${qs ? `?${qs}` : ''}`);
}
