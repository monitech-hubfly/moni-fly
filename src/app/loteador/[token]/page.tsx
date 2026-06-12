import { carregarFichaLoteadorExterna, buscarLoteadorExternoTokenInfo } from '@/lib/actions/loteador-externo-actions';
import { FormularioLoteadorExternoForm } from './FormularioLoteadorExternoForm';

type Props = { params: { token: string } };

export default async function LoteadorExternoPage({ params }: Props) {
  const { token } = params;

  const info = await buscarLoteadorExternoTokenInfo(token);
  if (!info.ok) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-semibold text-gray-800">Link inválido ou expirado</p>
          <p className="mt-2 text-sm text-gray-500">{info.error}</p>
        </div>
      </main>
    );
  }

  const ficha = await carregarFichaLoteadorExterna(token);
  if (!ficha.ok) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-semibold text-gray-800">Erro ao carregar ficha</p>
          <p className="mt-2 text-sm text-gray-500">{ficha.error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-600">Casa Moní</p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">Dados do Loteador</h1>
          <p className="mt-2 text-sm text-gray-500">
            Formulário compartilhável — visualização e edição da ficha do loteador vinculada ao card.
          </p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <FormularioLoteadorExternoForm token={token} draftInicial={ficha.draft} />
        </div>
      </div>
    </main>
  );
}
