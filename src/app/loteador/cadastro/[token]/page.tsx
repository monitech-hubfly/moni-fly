import type { Metadata } from 'next';
import { validarTokenIntakePublicoLoteador } from '@/lib/actions/loteador-externo-actions';
import { FormularioIntakeLoteadorForm } from './FormularioIntakeLoteadorForm';

type Props = { params: { token: string } };

export const metadata: Metadata = {
  title: 'Cadastro de loteador | Casa Moní',
  description: 'Formulário público para cadastro de novos loteadores na Casa Moní.',
  robots: { index: false, follow: false },
};

export default async function LoteadorIntakePublicoPage({ params }: Props) {
  const { token } = params;
  const info = await validarTokenIntakePublicoLoteador(token);

  if (!info.ok) {
    return (
      <main
        className="flex min-h-screen items-center justify-center px-4"
        style={{ background: 'var(--moni-surface-50)' }}
      >
        <div
          className="w-full max-w-md bg-white p-8 text-center"
          style={{
            borderRadius: 'var(--moni-radius-lg)',
            border: '0.5px solid var(--moni-border-default)',
            boxShadow: 'var(--moni-shadow-card)',
          }}
        >
          <p className="text-lg font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
            Link inválido
          </p>
          <p className="mt-2 text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
            {info.error}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-12" style={{ background: 'var(--moni-surface-50)' }}>
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-8 text-center">
          <p
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-sans)' }}
          >
            Casa Moní
          </p>
          <h1
            className="mt-2 text-2xl font-bold"
            style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-display)' }}
          >
            Cadastro de loteador
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
            Preencha os dados abaixo. Cada envio cria um cadastro novo.
          </p>
        </div>

        <div
          className="bg-white p-6 sm:p-8"
          style={{
            borderRadius: 'var(--moni-radius-lg)',
            border: '0.5px solid var(--moni-border-default)',
            boxShadow: 'var(--moni-shadow-card)',
          }}
        >
          <FormularioIntakeLoteadorForm token={token} />
        </div>
      </div>
    </main>
  );
}
