'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Circle, Loader2, Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { KanbanFaseSecaoTabs } from '@/components/kanban-shared/KanbanFaseSecaoTabs';
import {
  carregarProspectsCondominioCard,
  salvarCampoCondominio,
  salvarPesquisaCondominioProspect,
} from '@/lib/actions/kanban-condominio-pesquisa';
import { carregarMapaCompetidoresChecklist } from '@/lib/actions/kanban-mapa-competidores';
import type { CasaRow } from '@/app/step-one/[id]/etapa/Etapa4Casas';
import {
  sugestoesPrecoMapaPorCondominio,
} from '@/lib/kanban/mapa-competidores-condominio';
import {
  CARACTERIZACAO_GLOBAL_CAMPOS,
  CHAVES_RECUO_CONDOMINIO,
  CHAVES_TODAS_GLOBAL,
  FAIXA_CONDOMINIO_CAMPOS,
  FAIXAS_CONDOMINIO,
  LOTES_GLOBAL_CAMPOS,
  atualizarPesquisaPreenchidaEm,
  faixaCondominioCompleta,
  prospectsOrdenadosPorTicketCasas,
  linhaSessaoCondominioCompleta,
  mesclarRespostasFaixaCondominio,
  normalizarLinhaProspect,
  parseOpcoesTipoPredominante,
  serializarOpcoesTipoPredominante,
  valorFaixaCondominio,
  type ChaveGlobalCondominio,
  type ChaveFaixaCondominio,
  type ChaveRecuoCondominioDb,
  type FaixaCondominioId,
  type LinhaProspectCondominio,
} from '@/lib/kanban/condominio-prospect-pesquisa';

type Props = {
  cardId: string;
  processoId?: string | null;
  itemLabel: string;
  obrigatorio?: boolean;
};

const CAMPOS_SUGESTAO_MAPA: ChaveFaixaCondominio[] = ['q_casas_faixas_preco', 'q_casas_preco_m2'];

const inputClass =
  'w-full rounded-md border px-3 py-1.5 text-sm outline-none focus:ring-1' +
  ' bg-white border-[var(--moni-border-default)] text-[var(--moni-text-primary)]' +
  ' focus:ring-[var(--moni-primary-500)] focus:border-[var(--moni-primary-500)]';

type RascunhoGlobal = Partial<Record<ChaveGlobalCondominio, string>>;
type RascunhoFaixas = Partial<Record<FaixaCondominioId, Partial<Record<ChaveFaixaCondominio, string>>>>;

