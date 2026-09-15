'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { existeSimuladorTemplateDoCard } from '@/lib/loteamento-simulador-template';
import type { SimulacaoPagamentoResumo } from '@/lib/loteamento-simulador-template';
import {
  simuladorTemplateMarcadoNoCliente,
  subscribeSimuladorCardUi,
} from '@/lib/simulador/simulador-card-ui-state';
import { createClient } from '@/lib/supabase/client';

type Props = {
  cardId: string;
};

const btnCls =
  'inline-flex items-center justify-center rounded-[var(--moni-radius-md)] px-3 py-1.5 text-xs font-medium';

const fontSans = { fontFamily: 'var(--moni-font-sans)' } as const;

const btnOutlineStyle = {
  ...fontSans,
  border: 'var(--moni-border-width) solid var(--moni-border-default)',
  background: 'transparent',
  color: 'var(--moni-text-primary)',
} as const;

const btnPrimaryStyle = {
  ...fontSans,
  background: 'var(--moni-navy-800)',
  color: 'var(--moni-text-inverse)',
} as const;

export function KanbanCardModalSimuladorPagamentos({ cardId }: Props) {
  const pathname = usePathname();
  const [carregando, setCarregando] = useState(!simuladorTemplateMarcadoNoCliente(cardId));
  const [templateSalvo, setTemplateSalvo] = useState(() => simuladorTemplateMarcadoNoCliente(cardId));
  const [ofertas, setOfertas] = useState<SimulacaoPagamentoResumo[]>([]);
  const [listaAberta, setListaAberta] = useState(false);

  const hrefTemplate = `/loteadores/${cardId}/simulador-template`;
  const hrefOfertas = `/loteadores/${cardId}/simulador-template/ofertas`;

  useEffect(() => {
    let ativo = true;
    const aplicarLocal = () => {
      if (simuladorTemplateMarcadoNoCliente(cardId)) setTemplateSalvo(true);
    };
    aplicarLocal();
    const carregar = (marcarLoading: boolean) => {
      if (marcarLoading && !simuladorTemplateMarcadoNoCliente(cardId)) setCarregando(true);
      void existeSimuladorTemplateDoCard(createClient(), cardId)
        .then((existe) => {
          if (!ativo) return;
          setTemplateSalvo(existe || simuladorTemplateMarcadoNoCliente(cardId));
          setCarregando(false);
        })
        .catch(() => {
          if (!ativo) return;
          setCarregando(false);
        });
    };
    carregar(true);
    const unsub = subscribeSimuladorCardUi(cardId, aplicarLocal);
    const onVisivel = () => {
      if (document.visibilityState === 'hidden') return;
      aplicarLocal();
      carregar(false);
    };
    window.addEventListener('focus', onVisivel);
    window.addEventListener('pageshow', onVisivel);
    document.addEventListener('visibilitychange', onVisivel);
    return () => {
      ativo = false;
      unsub();
      window.removeEventListener('focus', onVisivel);
      window.removeEventListener('pageshow', onVisivel);
      document.removeEventListener('visibilitychange', onVisivel);
    };
  }, [cardId, pathname]);

  const ofertasComNome = ofertas.filter((o) => Boolean(o.nome?.trim()));

  return (
    <>
      <p className="mb-3 text-xs" style={{ color: 'var(--moni-text-tertiary)', ...fontSans }}>
        Incorporação em nuvem - Criar template e ofertas para venda dos lotes
      </p>
      {carregando ? (
        <p className="text-[11px]" style={{ color: 'var(--moni-text-tertiary)', ...fontSans }}>
          Carregando…
        </p>
      ) : !templateSalvo ? (
        <Link href={hrefTemplate} className={btnCls} style={btnPrimaryStyle}>
          Configurar template e gerar link
        </Link>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={hrefTemplate} className={btnCls} style={btnOutlineStyle}>
              Acessar template
            </Link>
            <Link href={hrefOfertas} className={btnCls} style={btnPrimaryStyle}>
              Criar oferta
            </Link>
          </div>
          {ofertasComNome.length > 0 ? (
            <div>
              <button
                type="button"
                onClick={() => setListaAberta((v) => !v)}
                className="text-left text-xs font-medium"
                aria-expanded={listaAberta}
                style={{
                  color: 'var(--moni-navy-800)',
                  ...fontSans,
                  background: 'transparent',
                }}
              >
                {listaAberta ? '▾' : '▸'} Ofertas criadas ({ofertasComNome.length})
              </button>
              {listaAberta ? (
                <ul className="mt-1 flex flex-col">
                  {ofertasComNome.map((o) => (
                    <li key={o.id}>
                      <Link
                        href={`/loteadores/${cardId}/simulador-template/ofertas/${o.id}`}
                        className="block cursor-pointer rounded-[var(--moni-radius-sm)] px-2 py-1 text-xs transition-opacity hover:opacity-70"
                        style={{
                          color: 'var(--moni-text-secondary)',
                          ...fontSans,
                        }}
                      >
                        {o.nome?.trim() || 'Oferta sem nome'}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}
