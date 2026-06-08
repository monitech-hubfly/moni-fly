'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { KanbanFaseSecaoTabs } from '@/components/kanban-shared/KanbanFaseSecaoTabs';
import {
  carregarProspectsCondominioCard,
  salvarPesquisaCondominioProspect,
} from '@/lib/actions/kanban-condominio-pesquisa';
import {
  CHAVES_PESQUISA_OBRIGATORIAS,
  linhaPesquisaCompleta,
  linhaProspectTemNome,
  PESQUISA_CONDOMINIO_SECOES,
  rotuloFontePesquisa,
  type ChavePesquisaCondominio,
  type LinhaProspectCondominio,
} from '@/lib/kanban/condominio-prospect-pesquisa';

type Props = {
  cardId: string;
  itemLabel: string;
  obrigatorio?: boolean;
};

const inputClass =
  'w-full rounded-md border px-3 py-1.5 text-sm outline-none focus:ring-1' +
  ' bg-white border-[var(--moni-border-default)] text-[var(--moni-text-primary)]' +
  ' focus:ring-[var(--moni-primary-500)] focus:border-[var(--moni-primary-500)]';

export function PesquisaCondominioProspect({ cardId, itemLabel, obrigatorio }: Props) {
  const [linhas, setLinhas] = useState<LinhaProspectCondominio[]>([]);
  const [rowIdAtivo, setRowIdAtivo] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [salvandoSecao, setSalvandoSecao] = useState<string | null>(null);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<Partial<Record<ChavePesquisaCondominio, string>>>({});

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErroCarregar(null);
    const res = await carregarProspectsCondominioCard(cardId);
    if (!res.ok) {
      setErroCarregar(res.error);
      setLinhas([]);
      setCarregando(false);
      return;
    }
    setLinhas(res.linhas);
    const comNome = res.linhas.filter(linhaProspectTemNome);
    setRowIdAtivo((atual) => {
      if (atual && comNome.some((l) => l.row_id === atual)) return atual;
      return comNome[0]?.row_id ?? null;
    });
    setCarregando(false);
  }, [cardId]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const prospects = useMemo(() => linhas.filter(linhaProspectTemNome), [linhas]);
  const tabsCondominio = useMemo(
    () =>
      prospects.map((p) => ({
        id: p.row_id,
        label: `${p.condominio.trim()}${linhaPesquisaCompleta(p) ? ' ✓' : ''}`,
      })),
    [prospects],
  );
  const linhaAtiva = useMemo(
    () => linhas.find((l) => l.row_id === rowIdAtivo) ?? null,
    [linhas, rowIdAtivo],
  );

  useEffect(() => {
    if (!linhaAtiva) {
      setRascunho({});
      return;
    }
    const draft: Partial<Record<ChavePesquisaCondominio, string>> = {};
    for (const chave of CHAVES_PESQUISA_OBRIGATORIAS) {
      draft[chave] = linhaAtiva[chave] ?? '';
    }
    setRascunho(draft);
    setErroSalvar(null);
  }, [linhaAtiva]);

  async function salvarSecao(secaoId: string) {
    if (!linhaAtiva) return;
    setSalvandoSecao(secaoId);
    setErroSalvar(null);
    const secao = PESQUISA_CONDOMINIO_SECOES.find((s) => s.id === secaoId);
    if (!secao) {
      setSalvandoSecao(null);
      return;
    }
    const respostas: Partial<Record<ChavePesquisaCondominio, string>> = {};
    for (const p of secao.perguntas) {
      respostas[p.chave] = rascunho[p.chave] ?? '';
    }
    const res = await salvarPesquisaCondominioProspect({
      cardId,
      rowId: linhaAtiva.row_id,
      respostas,
    });
    setSalvandoSecao(null);
    if (!res.ok) {
      setErroSalvar(res.error);
      return;
    }
    await recarregar();
  }

  async function salvarCampoBlur(chave: ChavePesquisaCondominio, valor: string) {
    if (!linhaAtiva) return;
    const atual = linhaAtiva[chave] ?? '';
    if (valor.trim() === atual.trim()) return;
    setErroSalvar(null);
    const res = await salvarPesquisaCondominioProspect({
      cardId,
      rowId: linhaAtiva.row_id,
      respostas: { [chave]: valor },
    });
    if (!res.ok) {
      setErroSalvar(res.error);
      return;
    }
    await recarregar();
  }

  return (
    <div className="space-y-4">
      <div>
        <span className="mb-1 block text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
          {itemLabel}
          {obrigatorio ? <span className="ml-1 text-red-500">*</span> : null}
        </span>
      </div>

      {carregando ? (
        <div className="flex items-center gap-2 py-2 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
          <Loader2 size={12} className="animate-spin" />
          Carregando condomínios prospectados...
        </div>
      ) : erroCarregar ? (
        <p className="text-xs text-red-500">{erroCarregar}</p>
      ) : prospects.length === 0 ? (
        <p className="rounded-md border px-3 py-4 text-sm italic" style={{ borderColor: 'var(--moni-border-default)', color: 'var(--moni-text-tertiary)' }}>
          Preencha a Tabela de Condomínios na fase Dados da Cidade primeiro.
        </p>
      ) : (
        <KanbanFaseSecaoTabs
          tabs={tabsCondominio}
          abaAtiva={rowIdAtivo ?? tabsCondominio[0]?.id ?? ''}
          onAbaChange={(id) => setRowIdAtivo(id || null)}
          ariaLabel="Condomínios prospectados"
        >
          {linhaAtiva ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <BadgeConclusao completa={linhaPesquisaCompleta(linhaAtiva)} />
                {linhaAtiva.pesquisa_preenchida_em ? (
                  <span className="text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
                    Preenchida em{' '}
                    {new Date(linhaAtiva.pesquisa_preenchida_em).toLocaleString('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                ) : null}
              </div>

              {PESQUISA_CONDOMINIO_SECOES.map((secao) => (
                <section
                  key={secao.id}
                  className="rounded-lg border p-3"
                  style={{ borderColor: 'var(--moni-border-default)', background: 'var(--moni-surface-50)' }}
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--moni-text-secondary)' }}>
                      {secao.titulo}
                    </h4>
                    <button
                      type="button"
                      disabled={salvandoSecao === secao.id}
                      onClick={() => void salvarSecao(secao.id)}
                      className="rounded-md border px-2 py-1 text-[11px] font-medium disabled:opacity-50"
                      style={{
                        borderColor: 'var(--moni-border-default)',
                        color: 'var(--moni-primary-600)',
                        background: 'white',
                      }}
                    >
                      {salvandoSecao === secao.id ? (
                        <span className="inline-flex items-center gap-1">
                          <Loader2 size={10} className="animate-spin" />
                          Salvando...
                        </span>
                      ) : (
                        'Salvar seção'
                      )}
                    </button>
                  </div>

                  <div className="space-y-3">
                    {secao.perguntas.map((pergunta) => (
                      <div key={pergunta.chave}>
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <label className="text-xs font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                            {pergunta.label}
                          </label>
                          <span
                            className="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase"
                            style={{
                              background:
                                pergunta.fonte === 'online'
                                  ? 'var(--moni-primary-50, #eef2ff)'
                                  : pergunta.fonte === 'corretor'
                                    ? 'var(--moni-surface-100)'
                                    : '#fef3c7',
                              color:
                                pergunta.fonte === 'online'
                                  ? 'var(--moni-primary-700, #4338ca)'
                                  : pergunta.fonte === 'corretor'
                                    ? 'var(--moni-text-secondary)'
                                    : '#92400e',
                            }}
                          >
                            {rotuloFontePesquisa(pergunta.fonte)}
                          </span>
                          {pergunta.destaque ? (
                            <span className="text-[10px] font-medium uppercase text-amber-700">Destaque</span>
                          ) : null}
                        </div>
                        {pergunta.tipo === 'texto_longo' ? (
                          <textarea
                            rows={3}
                            className={inputClass + ' resize-none'}
                            value={rascunho[pergunta.chave] ?? ''}
                            onChange={(e) =>
                              setRascunho((prev) => ({ ...prev, [pergunta.chave]: e.target.value }))
                            }
                            onBlur={(e) => void salvarCampoBlur(pergunta.chave, e.target.value)}
                          />
                        ) : (
                          <input
                            type="text"
                            className={inputClass}
                            value={rascunho[pergunta.chave] ?? ''}
                            onChange={(e) =>
                              setRascunho((prev) => ({ ...prev, [pergunta.chave]: e.target.value }))
                            }
                            onBlur={(e) => void salvarCampoBlur(pergunta.chave, e.target.value)}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : null}
        </KanbanFaseSecaoTabs>
      )}

      {erroSalvar ? <p className="text-xs text-red-500">{erroSalvar}</p> : null}
    </div>
  );
}

function BadgeConclusao({ completa }: { completa: boolean }) {
  if (completa) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
        <CheckCircle2 size={12} />
        Pesquisa completa
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">
      <Circle size={10} />
      Pesquisa incompleta
    </span>
  );
}
