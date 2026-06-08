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
  CARACTERIZACAO_CONDOMINIO_CAMPOS,
  CHAVES_CARACTERIZACAO_OBRIGATORIAS,
  CHAVES_PESQUISA_OBRIGATORIAS,
  atualizarPesquisaPreenchidaEm,
  linhaProspectTemNome,
  linhaSessaoCondominioCompleta,
  normalizarLinhaProspect,
  PESQUISA_CONDOMINIO_SECOES,
  rotuloFontePesquisa,
  type ChaveLinhaProspectCondominio,
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
  const [carregandoInicial, setCarregandoInicial] = useState(true);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [salvandoSecao, setSalvandoSecao] = useState<string | null>(null);
  const [uploadMapa, setUploadMapa] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<Partial<Record<ChaveLinhaProspectCondominio, string>>>({});
  const rowIdRascunhoRef = useRef<string | null>(null);

  const recarregar = useCallback(async (opts?: { silencioso?: boolean }) => {
    if (!opts?.silencioso) setCarregandoInicial(true);
    setErroCarregar(null);
    const res = await carregarProspectsCondominioCard(cardId);
    if (!res.ok) {
      setErroCarregar(res.error);
      if (!opts?.silencioso) setLinhas([]);
      if (!opts?.silencioso) setCarregandoInicial(false);
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

  /** Repõe rascunho só ao trocar de aba (não após cada save). */
  useEffect(() => {
    if (!rowIdAtivo) {
      rowIdRascunhoRef.current = null;
      setRascunho({});
      return;
    }
    if (rowIdRascunhoRef.current === rowIdAtivo) return;
    rowIdRascunhoRef.current = rowIdAtivo;
    const linha = linhas.find((l) => l.row_id === rowIdAtivo);
    if (!linha) return;
    const draft: Partial<Record<ChaveLinhaProspectCondominio, string>> = {};
    for (const chave of [...CHAVES_CARACTERIZACAO_OBRIGATORIAS, ...CHAVES_PESQUISA_OBRIGATORIAS]) {
      draft[chave] = linha[chave] ?? '';
    }
    setRascunho(draft);
    setErroSalvar(null);
  }, [rowIdAtivo, linhas]);

  function aplicarLinhaSalvaLocal(
    rowId: string,
    respostas: Partial<Record<ChaveLinhaProspectCondominio, string>>,
  ) {
    setLinhas((prev) =>
      prev.map((l) => {
        if (l.row_id !== rowId) return l;
        return atualizarPesquisaPreenchidaEm(
          normalizarLinhaProspect({ ...l, ...respostas, row_id: rowId }),
        );
      }),
    );
  }

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
    aplicarLinhaSalvaLocal(linhaAtiva.row_id, respostas);
  }

  async function salvarCampoBlur(chave: ChaveLinhaProspectCondominio, valor: string) {
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
    aplicarLinhaSalvaLocal(linhaAtiva.row_id, { [chave]: valor });
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
      await salvarCampoBlur('mapa_condominio_path', path);
      setRascunho((prev) => ({ ...prev, mapa_condominio_path: path }));
    } finally {
      setUploadMapa(false);
    }
  }

  const camposCaracterizacao = CARACTERIZACAO_CONDOMINIO_CAMPOS.filter((c) => c.grupo === 'caracterizacao');
  const camposLiquidez = CARACTERIZACAO_CONDOMINIO_CAMPOS.filter((c) => c.grupo === 'liquidez');

  return (
    <div className="space-y-4">
      <div>
        <span className="mb-1 block text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
          {itemLabel}
          {obrigatorio ? <span className="ml-1 text-red-500">*</span> : null}
        </span>
      </div>

      {carregandoInicial ? (
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
                <h4 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--moni-text-secondary)' }}>
                  Caracterização do condomínio
                </h4>
                {camposCaracterizacao.map((campo) => (
                  <CampoCaracterizacao
                    key={campo.chave}
                    campo={campo}
                    valor={rascunho[campo.chave] ?? ''}
                    inputClass={inputClass}
                    onChange={(v) => setRascunho((prev) => ({ ...prev, [campo.chave]: v }))}
                    onBlur={(v) => void salvarCampoBlur(campo.chave, v)}
                  />
                ))}
              </section>

              <section
                className="rounded-lg border p-3 space-y-3"
                style={{ borderColor: 'var(--moni-border-default)', background: 'var(--moni-surface-50)' }}
              >
                <h4 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--moni-text-secondary)' }}>
                  Liquidez e Valorização Exponencial
                </h4>
                {camposLiquidez.map((campo) =>
                  campo.tipo === 'anexo' ? (
                    <div key={campo.chave}>
                      <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                        {campo.label}
                        <span className="ml-1 text-red-500">*</span>
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium hover:bg-stone-50"
                          style={{ borderColor: 'var(--moni-border-default)', color: 'var(--moni-primary-600)' }}>
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
                        {rascunho.mapa_condominio_path ? (
                          <span className="text-[10px] text-stone-500 truncate max-w-[200px]">
                            {String(rascunho.mapa_condominio_path).split('/').pop()}
                          </span>
                        ) : (
                          <span className="text-[10px] italic text-stone-400">Nenhum arquivo</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <CampoCaracterizacao
                      key={campo.chave}
                      campo={campo}
                      valor={rascunho[campo.chave] ?? ''}
                      inputClass={inputClass}
                      onChange={(v) => setRascunho((prev) => ({ ...prev, [campo.chave]: v }))}
                      onBlur={(v) => void salvarCampoBlur(campo.chave, v)}
                    />
                  ),
                )}
              </section>

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

function CampoCaracterizacao({
  campo,
  valor,
  inputClass,
  onChange,
  onBlur,
}: {
  campo: (typeof CARACTERIZACAO_CONDOMINIO_CAMPOS)[number];
  valor: string;
  inputClass: string;
  onChange: (v: string) => void;
  onBlur: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--moni-text-primary)' }}>
        {campo.label}
        <span className="ml-1 text-red-500">*</span>
      </label>
      {campo.placeholder ? (
        <p className="mb-1 text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
          {campo.placeholder}
        </p>
      ) : null}
      {campo.tipo === 'texto_longo' ? (
        <textarea
          rows={3}
          className={inputClass + ' resize-none'}
          value={valor}
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
