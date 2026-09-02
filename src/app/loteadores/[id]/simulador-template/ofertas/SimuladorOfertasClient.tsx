'use client';

import {
  formatarMoedaBr,
  type SimulacaoPagamentoResumo,
} from '@/lib/loteamento-simulador-template';

type Props = {
  cardId: string;
  ofertas: SimulacaoPagamentoResumo[];
};

function formatarQuando(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function SimuladorOfertasClient({ cardId, ofertas }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <h2
        className="text-lg"
        style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
      >
        Ofertas salvas
      </h2>

      {ofertas.length === 0 ? (
        <div
          className="rounded-[var(--moni-radius-lg)] p-5"
          style={{
            border: 'var(--moni-border-width) solid var(--moni-border-default)',
            background: 'var(--moni-surface-0)',
            boxShadow: 'var(--moni-shadow-card)',
          }}
        >
          <p className="text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
            Nenhuma oferta ainda. Use a calculadora abaixo para criar a primeira.
          </p>
        </div>
      ) : (
        <div
          className="overflow-x-auto rounded-[var(--moni-radius-lg)]"
          style={{ border: 'var(--moni-border-width) solid var(--moni-border-default)' }}
        >
          <table className="min-w-full text-left text-sm" style={{ fontFamily: 'var(--moni-font-sans)' }}>
            <thead>
              <tr style={{ color: 'var(--moni-text-tertiary)' }}>
                <th className="px-3 py-2 font-medium">Nome</th>
                <th className="px-3 py-2 font-medium">Quando</th>
                <th className="px-3 py-2 font-medium">Lote</th>
                <th className="px-3 py-2 font-medium">Casa</th>
                <th className="px-3 py-2 font-medium">Prazo</th>
                <th className="px-3 py-2 font-medium">Acessar</th>
              </tr>
            </thead>
            <tbody>
              {ofertas.map((o) => (
                <tr
                  key={o.id}
                  style={{
                    borderTop: 'var(--moni-border-width) solid var(--moni-border-default)',
                    color: 'var(--moni-text-secondary)',
                  }}
                >
                  <td className="px-3 py-2">{o.nome?.trim() || 'Sem nome'}</td>
                  <td className="whitespace-nowrap px-3 py-2">{formatarQuando(o.created_at)}</td>
                  <td className="whitespace-nowrap px-3 py-2">{formatarMoedaBr(o.valor_lote)}</td>
                  <td className="whitespace-nowrap px-3 py-2">{formatarMoedaBr(o.valor_casa)}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {o.prazo_meses != null ? `${o.prazo_meses} meses` : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <a
                      href={`/loteadores/${cardId}/simulador-template/ofertas/${o.id}`}
                      style={{ color: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-sans)' }}
                      className="text-xs underline hover:opacity-70"
                    >
                      Abrir
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
