'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { excluirOfertaSimulacao } from '@/lib/actions/loteamento-simulador-template';
import { rowToTemplateConfig } from '@/lib/loteamento-simulador-template';
import type {
  LoteamentoSimuladorTemplateRow,
  SimulacaoPagamentoResumo,
} from '@/lib/loteamento-simulador-template';
import { OfertaDetalheLeitura } from '@/components/simulador/OfertaDetalheLeitura';
import { CalculadoraOferta } from '@/components/simulador/CalculadoraOferta';
import { BotaoImprimirOferta } from '@/components/simulador/BotaoImprimirOferta';

type Props = {
  oferta: SimulacaoPagamentoResumo;
  template: LoteamentoSimuladorTemplateRow | null;
  cardId: string;
};

const btnBaseStyle = {
  fontFamily: 'var(--moni-font-sans)',
  border: 'var(--moni-border-width) solid var(--moni-border-default)',
  background: 'var(--moni-surface-0)',
  color: 'var(--moni-text-primary)',
} as const;

const btnPerigStyle = {
  fontFamily: 'var(--moni-font-sans)',
  border: 'var(--moni-border-width) solid var(--moni-status-overdue-bg, #fee2e2)',
  background: 'var(--moni-surface-0)',
  color: 'var(--moni-status-overdue-text)',
} as const;

export function OfertaDetalheCliente({ oferta, template, cardId }: Props) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function onExcluir() {
    // eslint-disable-next-line no-alert
    if (!window.confirm('Tem certeza que deseja excluir esta oferta? Esta ação não pode ser desfeita.'))
      return;
    setExcluindo(true);
    setErro(null);
    const res = await excluirOfertaSimulacao(oferta.id, cardId);
    setExcluindo(false);
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    router.push(`/loteadores/${cardId}/simulador-template/ofertas`);
  }

  const templateConfig = template ? rowToTemplateConfig(template) : null;

  return (
    <div className="flex flex-col gap-4">
      {erro ? (
        <div
          className="moni-tag-atrasado px-4 py-3 text-sm"
          role="alert"
          style={{ borderRadius: 'var(--moni-radius-md)' }}
        >
          {erro}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {editando ? (
          <button
            type="button"
            onClick={() => setEditando(false)}
            className="min-h-[44px] rounded-[var(--moni-radius-md)] px-4 text-sm font-medium sm:min-h-0"
            style={btnBaseStyle}
          >
            ← Cancelar edição
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="min-h-[44px] rounded-[var(--moni-radius-md)] px-4 text-sm font-medium sm:min-h-0"
              style={btnBaseStyle}
            >
              Editar oferta
            </button>
            <button
              type="button"
              onClick={() => void onExcluir()}
              disabled={excluindo}
              className="min-h-[44px] rounded-[var(--moni-radius-md)] px-4 text-sm font-medium disabled:opacity-50 sm:min-h-0"
              style={btnPerigStyle}
            >
              {excluindo ? 'Excluindo…' : 'Excluir oferta'}
            </button>
            <BotaoImprimirOferta />
          </>
        )}
      </div>

      {editando && templateConfig ? (
        <CalculadoraOferta
          template={templateConfig}
          loteadorId={cardId}
          kanbanCardId={cardId}
          empreendimentoId={oferta.empreendimento_id ?? null}
          ofertaId={oferta.id}
          ofertaInicial={oferta}
        />
      ) : (
        <OfertaDetalheLeitura oferta={oferta} template={template} />
      )}
    </div>
  );
}
