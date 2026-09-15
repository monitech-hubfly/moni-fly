import { buscarTokenCorretorLead } from '@/lib/actions/corretor-lead-actions';
import { FormularioCorretorForm } from './FormularioCorretorForm';

type Props = { params: { token: string } };

export const metadata = {
  title: 'Indicação de lead | Casa Moní',
};

export default async function FormularioCorretorPage({ params }: Props) {
  const { token } = params;
  const info = await buscarTokenCorretorLead(token);

  if (!info.ok) {
    return (
      <main
        className="flex min-h-screen items-center justify-center px-4"
        style={{ background: 'var(--moni-surface-50)' }}
      >
        <div
          className="w-full max-w-md rounded-[var(--moni-radius-lg)] bg-[var(--moni-surface-0)] p-8 text-center shadow-[var(--moni-shadow-card)]"
          style={{ border: '0.5px solid var(--moni-border-default)' }}
        >
          <p
            className="text-lg font-semibold"
            style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-display)' }}
          >
            Link inválido ou expirado
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
            style={{ color: 'var(--moni-kanban-corretores)' }}
          >
            Casa Moní
          </p>
          <h1
            className="mt-2 text-2xl font-semibold"
            style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-display)' }}
          >
            Indicação de lead
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
            Preencha os dados do cliente. Campos com * são obrigatórios.
          </p>
        </div>

        <div
          className="rounded-[var(--moni-radius-lg)] bg-[var(--moni-surface-0)] p-8 shadow-[var(--moni-shadow-card)]"
          style={{ border: '0.5px solid var(--moni-border-default)' }}
        >
          <FormularioCorretorForm
            token={token}
            nomeCorretor={info.nome_corretor}
            imobiliaria={info.imobiliaria_corretor}
          />
        </div>
      </div>
    </main>
  );
}
