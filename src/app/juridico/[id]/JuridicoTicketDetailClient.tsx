"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  updateJuridicoTicketStatus,
  setJuridicoRespostaPublica,
  addJuridicoComentarioInterno,
  registerJuridicoAnexo,
} from "../actions";
import { JURIDICO_STATUS_LIST } from "../constants";
import { UploadAnexoJuridico } from "./UploadAnexoJuridico";

type Props = {
  ticketId: string;
  isMoni: boolean;
  status: string;
  comentarios?: Array<{ id: string; texto: string; created_at: string }>;
};

export function JuridicoTicketDetailClient({ ticketId, isMoni, status, comentarios = [] }: Props) {
  const router = useRouter();
  const [statusBusy, setStatusBusy] = useState(false);
  const [respostaBusy, setRespostaBusy] = useState(false);
  const [commentBusy, setCommentBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState(status);
  const [respostaText, setRespostaText] = useState("");
  const [commentText, setCommentText] = useState("");

  async function handleStatusChange() {
    if (newStatus === status) return;
    setError(null);
    setStatusBusy(true);
    const result = await updateJuridicoTicketStatus(ticketId, newStatus);
    setStatusBusy(false);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  async function handleSetResposta() {
    if (!respostaText.trim()) return;
    setError(null);
    setRespostaBusy(true);
    const result = await setJuridicoRespostaPublica(ticketId, respostaText.trim(), true);
    setRespostaBusy(false);
    if (!result.ok) setError(result.error);
    else {
      setRespostaText("");
      router.refresh();
    }
  }

  async function handleAddComment() {
    if (!commentText.trim()) return;
    setError(null);
    setCommentBusy(true);
    const result = await addJuridicoComentarioInterno(ticketId, commentText.trim());
    setCommentBusy(false);
    if (!result.ok) setError(result.error);
    else {
      setCommentText("");
      router.refresh();
    }
  }

  const finalizado = status === "finalizado";

  return (
    <div className="mt-8 space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {!isMoni && !finalizado && (
        <section className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-medium text-stone-700">Enviar anexo</h2>
          <p className="mt-1 text-sm text-stone-500">Anexe documentos à sua dúvida (PDF, imagens, Word).</p>
          <UploadAnexoJuridico ticketId={ticketId} lado="frank" onSuccess={() => router.refresh()} />
        </section>
      )}

      {isMoni && (
        <>
          <section className="rounded-2xl border border-amber-200/80 bg-amber-50/30 p-5 shadow-sm">
            <h2 className="text-sm font-medium text-amber-800">Comentários internos (Frank não vê)</h2>
            {comentarios.length > 0 && (
              <ul className="mt-3 space-y-2">
                {comentarios.map((c) => (
                  <li key={c.id} className="rounded-lg bg-white/80 p-3 text-sm text-stone-700">
                    <p className="whitespace-pre-wrap">{c.texto}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      {new Date(c.created_at).toLocaleString("pt-BR")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex gap-2">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Observação interna..."
                rows={2}
                className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
              />
              <button
                type="button"
                onClick={handleAddComment}
                disabled={commentBusy || !commentText.trim()}
                className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {commentBusy ? "..." : "Adicionar"}
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-medium text-stone-700">Alterar etapa</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
              >
                {JURIDICO_STATUS_LIST.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleStatusChange}
                disabled={statusBusy || newStatus === status}
                className="rounded-lg bg-moni-primary px-4 py-2 text-sm font-medium text-white hover:bg-moni-secondary disabled:opacity-50"
              >
                {statusBusy ? "Salvando..." : "Aplicar"}
              </button>
            </div>
          </section>

          {!finalizado && (
            <section className="rounded-2xl border border-emerald-200/80 bg-emerald-50/30 p-5 shadow-sm">
              <h2 className="text-sm font-medium text-emerald-800">Responder ao Frank e finalizar</h2>
              <p className="mt-1 text-sm text-emerald-700">
                Esta resposta será visível para o franqueado. Ao enviar, o ticket será marcado como Finalizado.
              </p>
              <textarea
                value={respostaText}
                onChange={(e) => setRespostaText(e.target.value)}
                placeholder="Digite a resposta..."
                rows={4}
                className="mt-3 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
              />
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleSetResposta}
                  disabled={respostaBusy || !respostaText.trim()}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {respostaBusy ? "Enviando..." : "Enviar resposta e finalizar"}
                </button>
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-medium text-stone-700">Anexos da Moní (resposta)</h2>
            <UploadAnexoJuridico ticketId={ticketId} lado="moni" onSuccess={() => router.refresh()} />
          </section>
        </>
      )}
    </div>
  );
}
