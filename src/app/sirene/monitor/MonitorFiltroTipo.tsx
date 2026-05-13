'use client';

import { useRouter, useSearchParams } from 'next/navigation';

type Props = { tipoAtual: 'todos' | 'padrao' | 'hdm' };

export function MonitorFiltroTipo({ tipoAtual }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(tipo: string) {
    const next = new URLSearchParams(searchParams?.toString() ?? '');
    if (tipo === 'todos') next.delete('tipo');
    else next.set('tipo', tipo);
    const q = next.toString();
    router.push(q ? `/sirene/monitor?${q}` : '/sirene/monitor');
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium text-stone-400">Tipo de chamado</label>
      <select
        value={tipoAtual}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-md border border-stone-600 bg-stone-800 px-3 py-1.5 text-sm text-stone-100 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
      >
        <option value="todos">Todos</option>
        <option value="padrao">Padrão</option>
        <option value="hdm">HDM</option>
      </select>
    </div>
  );
}
