'use client';

import { useEffect, useState } from 'react';
import { listarRespostasDoCard } from '@/lib/actions/formulario-actions';
import { FORMULARIO_IDS } from '@/lib/constants/formularios-ids';
import type { FormularioRespostaListaItem } from '@/types/formularios';
import { GerarLinkFormularioButton } from './GerarLinkFormularioButton';
import { RespostasFormularioLista } from './RespostasFormularioLista';

export function CardFormulariosSecao({
  cardId,
  redeFranqueadoId,
}: {
  cardId: string;
  redeFranqueadoId?: string | null;
}) {
  const [respostas, setRespostas] = useState<FormularioRespostaListaItem[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    void listarRespostasDoCard(cardId).then((res) => {
      if (!ativo) return;
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setRespostas(res.respostas);
    });
    return () => {
      ativo = false;
    };
  }, [cardId]);

  return (
    <div className="space-y-2">
      {erro ? (
        <p className="text-[10px]" style={{ color: 'var(--moni-status-overdue-text)' }}>
          {erro}
        </p>
      ) : (
        <RespostasFormularioLista respostas={respostas} compacto vazio="Nenhum formulário neste card." />
      )}
      <GerarLinkFormularioButton
        formularioId={FORMULARIO_IDS.CHECKLIST_CREDITO_PRELIMINAR}
        cardId={cardId}
        redeFranqueadoId={redeFranqueadoId}
        rotulo="Gerar link do formulário de crédito"
        compacto
      />
    </div>
  );
}
