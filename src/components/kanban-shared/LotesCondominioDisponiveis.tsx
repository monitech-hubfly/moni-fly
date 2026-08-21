'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { CheckCircle2, Circle, Loader2, Plus, Trash2, Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { KanbanFaseSecaoTabs } from '@/components/kanban-shared/KanbanFaseSecaoTabs';
import {
  carregarLotesCondominioCard,
  salvarCampoLoteCondominio,
  salvarLoteEscolhidoCondominio,
  salvarLotesCondominioDisponivel,
} from '@/lib/actions/kanban-lotes-disponiveis';
import {
  prospectsOrdenadosPorTicketCasas,
  type LinhaProspectCondominio,
} from '@/lib/kanban/condominio-prospect-pesquisa';
import {
  criarLoteDisponivelVazio,
  linhaLotesCondominioCompleta,
  linhaTemLoteEscolhido,
  LOTES_DISPONIVEIS_CAMPOS,
  LOTES_DISPONIVEIS_CHECKBOXES_LOCALIZACAO,
  LOTES_DISPONIVEIS_CHECKBOXES_TOPOGRAFIA,
  CHAVES_TOPOGRAFIA_LOTE,
  formatValorLoteCampo,
  normalizarValorLoteDigitacao,
  parseFotosLotePaths,
  rotuloArquivoFoto,
  rotuloLoteDisponivel,
  serializarFotosLotePaths,
  type ChaveLoteCheckbox,
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
  const rascunhoLotesRef = useRef<LinhaLoteDisponivel[]>([]);
  const linhasRef = useRef<LinhaProspectCondominio[]>([]);
  const saveChainRef = useRef(Promise.resolve());
  const fotosInputRef = useRef<HTMLInputElement>(null);
  const fotosUploadLoteIdRef = useRef<string | null>(null);
  const rowIdAtivoRef = useRef<string | null>(null);
  const salvarFotosLoteRef = useRef<(loteId: string, files: File[]) => Promise<void>>(async () => {});

  useEffect(() => {
    rascunhoLotesRef.current = rascunhoLotes;
  }, [rascunhoLotes]);

  useEffect(() => {
    rowIdAtivoRef.current = rowIdAtivo;
  }, [rowIdAtivo]);

  useEffect(() => {
    linhasRef.current = linhas;
  }, [linhas]);

  function enfileirarPersistirRascunho(rowId: string) {
    saveChainRef.current = saveChainRef.current
      .catch(() => undefined)
      .then(async () => {
        const lotes = rascunhoLotesRef.current;
        setSalvando(true);
        setErroSalvar(null);
        const res = await salvarLotesCondominioDisponivel({ cardId, rowId, lotes });
        setSalvando(false);
        if (!res.ok) {
          setErroSalvar(res.error);
          return;
        }
        aplicarLotesSalvosLocal(rowId, lotes);
      });
  }

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
    const comNome = prospectsOrdenadosPorTicketCasas(res.linhas);
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

  const prospects = useMemo(() => prospectsOrdenadosPorTicketCasas(linhas), [linhas]);
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

  function aplicarLotesSalvosLocal(
    rowId: string,
    lotes: LinhaLoteDisponivel[],
    loteEscolhidoId?: string | null,
  ) {
    setLinhas((prev) =>
      prev.map((l) => {
        if (l.row_id !== rowId) return l;
        const escolhidoId = loteEscolhidoId !== undefined ? loteEscolhidoId : l.lote_escolhido_id;
        const escolhidoValido =
          escolhidoId && lotes.some((lot) => lot.lote_id === escolhidoId) ? escolhidoId : null;
        return {
          ...l,
          lotes_disponiveis: lotes,
          lote_escolhido_id: escolhidoValido,
        };
      }),
    );
  }

  async function marcarLoteEscolhido(loteId: string) {
    if (!linhaAtiva) return;
    setSalvando(true);
    setErroSalvar(null);
    const res = await salvarLoteEscolhidoCondominio({
      cardId,
      rowId: linhaAtiva.row_id,
      loteId,
    });
    setSalvando(false);
    if (!res.ok) {
      setErroSalvar(res.error);
      return;
    }
    aplicarLotesSalvosLocal(linhaAtiva.row_id, rascunhoLotes, loteId);
  }

  async function persistirLotesParaRow(rowId: string, lotes: LinhaLoteDisponivel[]) {
    setSalvando(true);
    setErroSalvar(null);
    const res = await salvarLotesCondominioDisponivel({
      cardId,
      rowId,
      lotes,
    });
    setSalvando(false);
    if (!res.ok) {
      setErroSalvar(res.error);
      return false;
    }
    aplicarLotesSalvosLocal(rowId, lotes);
    return true;
  }

  async function persistirLotes(lotes: LinhaLoteDisponivel[]) {
    const rowId = rowIdAtivoRef.current;
    if (!rowId) return;
    await persistirLotesParaRow(rowId, lotes);
  }

  function salvarCampoBlur(loteId: string, chave: ChaveLoteDisponivel, valor: string) {
    const rowId = rowIdAtivo;
    if (!rowId) return;
    const linha = linhasRef.current.find((l) => l.row_id === rowId);
    if (!linha) return;
    const lotePersistido = linha.lotes_disponiveis?.find((l) => l.lote_id === loteId);
    const atualPersistido = String(lotePersistido?.[chave] ?? '').trim();
    if (valor.trim() === atualPersistido) return;
    enfileirarPersistirRascunho(rowId);
  }

  function aplicarCheckboxSalvoLocal(
    rowId: string,
    loteId: string,
    updates: Partial<Record<ChaveLoteCheckbox, string>>,
  ) {
    const patchLote = (l: LinhaLoteDisponivel) =>
      l.lote_id === loteId ? { ...l, ...updates } : l;

    setLinhas((prev) =>
      prev.map((linha) =>
        linha.row_id !== rowId
          ? linha
          : { ...linha, lotes_disponiveis: (linha.lotes_disponiveis ?? []).map(patchLote) },
      ),
    );
    if (rowIdRascunhoRef.current === rowId) {
      setRascunhoLotes((prev) => {
        const next = prev.map(patchLote);
        rascunhoLotesRef.current = next;
        return next;
      });
    }
  }

  function enfileirarSalvarCheckbox(
    rowId: string,
    loteId: string,
    chave: ChaveLoteCheckbox,
    checked: boolean,
  ) {
    const valor = checked ? 'true' : 'false';
    saveChainRef.current = saveChainRef.current
      .catch(() => undefined)
      .then(async () => {
        setSalvando(true);
        setErroSalvar(null);
        const res = await salvarCampoLoteCondominio({
          cardId,
          rowId,
          loteId,
          chave,
          valor,
        });
        setSalvando(false);
        if (!res.ok) {
          setErroSalvar(res.error);
          return;
        }
        aplicarCheckboxSalvoLocal(rowId, loteId, { [chave]: valor });
      });
  }

  function handleSalvarCheckbox(loteId: string, chave: ChaveLoteCheckbox, checked: boolean) {
    const rowId = rowIdAtivo;
    if (!rowId) return;

    const isTopografia = (CHAVES_TOPOGRAFIA_LOTE as readonly string[]).includes(chave);
    const updates: Partial<Record<ChaveLoteCheckbox, string>> = {};

    if (isTopografia) {
      for (const k of CHAVES_TOPOGRAFIA_LOTE) {
        updates[k] = k === chave && checked ? 'true' : 'false';
      }
    } else {
      updates[chave] = checked ? 'true' : 'false';
    }

    setRascunhoLotes((prev) => {
      const next = prev.map((l) => (l.lote_id === loteId ? { ...l, ...updates } : l));
      rascunhoLotesRef.current = next;
      return next;
    });

    if (isTopografia) {
      for (const k of CHAVES_TOPOGRAFIA_LOTE) {
        enfileirarSalvarCheckbox(rowId, loteId, k, k === chave && checked);
      }
    } else {
      enfileirarSalvarCheckbox(rowId, loteId, chave, checked);
    }
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

  function abrirSeletorFotos(loteId: string, e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (uploadLoteId) return;
    fotosUploadLoteIdRef.current = loteId;
    fotosInputRef.current?.click();
  }

  function aplicarFotosLoteLocal(loteId: string, paths: string[]) {
    const serializado = serializarFotosLotePaths(paths);
    const next = rascunhoLotesRef.current.map((l) =>
      l.lote_id === loteId ? { ...l, fotos_path: serializado } : l,
    );
    rascunhoLotesRef.current = next;
    setRascunhoLotes(next);
    return next;
  }

  async function salvarFotosLote(loteId: string, files: File[]) {
    const rowId = rowIdAtivoRef.current;
    if (!rowId) {
      setErroSalvar('Selecione um condomínio antes de enviar fotos.');
      return;
    }
    if (files.length === 0) return;

    setUploadLoteId(loteId);
    setErroSalvar(null);
    try {
      const supabase = createClient();
      const loteAtual = rascunhoLotesRef.current.find((l) => l.lote_id === loteId);
      const pathsAtuais = parseFotosLotePaths(loteAtual?.fotos_path);
      const novosPaths = [...pathsAtuais];
      const baseTs = Date.now();

      for (let i = 0; i < files.length; i++) {
        const file = files[i]!;
        const ext = file.name.split('.').pop() ?? 'bin';
        const path = `respostas/${cardId}/lotes-disponiveis/${rowId}/${loteId}/${baseTs}-${i}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from('documentos-templates').upload(path, file, { upsert: true });
        if (error) {
          setErroSalvar(error.message);
          if (novosPaths.length > pathsAtuais.length) {
            const lotesComParcial = aplicarFotosLoteLocal(loteId, novosPaths);
            await persistirLotesParaRow(rowId, lotesComParcial);
          }
          return;
        }
        novosPaths.push(path);
      }

      const lotesAtualizados = aplicarFotosLoteLocal(loteId, novosPaths);
      const ok = await persistirLotesParaRow(rowId, lotesAtualizados);
      if (!ok) {
        setErroSalvar((atual) => atual ?? 'Fotos enviadas, mas não foi possível salvar no card.');
      }
    } finally {
      setUploadLoteId(null);
    }
  }

  salvarFotosLoteRef.current = salvarFotosLote;

  useEffect(() => {
    const input = fotosInputRef.current;
    if (!input) return;
    const onInputChange = () => {
      const files = Array.from(input.files ?? []);
      const loteId = fotosUploadLoteIdRef.current;
      fotosUploadLoteIdRef.current = null;
      input.value = '';
      if (!loteId) {
        if (files.length > 0) {
          setErroSalvar('Não foi possível identificar o lote. Clique em Enviar fotos novamente.');
        }
        return;
      }
      if (files.length === 0) return;
      void salvarFotosLoteRef.current(loteId, files);
    };
    input.addEventListener('change', onInputChange);
    return () => input.removeEventListener('change', onInputChange);
  }, [cardId]);

  function removerFotoLote(loteId: string, index: number) {
    const rowId = rowIdAtivoRef.current;
    if (!rowId) return;
    const loteAtual = rascunhoLotesRef.current.find((l) => l.lote_id === loteId);
    const paths = parseFotosLotePaths(loteAtual?.fotos_path);
    const lotesAtualizados = aplicarFotosLoteLocal(
      loteId,
      paths.filter((_, i) => i !== index),
    );
    void persistirLotesParaRow(rowId, lotesAtualizados);
  }

  const tabsLotes = useMemo(
    () =>
      rascunhoLotes.map((l) => ({
        id: l.lote_id,
        label: `${rotuloLoteDisponivel(l)}${
          linhaAtiva?.lote_escolhido_id === l.lote_id ? ' ★' : ''
        }`,
      })),
    [rascunhoLotes, linhaAtiva?.lote_escolhido_id],
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
          Para cada condomínio da Tabela de Condomínios, cadastre os lotes e marque{' '}
          <strong>1 lote escolhido</strong> para seguir no funil.
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
                {!linhaTemLoteEscolhido(linhaAtiva) ? (
                  <span className="text-[11px] font-medium text-amber-700">
                    Marque o lote escolhido abaixo
                  </span>
                ) : null}
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
                      <label
                        className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium ${
                          linhaAtiva.lote_escolhido_id === loteAtivo.lote_id
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                            : 'border-stone-200 bg-white text-stone-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`lote-escolhido-${linhaAtiva.row_id}`}
                          checked={linhaAtiva.lote_escolhido_id === loteAtivo.lote_id}
                          onChange={() => void marcarLoteEscolhido(loteAtivo.lote_id)}
                          className="h-4 w-4 shrink-0 border-stone-300 text-emerald-600"
                        />
                        Lote escolhido para seguir
                      </label>

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
                          const fotosPaths = parseFotosLotePaths(valor);
                          const enviandoFotos = uploadLoteId === loteAtivo.lote_id;
                          return (
                            <div key={campo.chave}>
                              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                                {campo.label}
                                {campo.obrigatorio ? <span className="ml-1 text-red-500">*</span> : null}
                              </label>
                              <div className="space-y-2">
                                {fotosPaths.length > 0 ? (
                                  <ul className="space-y-1">
                                    {fotosPaths.map((path, idx) => (
                                      <li
                                        key={`${path}-${idx}`}
                                        className="flex items-center gap-2 rounded-md border px-2 py-1 text-[10px]"
                                        style={{
                                          borderColor: 'var(--moni-border-default)',
                                          background: 'var(--moni-surface-0)',
                                          color: 'var(--moni-text-secondary)',
                                        }}
                                      >
                                        <span className="min-w-0 flex-1 truncate">{rotuloArquivoFoto(path)}</span>
                                        <button
                                          type="button"
                                          disabled={enviandoFotos}
                                          onClick={() => removerFotoLote(loteAtivo.lote_id, idx)}
                                          className="shrink-0 text-red-600 hover:underline disabled:opacity-50"
                                        >
                                          Remover
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-[10px] italic" style={{ color: 'var(--moni-text-tertiary)' }}>
                                    Nenhuma foto anexada
                                  </p>
                                )}
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={enviandoFotos}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={(e) => abrirSeletorFotos(loteAtivo.lote_id, e)}
                                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
                                    style={{
                                      borderColor: 'var(--moni-border-default)',
                                      color: 'var(--moni-primary-600)',
                                    }}
                                  >
                                    {enviandoFotos ? (
                                      <Loader2 size={12} className="animate-spin" />
                                    ) : (
                                      <Upload size={12} />
                                    )}
                                    {enviandoFotos
                                      ? 'Enviando…'
                                      : fotosPaths.length > 0
                                        ? 'Adicionar fotos'
                                        : 'Enviar fotos'}
                                  </button>
                                  <span className="text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
                                    Uma ou várias por vez
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        if (campo.chave === 'valor') {
                          const valorFmt = formatValorLoteCampo(valor);
                          return (
                            <div key={campo.chave}>
                              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                                {campo.label}
                                {campo.obrigatorio ? <span className="ml-1 text-red-500">*</span> : null}
                              </label>
                              <div
                                className="flex w-full items-center overflow-hidden rounded-md border bg-white focus-within:border-[var(--moni-primary-500)] focus-within:ring-1 focus-within:ring-[var(--moni-primary-500)]"
                                style={{
                                  borderColor: 'var(--moni-border-default)',
                                }}
                              >
                                <span
                                  className="shrink-0 border-r px-3 py-1.5 text-sm font-medium"
                                  style={{
                                    borderColor: 'var(--moni-border-default)',
                                    color: 'var(--moni-text-secondary)',
                                    background: 'var(--moni-surface-50)',
                                  }}
                                >
                                  R$
                                </span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  className="min-w-0 flex-1 border-0 bg-transparent px-3 py-1.5 text-sm outline-none focus:ring-0"
                                  style={{ color: 'var(--moni-text-primary)' }}
                                  value={valorFmt}
                                  placeholder={campo.placeholder ?? '0,00'}
                                  onChange={(e) => {
                                    const fmt = normalizarValorLoteDigitacao(e.target.value);
                                    setRascunhoLotes((prev) => {
                                      const next = prev.map((l) =>
                                        l.lote_id === loteAtivo.lote_id ? { ...l, valor: fmt } : l,
                                      );
                                      rascunhoLotesRef.current = next;
                                      return next;
                                    });
                                  }}
                                  onBlur={(e) => {
                                    const fmt = normalizarValorLoteDigitacao(e.target.value);
                                    setRascunhoLotes((prev) => {
                                      const next = prev.map((l) =>
                                        l.lote_id === loteAtivo.lote_id ? { ...l, valor: fmt } : l,
                                      );
                                      rascunhoLotesRef.current = next;
                                      return next;
                                    });
                                    void salvarCampoBlur(loteAtivo.lote_id, 'valor', fmt);
                                  }}
                                />
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
                                  setRascunhoLotes((prev) => {
                                    const next = prev.map((l) =>
                                      l.lote_id === loteAtivo.lote_id
                                        ? { ...l, [campo.chave]: e.target.value }
                                        : l,
                                    );
                                    rascunhoLotesRef.current = next;
                                    return next;
                                  })
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
                                setRascunhoLotes((prev) => {
                                  const next = prev.map((l) =>
                                    l.lote_id === loteAtivo.lote_id
                                      ? { ...l, [campo.chave]: e.target.value }
                                      : l,
                                  );
                                  rascunhoLotesRef.current = next;
                                  return next;
                                })
                              }
                              onBlur={(e) => void salvarCampoBlur(loteAtivo.lote_id, campo.chave, e.target.value)}
                            />
                          </div>
                        );
                      })}

                      <div className="space-y-4">
                        <p
                          className="text-xs font-medium"
                          style={{ color: 'var(--moni-text-primary)' }}
                        >
                          Atributos do lote
                        </p>

                        <div
                          className="rounded-md border px-3 py-2.5 space-y-2"
                          style={{ borderColor: 'var(--moni-border-default)', background: 'white' }}
                        >
                          <h5
                            className="text-[11px] font-semibold uppercase tracking-wide"
                            style={{ color: 'var(--moni-text-secondary)' }}
                          >
                            Topografia
                          </h5>
                          <p className="text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
                            Selecione apenas uma opção
                          </p>
                          <div className="space-y-1.5">
                            {LOTES_DISPONIVEIS_CHECKBOXES_TOPOGRAFIA.map(({ chave, label }) => (
                              <label
                                key={chave}
                                className="flex cursor-pointer items-center gap-2 text-sm"
                                style={{ color: 'var(--moni-text-primary)' }}
                              >
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 shrink-0 rounded"
                                  checked={loteAtivo[chave] === 'true'}
                                  onChange={(e) =>
                                    handleSalvarCheckbox(loteAtivo.lote_id, chave, e.target.checked)
                                  }
                                />
                                {label}
                              </label>
                            ))}
                          </div>
                        </div>

                        <div
                          className="rounded-md border px-3 py-2.5 space-y-2"
                          style={{ borderColor: 'var(--moni-border-default)', background: 'white' }}
                        >
                          <h5
                            className="text-[11px] font-semibold uppercase tracking-wide"
                            style={{ color: 'var(--moni-text-secondary)' }}
                          >
                            Localização
                          </h5>
                          <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
                            {LOTES_DISPONIVEIS_CHECKBOXES_LOCALIZACAO.map(({ chave, label }) => (
                              <label
                                key={chave}
                                className="flex cursor-pointer items-center gap-2 text-sm"
                                style={{ color: 'var(--moni-text-primary)' }}
                              >
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 shrink-0 rounded"
                                  checked={loteAtivo[chave] === 'true'}
                                  onChange={(e) =>
                                    handleSalvarCheckbox(loteAtivo.lote_id, chave, e.target.checked)
                                  }
                                />
                                {label}
                              </label>
                            ))}
                          </div>
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

      <input
        ref={fotosInputRef}
        type="file"
        accept="image/*,.pdf"
        multiple
        className="hidden"
        tabIndex={-1}
        aria-hidden
      />
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
