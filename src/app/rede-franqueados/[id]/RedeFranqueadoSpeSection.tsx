'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Link2, Loader2, Plus, Unlink } from 'lucide-react';
import type { FranqueadoSpeRow } from '@/lib/franqueado-spe';
import {
  FRANQUEADO_SPE_DOC_SLOTS,
  getFranqueadoSpeDocSlotValues,
} from '@/lib/rede-documentos-spe';
import { FRANQUEADO_EMPRESA_STATUS_LABEL, formatContaBancariaEmpresa } from '@/lib/franqueado-empresas';
import { isRedeDocSlotCompleto } from '@/lib/rede-documentos-franquia';
import {
  criarFranqueadoSpe,
  desvincularSpeDoCard,
  salvarJustificativaSpeDoc,
  uploadFranqueadoSpeDoc,
  vincularSpeACard,
} from '../franqueado-spe-actions';
import { getSignedUrlRedeAnexo } from '../actions';
import { RedeDocsSubsecaoColapsavel } from './rede-docs-secao-colapsavel';

type Props = {
  redeId: string;
  spes: FranqueadoSpeRow[];
};

function SpeDocCard({
  speId,
  slot,
  path,
  justificativa,
  uploading,
  onUpload,
  onRefresh,
}: {
  speId: string;
  slot: (typeof FRANQUEADO_SPE_DOC_SLOTS)[number];
  path: string | null;
  justificativa: string | null;
  uploading: string | null;
  onUpload: (tipo: string, file: File) => void;
  onRefresh: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [just, setJust] = useState(justificativa ?? '');
  const [saving, setSaving] = useState(false);
  const busy = uploading !== null || saving;
  const completo =
    !slot.obrigatorioParaCadastroCompleto ||
    isRedeDocSlotCompleto(path, slot.justificativaKey ? justificativa : null);

  async function salvarJust() {
    setSaving(true);
    const fd = new FormData();
    fd.set('speId', speId);
    fd.set('tipo', slot.tipo);
    fd.set('justificativa', just);
    await salvarJustificativaSpeDoc(fd);
    setSaving(false);
    onRefresh();
  }

  return (
    <div
      className={`rounded-lg border p-3 text-sm ${completo ? 'border-green-200 bg-green-50/40' : 'border-stone-200 bg-white'}`}
    >
      <p className="font-medium text-stone-800">{slot.titulo}</p>
      {path ? (
        <button
          type="button"
          className="mt-2 text-xs text-moni-primary underline"
          onClick={() => void getSignedUrlRedeAnexo(path).then((r) => r.ok && window.open(r.url, '_blank'))}
        >
          Ver arquivo
        </button>
      ) : slot.justificativaKey ? (
        <div className="mt-2 space-y-1">
          <textarea
            value={just}
            onChange={(e) => setJust(e.target.value)}
            rows={2}
            className="w-full rounded border border-stone-200 px-2 py-1 text-xs"
            placeholder="Justificativa se não houver anexo"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void salvarJust()}
            className="rounded bg-stone-800 px-2 py-1 text-[11px] text-white disabled:opacity-50"
          >
            Salvar justificativa
          </button>
        </div>
      ) : (
        <p className="mt-1 text-xs text-stone-500">Opcional</p>
      )}
      <div className="mt-2">
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) onUpload(slot.tipo, f);
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="rounded border border-stone-300 px-2 py-1 text-[11px] text-stone-700 hover:bg-stone-50 disabled:opacity-50"
        >
          {uploading === slot.tipo ? <Loader2 className="inline h-3 w-3 animate-spin" /> : null}
          {path ? 'Substituir' : 'Enviar'}
        </button>
      </div>
    </div>
  );
}

