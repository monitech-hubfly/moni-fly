import { redirect } from 'next/navigation';

type Props = {
  params: Promise<{ secao: string }>;
};

/** Compat: URLs antigas `/leitura/:secao` → link único `/treinamento-bca/leitura` (sem query). */
export default async function TreinamentoBcaLeituraSecaoParaLinkFixo(props: Props) {
  await props.params;
  redirect('/treinamento-bca/leitura');
}
