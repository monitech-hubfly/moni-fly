import FormularioQualificacaoForm from '@/app/rede-franqueados/[id]/formulario-qualificacao/FormularioQualificacaoForm';
import { buscarFormularioPorToken } from '@/lib/actions/formulario-actions';
import { buscarHistoricoPublico, resolverTokenPublico } from '@/lib/actions/formulario-publico';
import { FormularioPublicoClient } from '@/components/formularios/FormularioPublicoClient';

interface Props {
  params: Promise<{ token: string }>;
}

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function aviso(mensagem: string) {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md items-center px-4">
      <div
        className="w-full p-8 text-center"
        style={{
          background: 'var(--moni-surface-0)',
          borderRadius: 'var(--moni-radius-lg)',
          border: 'var(--moni-border-width) solid var(--moni-border-default)',
          boxShadow: 'var(--moni-shadow-card)',
        }}
      >
        <p className="text-lg" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
          {mensagem}
        </p>
      </div>
    </main>
  );
}

export default async function FormularioPublicoPage({ params }: Props) {
  const { token } = await params;
  const { formulario, tokenData, error } = await buscarFormularioPorToken(token);

  if (formulario && tokenData) {
    return (
      <FormularioPublicoClient
        formulario={formulario}
        token={token}
        cardId={tokenData.card_id}
        redeFranqueadoId={tokenData.rede_franqueado_id}
      />
    );
  }

  if (!error || error === 'Token inválido.') {
    if (UUID_RE.test(token.trim())) {
      const qualificacao = await resolverTokenPublico(token.trim());
      if (qualificacao.ok) {
        const historico = await buscarHistoricoPublico(token.trim());
        return (
          <FormularioQualificacaoForm
            redeId={qualificacao.redeId}
            nFranquia={qualificacao.nFranquia}
            nomeCompleto={qualificacao.nomeCompleto}
            cidadeInicial={qualificacao.cidadeInicial}
            estadoInicial={qualificacao.estadoInicial}
            historico={historico.data ?? []}
            publicToken={token.trim()}
          />
        );
      }
    }
  }

  return aviso(error ?? 'Formulário não encontrado.');
}
