import { buscarFormularioPorToken } from '@/lib/actions/formulario-actions';
import { FormularioPublicoClient } from '@/components/formularios/FormularioPublicoClient';

interface Props {
  params: Promise<{ token: string }>;
}

export const dynamic = 'force-dynamic';

export default async function FormularioPublicoPage({ params }: Props) {
  const { token } = await params;
  const { formulario, tokenData, error } = await buscarFormularioPorToken(token);

  if (error || !formulario || !tokenData) {
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
            {error ?? 'Formulário não encontrado.'}
          </p>
        </div>
      </main>
    );
  }

  const avulso = !tokenData.card_id && !tokenData.rede_franqueado_id;

  return (
    <FormularioPublicoClient
      formulario={formulario}
      token={token}
      cardId={tokenData.card_id}
      redeFranqueadoId={tokenData.rede_franqueado_id}
      avulso={avulso}
    />
  );
}