export function PesquisaCondominioProspect({ cardId, processoId, itemLabel, obrigatorio }: Props) {
  const [linhas, setLinhas] = useState<LinhaProspectCondominio[]>([]);
  const [casasMapa, setCasasMapa] = useState<CasaRow[]>([]);
  const [rowIdAtivo, setRowIdAtivo] = useState<string | null>(null);
  const [faixaAtiva, setFaixaAtiva] = useState<FaixaCondominioId>('premium');
  const [carregandoInicial, setCarregandoInicial] = useState(true);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [uploadMapa, setUploadMapa] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [rascunhoGlobal, setRascunhoGlobal] = useState<RascunhoGlobal>({});
  const [rascunhoFaixas, setRascunhoFaixas] = useState<RascunhoFaixas>({});
  const rowIdRascunhoRef = useRef<string | null>(null);
  const sugestoesMapaAplicadasRef = useRef<Set<string>>(new Set());

  const recarregar = useCallback(async (opts?: { silencioso?: boolean }) => {
    if (!opts?.silencioso) setCarregandoInicial(true);
    setErroCarregar(null);
    const res = await carregarProspectsCondominioCard(cardId);
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
    sugestoesMapaAplicadasRef.current = new Set();
  }, [cardId]);

  useEffect(() => {
    const pid = processoId?.trim();
    if (!pid) {
      setCasasMapa([]);
      return;
    }
    let cancelado = false;
    void (async () => {
      const res = await carregarMapaCompetidoresChecklist(pid, cardId);
      if (cancelado) return;
      setCasasMapa(res.ok ? res.casas : []);
    })();
    return () => {
      cancelado = true;
    };
  }, [cardId, processoId]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const prospects = useMemo(() => prospectsOrdenadosPorTicketCasas(linhas), [linhas]);
  const tabsCondominio = useMemo(
    () =>
      prospects.map((p) => ({
        id: p.row_id,
        label: `${p.condominio.trim()}${linhaSessaoCondominioCompleta(p) ? ' ✓' : ''}`,
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
      setRascunhoGlobal({});
      setRascunhoFaixas({});
      return;
    }
    if (rowIdRascunhoRef.current === rowIdAtivo) return;
    rowIdRascunhoRef.current = rowIdAtivo;
    const linha = linhas.find((l) => l.row_id === rowIdAtivo);
    if (!linha) return;

    const global: RascunhoGlobal = {};
    for (const chave of CHAVES_TODAS_GLOBAL) {
      global[chave] = linha[chave] ?? '';
    }

    const faixas: RascunhoFaixas = {};
    for (const { id } of FAIXAS_CONDOMINIO) {
      const draft: Partial<Record<ChaveFaixaCondominio, string>> = {};
      for (const campo of FAIXA_CONDOMINIO_CAMPOS) {
        draft[campo.chave] = valorFaixaCondominio(linha, id, campo.chave);
      }
      faixas[id] = draft;
    }

    setRascunhoGlobal(global);
    setRascunhoFaixas(faixas);
    setFaixaAtiva('premium');
    setErroSalvar(null);
  }, [rowIdAtivo, linhas]);

  useEffect(() => {
    if (!linhaAtiva?.condominio?.trim() || casasMapa.length === 0) return;

    const sugestoes = sugestoesPrecoMapaPorCondominio(casasMapa, linhaAtiva.condominio);
    if (Object.keys(sugestoes).length === 0) return;

    let cancelado = false;
    void (async () => {
      for (const { id: faixaId } of FAIXAS_CONDOMINIO) {
        const sug = sugestoes[faixaId];
        if (!sug) continue;

        const campos: Partial<Record<ChaveFaixaCondominio, string>> = {};
        for (const chave of CAMPOS_SUGESTAO_MAPA) {
          const refKey = `${linhaAtiva.row_id}:${faixaId}:${chave}`;
          if (sugestoesMapaAplicadasRef.current.has(refKey)) continue;
          if (valorFaixaCondominio(linhaAtiva, faixaId, chave)) {
            sugestoesMapaAplicadasRef.current.add(refKey);
            continue;
          }
          if (chave === 'q_casas_faixas_preco') {
            campos.q_casas_faixas_preco = sug.q_casas_faixas_preco;
          } else if (chave === 'q_casas_preco_m2') {
            campos.q_casas_preco_m2 = sug.q_casas_preco_m2;
          }
          sugestoesMapaAplicadasRef.current.add(refKey);
        }
        if (Object.keys(campos).length === 0) continue;

        const res = await salvarPesquisaCondominioProspect({
          cardId,
          rowId: linhaAtiva.row_id,
          faixaId,
          faixaRespostas: campos,
        });
        if (cancelado || !res.ok) continue;

        setRascunhoFaixas((prev) => ({
          ...prev,
          [faixaId]: { ...prev[faixaId], ...campos },
        }));
        setLinhas((prev) =>
          prev.map((l) => {
            if (l.row_id !== linhaAtiva.row_id) return l;
            const merged = mesclarRespostasFaixaCondominio(l, faixaId, campos);
            return atualizarPesquisaPreenchidaEm(merged);
          }),
        );
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [cardId, casasMapa, linhaAtiva]);

  function aplicarLinhaSalvaLocal(linha: LinhaProspectCondominio) {
    setLinhas((prev) =>
      prev.map((l) => (l.row_id === linha.row_id ? atualizarPesquisaPreenchidaEm(linha) : l)),
    );
  }

  async function salvarCampoRecuoCondominio(chave: ChaveRecuoCondominioDb, raw: string) {
    if (!linhaAtiva) return;
    const condominioId = linhaAtiva.condominio_id?.trim();
    if (!condominioId) {
      setErroSalvar('Vincule o condomínio ao cadastro na Tabela de Condomínios antes de informar recuos.');
      return;
    }

    const t = raw.trim();
    const valorNum = t === '' ? null : Number.parseFloat(t.replace(',', '.'));
    const valor = valorNum != null && Number.isFinite(valorNum) ? valorNum : null;

    const atualStr = (linhaAtiva[chave] ?? '').trim();
    const novoStr = valor != null ? String(valor) : '';
    if (novoStr === atualStr || (atualStr && valor != null && Number.parseFloat(atualStr) === valor)) {
      return;
    }

    setErroSalvar(null);
    const res = await salvarCampoCondominio({
      cardId,
      rowId: linhaAtiva.row_id,
      condominioId,
      chave,
      valor,
    });
    if (!res.ok) {
      setErroSalvar(res.error);
      return;
    }

    const valorLinha = valor != null ? String(valor) : '';
    setRascunhoGlobal((prev) => ({ ...prev, [chave]: valorLinha }));
    aplicarLinhaSalvaLocal(
      normalizarLinhaProspect({ ...linhaAtiva, [chave]: valorLinha, row_id: linhaAtiva.row_id }),
    );
  }

  async function salvarCampoGlobal(chave: ChaveGlobalCondominio, valor: string) {
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
    aplicarLinhaSalvaLocal(
      normalizarLinhaProspect({ ...linhaAtiva, [chave]: valor, row_id: linhaAtiva.row_id }),
    );
  }

  async function salvarCampoFaixa(faixaId: FaixaCondominioId, chave: ChaveFaixaCondominio, valor: string) {
    if (!linhaAtiva) return;
    const atual = valorFaixaCondominio(linhaAtiva, faixaId, chave);
    if (valor.trim() === atual.trim()) return;
    setErroSalvar(null);
    const res = await salvarPesquisaCondominioProspect({
      cardId,
      rowId: linhaAtiva.row_id,
      faixaId,
      faixaRespostas: { [chave]: valor },
    });
    if (!res.ok) {
      setErroSalvar(res.error);
      return;
    }
    setRascunhoFaixas((prev) => ({
      ...prev,
      [faixaId]: { ...prev[faixaId], [chave]: valor },
    }));
    const loaded = await carregarProspectsCondominioCard(cardId);
    if (loaded.ok) {
      const atualizada = loaded.linhas.find((l) => l.row_id === linhaAtiva.row_id);
      if (atualizada) aplicarLinhaSalvaLocal(atualizada);
    }
  }

  async function salvarMapaCondominio(file: File) {
    if (!linhaAtiva) return;
    setUploadMapa(true);
    setErroSalvar(null);
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop() ?? 'bin';
      const path = `respostas/${cardId}/condominio-prospect/${linhaAtiva.row_id}/mapa/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('documentos-templates').upload(path, file, { upsert: true });
      if (error) {
        setErroSalvar(error.message);
        return;
      }
      await salvarCampoGlobal('mapa_condominio_path', path);
      setRascunhoGlobal((prev) => ({ ...prev, mapa_condominio_path: path }));
    } finally {
      setUploadMapa(false);
    }
  }

  const camposCaracterizacao = CARACTERIZACAO_GLOBAL_CAMPOS.filter(
    (c) => c.tipo !== 'anexo' && !CHAVES_RECUO_CONDOMINIO.includes(c.chave as ChaveRecuoCondominioDb),
  );
  const campoMapa = CARACTERIZACAO_GLOBAL_CAMPOS.find((c) => c.chave === 'mapa_condominio_path');
  const camposLotesGlobal = LOTES_GLOBAL_CAMPOS;

  const tabsFaixa = useMemo(
    () =>
      FAIXAS_CONDOMINIO.map((f) => ({
        id: f.id,
        label: `${f.label}${linhaAtiva && faixaCondominioCompleta(linhaAtiva, f.id) ? ' ✓' : ''}`,
      })),
    [linhaAtiva],
  );

  return (
    <div className="space-y-4">
      <div>
        <span className="mb-1 block text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
          {itemLabel}
          {obrigatorio ? <span className="ml-1 text-red-500">*</span> : null}
        </span>
        <p className="text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
          Para cada condomínio: caracterização e lotes (globais) e, em seguida, Liquidez e Valorização
          Exponencial nas três faixas (Premium, Intermediária e Entrada).
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
                <BadgeConclusao completa={linhaSessaoCondominioCompleta(linhaAtiva)} />
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

              <section
                className="rounded-lg border p-3 space-y-3"
                style={{ borderColor: 'var(--moni-border-default)', background: 'var(--moni-surface-50)' }}
              >
                <h4
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--moni-text-secondary)' }}
                >
                  Caracterização do condomínio
                </h4>
                {camposCaracterizacao.map((campo) => (
                  <CampoTexto
                    key={campo.chave}
                    label={campo.label}
                    placeholder={campo.placeholder}
                    tipo={
                      campo.tipo === 'texto_longo'
                        ? 'texto_longo'
                        : campo.tipo === 'numero'
                          ? 'numero'
                          : 'texto'
                    }
                    obrigatorio={campo.obrigatorio}
                    valor={rascunhoGlobal[campo.chave] ?? ''}
                    inputClass={inputClass}
                    onChange={(v) => setRascunhoGlobal((prev) => ({ ...prev, [campo.chave]: v }))}
                    onBlur={(v) => void salvarCampoGlobal(campo.chave, v)}
                  />
                ))}

                <div>
                  <h5
                    className="text-xs font-semibold"
                    style={{ color: 'var(--moni-text-secondary)' }}
                  >
                    Recuos obrigatórios do condomínio
                  </h5>
                  {!linhaAtiva.condominio_id?.trim() ? (
                    <p className="mt-1 text-[11px] italic" style={{ color: 'var(--moni-text-tertiary)' }}>
                      Confirme o condomínio na Tabela de Condomínios (fase Dados da Cidade) para salvar recuos no
                      cadastro.
                    </p>
                  ) : null}
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <label className="grid gap-1">
                      <span className="text-xs text-gray-500">Recuo frontal (m)</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        className={inputClass}
                        value={rascunhoGlobal.recuo_frontal_m ?? ''}
                        disabled={!linhaAtiva.condominio_id?.trim()}
                        onChange={(e) =>
                          setRascunhoGlobal((prev) => ({ ...prev, recuo_frontal_m: e.target.value }))
                        }
                        onBlur={(e) => void salvarCampoRecuoCondominio('recuo_frontal_m', e.target.value)}
                      />
                    </label>
                    <label className="grid gap-1">
                      <span className="text-xs text-gray-500">Recuo de fundo (m)</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        className={inputClass}
                        value={rascunhoGlobal.recuo_fundo_m ?? ''}
                        disabled={!linhaAtiva.condominio_id?.trim()}
                        onChange={(e) =>
                          setRascunhoGlobal((prev) => ({ ...prev, recuo_fundo_m: e.target.value }))
                        }
                        onBlur={(e) => void salvarCampoRecuoCondominio('recuo_fundo_m', e.target.value)}
                      />
                    </label>
                    <label className="grid gap-1">
                      <span className="text-xs text-gray-500">Recuo lateral (m) — ambos os lados</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        className={inputClass}
                        value={rascunhoGlobal.recuo_lateral_m ?? ''}
                        disabled={!linhaAtiva.condominio_id?.trim()}
                        onChange={(e) =>
                          setRascunhoGlobal((prev) => ({ ...prev, recuo_lateral_m: e.target.value }))
                        }
                        onBlur={(e) => void salvarCampoRecuoCondominio('recuo_lateral_m', e.target.value)}
                      />
                    </label>
                  </div>
                </div>
                {campoMapa ? (
                  <div>
                    <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                      {campoMapa.label}
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      <label
                        className="inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium hover:bg-stone-50"
                        style={{ borderColor: 'var(--moni-border-default)', color: 'var(--moni-primary-600)' }}
                      >
                        {uploadMapa ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                        {uploadMapa ? 'Enviando…' : 'Enviar mapa'}
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          className="sr-only"
                          disabled={uploadMapa}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void salvarMapaCondominio(f);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      {rascunhoGlobal.mapa_condominio_path ? (
                        <span className="max-w-[200px] truncate text-[10px] text-stone-500">
                          {String(rascunhoGlobal.mapa_condominio_path).split('/').pop()}
                        </span>
                      ) : (
                        <span className="text-[10px] italic text-stone-400">Nenhum arquivo</span>
                      )}
                    </div>
                  </div>
                ) : null}
              </section>

              <section
                className="rounded-lg border p-3 space-y-3"
                style={{ borderColor: 'var(--moni-border-default)', background: 'var(--moni-surface-50)' }}
              >
                <h4
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--moni-text-secondary)' }}
                >
                  Sobre os lotes
                </h4>
                {camposLotesGlobal.map((campo) => (
                  <CampoTexto
                    key={campo.chave}
                    label={campo.label}
                    placeholder={campo.placeholder}
                    tipo={campo.tipo === 'texto_longo' ? 'texto_longo' : 'texto'}
                    obrigatorio={campo.obrigatorio}
                    valor={rascunhoGlobal[campo.chave] ?? ''}
                    inputClass={inputClass}
                    onChange={(v) => setRascunhoGlobal((prev) => ({ ...prev, [campo.chave]: v }))}
                    onBlur={(v) => void salvarCampoGlobal(campo.chave, v)}
                  />
                ))}
              </section>

              <KanbanFaseSecaoTabs
                tabs={tabsFaixa}
                abaAtiva={faixaAtiva}
                onAbaChange={(id) => setFaixaAtiva((id as FaixaCondominioId) || 'premium')}
                ariaLabel={`Faixas — ${linhaAtiva.condominio}`}
              >
                <section
                  className="rounded-lg border p-3 space-y-3"
                  style={{ borderColor: 'var(--moni-border-default)', background: 'var(--moni-surface-50)' }}
                >
                  <h4
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--moni-text-secondary)' }}
                  >
                    Liquidez e Valorização Exponencial
                  </h4>
                  {FAIXA_CONDOMINIO_CAMPOS.map((campo) =>
                    campo.tipo === 'selecao_multipla' ? (
                      <CampoSelecaoMultipla
                        key={campo.chave}
                        label={campo.label}
                        opcoes={campo.opcoes ?? []}
                        obrigatorio={campo.obrigatorio}
                        valor={rascunhoFaixas[faixaAtiva]?.[campo.chave] ?? ''}
                        onChange={(v) => {
                          setRascunhoFaixas((prev) => ({
                            ...prev,
                            [faixaAtiva]: { ...prev[faixaAtiva], [campo.chave]: v },
                          }));
                          void salvarCampoFaixa(faixaAtiva, campo.chave, v);
                        }}
                      />
                    ) : campo.tipo === 'selecao_unica' ? (
                      <CampoSelecaoUnica
                        key={campo.chave}
                        label={campo.label}
                        opcoes={campo.opcoes ?? []}
                        obrigatorio={campo.obrigatorio}
                        valor={rascunhoFaixas[faixaAtiva]?.[campo.chave] ?? ''}
                        onSelect={(opcao) => {
                          setRascunhoFaixas((prev) => ({
                            ...prev,
                            [faixaAtiva]: { ...prev[faixaAtiva], [campo.chave]: opcao },
                          }));
                          void salvarCampoFaixa(faixaAtiva, campo.chave, opcao);
                        }}
                      />
                    ) : (
                      <CampoTexto
                        key={campo.chave}
                        label={campo.label}
                        placeholder={campo.placeholder}
                        tipo={campo.tipo}
                        obrigatorio={campo.obrigatorio}
                        valor={rascunhoFaixas[faixaAtiva]?.[campo.chave] ?? ''}
                        inputClass={inputClass}
                        onChange={(v) =>
                          setRascunhoFaixas((prev) => ({
                            ...prev,
                            [faixaAtiva]: { ...prev[faixaAtiva], [campo.chave]: v },
                          }))
                        }
                        onBlur={(v) => void salvarCampoFaixa(faixaAtiva, campo.chave, v)}
                      />
                    ),
                  )}
                </section>
              </KanbanFaseSecaoTabs>
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

function CampoSelecaoMultipla({
  label,
  opcoes,
  valor,
  obrigatorio,
  onChange,
}: {
  label: string;
  opcoes: string[];
  valor: string;
  obrigatorio?: boolean;
  onChange: (valor: string) => void;
}) {
  const selecionados = useMemo(() => new Set(parseOpcoesTipoPredominante(valor)), [valor]);

  const toggle = (opcao: string) => {
    const next = new Set(selecionados);
    if (next.has(opcao as 'Térrea' | 'Sobrado')) next.delete(opcao as 'Térrea' | 'Sobrado');
    else next.add(opcao as 'Térrea' | 'Sobrado');
    onChange(serializarOpcoesTipoPredominante(next));
  };

  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--moni-text-primary)' }}>
        {label}
        {obrigatorio ? <span className="ml-1 text-red-500">*</span> : null}
      </label>
      <p className="mb-2 text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
        Pode marcar um ou os dois. Com ambos selecionados, o critério Andares (An) não entra no rank
        na Pré Batalha e na Batalha.
      </p>
      <div className="flex flex-wrap gap-2">
        {opcoes.map((opcao) => (
          <button
            key={opcao}
            type="button"
            onClick={() => toggle(opcao)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              selecionados.has(opcao as 'Térrea' | 'Sobrado')
                ? 'border-moni-dark bg-moni-dark text-white'
                : 'border-stone-300 bg-white text-stone-600 hover:border-moni-dark'
            }`}
          >
            {opcao}
          </button>
        ))}
      </div>
    </div>
  );
}

function CampoSelecaoUnica({
  label,
  opcoes,
  valor,
  obrigatorio,
  onSelect,
}: {
  label: string;
  opcoes: string[];
  valor: string;
  obrigatorio?: boolean;
  onSelect: (opcao: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--moni-text-primary)' }}>
        {label}
        {obrigatorio ? <span className="ml-1 text-red-500">*</span> : null}
      </label>
      <div className="flex flex-wrap gap-2">
        {opcoes.map((opcao) => (
          <button
            key={opcao}
            type="button"
            onClick={() => onSelect(opcao)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              valor === opcao
                ? 'border-moni-dark bg-moni-dark text-white'
                : 'border-stone-300 bg-white text-stone-600 hover:border-moni-dark'
            }`}
          >
            {opcao}
          </button>
        ))}
      </div>
    </div>
  );
}

function CampoTexto({
  label,
  placeholder,
  tipo,
  valor,
  inputClass,
  obrigatorio,
  onChange,
  onBlur,
}: {
  label: string;
  placeholder?: string;
  tipo: 'texto' | 'texto_longo' | 'numero';
  valor: string;
  inputClass: string;
  obrigatorio?: boolean;
  onChange: (v: string) => void;
  onBlur: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--moni-text-primary)' }}>
        {label}
        {obrigatorio ? <span className="ml-1 text-red-500">*</span> : null}
      </label>
      {placeholder && tipo !== 'texto_longo' ? (
        <p className="mb-1 text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
          {placeholder}
        </p>
      ) : null}
      {tipo === 'texto_longo' ? (
        <textarea
          rows={placeholder && placeholder.length > 120 ? 6 : 3}
          className={inputClass + ' resize-y'}
          value={valor}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onBlur(e.target.value)}
        />
      ) : (
        <input
          type="text"
          inputMode={tipo === 'numero' ? 'decimal' : undefined}
          className={inputClass}
          value={valor}
          placeholder={tipo === 'numero' ? placeholder ?? 'Ex.: 5,5' : undefined}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onBlur(e.target.value)}
        />
      )}
    </div>
  );
}
