import { notFound } from 'next/navigation';
import { resolverTokenPublico, buscarHistoricoPublico } from '@/lib/actions/formulario-publico';
import FormularioQualificacaoForm from '@/app/rede-franqueados/[id]/formulario-qualificacao/FormularioQualificacaoForm';

export const dynamic = 'force-dynamic';

export default async function FormularioPublicoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const result = await resolverTokenPublico(token);
  if (!result.ok) notFound();

  const { redeId, nFranquia, nomeCompleto, cidadeInicial, estadoInicial } = result;

  const { data: historico } = await buscarHistoricoPublico(token);

  return (
    <FormularioQualificacaoForm
      redeId={redeId}
      nFranquia={nFranquia}
      nomeCompleto={nomeCompleto}
      cidadeInicial={cidadeInicial}
      estadoInicial={estadoInicial}
      historico={historico ?? []}
      publicToken={token}
    />
  );
}
