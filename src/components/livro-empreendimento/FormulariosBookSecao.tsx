'use client';

import { useEffect, useState } from 'react';
import { FormularioRespostaCorpo } from '@/components/formularios/FormularioRespostaCorpo';
import { carregarLeituraResposta, listarRespostasDoCard, type LeituraFormularioResposta } from '@/lib/actions/formulario-actions';

type GrupoFormulario = {
  id: string;
  nome: string;
  leituras: LeituraFormularioResposta[];
};

export function FormulariosBookSecao({ cardId }: { cardId: string }) {
  const [grupos, setGrupos] = useState<GrupoFormulario[] | null>(null);

  useEffect(() => {
    let ativo = true;
    setGrupos(null);
    void (async () => {
      const lista = await listarRespostasDoCard(cardId);
      const enviadas = lista.filter((item) => item.status === 'enviado');
      const leituras = (
        await Promise.all(enviadas.map((item) => carregarLeituraResposta(item.id)))
      ).filter((item): item is LeituraFormularioResposta => Boolean(item));
      if (!ativo) return;
      const porFormulario = new Map<string, GrupoFormulario>();
      for (const leitura of leituras) {
        const id = leitura.resposta.formulario_id;
        const atual = porFormulario.get(id) ?? {
          id,
          nome: leitura.formularioNome || 'Formulário',
          leituras: [],
        };
        atual.leituras.push(leitura);
        porFormulario.set(id, atual);
      }
      setGrupos([...porFormulario.values()]);
    })();
    return () => {
      ativo = false;
    };
  }, [cardId]);

  if (!grupos || grupos.length === 0) return null;

  return (
    <section className="mb-6 rounded-xl border border-[var(--moni-border)] bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-[var(--moni-navy-800)]">Formulários</h2>
      <p className="mb-5 text-xs text-stone-400">Respostas já enviadas neste card, separadas por formulário.</p>
      <div className="space-y-8">
        {grupos.map((grupo) => (
          <div key={grupo.id}>
            <h3 className="mb-3 text-base text-[var(--moni-navy-800)]" style={{ fontFamily: 'var(--moni-font-display)' }}>
              {grupo.nome}
            </h3>
            <div className="space-y-6">
              {grupo.leituras.map((leitura) => (
                <FormularioRespostaCorpo
                  key={leitura.resposta.id}
                  secoes={leitura.secoes}
                  dados={leitura.resposta.dados}
                  somentePreenchidos
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
