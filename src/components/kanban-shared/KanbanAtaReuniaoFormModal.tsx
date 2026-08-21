'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import { salvarAtaReuniaoCard } from '@/lib/actions/kanban-ata-reuniao';
import {
  CONTEUDO_ATA_VAZIO,
  type AcaoAtaReuniao,
  type ConteudoAtaReuniao,
} from '@/lib/kanban/ata-reuniao-types';

type Props = {
  cardId: string;
  origem: 'nativo' | 'legado';
  dataReuniaoInicial: string;
  basePath: string;
  onClose: () => void;
  onSalvo: () => void;
};

export function KanbanAtaReuniaoFormModal({
  cardId,
  origem,
  dataReuniaoInicial,
  basePath,
  onClose,
  onSalvo,
}: Props) {
  const [dataReuniao, setDataReuniao] = useState(dataReuniaoInicial);
  const [form, setForm] = useState<ConteudoAtaReuniao>({
    ...CONTEUDO_ATA_VAZIO,
    assunto: '',
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setDataReuniao(dataReuniaoInicial);
  }, [dataReuniaoInicial]);

  const assuntoTitulo = form.assunto.trim() || 'ASSUNTO';

  function patchAcao(idx: number, patch: Partial<AcaoAtaReuniao>) {
    setForm((f) => ({
      ...f,
      acoes: f.acoes.map((a, i) => (i === idx ? { ...a, ...patch } : a)),
    }));
  }

  function addAcao() {
    setForm((f) => ({ ...f, acoes: [...f.acoes, { acao: '', responsavel: '', prazo: '' }] }));
  }

  function removeAcao(idx: number) {
    setForm((f) => ({
      ...f,
      acoes: f.acoes.length <= 1 ? f.acoes : f.acoes.filter((_, i) => i !== idx),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const res = await salvarAtaReuniaoCard({
        cardId,
        origem,
        dataReuniao,
        conteudo: form,
        basePath,
      });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      onSalvo();
      onClose();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ata-reuniao-titulo"
      >
        <header
          className="flex shrink-0 items-start justify-between gap-3 border-b px-5 py-4"
          style={{ borderColor: 'var(--moni-border-default)' }}
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
              Ata de reunião
            </p>
            <h2 id="ata-reuniao-titulo" className="mt-0.5 text-lg font-bold text-stone-900">
              ATA DE REUNIÃO – “{assuntoTitulo}”
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4 text-sm">
            <section>
              <h3 className="mb-2 font-semibold text-stone-800">1️⃣ Data da reunião</h3>
              <input
                type="date"
                required
                value={dataReuniao}
                onChange={(e) => setDataReuniao(e.target.value)}
                className="w-full max-w-xs rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
            </section>

            <section>
              <h3 className="mb-2 font-semibold text-stone-800">2️⃣ Quem participou?</h3>
              <textarea
                rows={2}
                value={form.participantes}
                onChange={(e) => setForm((f) => ({ ...f, participantes: e.target.value }))}
                placeholder="Nomes dos participantes"
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
            </section>

            <section>
              <h3 className="mb-2 font-semibold text-stone-800">3️⃣ Qual o assunto principal?</h3>
              <input
                type="text"
                required
                value={form.assunto}
                onChange={(e) => setForm((f) => ({ ...f, assunto: e.target.value }))}
                placeholder="Tema da reunião (resuma em 1 frase)"
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
            </section>

            <section>
              <h3 className="mb-2 font-semibold text-stone-800">4️⃣ O que foi discutido de importante?</h3>
              <textarea
                rows={4}
                value={form.pontos_chave}
                onChange={(e) => setForm((f) => ({ ...f, pontos_chave: e.target.value }))}
                placeholder="Pontos-chave (use tópicos)"
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
            </section>

            <section>
              <h3 className="mb-2 font-semibold text-stone-800">5️⃣ Teve decisão tomada?</h3>
              <textarea
                rows={2}
                value={form.decisoes}
                onChange={(e) => setForm((f) => ({ ...f, decisoes: e.target.value }))}
                placeholder="Não? Sim? Quais?"
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
            </section>

            <section>
              <h3 className="mb-2 font-semibold text-stone-800">6️⃣ Ações definidas</h3>
              <p className="mb-2 text-xs text-stone-500">Há ações a executar?</p>
              <div className="space-y-3">
                {form.acoes.map((acao, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-stone-200 bg-stone-50/80 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-stone-600">Ação {idx + 1}</span>
                      {form.acoes.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeAcao(idx)}
                          className="text-stone-400 hover:text-red-600"
                          aria-label="Remover ação"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                    <input
                      type="text"
                      value={acao.acao}
                      onChange={(e) => patchAcao(idx, { acao: e.target.value })}
                      placeholder="Ação"
                      className="w-full rounded border border-stone-200 bg-white px-2 py-1.5 text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={acao.responsavel}
                        onChange={(e) => patchAcao(idx, { responsavel: e.target.value })}
                        placeholder="Responsável"
                        className="rounded border border-stone-200 bg-white px-2 py-1.5 text-sm"
                      />
                      <input
                        type="date"
                        value={acao.prazo}
                        onChange={(e) => patchAcao(idx, { prazo: e.target.value })}
                        className="rounded border border-stone-200 bg-white px-2 py-1.5 text-sm"
                      />
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addAcao}
                  className="inline-flex items-center gap-1 text-xs font-medium text-moni-primary hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar ação
                </button>
              </div>
            </section>

            <section>
              <h3 className="mb-2 font-semibold text-stone-800">7️⃣ Pendências ou riscos?</h3>
              <textarea
                rows={2}
                value={form.pendencias_riscos}
                onChange={(e) => setForm((f) => ({ ...f, pendencias_riscos: e.target.value }))}
                placeholder="Algo ficou em aberto ou com risco?"
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
            </section>

            <section>
              <h3 className="mb-2 font-semibold text-stone-800">8️⃣ Próximos passos</h3>
              <textarea
                rows={2}
                value={form.proximos_passos}
                onChange={(e) => setForm((f) => ({ ...f, proximos_passos: e.target.value }))}
                placeholder="Observações finais"
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
            </section>

            {erro ? <p className="text-sm text-red-600">{erro}</p> : null}
          </div>

          <footer
            className="flex shrink-0 justify-end gap-2 border-t px-5 py-3"
            style={{ borderColor: 'var(--moni-border-default)' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="inline-flex items-center gap-2 rounded-lg bg-moni-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Concluir ata
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
