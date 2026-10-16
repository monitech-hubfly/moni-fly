import { notFound } from 'next/navigation';
import { carregarFormularioPublico } from '@/lib/actions/formulario-actions';
import { FormularioPublicoClient } from '@/components/formularios/FormularioPublicoClient';

export const dynamic = 'force-dynamic';

export default async function FormularioPublicoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await carregarFormularioPublico(token);
  if (!data.ok) {
    if (data.error === 'Link inválido.') notFound();
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <p className="text-sm" style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}>
          Casa Moní
        </p>
        <h1 className="mt-2 text-3xl" style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}>
          Formulário indisponível
        </h1>
        <p className="mt-3 text-sm" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
          {data.error}
        </p>
      </main>
    );
  }

  return (
    <FormularioPublicoClient
      token={token}
      tokenId={data.tokenId}
      avulso={data.avulso}
      formulario={data.formulario}
      secoes={data.secoes}
    />
  );
}
