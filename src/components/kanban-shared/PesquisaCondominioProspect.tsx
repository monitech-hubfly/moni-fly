'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Circle, Loader2, Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { KanbanFaseSecaoTabs } from '@/components/kanban-shared/KanbanFaseSecaoTabs';
import {
  carregarProspectsCondominioCard,
  salvarPesquisaCondominioProspect,
} from '@/lib/actions/kanban-condominio-pesquisa';
import {
  CARACTERIZACAO_GLOBAL_CAMPOS,
  CHAVES_CARACTERIZACAO_OBRIGATORIAS,
  CHAVES_FAIXA_OBRIGATORIAS,
  FAIXA_CONDOMINIO_CAMPOS,
  FAIXAS_CONDOMINIO,
  atualizarPesquisaPreenchidaEm,
  faixaCondominioCompleta,
  linhaProspectTemNome,
  linhaSessaoCondominioCompleta,
  normalizarLinhaProspect,
  valorFaixaCondominio,
  type ChaveCaracterizacaoGlobal,
  type ChaveFaixaCondominio,
  type FaixaCondominioId,
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

type RascunhoGlobal = Partial<Record<ChaveCaracterizacaoGlobal, string>>;
type RascunhoFaixas = Partial<Record<FaixaCondominioId, Partial<Record<ChaveFaixaCondominio, string>>>>;

export function PesquisaCondominioProspect({ cardId, itemLabel, obrigatorio }: Props) {
  const [linhas, setLinhas] = useState<LinhaProspectCondominio[]>([]);
  const [rowIdAtivo, setRowIdAtivo] = useState<string | null>(null);
  const [faixaAtiva, setFaixaAtiva] = useState<FaixaCondominioId>('premium');
  const [carregandoInicial, setCarregandoInicial] = useState(true);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [uploadMapa, setUploadMapa] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [rascunhoGlobal, setRascunhoGlobal] = useState<RascunhoGlobal>({});
  const [rascunhoFaixas, setRascunhoFaixas] = useState<RascunhoFaixas>({});
  const rowIdRascunhoRef = useRef<string | null>(null);

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
    for (const chave of [...CHAVES_CARACTERIZACAO_OBRIGATORIAS, 'mapa_condominio_path' as const]) {
      global[chave] = linha[chave] ?? '';
    }

    const faixas: RascunhoFaixas = {};
    for (const { id } of FAIXAS_CONDOMINIO) {
      const draft: Partial<Record<ChaveFaixaCondominio, string>> = {};
      for (const chave of CHAVES_FAIXA_OBRIGATORIAS) {
        draft[chave] = valorFaixaCondominio(linha, id, chave);
      }
      faixas[id] = draft;
    }

    setRascunhoGlobal(global);
    setRascunhoFaixas(faixas);
    setFaixaAtiva('premium');
    setErroSalvar(null);
  }, [rowIdAtivo, linhas]);

  function aplicarLinhaSalvaLocal(linha: LinhaProspectCondominio) {
    setLinhas((prev) =>
      prev.map((l) => (l.row_id === linha.row_id ? atualizarPesquisaPreenchidaEm(linha) : l)),
    );
  }

  async function salvarCampoGlobal(chave: ChaveCaracterizacaoGlobal, valor: string) {
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

  const camposGlobalTexto = CARACTERIZACAO_GLOBAL_CAMPOS.filter((c) => c.tipo !== 'anexo');
  const campoMapa = CARACTERIZACAO_GLOBAL_CAMPOS.find((c) => c.chave === 'mapa_condominio_path');

  const tabsFaixa = useMemo(
    () =>
      FAIXAS_CONDOMINIO.map((f) => ({
        id: f.id,
        label: `${f.label}${linhaAtiva && faixaCondominioCompleta(linhaAtiva, f.id) ? ' ✓' : ''}`,
      })),
    [linhaAtiva],
  );

  const camposLiquidez = FAIXA_CONDOMINIO_CAMPOS.filter((c) => c.secao === 'liquidez');
  const camposLotes = FAIXA_CONDOMINIO_CAMPOS.filter((c) => c.secao === 'lotes');
  const camposCasas = FAIXA_CONDOMINIO_CAMPOS.filter((c) => c.secao === 'casas');
  const camposLocacao = FAIXA_CONDOMINIO_CAMPOS.filter((c) => c.secao === 'locacao');

  return (
    <div className="space-y-4">
      <div>
        <span className="mb-1 block text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
          {itemLabel}
          {obrigatorio ? <span className="ml-1 text-red-500">*</span> : null}
        </span>
        <p className="text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
          Para cada condomínio: caracterização geral e, em seguida, liquidez e mercado nas três faixas (Premium,
          Intermediária e Entrada).
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
                {camposGlobalTexto.map((campo) => (
                  <CampoTexto
                    key={campo.chave}
                    label={campo.label}
                    placeholder={campo.placeholder}
                    tipo={campo.tipo === 'texto_longo' ? 'texto_longo' : 'texto'}
                    valor={rascunhoGlobal[campo.chave] ?? ''}
                    inputClass={inputClass}
                    onChange={(v) => setRascunhoGlobal((prev) => ({ ...prev, [campo.chave]: v }))}
                    onBlur={(v) => void salvarCampoGlobal(campo.chave, v)}
                  />
                ))}
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

              <KanbanFaseSecaoTabs
                tabs={tabsFaixa}
                abaAtiva={faixaAtiva}
                onAbaChange={(id) => setFaixaAtiva((id as FaixaCondominioId) || 'premium')}
                ariaLabel={`Faixas — ${linhaAtiva.condominio}`}
              >
                <section
                  className="rounded-lg border p-3 space-y-4"
                  style={{ borderColor: 'var(--moni-border-default)', background: 'var(--moni-surface-50)' }}
                >
                  <div className="space-y-3">
                    <h4
                      className="text-xs font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--moni-text-secondary)' }}
                    >
                      Liquidez e Valorização Exponencial
                    </h4>
                    {camposLiquidez.map((campo) => (
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
                    ))}
                  </div>

                  <div className="space-y-3 border-t pt-3" style={{ borderColor: 'var(--moni-border-default)' }}>
                    <h4
                      className="text-xs font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--moni-text-secondary)' }}
                    >
                      Sobre os lotes
                    </h4>
                    {camposLotes.map((campo) => (
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
                    ))}
                  </div>

                  <div className="space-y-3 border-t pt-3" style={{ borderColor: 'var(--moni-border-default)' }}>
                    {camposCasas.map((campo) => (
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
                    ))}
                  </div>

                  <div className="space-y-3 border-t pt-3" style={{ borderColor: 'var(--moni-border-default)' }}>
                    {camposLocacao.map((campo) => (
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
                    ))}
                  </div>
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
  tipo: 'texto' | 'texto_longo';
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
          className={inputClass}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onBlur(e.target.value)}
        />
      )}
    </div>
  );
}
