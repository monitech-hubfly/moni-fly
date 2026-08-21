'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, FileText, Loader2 } from 'lucide-react';
import { listarAtasReuniaoCard } from '@/lib/actions/kanban-ata-reuniao';
import type { AtaReuniaoRow } from '@/lib/kanban/ata-reuniao-types';
import { formatDataPtBr } from '@/lib/kanban/kanban-card-datas';

type Props = {
  cardId: string;
  origem: 'nativo' | 'legado';
  refreshKey?: number;
};

export function KanbanCardModalAtasReuniao({ cardId, origem, refreshKey = 0 }: Props) {
  const [rows, setRows] = useState<AtaReuniaoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandidoId, setExpandidoId] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    if (!cardId) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const list = await listarAtasReuniaoCard({ cardId, origem });
      setRows(list);
    } finally {
      setLoading(false);
    }
  }, [cardId, origem]);

  useEffect(() => {
    void recarregar();
  }, [recarregar, refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-stone-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Carregando atas…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-xs text-stone-500">
        Nenhuma ata registrada. Agende uma reunião e preencha a ata para guardar o histórico aqui.
      </p>
    );
  }

  return (
    <ul className="max-h-72 space-y-1 overflow-y-auto">
      {rows.map((row) => {
        const aberto = expandidoId === row.id;
        return (
          <li key={row.id} className="rounded-lg border border-stone-100 bg-stone-50/50">
            <button
              type="button"
              onClick={() => setExpandidoId(aberto ? null : row.id)}
              className="flex w-full items-start gap-2 px-2 py-2 text-left text-xs hover:bg-stone-100/80"
            >
              {aberto ? (
                <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-500" />
              ) : (
                <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-500" />
              )}
              <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-600" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-stone-800 line-clamp-1">{row.assunto}</span>
                <span className="mt-0.5 block text-[10px] text-stone-500">
                  {formatDataPtBr(row.data_reuniao)}
                  {row.preenchido_nome ? ` · ${row.preenchido_nome}` : ''}
                </span>
              </span>
            </button>
            {aberto ? (
              <div className="space-y-2 border-t border-stone-100 px-3 pb-3 pt-2 text-[11px] text-stone-700">
                {row.conteudo.participantes ? (
                  <p>
                    <span className="font-semibold">Participantes:</span> {row.conteudo.participantes}
                  </p>
                ) : null}
                {row.conteudo.pontos_chave ? (
                  <p>
                    <span className="font-semibold">Discussão:</span>
                    <span className="mt-0.5 block whitespace-pre-wrap">{row.conteudo.pontos_chave}</span>
                  </p>
                ) : null}
                {row.conteudo.decisoes ? (
                  <p>
                    <span className="font-semibold">Decisões:</span> {row.conteudo.decisoes}
                  </p>
                ) : null}
                {row.conteudo.acoes.filter((a) => a.acao || a.responsavel).length > 0 ? (
                  <div>
                    <span className="font-semibold">Ações:</span>
                    <ul className="mt-1 list-disc pl-4">
                      {row.conteudo.acoes
                        .filter((a) => a.acao || a.responsavel)
                        .map((a, i) => (
                          <li key={i}>
                            {a.acao}
                            {a.responsavel ? ` — ${a.responsavel}` : ''}
                            {a.prazo ? ` (${formatDataPtBr(a.prazo)})` : ''}
                          </li>
                        ))}
                    </ul>
                  </div>
                ) : null}
                {row.conteudo.pendencias_riscos ? (
                  <p>
                    <span className="font-semibold">Pendências/riscos:</span> {row.conteudo.pendencias_riscos}
                  </p>
                ) : null}
                {row.conteudo.proximos_passos ? (
                  <p>
                    <span className="font-semibold">Próximos passos:</span> {row.conteudo.proximos_passos}
                  </p>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
