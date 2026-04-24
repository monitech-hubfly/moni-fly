'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, Upload, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  upsertFaseChecklistResposta,
  type ActionResult,
  type FaseChecklistItem,
  type FaseChecklistResposta,
} from '@/lib/actions/card-actions';
import { ChecklistDocumentDiffModal } from '@/components/kanban-shared/ChecklistDocumentDiffModal';

type Props = {
  faseId: string;
  cardId: string;
  isFrank: boolean;
  isAdmin: boolean;
};

type EstadoResposta = {
  valor: string;
  arquivo_path: string | null;
  salvando: boolean;
  erro: string | null;
};

export function FaseChecklistCard({ faseId, cardId, isFrank, isAdmin }: Props) {
  const [itens, setItens] = useState<FaseChecklistItem[] | null>(null);
  const [respostas, setRespostas] = useState<Map<string, EstadoResposta>>(new Map());
  const [carregando, setCarregando] = useState(true);
  const [diffModal, setDiffModal] = useState<{ open: boolean; lines: string[] }>({ open: false, lines: [] });

  useEffect(() => {
    if (!faseId || !cardId) {
      setCarregando(false);
      return;
    }
    let cancelado = false;
    void (async () => {
      try {
        const supabase = createClient();
        const { data: itensData, error: itensError } = await supabase
          .from('kanban_fase_checklist_itens')
          .select('*')
          .eq('fase_id', faseId)
          .order('ordem', { ascending: true });

        const { data: respostasData, error: respostasError } = await supabase
          .from('kanban_fase_checklist_respostas')
          .select('*')
          .eq('card_id', cardId);

        if (cancelado) return;

        const itemRows = (itensData ?? []) as FaseChecklistItem[];
        const respRows = (respostasData ?? []) as FaseChecklistResposta[];

        if (itensError || respostasError) {
          setItens([]);
          setRespostas(new Map());
          setCarregando(false);
          return;
        }

        setItens(itemRows);
        const map = new Map<string, EstadoResposta>();
        const respPorItem = new Map<string, FaseChecklistResposta>();
        for (const r of respRows) respPorItem.set(r.item_id, r);
        for (const it of itemRows) {
          const resp = respPorItem.get(it.id);
          map.set(it.id, {
            valor: resp?.valor ?? '',
            arquivo_path: resp?.arquivo_path ?? null,
            salvando: false,
            erro: null,
          });
        }
        setRespostas(map);
        setCarregando(false);
      } catch {
        if (!cancelado) {
          setItens([]);
          setRespostas(new Map());
          setCarregando(false);
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [faseId, cardId]);

  function setResposta(itemId: string, patch: Partial<EstadoResposta>) {
    setRespostas((prev) => {
      const atual = prev.get(itemId) ?? { valor: '', arquivo_path: null, salvando: false, erro: null };
      return new Map(prev).set(itemId, { ...atual, ...patch });
    });
  }

  async function salvar(itemId: string, valor?: string, arquivo_path?: string | null): Promise<ActionResult> {
    setResposta(itemId, { salvando: true, erro: null });
    const res = await upsertFaseChecklistResposta({
      item_id: itemId,
      card_id: cardId,
      valor: valor ?? respostas.get(itemId)?.valor ?? null,
      arquivo_path: arquivo_path !== undefined ? arquivo_path : (respostas.get(itemId)?.arquivo_path ?? null),
    });
    setResposta(itemId, { salvando: false, erro: res.ok ? null : res.error });
    return res;
  }

  async function compararAposAssinado(itemId: string) {
    try {
      const r = await fetch('/api/candidato/comparar-documentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ item_id: itemId, card_id: cardId }),
      });
      const j = (await r.json()) as {
        ok?: boolean;
        diferencas?: string[];
        temDiferencasRelevantes?: boolean;
        error?: string;
      };
      if (!r.ok || !j.ok) return;
      if (j.temDiferencasRelevantes && Array.isArray(j.diferencas) && j.diferencas.length > 0) {
        setDiffModal({ open: true, lines: j.diferencas });
      }
    } catch {
      /* comparação é auxiliar; falhas silenciosas */
    }
  }

  if (carregando) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm" style={{ color: 'var(--moni-text-tertiary)' }}>
        <Loader2 size={14} className="animate-spin" />
        Carregando itens...
      </div>
    );
  }

  if (!itens || itens.length === 0) {
    return (
      <p className="text-xs italic" style={{ color: 'var(--moni-text-tertiary)' }}>
        Nenhum item configurado para esta fase.
      </p>
    );
  }

  const itensFiltrados = isFrank ? itens.filter((it) => it.visivel_candidato) : itens;

  return (
    <div className="space-y-4">
      <ChecklistDocumentDiffModal
        open={diffModal.open}
        diferencas={diffModal.lines}
        onClose={() => setDiffModal({ open: false, lines: [] })}
      />
      {itensFiltrados.map((item) => (
        <ItemField
          key={item.id}
          item={item}
          estado={respostas.get(item.id) ?? { valor: '', arquivo_path: null, salvando: false, erro: null }}
          cardId={cardId}
          isAdmin={isAdmin}
          onChange={(valor) => setResposta(item.id, { valor })}
          onBlur={(valor) => void salvar(item.id, valor)}
          onArquivo={async (path) => {
            setResposta(item.id, { arquivo_path: path });
            const res = await salvar(item.id, undefined, path);
            if (res.ok && item.tipo === 'anexo_template') {
              await compararAposAssinado(item.id);
            }
          }}
        />
      ))}
    </div>
  );
}

type ItemFieldProps = {
  item: FaseChecklistItem;
  estado: EstadoResposta;
  cardId: string;
  isAdmin: boolean;
  onChange: (valor: string) => void;
  onBlur: (valor: string) => void;
  onArquivo: (path: string) => void | Promise<void>;
};

function ItemField({ item, estado, cardId, isAdmin, onChange, onBlur, onArquivo }: ItemFieldProps) {
  const inputFileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [baixandoModelo, setBaixandoModelo] = useState(false);
  const [erroModelo, setErroModelo] = useState<string | null>(null);

  const labelEl = (
    <span className="mb-1 block text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
      {item.label}
      {item.obrigatorio && <span className="ml-1 text-red-500">*</span>}
      {estado.salvando && <Loader2 size={10} className="ml-1 inline animate-spin" />}
    </span>
  );

  const inputClass =
    'w-full rounded-md border px-3 py-1.5 text-sm outline-none focus:ring-1' +
    ' bg-white border-[var(--moni-border-default)] text-[var(--moni-text-primary)]' +
    ' focus:ring-[var(--moni-primary-500)] focus:border-[var(--moni-primary-500)]';

  const erroEl =
    estado.erro || erroModelo ? (
      <p className="mt-1 text-xs text-red-500">{erroModelo ?? estado.erro}</p>
    ) : null;

  async function handleUpload(file: File) {
    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split('.').pop() ?? 'bin';
    const path = `respostas/${cardId}/${item.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('documentos-templates').upload(path, file, { upsert: true });
    setUploading(false);
    if (error) return;
    await onArquivo(path);
  }

  if (item.tipo === 'checkbox') {
    return (
      <div>
        <label className="flex cursor-pointer items-center gap-2 text-sm" style={{ color: 'var(--moni-text-primary)' }}>
          <input
            type="checkbox"
            className="h-4 w-4 rounded"
            checked={estado.valor === 'true'}
            onChange={(e) => {
              const v = e.target.checked ? 'true' : 'false';
              onChange(v);
              onBlur(v);
            }}
          />
          {item.label}
          {item.obrigatorio && <span className="text-red-500">*</span>}
          {estado.salvando && <Loader2 size={10} className="animate-spin" />}
        </label>
        {erroEl}
      </div>
    );
  }

  if (item.tipo === 'texto_longo') {
    return (
      <div>
        {labelEl}
        <textarea
          rows={3}
          className={inputClass + ' resize-none'}
          placeholder={item.placeholder ?? ''}
          value={estado.valor}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onBlur(e.target.value)}
        />
        {erroEl}
      </div>
    );
  }

  if (item.tipo === 'data') {
    return (
      <div>
        {labelEl}
        <input
          type="date"
          className={inputClass}
          value={estado.valor}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onBlur(e.target.value)}
        />
        {erroEl}
      </div>
    );
  }

  if (item.tipo === 'hora') {
    return (
      <div>
        {labelEl}
        <input
          type="time"
          className={inputClass}
          value={estado.valor}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onBlur(e.target.value)}
        />
        {erroEl}
      </div>
    );
  }

  if (item.tipo === 'anexo') {
    return (
      <div>
        {labelEl}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputFileRef.current?.click()}
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs"
            style={{
              borderColor: 'var(--moni-border-default)',
              color: 'var(--moni-text-secondary)',
              background: 'var(--moni-surface-100)',
            }}
          >
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            {uploading ? 'Enviando...' : 'Enviar arquivo'}
          </button>
          {estado.arquivo_path && (
            <span className="truncate text-xs" style={{ color: 'var(--moni-primary-600)', maxWidth: 180 }}>
              {estado.arquivo_path.split('/').pop()}
            </span>
          )}
        </div>
        <input
          ref={inputFileRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
        />
        {erroEl}
      </div>
    );
  }

  if (item.tipo === 'anexo_template') {
    const temModelo = Boolean(item.template_storage_path?.trim());

    async function baixarModelo() {
      if (!temModelo) return;
      setErroModelo(null);
      setBaixandoModelo(true);
      try {
        const r = await fetch(`/api/candidato/download-template?item_id=${encodeURIComponent(item.id)}`);
        const j = (await r.json()) as { url?: string; error?: string };
        if (!r.ok || !j.url) {
          setErroModelo(j.error ?? 'Não foi possível baixar o modelo.');
          return;
        }
        window.open(j.url, '_blank', 'noopener,noreferrer');
      } catch {
        setErroModelo('Erro ao baixar o modelo.');
      } finally {
        setBaixandoModelo(false);
      }
    }

    return (
      <div>
        {labelEl}
        <div className="flex flex-wrap items-center gap-2">
          {temModelo && (
            <button
              type="button"
              disabled={baixandoModelo}
              onClick={() => void baixarModelo()}
              className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs disabled:opacity-50"
              style={{
                borderColor: 'var(--moni-border-default)',
                color: 'var(--moni-text-secondary)',
                background: 'var(--moni-surface-100)',
              }}
            >
              {baixandoModelo ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
              Baixar modelo
            </button>
          )}
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputFileRef.current?.click()}
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs"
            style={{
              borderColor: 'var(--moni-border-default)',
              color: 'var(--moni-text-secondary)',
              background: 'var(--moni-surface-100)',
            }}
          >
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            {uploading ? 'Enviando...' : 'Enviar assinado'}
          </button>
          {estado.arquivo_path && (
            <span className="truncate text-xs" style={{ color: 'var(--moni-primary-600)', maxWidth: 180 }}>
              {estado.arquivo_path.split('/').pop()}
            </span>
          )}
        </div>
        <input
          ref={inputFileRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
        />
        {erroEl}
      </div>
    );
  }

  // texto_curto | email | telefone | numero
  const inputType =
    item.tipo === 'email' ? 'email' : item.tipo === 'telefone' ? 'tel' : item.tipo === 'numero' ? 'number' : 'text';

  return (
    <div>
      {labelEl}
      <input
        type={inputType}
        className={inputClass}
        placeholder={item.placeholder ?? ''}
        value={estado.valor}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onBlur(e.target.value)}
      />
      {erroEl}
    </div>
  );
}
