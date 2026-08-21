'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { KanbanCardModalMoedaField } from './KanbanCardModalMoedaField';
import {
  criarImobSimulacaoEmpreendimento,
  excluirImobSimulacaoEmpreendimento,
  salvarImobCardModelo,
  salvarImobSimulacaoEmpreendimento,
  uploadImobImagemOferta,
  uploadImobImagemPrincipal,
  urlAssinadaImobAnexo,
} from '@/lib/actions/imob-simulacoes-card';
import { carregarImobSimulacoesCard } from '@/lib/kanban/carregar-imob-simulacoes-card';
import { createClient } from '@/lib/supabase/client';
import {
  IMOB_STATUS_IMOVEL,
  emptyImobCardModeloDraft,
  formatImobMoedaExibicao,
  labelStatusImovel,
  opcoesProdutoModeloComValorAtual,
  type ImobCardEmpreendimentoDraft,
  type ImobCardModeloDraft,
  type ImobMoneyKey,
} from '@/lib/kanban/imob-simulacoes-card';

type Prefetch = {
  cardId: string;
  itens: ImobCardEmpreendimentoDraft[];
  modelo: ImobCardModeloDraft;
  error: string | null;
};

type Props = {
  cardId: string;
  podeEditar: boolean;
  prefetch?: Prefetch | null;
  esperarPrefetch?: boolean;
  /** Valor legado em processo_step_one — preservado se não estiver na lista. */
  legadoProdutoModeloCasa?: string;
};

const inputCls =
  'mt-0.5 min-h-[44px] w-full rounded-md px-2 py-1 text-xs sm:min-h-0';
const inputStyle = {
  border: '0.5px solid var(--moni-border-default)',
  background: 'var(--moni-surface-0)',
  color: 'var(--moni-text-primary)',
} as const;
const labelCls = 'text-[10px] font-medium uppercase tracking-wide';
const labelStyle = { color: 'var(--moni-text-tertiary)' } as const;

function patchDraft(
  setItens: (fn: (prev: ImobCardEmpreendimentoDraft[]) => ImobCardEmpreendimentoDraft[]) => void,
  id: string,
  key: keyof ImobCardEmpreendimentoDraft,
  value: string,
) {
  setItens((prev) => prev.map((it) => (it.id === id ? { ...it, [key]: value } : it)));
}

function CampoTexto({
  label,
  value,
  podeEditar,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  podeEditar: boolean;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <label className="block">
      <span className={labelCls} style={labelStyle}>
        {label}
      </span>
      {podeEditar ? (
        multiline ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={4}
            className={`${inputCls} resize-y`}
            style={inputStyle}
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={inputCls}
            style={inputStyle}
          />
        )
      ) : (
        <div className="mt-0.5 whitespace-pre-wrap text-xs" style={{ color: 'var(--moni-text-primary)' }}>
          {value.trim() || '—'}
        </div>
      )}
    </label>
  );
}

function CampoMoeda({
  label,
  value,
  podeEditar,
  onChange,
}: {
  label: string;
  value: string;
  podeEditar: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className={labelCls} style={labelStyle}>
        {label}
      </span>
      {podeEditar ? (
        <div
          className="mt-0.5 rounded-md"
          style={{ border: '0.5px solid var(--moni-border-default)' }}
        >
          <KanbanCardModalMoedaField
            value={value}
            onChange={onChange}
            className="flex min-h-[44px] items-center px-2 py-1 sm:min-h-0"
          />
        </div>
      ) : (
        <div className="mt-0.5 text-xs" style={{ color: 'var(--moni-text-primary)' }}>
          {formatImobMoedaExibicao(value)}
        </div>
      )}
    </label>
  );
}

