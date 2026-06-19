'use client';

import { MeuCarometroBloco } from '@/components/carometro/todo/MeuCarometroBloco';

export default function TodoPlanningPage() {
  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-gray-800">TO DO &amp; Planning</h1>
      <MeuCarometroBloco />
      {/* Próximas sessões: Backlog, Agenda, Metas & Indicadores */}
    </div>
  );
}
