"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateJuridicoTicketStatus } from "../actions";
import { JURIDICO_STATUS_LIST } from "../constants";

type Ticket = {
  id: string;
  titulo: string;
  descricao: string;
  status: string;
  created_at: string;
  resposta_publica: string | null;
  nome_frank: string | null;
  nome_condominio: string | null;
  lote: string | null;
};

export function KanbanColumn({
  columnKey,
  title,
  tickets,
}: {
  columnKey: string;
  title: string;
  tickets: Ticket[];
}) {
  const router = useRouter();

  async function handleStatusChange(ticketId: string, newStatus: string) {
    if (newStatus === columnKey) return;
    await updateJuridicoTicketStatus(ticketId, newStatus);
    router.refresh();
  }

  return (
    <div className="w-72 shrink-0 rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      <div className="bg-stone-100 px-4 py-3 border-b border-stone-200">
        <h2 className="font-semibold text-stone-800">{title}</h2>
        <p className="text-xs text-stone-500 mt-0.5">{tickets.length} ticket(s)</p>
      </div>
      <div className="p-2 space-y-2 max-h-[70vh] overflow-y-auto">
        {tickets.map((t) => (
          <div
            key={t.id}
            className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm hover:border-moni-accent/40 transition"
          >
            <Link href={`/juridico/${t.id}`} className="block">
              <p className="font-medium text-stone-800 text-sm line-clamp-2">{t.titulo}</p>
              {(t.nome_frank || t.nome_condominio || t.lote) && (
                <p className="mt-0.5 text-xs text-stone-500 line-clamp-1">
                  {[t.nome_frank, t.nome_condominio, t.lote].filter(Boolean).join(" · ")}
                </p>
              )}
              <p className="mt-1 text-xs text-stone-500 line-clamp-2">{t.descricao}</p>
              <p className="mt-1 text-xs text-stone-400">
                {t.created_at ? new Date(t.created_at).toLocaleDateString("pt-BR") : ""}
              </p>
            </Link>
            <div className="mt-2 pt-2 border-t border-stone-100">
              <label className="text-xs text-stone-500 block mb-1">Mover para:</label>
              <select
                value={t.status}
                onChange={(e) => handleStatusChange(t.id, e.target.value)}
                className="w-full rounded border border-stone-300 px-2 py-1 text-xs"
                onClick={(e) => e.preventDefault()}
              >
                {JURIDICO_STATUS_LIST.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
        {tickets.length === 0 && (
          <div className="rounded-lg border border-dashed border-stone-200 p-4 text-center text-sm text-stone-400">
            Nenhum ticket
          </div>
        )}
      </div>
    </div>
  );
}
