'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addRedeContato, deleteRedeContato, type RedeTipo } from './actions';

type Contato = {
  id: string;
  tipo: string;
  nome: string;
  contato: string | null;
  created_at: string;
};

const TIPO_LABEL: Record<RedeTipo, string> = {
  condominio: 'Condomínio',
  corretor: 'Corretor',
  imobiliaria: 'Imobiliária',
};

export function RedeContatosClient({ contatos }: { contatos: Contato[] }) {
  const router = useRouter();
  const [tipo, setTipo] = useState<RedeTipo>('condominio');
  const [nome, setNome] = useState('');
  const [contato, setContato] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await addRedeContato({ tipo, nome, contato: contato || undefined });
    setLoading(false);
    if (res.ok) {
      router.refresh();
      setNome('');
      setContato('');
    } else setError(res.error);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este contato da rede?')) return;
    const res = await deleteRedeContato(id);
    if (res.ok) router.refresh();
    else setError(res.error);
  };

  const byTipo = (t: string) => contatos.filter((c) => c.tipo === t);

  return (
    <div className="space-y-6">
      <p className="text-sm text-stone-600">
        Mantenha sua rede de contatos (condomínios, corretores, imobiliárias). Recomenda-se
        atualizar esta lista <strong>quinzenalmente</strong>.
      </p>

      <form
        onSubmit={handleAdd}
        className="space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-4"
      >
        <h3 className="font-medium text-stone-800">Adicionar contato</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-stone-500">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as RedeTipo)}
              className="rounded border border-stone-300 px-3 py-2 text-sm"
            >
              {(['condominio', 'corretor', 'imobiliaria'] as const).map((t) => (
                <option key={t} value={t}>
                  {TIPO_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-stone-500">Nome</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome ou razão social"
              className="w-48 rounded border border-stone-300 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-stone-500">Contato (e-mail, telefone)</label>
            <input
              type="text"
              value={contato}
              onChange={(e) => setContato(e.target.value)}
              placeholder="Opcional"
              className="w-56 rounded border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary text-sm">
            {loading ? 'Adicionando…' : 'Adicionar'}
          </button>
        </div>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-4">
        {(['condominio', 'corretor', 'imobiliaria'] as const).map((t) => {
          const list = byTipo(t);
          return (
            <div key={t} className="overflow-hidden rounded-lg border border-stone-200">
              <h3 className="bg-stone-100 px-3 py-2 text-sm font-medium text-stone-800">
                {TIPO_LABEL[t]} ({list.length})
              </h3>
              {list.length === 0 ? (
                <p className="p-3 text-sm text-stone-500">Nenhum contato.</p>
              ) : (
                <ul className="divide-y divide-stone-100">
                  {list.map((c) => (
                    <li key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="font-medium text-stone-800">{c.nome}</span>
                      <span className="flex items-center gap-2">
                        {c.contato && <span className="text-stone-500">{c.contato}</span>}
                        <button
                          type="button"
                          onClick={() => handleDelete(c.id)}
                          className="text-red-600 hover:underline"
                        >
                          Excluir
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
