'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, History } from 'lucide-react';
import type { RedeSubstituicaoRow } from '@/lib/rede-franqueado-substituicao';
import { formatNFranquiaRedeExibicao } from '@/lib/rede-franqueados';

type Props = {
  substituicoes: RedeSubstituicaoRow[];
};

function formatData(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export function RedeFranqueadoSubstituicoesHistorico({ substituicoes }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (!substituicoes.length) return null;

  return (
    <section className="mt-6 rounded-xl border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] p-4">
      <div className="mb-3 flex items-center gap-2">
        <History className="h-4 w-4 text-[color:var(--moni-text-tertiary)]" aria-hidden />
        <h2 className="text-sm font-semibold text-[color:var(--moni-navy-800)]">
          Histórico de substituições
        </h2>
        <span className="text-xs text-[color:var(--moni-text-tertiary)]">
          ({substituicoes.length} registro{substituicoes.length === 1 ? '' : 's'})
        </span>
      </div>
      <p className="mb-3 text-xs text-[color:var(--moni-text-secondary)]">
        Franqueados anteriores substituídos nesta unidade. Não aparecem na tabela operacional, mas o cadastro
        fica arquivado aqui.
      </p>
      <ul className="space-y-2">
        {substituicoes.map((s) => {
          const aberto = openId === s.id;
          const snap = s.snapshot;
          const nome =
            s.nome_anterior ??
            String(snap.nome_completo ?? '').trim() ??
            'Franqueado anterior';
          const fk = formatNFranquiaRedeExibicao(
            s.n_franquia_anterior ?? (snap.n_franquia as string | null),
            typeof snap.ordem === 'number' ? snap.ordem : null,
          );
          return (
            <li
              key={s.id}
              className="rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-50)]"
            >
              <button
                type="button"
                onClick={() => setOpenId(aberto ? null : s.id)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
              >
                <span className="text-sm font-medium text-[color:var(--moni-text-primary)]">
                  {fk ? `${fk} · ` : ''}
                  {nome}
                </span>
                <span className="flex items-center gap-2 text-[10px] text-[color:var(--moni-text-tertiary)]">
                  {formatData(s.substituido_em)}
                  {aberto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </span>
              </button>
              {aberto ? (
                <div className="border-t border-[color:var(--moni-border-default)] px-3 py-2 text-xs text-[color:var(--moni-text-secondary)]">
                  <dl className="grid gap-1 sm:grid-cols-2">
                    {(
                      [
                        ['Status', snap.status_franquia],
                        ['E-mail', snap.email_frank],
                        ['Telefone', snap.telefone_frank],
                        ['Regional', snap.regional],
                        ['Área', snap.area_atuacao],
                        ['Classificação', snap.classificacao_franqueado],
                      ] as [string, unknown][]
                    ).map(([lab, val]) =>
                      val != null && String(val).trim() !== '' ? (
                        <div key={lab}>
                          <dt className="font-semibold text-[color:var(--moni-text-tertiary)]">{lab}</dt>
                          <dd>{String(val)}</dd>
                        </div>
                      ) : null,
                    )}
                  </dl>
                  {s.processo_step_one_id ? (
                    <p className="mt-2 text-[10px] text-[color:var(--moni-text-tertiary)]">
                      Processo Step One arquivado: {s.processo_step_one_id.slice(0, 8)}…
                    </p>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