function SpeCadastroCard({ redeId, spe, onRefresh }: { redeId: string; spe: FranqueadoSpeRow; onRefresh: () => void }) {
  const [cardIdInput, setCardIdInput] = useState(spe.kanban_card_id ?? '');
  const [vinculando, setVinculando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const titulo = spe.nome_projeto?.trim() || spe.razao_social?.trim() || `SPE ${spe.id.slice(0, 8)}`;

  async function vincular() {
    setVinculando(true);
    setMsg(null);
    const res = await vincularSpeACard(spe.id, cardIdInput.trim());
    setVinculando(false);
    setMsg(res.ok ? res.mensagem : res.error);
    if (res.ok) onRefresh();
  }

  async function desvincular() {
    setVinculando(true);
    const res = await desvincularSpeDoCard(spe.id);
    setVinculando(false);
    if (res.ok) {
      setCardIdInput('');
      onRefresh();
    } else setMsg(res.error);
  }

  return (
    <div className="mb-3 rounded-lg border border-stone-200 bg-stone-50/50 p-3 text-xs text-stone-700">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <span>
          <strong>Status:</strong> {FRANQUEADO_EMPRESA_STATUS_LABEL[spe.status]}
        </span>
        <span>
          <strong>Conta:</strong>{' '}
          {formatContaBancariaEmpresa(spe.conta_banco, spe.conta_agencia, spe.conta_numero)}
        </span>
        {spe.kanban_card_id ? (
          <span>
            <strong>Card:</strong> <code className="text-[10px]">{spe.kanban_card_id}</code>
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="flex-1 min-w-[12rem]">
          <span className="text-[11px] text-stone-500">Vincular ao card (ID)</span>
          <input
            value={cardIdInput}
            onChange={(e) => setCardIdInput(e.target.value)}
            placeholder="UUID do card Kanban"
            className="mt-0.5 w-full rounded border border-stone-200 px-2 py-1 font-mono text-[11px]"
          />
        </label>
        <button
          type="button"
          disabled={vinculando || !cardIdInput.trim()}
          onClick={() => void vincular()}
          className="inline-flex items-center gap-1 rounded bg-moni-primary px-2 py-1 text-[11px] text-white disabled:opacity-50"
        >
          <Link2 className="h-3 w-3" />
          Vincular
        </button>
        {spe.kanban_card_id ? (
          <button
            type="button"
            disabled={vinculando}
            onClick={() => void desvincular()}
            className="inline-flex items-center gap-1 rounded border border-stone-300 px-2 py-1 text-[11px] disabled:opacity-50"
          >
            <Unlink className="h-3 w-3" />
            Desvincular
          </button>
        ) : null}
      </div>
      {msg ? <p className="mt-1 text-[11px] text-stone-600">{msg}</p> : null}
      <p className="mt-1 text-[10px] text-stone-500">
        Ao vincular, os Dados das Empresas do card são preenchidos com esta SPE.
      </p>
    </div>
  );
}

export function RedeFranqueadoSpeSection({ redeId, spes: spesIniciais }: Props) {
  const router = useRouter();
  const spes = spesIniciais;
  const [uploading, setUploading] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  const refresh = () => router.refresh();

  async function criarSpe() {
    setCriando(true);
    const res = await criarFranqueadoSpe(redeId);
    setCriando(false);
    if (res.ok) refresh();
  }

  async function onUpload(speId: string, tipo: string, file: File) {
    setUploading(`${speId}:${tipo}`);
    const fd = new FormData();
    fd.set('speId', speId);
    fd.set('tipo', tipo);
    fd.set('file', file);
    await uploadFranqueadoSpeDoc(fd);
    setUploading(null);
    refresh();
  }

  return (
    <div className="space-y-3 border-t border-stone-200 pt-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-stone-800">SPEs (por projeto)</p>
        <button
          type="button"
          disabled={criando}
          onClick={() => void criarSpe()}
          className="inline-flex items-center gap-1 rounded border border-stone-300 bg-white px-2 py-1 text-xs text-stone-700 hover:bg-stone-50 disabled:opacity-50"
        >
          {criando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Nova SPE
        </button>
      </div>

      {spes.length === 0 ? (
        <p className="text-sm text-stone-500">Nenhuma SPE cadastrada para este franqueado.</p>
      ) : (
        spes.map((spe) => {
          const titulo = spe.nome_projeto?.trim() || spe.razao_social?.trim() || `SPE ${spe.id.slice(0, 8)}`;
          return (
            <RedeDocsSubsecaoColapsavel key={spe.id} titulo={titulo} sectionId={`spe-${spe.id}`}>
              <SpeCadastroCard redeId={redeId} spe={spe} onRefresh={refresh} />
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {FRANQUEADO_SPE_DOC_SLOTS.map((slot) => {
                  const { path, justificativa } = getFranqueadoSpeDocSlotValues(spe, slot);
                  return (
                    <SpeDocCard
                      key={slot.tipo}
                      speId={spe.id}
                      slot={slot}
                      path={path}
                      justificativa={justificativa}
                      uploading={uploading?.startsWith(`${spe.id}:`) ? uploading.split(':')[1] ?? null : null}
                      onUpload={(tipo, file) => void onUpload(spe.id, tipo, file)}
                      onRefresh={refresh}
                    />
                  );
                })}
              </div>
            </RedeDocsSubsecaoColapsavel>
          );
        })
      )}
    </div>
  );
}
