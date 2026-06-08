'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Circle, Loader2, Plus, Trash2, Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { KanbanFaseSecaoTabs } from '@/components/kanban-shared/KanbanFaseSecaoTabs';
import {
  carregarLotesCondominioCard,
  salvarCampoLoteCondominio,
  salvarLotesCondominioDisponivel,
} from '@/lib/actions/kanban-lotes-disponiveis';
import { linhaProspectTemNome, type LinhaProspectCondominio } from '@/lib/kanban/condominio-prospect-pesquisa';
import {
  criarLoteDisponivelVazio,
  linhaLotesCondominioCompleta,
  loteDisponivelCompleto,
  LOTES_DISPONIVEIS_CAMPOS,
  LOTES_DISPONIVEIS_CHECKBOXES,
  rotuloLoteDisponivel,
  type ChaveLoteDisponivel,
  type LinhaLoteDisponivel,
} from '@/lib/kanban/lotes-disponiveis-condominio';

type Props = {
  cardId: string;
  itemLabel: string;
  obrigatorio?: boolean;
};

const inputClass =
  'w-full rounded-md border px-3 py-1.5 text-sm outline-none focus:ring-1' +
  ' bg-white border-[var(--moni-border-default)] text-[var(--moni-text-primary)]' +
  ' focus:ring-[var(--moni-primary-500)] focus:border-[var(--moni-primary-500)]';

