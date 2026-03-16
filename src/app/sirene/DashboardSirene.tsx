import Link from "next/link";

type PorStatus = { status: string; count: number; pct: number };
type TravaItem = { id: number; numero: number; time_abertura: string | null; incendio: string };
type Tarefa = { chamadoId: number; numero: number; incendio: string; titulo: string; status: string };

type Props = {
  emAberto: number;
  emAndamento: number;
  concluidos: number;
  tempoMedioPrimeiroAtendimento: string;
  porStatus: PorStatus[];
  satisfacaoPct: number;
  chamadosComTrava: number;
  recentesComTrava: TravaItem[];
  minhasTarefas: Tarefa[];
};

const statusLabel: Record<string, string> = {
  nao_iniciado: "Não iniciados",
  em_andamento: "Em andamento",
  concluido: "Concluídos",
};

const statusColor: Record<string, string> = {
  nao_iniciado: "text-red-400",
  em_andamento: "text-amber-400",
  concluido: "text-emerald-400",
};

const statusBarColor: Record<string, string> = {
  nao_iniciado: "bg-red-500",
  em_andamento: "bg-amber-500",
  concluido: "bg-emerald-500",
};

export function DashboardSirene({
  emAberto,
  emAndamento,
  concluidos,
  tempoMedioPrimeiroAtendimento,
  porStatus,
  satisfacaoPct,
  chamadosComTrava,
  recentesComTrava,
  minhasTarefas,
}: Props) {
  const total = emAberto + emAndamento + concluidos;

  return (
    <div className="min-h-screen bg-stone-900 text-stone-100">
      {/* KPIs — linha superior */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-stone-700 bg-stone-800/80 p-4">
          <p className="text-3xl font-bold text-red-400">{emAberto}</p>
          <p className="mt-1 text-sm text-stone-400">Em aberto</p>
        </div>
        <div className="rounded-xl border border-stone-700 bg-stone-800/80 p-4">
          <p className="text-3xl font-bold text-amber-400">{emAndamento}</p>
          <p className="mt-1 text-sm text-stone-400">Em andamento</p>
        </div>
        <div className="rounded-xl border border-stone-700 bg-stone-800/80 p-4">
          <p className="text-3xl font-bold text-emerald-400">{concluidos}</p>
          <p className="mt-1 text-sm text-stone-400">Concluídos</p>
        </div>
        <div className="rounded-xl border border-stone-700 bg-stone-800/80 p-4">
          <p className="text-3xl font-bold text-blue-400">{tempoMedioPrimeiroAtendimento}</p>
          <p className="mt-1 text-sm text-stone-400">Tempo médio 1º atendimento</p>
        </div>
      </div>

      {/* Duas colunas: Chamados por status + Satisfação | Chamados com trava */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Esquerda: Chamados por status + Satisfação */}
        <div className="space-y-6 rounded-xl border border-stone-700 bg-stone-800/60 p-5">
          <h2 className="text-lg font-semibold text-stone-100">Chamados por status</h2>
          <ul className="space-y-3">
            {porStatus.map((item) => (
              <li key={item.status}>
                <div className="flex items-center justify-between text-sm">
                  <span className={statusColor[item.status] ?? "text-stone-400"}>
                    {statusLabel[item.status] ?? item.status}: {item.count} ({item.pct.toFixed(1)}%)
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-700">
                  <div
                    className={`h-full rounded-full ${statusBarColor[item.status] ?? "bg-stone-500"}`}
                    style={{ width: `${Math.min(100, item.pct)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-stone-700 pt-4">
            <p className="text-sm font-medium text-stone-400">Satisfação do criador no 1º atendimento</p>
            <p className="mt-1 text-3xl font-bold text-emerald-400">{satisfacaoPct}%</p>
            <p className="mt-0.5 text-xs text-stone-500">chamados resolvidos sem reincidência</p>
          </div>
        </div>

        {/* Direita: Chamados com trava */}
        <div className="space-y-4 rounded-xl border border-stone-700 bg-stone-800/60 p-5">
          <h2 className="text-lg font-semibold text-stone-100">Chamados com trava</h2>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-red-400">{chamadosComTrava}</span>
            <span className="text-sm text-red-400/90">chamados ativos travam o avanço</span>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-stone-400">Chamados recentes com trava</p>
            <ul className="space-y-2">
              {recentesComTrava.length === 0 ? (
                <li className="text-sm text-stone-500">Nenhum</li>
              ) : (
                recentesComTrava.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/sirene/${c.id}`}
                      className="block rounded-lg border border-stone-600 bg-stone-800/80 p-3 transition hover:border-red-500/50 hover:bg-stone-700/80"
                    >
                      <span className="font-medium text-red-300">#{c.numero}</span>
                      {c.time_abertura && (
                        <span className="ml-2 text-stone-400"> — {c.time_abertura}</span>
                      )}
                      <p className="mt-0.5 truncate text-sm text-stone-300">{c.incendio}</p>
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Minhas tarefas pendentes */}
      <div className="mt-6 rounded-xl border border-stone-700 bg-stone-800/60 p-5">
        <h2 className="text-lg font-semibold text-stone-100">Minhas tarefas pendentes</h2>
        <ul className="mt-4 space-y-2">
          {minhasTarefas.length === 0 ? (
            <li className="text-sm text-stone-500">Nenhuma tarefa pendente</li>
          ) : (
            minhasTarefas.map((t) => (
              <li key={`${t.chamadoId}-${t.titulo}`}>
                <Link
                  href={`/sirene/${t.chamadoId}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-600 bg-stone-800/80 p-3 transition hover:border-amber-500/50 hover:bg-stone-700/80"
                >
                  <span className="text-sm text-stone-200">
                    <span className="font-medium">#{t.numero}</span> — {t.titulo}
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        t.status === "Aguardando"
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-stone-600 text-stone-300"
                      }`}
                    >
                      {t.status}
                    </span>
                    <span className="text-xs text-amber-400">Ver ↗</span>
                  </span>
                </Link>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
