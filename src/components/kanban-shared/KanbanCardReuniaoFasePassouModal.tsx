'use client';

import { useState } from 'react';
import { Calendar } from 'lucide-react';
import { salvarDataReuniaoCard } from '@/lib/actions/kanban-ata-reuniao';
import { dataIsoInputValida } from '@/lib/kanban/kanban-card-datas';

type Props = {
  cardId: string;
  origem: 'nativo' | 'legado';
  basePath: string;
  faseId?: string | null;
  etapaSlug?: string | null;
  onClose: () => void;
  onAtualizado: (dataReuniao: string) => void;
};

export function KanbanCardReuniaoFasePassouModal({
  cardId,
  origem,
  basePath,
  faseId,
  etapaSlug,
  onClose,
  onAtualizado,
}: Props) {
  const [passo, setPasso] = useState<'pergunta' | 'nova_data'>('pergunta');
  const [novaData, setNovaData] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function reiniciarCampo() {
    setSalvando(true);
    try {
      const res = await salvarDataReuniaoCard({
        cardId,
        origem,
        dataReuniao: '',
        faseId: faseId ?? null,
        etapaSlug: etapaSlug ?? null,
        basePath,
      });
      if (!res.ok) {
        alert(res.error);
        return;
      }
      onAtualizado('');
      onClose();
    } finally {
      setSalvando(false);
    }
  }

  async function salvarNovaData() {
    const v = novaData.trim().slice(0, 10);
    if (!v || !dataIsoInputValida(v)) {
      alert('Informe uma data válida (ano com 4 dígitos).');
      return;
    }
    setSalvando(true);
    try {
      const res = await salvarDataReuniaoCard({
        cardId,
        origem,
        dataReuniao: v,
        faseId: faseId ?? null,
        etapaSlug: etapaSlug ?? null,
        basePath,
      });
      if (!res.ok) {
        alert(res.error);
        return;
      }
      onAtualizado(v);
      onClose();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reuniao-fase-passou-titulo"
        style={{
          borderRadius: 'var(--moni-radius-lg)',
          border: 'var(--moni-border-width) solid var(--moni-border-default)',
        }}
      >
        <div className="flex items-start gap-3">
          <Calendar
            className="mt-0.5 h-5 w-5 shrink-0"
            style={{ color: 'var(--moni-text-secondary)' }}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <h3
              id="reuniao-fase-passou-titulo"
              className="text-base font-semibold"
              style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
            >
              Data de reunião
            </h3>

            {passo === 'pergunta' ? (
              <>
                <p className="mt-3 text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
                  Este card avançou de fase desde a última data de reunião registrada. O campo de
                  reunião pode ser reiniciado?
                </p>
                <div className="mt-6 flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={salvando}
                    onClick={() => void reiniciarCampo()}
                    className="min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      borderRadius: 'var(--moni-radius-md)',
                      background: 'var(--moni-navy-800)',
                    }}
                  >
                    Sim — limpar data
                  </button>
                  <button
                    type="button"
                    disabled={salvando}
                    onClick={() => setPasso('nova_data')}
                    className="min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      borderRadius: 'var(--moni-radius-md)',
                      border: 'var(--moni-border-width) solid var(--moni-border-default)',
                      color: 'var(--moni-text-secondary)',
                      background: 'var(--moni-surface-elevated, #fff)',
                    }}
                  >
                    Não — informar próxima data
                  </button>
                  <button
                    type="button"
                    disabled={salvando}
                    onClick={onClose}
                    className="min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ color: 'var(--moni-text-tertiary)' }}
                  >
                    Preencher depois
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
                  Informe a próxima data de reunião para esta fase.
                </p>
                <label className="mt-4 block text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
                  Próxima reunião
                  <input
                    type="date"
                    value={novaData}
                    onChange={(e) => setNovaData(e.target.value)}
                    disabled={salvando}
                    className="mt-1 w-full rounded-lg px-3 py-2 text-sm"
                    style={{
                      borderRadius: 'var(--moni-radius-md)',
                      border: 'var(--moni-border-width) solid var(--moni-border-default)',
                      fontFamily: 'var(--moni-font-sans)',
                    }}
                  />
                </label>
                <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    disabled={salvando}
                    onClick={() => setPasso('pergunta')}
                    className="min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      borderRadius: 'var(--moni-radius-md)',
                      border: 'var(--moni-border-width) solid var(--moni-border-default)',
                      color: 'var(--moni-text-secondary)',
                    }}
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    disabled={salvando}
                    onClick={onClose}
                    className="min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ color: 'var(--moni-text-tertiary)' }}
                  >
                    Preencher depois
                  </button>
                  <button
                    type="button"
                    disabled={salvando}
                    onClick={() => void salvarNovaData()}
                    className="min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      borderRadius: 'var(--moni-radius-md)',
                      background: 'var(--moni-navy-800)',
                    }}
                  >
                    Salvar data
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