export function LotesCondominioDisponiveis({ cardId, itemLabel, obrigatorio }: Props) {
  const [linhas, setLinhas] = useState<LinhaProspectCondominio[]>([]);
  const [rowIdAtivo, setRowIdAtivo] = useState<string | null>(null);
  const [loteIdAtivo, setLoteIdAtivo] = useState<string | null>(null);
  const [carregandoInicial, setCarregandoInicial] = useState(true);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [uploadLoteId, setUploadLoteId] = useState<string | null>(null);
  const [rascunhoLotes, setRascunhoLotes] = useState<LinhaLoteDisponivel[]>([]);
  const rowIdRascunhoRef = useRef<string | null>(null);

  const recarregar = useCallback(async (opts?: { silencioso?: boolean }) => {
    if (!opts?.silencioso) setCarregandoInicial(true);
    setErroCarregar(null);
    const res = await carregarLotesCondominioCard(cardId);
    if (!res.ok) {
      setErroCarregar(res.error);
      if (!opts?.silencioso) {
        setLinhas([]);
        setCarregandoInicial(false);
      }
      return;
    }
    setLinhas(res.linhas);
    const comNome = res.linhas.filter(linhaProspectTemNome);
    setRowIdAtivo((atual) => {
      if (atual && comNome.some((l) => l.row_id === atual)) return atual;
      return comNome[0]?.row_id ?? null;
    });
    if (!opts?.silencioso) setCarregandoInicial(false);
  }, [cardId]);

  useEffect(() => {
    rowIdRascunhoRef.current = null;
  }, [cardId]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const prospects = useMemo(() => linhas.filter(linhaProspectTemNome), [linhas]);
  const tabsCondominio = useMemo(
    () =>
      prospects.map((p) => ({
        id: p.row_id,
        label: `${p.condominio.trim()}${linhaLotesCondominioCompleta(p) ? ' ✓' : ''}`,
      })),
    [prospects],
  );
  const linhaAtiva = useMemo(
    () => linhas.find((l) => l.row_id === rowIdAtivo) ?? null,
    [linhas, rowIdAtivo],
  );

  useEffect(() => {
    if (!rowIdAtivo) {
      rowIdRascunhoRef.current = null;
      setRascunhoLotes([]);
      setLoteIdAtivo(null);
      return;
    }
    if (rowIdRascunhoRef.current === rowIdAtivo) return;
    rowIdRascunhoRef.current = rowIdAtivo;
    const linha = linhas.find((l) => l.row_id === rowIdAtivo);
    const lotes = linha?.lotes_disponiveis?.length ? [...linha.lotes_disponiveis] : [criarLoteDisponivelVazio()];
    setRascunhoLotes(lotes);
    setLoteIdAtivo(lotes[0]?.lote_id ?? null);
    setErroSalvar(null);
  }, [rowIdAtivo, linhas]);

  function aplicarLotesSalvosLocal(rowId: string, lotes: LinhaLoteDisponivel[]) {
    setLinhas((prev) =>
      prev.map((l) => {
        if (l.row_id !== rowId) return l;
        return { ...l, lotes_disponiveis: lotes };
      }),
    );
  }

  async function persistirLotes(lotes: LinhaLoteDisponivel[]) {
    if (!linhaAtiva) return;
    setSalvando(true);
    setErroSalvar(null);
    const res = await salvarLotesCondominioDisponivel({
      cardId,
      rowId: linhaAtiva.row_id,
      lotes,
    });
    setSalvando(false);
    if (!res.ok) {
      setErroSalvar(res.error);
      return;
    }
    aplicarLotesSalvosLocal(linhaAtiva.row_id, lotes);
  }

  async function salvarCampoBlur(loteId: string, chave: ChaveLoteDisponivel, valor: string) {
    if (!linhaAtiva) return;
    const lote = rascunhoLotes.find((l) => l.lote_id === loteId);
    if (!lote) return;
    const atual = String(lote[chave] ?? '').trim();
    if (valor.trim() === atual) return;

    setErroSalvar(null);
    const res = await salvarCampoLoteCondominio({
      cardId,
      rowId: linhaAtiva.row_id,
      loteId,
      chave,
      valor,
    });
    if (!res.ok) {
      setErroSalvar(res.error);
      return;
    }
    const novos = rascunhoLotes.map((l) => (l.lote_id === loteId ? { ...l, [chave]: valor } : l));
    setRascunhoLotes(novos);
    aplicarLotesSalvosLocal(linhaAtiva.row_id, novos);
  }

  async function adicionarLote() {
    if (!linhaAtiva) return;
    const novo = criarLoteDisponivelVazio();
    const novos = [...rascunhoLotes, novo];
    setRascunhoLotes(novos);
    setLoteIdAtivo(novo.lote_id);
    await persistirLotes(novos);
  }

  async function removerLote(loteId: string) {
    if (!linhaAtiva) return;
    const novos = rascunhoLotes.filter((l) => l.lote_id !== loteId);
    const finais = novos.length > 0 ? novos : [criarLoteDisponivelVazio()];
    setRascunhoLotes(finais);
    if (loteIdAtivo === loteId) setLoteIdAtivo(finais[0]?.lote_id ?? null);
    await persistirLotes(finais);
  }

  async function salvarFotosLote(loteId: string, file: File) {
    if (!linhaAtiva) return;
    setUploadLoteId(loteId);
    setErroSalvar(null);
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop() ?? 'bin';
      const path = `respostas/${cardId}/lotes-disponiveis/${linhaAtiva.row_id}/${loteId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('documentos-templates').upload(path, file, { upsert: true });
      if (error) {
        setErroSalvar(error.message);
        return;
      }
      setRascunhoLotes((prev) => prev.map((l) => (l.lote_id === loteId ? { ...l, fotos_path: path } : l)));
      await salvarCampoBlur(loteId, 'fotos_path', path);
    } finally {
      setUploadLoteId(null);
    }
  }

  const tabsLotes = useMemo(
    () =>
      rascunhoLotes.map((l) => ({
        id: l.lote_id,
        label: `${rotuloLoteDisponivel(l)}${loteDisponivelCompleto(l) ? ' ✓' : ''}`,
      })),
    [rascunhoLotes],
  );

  const loteAtivo = rascunhoLotes.find((l) => l.lote_id === loteIdAtivo) ?? rascunhoLotes[0] ?? null;

  return (
    <div className="space-y-4">
      <div>
        <span className="mb-1 block text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
          {itemLabel}
          {obrigatorio ? <span className="ml-1 text-red-500">*</span> : null}
          {salvando ? <Loader2 size={10} className="ml-1 inline animate-spin" /> : null}
        </span>
        <p className="text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
          Para cada condomínio da Tabela de Condomínios, cadastre um ou mais lotes disponíveis.
        </p>
      </div>

      {carregandoInicial ? (
        <div className="flex items-center gap-2 py-2 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
          <Loader2 size={12} className="animate-spin" />
          Carregando condomínios prospectados...
        </div>
      ) : erroCarregar ? (
        <p className="text-xs text-red-500">{erroCarregar}</p>
      ) : prospects.length === 0 ? (
        <p
          className="rounded-md border px-3 py-4 text-sm italic"
          style={{ borderColor: 'var(--moni-border-default)', color: 'var(--moni-text-tertiary)' }}
        >
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
                <BadgeConclusao completa={linhaLotesCondominioCompleta(linhaAtiva)} />
                {linhaAtiva.lotes_preenchidos_em ? (
                  <span className="text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
                    Atualizado em{' '}
                    {new Date(linhaAtiva.lotes_preenchidos_em).toLocaleString('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                ) : null}
              </div>

              {tabsLotes.length > 0 ? (
                <KanbanFaseSecaoTabs
                  tabs={tabsLotes}
                  abaAtiva={loteIdAtivo ?? tabsLotes[0]?.id ?? ''}
                  onAbaChange={(id) => setLoteIdAtivo(id || null)}
                  ariaLabel={`Lotes — ${linhaAtiva.condominio}`}
                >
                  {loteAtivo ? (
                    <section
                      className="rounded-lg border p-3 space-y-3"
                      style={{ borderColor: 'var(--moni-border-default)', background: 'var(--moni-surface-50)' }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--moni-text-secondary)' }}>
                          Dados do lote
                        </h4>
                        {rascunhoLotes.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => void removerLote(loteAtivo.lote_id)}
                            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] text-red-600 hover:bg-red-50"
                            style={{ borderColor: 'var(--moni-border-default)' }}
                          >
                            <Trash2 size={11} />
                            Remover
                          </button>
                        ) : null}
                      </div>

                      {LOTES_DISPONIVEIS_CAMPOS.filter((c) => c.tipo !== 'checkbox').map((campo) => {
                        const valor = String(loteAtivo[campo.chave] ?? '');

                        if (campo.tipo === 'anexo') {
                          return (
                            <div key={campo.chave}>
                              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                                {campo.label}
                                {campo.obrigatorio ? <span className="ml-1 text-red-500">*</span> : null}
                              </label>
                              <div className="flex flex-wrap items-center gap-2">
                                <label
                                  className="inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium hover:bg-stone-50"
                                  style={{ borderColor: 'var(--moni-border-default)', color: 'var(--moni-primary-600)' }}
                                >
                                  {uploadLoteId === loteAtivo.lote_id ? (
                                    <Loader2 size={12} className="animate-spin" />
                                  ) : (
                                    <Upload size={12} />
                                  )}
                                  {uploadLoteId === loteAtivo.lote_id ? 'Enviando…' : 'Enviar fotos'}
                                  <input
                                    type="file"
                                    accept="image/*,.pdf"
                                    className="sr-only"
                                    disabled={uploadLoteId === loteAtivo.lote_id}
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (f) void salvarFotosLote(loteAtivo.lote_id, f);
                                      e.target.value = '';
                                    }}
                                  />
                                </label>
                                {valor ? (
                                  <span className="max-w-[200px] truncate text-[10px] text-stone-500">
                                    {valor.split('/').pop()}
                                  </span>
                                ) : (
                                  <span className="text-[10px] italic text-stone-400">Nenhum arquivo</span>
                                )}
                              </div>
                            </div>
                          );
                        }

                        if (campo.tipo === 'texto_longo') {
                          return (
                            <div key={campo.chave}>
                              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                                {campo.label}
                              </label>
                              <textarea
                                rows={3}
                                className={inputClass + ' resize-none'}
                                value={valor}
                                placeholder={campo.placeholder ?? ''}
                                onChange={(e) =>
                                  setRascunhoLotes((prev) =>
                                    prev.map((l) =>
                                      l.lote_id === loteAtivo.lote_id ? { ...l, [campo.chave]: e.target.value } : l,
                                    ),
                                  )
                                }
                                onBlur={(e) => void salvarCampoBlur(loteAtivo.lote_id, campo.chave, e.target.value)}
                              />
                            </div>
                          );
                        }

                        return (
                          <div key={campo.chave}>
                            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                              {campo.label}
                              {campo.obrigatorio ? <span className="ml-1 text-red-500">*</span> : null}
                            </label>
                            <input
                              type={campo.tipo === 'numero' ? 'text' : 'text'}
                              inputMode={campo.tipo === 'numero' ? 'decimal' : undefined}
                              className={inputClass}
                              value={valor}
                              placeholder={campo.placeholder ?? ''}
                              onChange={(e) =>
                                setRascunhoLotes((prev) =>
                                  prev.map((l) =>
                                    l.lote_id === loteAtivo.lote_id ? { ...l, [campo.chave]: e.target.value } : l,
                                  ),
                                )
                              }
                              onBlur={(e) => void salvarCampoBlur(loteAtivo.lote_id, campo.chave, e.target.value)}
                            />
                          </div>
                        );
                      })}

                      <div>
                        <p
                          className="mb-2 text-xs font-medium"
                          style={{ color: 'var(--moni-text-primary)' }}
                        >
                          Atributos do lote
                        </p>
                        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                          {LOTES_DISPONIVEIS_CHECKBOXES.map((campo) => {
                            const valor = String(loteAtivo[campo.chave] ?? '');
                            return (
                              <label
                                key={campo.chave}
                                className="flex cursor-pointer items-center gap-2 text-sm"
                                style={{ color: 'var(--moni-text-primary)' }}
                              >
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 shrink-0 rounded"
                                  checked={valor === 'true'}
                                  onChange={(e) => {
                                    const v = e.target.checked ? 'true' : 'false';
                                    setRascunhoLotes((prev) =>
                                      prev.map((l) =>
                                        l.lote_id === loteAtivo.lote_id ? { ...l, [campo.chave]: v } : l,
                                      ),
                                    );
                                    void salvarCampoBlur(loteAtivo.lote_id, campo.chave, v);
                                  }}
                                />
                                {campo.label}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </section>
                  ) : null}
                </KanbanFaseSecaoTabs>
              ) : null}

              <button
                type="button"
                onClick={() => void adicionarLote()}
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium"
                style={{
                  borderColor: 'var(--moni-border-default)',
                  color: 'var(--moni-primary-600)',
                  background: 'white',
                }}
              >
                <Plus size={12} />
                Adicionar lote
              </button>
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
        Sessão completa
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">
      <Circle size={10} />
      Sessão incompleta
    </span>
  );
}