function AnexoImagem({
  label,
  path,
  nome,
  podeEditar,
  uploading,
  onUpload,
}: {
  label: string;
  path: string;
  nome: string;
  podeEditar: boolean;
  uploading: boolean;
  onUpload: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    if (!path.trim()) return;
    void urlAssinadaImobAnexo(path).then((r) => {
      if (!cancelled && r.ok) setUrl(r.url);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return (
    <div>
      <span className={labelCls} style={labelStyle}>
        {label}
      </span>
      <div className="mt-1 space-y-2">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={nome || label}
            className="max-h-40 w-full rounded-md object-contain"
            style={{ border: '0.5px solid var(--moni-border-default)', background: 'var(--moni-surface-0)' }}
          />
        ) : path ? (
          <p className="text-[11px]" style={{ color: 'var(--moni-text-secondary)' }}>
            {nome || path}
          </p>
        ) : (
          <p className="text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
            Nenhuma imagem anexada.
          </p>
        )}
        {podeEditar ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="inline-flex min-h-[44px] items-center rounded-md px-2 py-1.5 text-xs font-medium sm:min-h-0"
              style={{
                border: '0.5px solid var(--moni-border-default)',
                background: 'var(--moni-surface-0)',
                color: 'var(--moni-text-secondary)',
              }}
            >
              {uploading ? 'Enviando…' : path ? 'Trocar imagem' : 'Anexar imagem'}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function EmpreendimentoBloco({
  item,
  index,
  total,
  kind,
  podeEditar,
  salvandoId,
  uploadingOferta,
  onChange,
  onSalvar,
  onExcluir,
  onUploadOferta,
}: {
  item: ImobCardEmpreendimentoDraft;
  index: number;
  total: number;
  kind: 'empreendimento' | 'showroom';
  podeEditar: boolean;
  salvandoId: string | null;
  uploadingOferta: boolean;
  onChange: (key: keyof ImobCardEmpreendimentoDraft, value: string) => void;
  onSalvar: () => void;
  onExcluir: () => void;
  onUploadOferta: (file: File) => void;
}) {
  const setMoney = (key: ImobMoneyKey, value: string) => onChange(key, value);
  const produtoOpcoes = opcoesProdutoModeloComValorAtual(item.produto_modelo);
  const isShowroom = kind === 'showroom';
  const tituloFinal = isShowroom
    ? total > 1
      ? `Showroom ${index + 1} de ${total}`
      : 'Showroom'
    : total > 1
      ? `Empreendimento ${index + 1} de ${total}`
      : `Empreendimento ${index + 1}`;

  return (
    <div
      className="space-y-3 rounded-lg p-2"
      style={{
        border: '0.5px solid var(--moni-border-default)',
        background: 'var(--moni-surface-50)',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold" style={{ color: 'var(--moni-text-secondary)' }}>
          {tituloFinal}
        </p>
        {podeEditar && total > 0 ? (
          <button
            type="button"
            onClick={onExcluir}
            className="inline-flex min-h-[44px] items-center gap-1 rounded-md px-2 text-[11px] sm:min-h-0"
            style={{ color: 'var(--moni-text-secondary)' }}
            aria-label={isShowroom ? 'Remover showroom' : 'Remover empreendimento'}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Remover
          </button>
        ) : null}
      </div>

      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
          Modelo / Oferta
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className={labelCls} style={labelStyle}>
              Produto / Modelo
            </span>
            {podeEditar ? (
              <select
                value={item.produto_modelo}
                onChange={(e) => onChange('produto_modelo', e.target.value)}
                className={inputCls}
                style={inputStyle}
              >
                <option value="">Selecione</option>
                {produtoOpcoes.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            ) : (
              <div className="mt-0.5 text-xs" style={{ color: 'var(--moni-text-primary)' }}>
                {item.produto_modelo.trim() || '—'}
              </div>
            )}
          </label>
          <CampoTexto
            label="Título da oferta"
            value={item.titulo_oferta}
            podeEditar={podeEditar}
            onChange={(v) => onChange('titulo_oferta', v)}
          />
          <CampoTexto
            label="Ano de lançamento"
            value={item.ano_lancamento}
            podeEditar={podeEditar}
            onChange={(v) => onChange('ano_lancamento', v.replace(/\D/g, '').slice(0, 4))}
            placeholder="AAAA"
          />
          <CampoTexto
            label="Quartos"
            value={item.quartos}
            podeEditar={podeEditar}
            onChange={(v) => onChange('quartos', v)}
          />
          <CampoTexto
            label="Banheiros"
            value={item.banheiros}
            podeEditar={podeEditar}
            onChange={(v) => onChange('banheiros', v)}
          />
          <CampoTexto
            label="Vagas"
            value={item.vagas}
            podeEditar={podeEditar}
            onChange={(v) => onChange('vagas', v)}
          />
          <CampoTexto
            label="Área de Vendas (m²)"
            value={item.area_vendas_m2}
            podeEditar={podeEditar}
            onChange={(v) => onChange('area_vendas_m2', v)}
          />
          <CampoTexto
            label="Link Modelo"
            value={item.link_modelo}
            podeEditar={podeEditar}
            onChange={(v) => onChange('link_modelo', v)}
            placeholder="https://"
          />
          <CampoTexto
            label="Link Imagens e Planta"
            value={item.link_imagens_planta}
            podeEditar={podeEditar}
            onChange={(v) => onChange('link_imagens_planta', v)}
            placeholder="https://"
          />
          <div className="sm:col-span-2">
            <CampoTexto
              label="Descrição"
              value={item.descricao}
              podeEditar={podeEditar}
              onChange={(v) => onChange('descricao', v)}
              multiline
            />
          </div>
          <div className="sm:col-span-2">
            <AnexoImagem
              label="Imagem da Oferta"
              path={item.imagem_oferta_path}
              nome={item.imagem_oferta_nome}
              podeEditar={podeEditar}
              uploading={uploadingOferta}
              onUpload={onUploadOferta}
            />
          </div>
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
          Dados gerais da simulação
        </p>
        <div className="space-y-2">
          <CampoTexto
            label={isShowroom ? 'Nome do showroom' : 'Nome do empreendimento'}
            value={item.nome}
            podeEditar={podeEditar}
            onChange={(v) => onChange('nome', v)}
            placeholder={isShowroom ? 'Ex.: Showroom Centro' : 'Ex.: Residencial Verde'}
          />
          <CampoMoeda
            label="Valor do imóvel à vista (R$)"
            value={item.valor_avista}
            podeEditar={podeEditar}
            onChange={(v) => setMoney('valor_avista', v)}
          />
          <CampoMoeda
            label="Entrada (R$)"
            value={item.entrada}
            podeEditar={podeEditar}
            onChange={(v) => setMoney('entrada', v)}
          />
          <CampoMoeda
            label="Parcelas mensais (R$)"
            value={item.parcelas_mensais}
            podeEditar={podeEditar}
            onChange={(v) => setMoney('parcelas_mensais', v)}
          />
        </div>
      </div>

      {podeEditar ? (
        <button
          type="button"
          onClick={onSalvar}
          disabled={salvandoId === item.id}
          className="min-h-[44px] w-full rounded-md px-3 py-1.5 text-xs font-medium sm:min-h-0"
          style={{
            background: 'var(--moni-navy-800)',
            color: 'var(--moni-text-inverse, #fff)',
          }}
        >
          {salvandoId === item.id ? 'Salvando…' : isShowroom ? 'Salvar showroom' : 'Salvar empreendimento'}
        </button>
      ) : null}
    </div>
  );
}

function aplicarLegadoProduto(
  itens: ImobCardEmpreendimentoDraft[],
  legado: string,
): ImobCardEmpreendimentoDraft[] {
  const leg = legado.trim();
  if (!leg || itens.length === 0) return itens;
  const idxShowroom = itens.findIndex((it) => it.tipo === 'showroom' && !it.produto_modelo.trim());
  const idx =
    idxShowroom >= 0 ? idxShowroom : itens.findIndex((it) => !String(it.produto_modelo ?? '').trim());
  if (idx < 0) return itens;
  return itens.map((it, i) => (i === idx ? { ...it, produto_modelo: leg } : it));
}

export function KanbanCardModalSimulacoesImob({
  cardId,
  podeEditar,
  prefetch = null,
  esperarPrefetch = false,
  legadoProdutoModeloCasa = '',
}: Props) {
  const prefetchOk = prefetch?.cardId === cardId ? prefetch : null;
  const [itens, setItens] = useState<ImobCardEmpreendimentoDraft[]>(() =>
    aplicarLegadoProduto(prefetchOk?.itens ?? [], legadoProdutoModeloCasa),
  );
  const [modelo, setModelo] = useState<ImobCardModeloDraft>(
    () => prefetchOk?.modelo ?? emptyImobCardModeloDraft(),
  );
  const [loading, setLoading] = useState(!prefetchOk);
  const [erro, setErro] = useState<string | null>(prefetchOk?.error ?? null);
  const [msg, setMsg] = useState<string | null>(null);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [salvandoModelo, setSalvandoModelo] = useState(false);
  const [criandoTipo, setCriandoTipo] = useState<'empreendimento' | 'showroom' | null>(null);
  const [uploadingPrincipal, setUploadingPrincipal] = useState(false);
  const [uploadingOfertaId, setUploadingOfertaId] = useState<string | null>(null);

  const showrooms = itens.filter((it) => (it.tipo ?? 'empreendimento') === 'showroom');
  const empreendimentos = itens.filter((it) => (it.tipo ?? 'empreendimento') !== 'showroom');

  const recarregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    const r = await carregarImobSimulacoesCard(createClient(), cardId);
    setLoading(false);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    setItens(aplicarLegadoProduto(r.itens, legadoProdutoModeloCasa));
    setModelo(r.modelo);
  }, [cardId, legadoProdutoModeloCasa]);

  useEffect(() => {
    if (prefetch?.cardId === cardId) {
      setItens(aplicarLegadoProduto(prefetch.itens, legadoProdutoModeloCasa));
      setModelo(prefetch.modelo);
      setErro(prefetch.error);
      setLoading(false);
      return;
    }
    if (esperarPrefetch) return;
    void recarregar();
  }, [cardId, prefetch, esperarPrefetch, recarregar, legadoProdutoModeloCasa]);

  async function handleSalvarModelo() {
    setSalvandoModelo(true);
    setErro(null);
    setMsg(null);
    const r = await salvarImobCardModelo(cardId, modelo);
    setSalvandoModelo(false);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    setMsg('Dados do imóvel salvos.');
  }

  async function handleUploadPrincipal(file: File) {
    setUploadingPrincipal(true);
    setErro(null);
    const fd = new FormData();
    fd.set('cardId', cardId);
    fd.set('file', file);
    const r = await uploadImobImagemPrincipal(fd);
    setUploadingPrincipal(false);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    setModelo((m) => ({
      ...m,
      imagem_principal_path: r.path,
      imagem_principal_nome: r.nome,
    }));
    setMsg('Imagem principal anexada.');
  }

  async function handleSalvar(item: ImobCardEmpreendimentoDraft) {
    setSalvandoId(item.id);
    setErro(null);
    setMsg(null);
    const r = await salvarImobSimulacaoEmpreendimento(cardId, item);
    setSalvandoId(null);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    setMsg(item.tipo === 'showroom' ? 'Showroom salvo.' : 'Empreendimento salvo.');
  }

  async function handleCriar(tipo: 'empreendimento' | 'showroom') {
    setCriandoTipo(tipo);
    setErro(null);
    setMsg(null);
    const r = await criarImobSimulacaoEmpreendimento(cardId, tipo);
    setCriandoTipo(null);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    setItens((prev) => aplicarLegadoProduto([...prev, r.item], legadoProdutoModeloCasa));
  }

  async function handleExcluir(id: string, tipo: 'empreendimento' | 'showroom') {
    const label = tipo === 'showroom' ? 'showroom' : 'empreendimento';
    if (!window.confirm(`Remover este ${label} da simulação?`)) return;
    setErro(null);
    setMsg(null);
    const r = await excluirImobSimulacaoEmpreendimento(cardId, id);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    setItens((prev) => prev.filter((it) => it.id !== id));
  }

  async function handleUploadOferta(empId: string, file: File) {
    setUploadingOfertaId(empId);
    setErro(null);
    const fd = new FormData();
    fd.set('cardId', cardId);
    fd.set('empreendimentoId', empId);
    fd.set('file', file);
    const r = await uploadImobImagemOferta(fd);
    setUploadingOfertaId(null);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    setItens((prev) =>
      prev.map((it) =>
        it.id === empId
          ? { ...it, imagem_oferta_path: r.path, imagem_oferta_nome: r.nome }
          : it,
      ),
    );
    setMsg('Imagem da oferta anexada.');
  }

  if (loading) {
    return (
      <p className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Carregando modelo e simulações…
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className="space-y-2 rounded-lg p-2"
        style={{
          border: '0.5px solid var(--moni-border-default)',
          background: 'var(--moni-surface-50)',
        }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
          Dados do imóvel
        </p>
        <label className="block">
          <span className={labelCls} style={labelStyle}>
            Status do Imóvel
          </span>
          {podeEditar ? (
            <select
              value={modelo.status_imovel}
              onChange={(e) => setModelo((m) => ({ ...m, status_imovel: e.target.value }))}
              className={inputCls}
              style={inputStyle}
            >
              <option value="">Selecione</option>
              {IMOB_STATUS_IMOVEL.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          ) : (
            <div className="mt-0.5 text-xs" style={{ color: 'var(--moni-text-primary)' }}>
              {labelStatusImovel(modelo.status_imovel)}
            </div>
          )}
        </label>
        {podeEditar ? (
          <button
            type="button"
            onClick={() => void handleSalvarModelo()}
            disabled={salvandoModelo}
            className="min-h-[44px] w-full rounded-md px-3 py-1.5 text-xs font-medium sm:min-h-0"
            style={{
              background: 'var(--moni-navy-800)',
              color: 'var(--moni-text-inverse, #fff)',
            }}
          >
            {salvandoModelo ? 'Salvando…' : 'Salvar status do imóvel'}
          </button>
        ) : null}
      </div>

      {erro ? (
        <div
          className="rounded-md px-2 py-1.5 text-[11px]"
          style={{
            border: '0.5px solid var(--moni-status-overdue-border)',
            background: 'var(--moni-status-overdue-bg)',
            color: 'var(--moni-status-overdue-text)',
          }}
          role="alert"
        >
          {erro}
        </div>
      ) : null}
      {msg ? (
        <div
          className="rounded-md px-2 py-1.5 text-[11px]"
          style={{
            border: '0.5px solid var(--moni-status-done-border)',
            background: 'var(--moni-status-done-bg)',
            color: 'var(--moni-status-done-text)',
          }}
          role="status"
        >
          {msg}
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
          Showroom
        </p>
        <AnexoImagem
          label="Imagem Principal"
          path={modelo.imagem_principal_path}
          nome={modelo.imagem_principal_nome}
          podeEditar={podeEditar}
          uploading={uploadingPrincipal}
          onUpload={(f) => void handleUploadPrincipal(f)}
        />
        {showrooms.length === 0 ? (
          <p className="text-[11px]" style={{ color: 'var(--moni-text-secondary)' }}>
            Nenhum showroom neste card.
          </p>
        ) : (
          <div className="space-y-3">
            {showrooms.map((item, idx) => (
              <EmpreendimentoBloco
                key={item.id}
                item={item}
                index={idx}
                total={showrooms.length}
                kind="showroom"
                podeEditar={podeEditar}
                salvandoId={salvandoId}
                uploadingOferta={uploadingOfertaId === item.id}
                onChange={(key, value) => patchDraft(setItens, item.id, key, value)}
                onSalvar={() => void handleSalvar(item)}
                onExcluir={() => void handleExcluir(item.id, 'showroom')}
                onUploadOferta={(f) => void handleUploadOferta(item.id, f)}
              />
            ))}
          </div>
        )}
        {podeEditar ? (
          <button
            type="button"
            onClick={() => void handleCriar('showroom')}
            disabled={criandoTipo != null}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium sm:min-h-0"
            style={{
              border: '0.5px solid var(--moni-border-default)',
              background: 'var(--moni-surface-0)',
              color: 'var(--moni-text-secondary)',
            }}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {criandoTipo === 'showroom' ? 'Adicionando…' : 'Adicionar showroom'}
          </button>
        ) : null}
      </div>

      <p className="text-[10px] leading-snug" style={{ color: 'var(--moni-text-tertiary)' }}>
        Por empreendimento: oferta e parâmetros do simulador. Valor quitado, sinal e parcela mensal do
        cliente são preenchidos na simulação, não neste card.
      </p>

      {empreendimentos.length === 0 ? (
        <p className="text-[11px]" style={{ color: 'var(--moni-text-secondary)' }}>
          Nenhum empreendimento neste card.
        </p>
      ) : (
        <div className="space-y-3">
          {empreendimentos.map((item, idx) => (
            <EmpreendimentoBloco
              key={item.id}
              item={item}
              index={idx}
              total={empreendimentos.length}
              kind="empreendimento"
              podeEditar={podeEditar}
              salvandoId={salvandoId}
              uploadingOferta={uploadingOfertaId === item.id}
              onChange={(key, value) => patchDraft(setItens, item.id, key, value)}
              onSalvar={() => void handleSalvar(item)}
              onExcluir={() => void handleExcluir(item.id, 'empreendimento')}
              onUploadOferta={(f) => void handleUploadOferta(item.id, f)}
            />
          ))}
        </div>
      )}

      {podeEditar ? (
        <button
          type="button"
          onClick={() => void handleCriar('empreendimento')}
          disabled={criandoTipo != null}
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium sm:min-h-0"
          style={{
            border: '0.5px solid var(--moni-border-default)',
            background: 'var(--moni-surface-0)',
            color: 'var(--moni-text-secondary)',
          }}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {criandoTipo === 'empreendimento' ? 'Adicionando…' : 'Adicionar empreendimento'}
        </button>
      ) : null}
    </div>
  );
}
