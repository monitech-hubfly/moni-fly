'use client';

import { useState } from 'react';
import { Calendar, FileText, RefreshCw } from 'lucide-react';
import { salvarDataFollowupCard, salvarDataReuniaoCard } from '@/lib/actions/kanban-ata-reuniao';
import {
  calcularCorDataBadge,
  formatDataPtBr,
  labelRelativoData,
} from '@/lib/kanban/kanban-card-datas';
import { KanbanAtaReuniaoFormModal } from './KanbanAtaReuniaoFormModal';

type Props = {
  cardId: string;
  origem: 'nativo' | 'legado';
  basePath: string;
  dataReuniao: string;
  dataFollowup: string;
  onDataReuniaoChange: (v: string) => void;
  onDataFollowupChange: (v: string) => void;
  onAtaSalva: () => void;
};

export function KanbanCardDatasFields({
  cardId,
  origem,
  basePath,
  dataReuniao,
  dataFollowup,
  onDataReuniaoChange,
  onDataFollowupChange,
  onAtaSalva,
}: Props) {
  const [salvandoFollowup, setSalvandoFollowup] = useState(false);
  const [salvandoReuniao, setSalvandoReuniao] = useState(false);
  const [ataAberta, setAtaAberta] = useState(false);

  async function salvarFollowup(valor: string) {
    setSalvandoFollowup(true);
    try {
      const res = await salvarDataFollowupCard({
        cardId,
        origem,
        dataFollowup: valor,
        basePath,
      });
      if (!res.ok) alert(res.error);
      else onDataFollowupChange(valor.trim() ? valor.trim().slice(0, 10) : '');
    } finally {
      setSalvandoFollowup(false);
    }
  }

  async function salvarReuniao(valor: string) {
    setSalvandoReuniao(true);
    try {
      const res = await salvarDataReuniaoCard({
        cardId,
        origem,
        dataReuniao: valor,
        basePath,
      });
      if (!res.ok) alert(res.error);
      else onDataReuniaoChange(valor.trim() ? valor.trim().slice(0, 10) : '');
    } finally {
      setSalvandoReuniao(false);
    }
  }

  function abrirAta() {
    if (!dataReuniao) {
      alert('Defina a data da reunião antes de preencher a ata.');
      return;
    }
    setAtaAberta(true);
  }

  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div
          className="rounded-xl p-3"
          style={{
            background: 'var(--moni-surface-50)',
            border: '0.5px solid var(--moni-border-default)',
          }}
        >
          <div className="mb-2 flex items-center gap-2">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-violet-700"
              aria-hidden
            >
              <Calendar className="h-3.5 w-3.5" />
            </span>
            <div>
              <p className="text-xs font-semibold text-stone-800">Reunião</p>
              <p className="text-[10px] text-stone-500">Agende e registre a ata ao concluir</p>
            </div>
          </div>
          <input
            type="date"
            value={dataReuniao}
            onChange={(e) => onDataReuniaoChange(e.target.value)}
            onBlur={(e) => void salvarReuniao(e.target.value)}
            disabled={salvandoReuniao}
            className="mb-2 w-full rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-sm"
          />
          {dataReuniao ? (
            <>
              <span
                className={`mb-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${calcularCorDataBadge(dataReuniao)}`}
              >
                {formatDataPtBr(dataReuniao)} · {labelRelativoData(dataReuniao)}
              </span>
              <button
                type="button"
                onClick={abrirAta}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
              >
                <FileText className="h-3.5 w-3.5" />
                Preencher ata de reunião
              </button>
              <p className="mt-1.5 text-[10px] text-stone-500">
                Obrigatório registrar a ata. Após concluir, a data da reunião será limpa.
              </p>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                const hoje = new Date().toISOString().slice(0, 10);
                onDataReuniaoChange(hoje);
                void salvarReuniao(hoje).then(() => setAtaAberta(true));
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-stone-300 px-3 py-2 text-xs font-medium text-stone-600 hover:border-moni-primary hover:text-moni-primary"
            >
              <PlusIcon />
              Agendar reunião
            </button>
          )}
        </div>

        <div
          className="rounded-xl p-3"
          style={{
            background: 'var(--moni-surface-50)',
            border: '0.5px solid var(--moni-border-default)',
          }}
        >
          <div className="mb-2 flex items-center gap-2">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-100 text-sky-700"
              aria-hidden
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </span>
            <div>
              <p className="text-xs font-semibold text-stone-800">Follow-up</p>
              <p className="text-[10px] text-stone-500">Próximo contato ou retorno</p>
            </div>
          </div>
          <input
            type="date"
            value={dataFollowup}
            onChange={(e) => onDataFollowupChange(e.target.value)}
            onBlur={(e) => void salvarFollowup(e.target.value)}
            disabled={salvandoFollowup}
            className="mb-2 w-full rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-sm"
          />
          {dataFollowup ? (
            <span
              className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${calcularCorDataBadge(dataFollowup)}`}
            >
              {formatDataPtBr(dataFollowup)} · {labelRelativoData(dataFollowup)}
            </span>
          ) : (
            <p className="text-[10px] text-stone-400">Nenhum follow-up agendado</p>
          )}
        </div>
      </div>

      {ataAberta ? (
        <KanbanAtaReuniaoFormModal
          cardId={cardId}
          origem={origem}
          dataReuniaoInicial={dataReuniao}
          basePath={basePath}
          onClose={() => setAtaAberta(false)}
          onSalvo={() => {
            onDataReuniaoChange('');
            onAtaSalva();
          }}
        />
      ) : null}
    </>
  );
}

function PlusIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
