import { buscarFormTokenInfo, listarFaseChecklistItens } from '@/lib/actions/candidato-actions';
import { FormularioCandidatoForm } from './FormularioCandidatoForm';
import { createAdminClient } from '@/lib/supabase/admin';

type Props = { params: { token: string } };

export default async function FormularioCandidatoPage({ params }: Props) {
  const { token } = params;

  const info = await buscarFormTokenInfo(token);
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

  const todosItens = await listarFaseChecklistItens(info.fase_id);
  const itens = todosItens.filter((it) => it.visivel_candidato);

  const respostasIniciais: Record<string, string> = {};
  const arquivosIniciais: Record<string, string | null> = {};
  if (itens.length) {
    const admin = createAdminClient();
    const { data: resps } = await admin
      .from('kanban_fase_checklist_respostas')
      .select('item_id, valor, arquivo_path')
      .eq('card_id', info.card_id)
      .in(
        'item_id',
        itens.map((i) => i.id),
      );
    for (const r of resps ?? []) {
      const row = r as { item_id: string; valor: string | null; arquivo_path: string | null };
      const id = String(row.item_id);
      respostasIniciais[id] = String(row.valor ?? '');
      if (row.arquivo_path != null && String(row.arquivo_path).trim() !== '') {
        arquivosIniciais[id] = String(row.arquivo_path).trim();
      }
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-600">Casa Moní</p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">Formulário do Candidato</h1>
          <p className="mt-2 text-sm text-gray-500">Preencha as informações abaixo. Os campos marcados com * são obrigatórios.</p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <FormularioCandidatoForm
            token={token}
            itens={itens}
            respostasIniciais={respostasIniciais}
            arquivosIniciais={arquivosIniciais}
          />
        </div>
      </div>
    </main>
  );
}
