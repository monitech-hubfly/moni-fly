'use client';

import { useState } from 'react';
import { Calendar, FileText, Plus, RefreshCw } from 'lucide-react';
import { salvarDataFollowupCard, salvarDataReuniaoCard } from '@/lib/actions/kanban-ata-reuniao';
import {
  calcularCorDataBadge,
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

const cardStyle = {
  background: 'var(--moni-surface-50)',
  border: '0.5px solid var(--moni-border-default)',
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

  function agendarReuniaoHoje() {
    const hoje = new Date().toISOString().slice(0, 10);
    onDataReuniaoChange(hoje);
    void salvarReuniao(hoje).then(() => setAtaAberta(true));
  }

  return (
    <>
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg px-2 py-1.5" style={cardStyle}>
          <Calendar className="h-3 w-3 shrink-0 text-violet-600" aria-hidden />
          <span className="text-[11px] font-semibold text-stone-700">Reunião</span>
          <input
            type="date"
            value={dataReuniao}
            onChange={(e) => onDataReuniaoChange(e.target.value)}
            onBlur={(e) => void salvarReuniao(e.target.value)}
            disabled={salvandoReuniao}
            className="min-w-0 flex-1 rounded border border-stone-200 bg-white px-1.5 py-0.5 text-[11px]"
          />
          {dataReuniao ? (
            <>
              <span
                className={`shrink-0 rounded-full border px-1.5 py-px text-[9px] font-semibold ${calcularCorDataBadge(dataReuniao)}`}
              >
                {labelRelativoData(dataReuniao)}
              </span>
              <button
                type="button"
                onClick={abrirAta}
                title="Preencher ata de reunião"
                className="inline-flex shrink-0 items-center gap-0.5 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 hover:bg-amber-100"
              >
                <FileText className="h-3 w-3" />
                Ata
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={agendarReuniaoHoje}
              title="Agendar reunião"
              className="inline-flex shrink-0 items-center gap-0.5 rounded border border-dashed border-stone-300 px-1.5 py-0.5 text-[10px] text-stone-600 hover:border-moni-primary hover:text-moni-primary"
            >
              <Plus className="h-3 w-3" />
              Agendar
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 rounded-lg px-2 py-1.5" style={cardStyle}>
          <RefreshCw className="h-3 w-3 shrink-0 text-sky-600" aria-hidden />
          <span className="text-[11px] font-semibold text-stone-700">Follow-up</span>
          <input
            type="date"
            value={dataFollowup}
            onChange={(e) => onDataFollowupChange(e.target.value)}
            onBlur={(e) => void salvarFollowup(e.target.value)}
            disabled={salvandoFollowup}
            className="min-w-0 flex-1 rounded border border-stone-200 bg-white px-1.5 py-0.5 text-[11px]"
          />
          {dataFollowup ? (
            <span
              className={`shrink-0 rounded-full border px-1.5 py-px text-[9px] font-semibold ${calcularCorDataBadge(dataFollowup)}`}
            >
              {labelRelativoData(dataFollowup)}
            </span>
          ) : null}
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
