'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Link2, Loader2, Plus, Unlink } from 'lucide-react';
import type { FranqueadoSpeRow } from '@/lib/franqueado-spe';
import {
  FRANQUEADO_SPE_DOC_SLOTS,
  getFranqueadoSpeDocSlotValues,
} from '@/lib/rede-documentos-spe';
import { FRANQUEADO_EMPRESA_STATUS_LABEL, formatContaBancariaEmpresa, type FranqueadoEmpresaStatus } from '@/lib/franqueado-empresas';
import { isRedeDocSlotCompleto } from '@/lib/rede-documentos-franquia';
import {
  criarFranqueadoSpe,
  desvincularSpeDoCard,
  salvarJustificativaSpeDoc,
  uploadFranqueadoSpeDoc,
  upsertFranqueadoSpe,
  vincularSpeACard,
} from '../franqueado-spe-actions';
import { getSignedUrlRedeAnexo } from '../actions';
import { RedeDocsSubsecaoColapsavel } from './rede-docs-secao-colapsavel';

type Props = {
  redeId: string;
  spes: FranqueadoSpeRow[];
  permiteCriar: boolean;
};

const inputCls = 'mt-0.5 w-full rounded border border-stone-200 px-2 py-1.5 text-xs text-stone-800';

type SpeCadastroDraft = {
  nome_projeto: string;
  razao_social: string;
  cnpj: string;
  inscricao_municipal: string;
  inscricao_estadual: string;
  status: FranqueadoEmpresaStatus;
  conta_banco: string;
  conta_agencia: string;
  conta_numero: string;
};

function speToCadastroDraft(spe: FranqueadoSpeRow): SpeCadastroDraft {
  return {
    nome_projeto: spe.nome_projeto ?? '',
    razao_social: spe.razao_social ?? '',
    cnpj: spe.cnpj ?? '',
    inscricao_municipal: spe.inscricao_municipal ?? '',
    inscricao_estadual: spe.inscricao_estadual ?? '',
    status: spe.status ?? 'em_abertura',
    conta_banco: spe.conta_banco ?? '',
    conta_agencia: spe.conta_agencia ?? '',
    conta_numero: spe.conta_numero ?? '',
  };
}

function draftToSpeUpsert(d: SpeCadastroDraft) {
  return {
    nome_projeto: d.nome_projeto.trim() || null,
    razao_social: d.razao_social.trim() || null,
    cnpj: d.cnpj.trim() || null,
    inscricao_municipal: d.inscricao_municipal.trim() || null,
    inscricao_estadual: d.inscricao_estadual.trim() || null,
    status: d.status,
    conta_banco: d.conta_banco.trim() || null,
    conta_agencia: d.conta_agencia.trim() || null,
    conta_numero: d.conta_numero.trim() || null,
  };
}

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

function SpeCadastroCard({ spe, onRefresh }: { redeId: string; spe: FranqueadoSpeRow; onRefresh: () => void }) {
  const [draft, setDraft] = useState(() => speToCadastroDraft(spe));
  const [cardIdInput, setCardIdInput] = useState(spe.kanban_card_id ?? '');
  const [vinculando, setVinculando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setDraft(speToCadastroDraft(spe));
    setCardIdInput(spe.kanban_card_id ?? '');
  }, [spe]);

  async function salvarCadastro() {
    setSalvando(true);
    setMsg(null);
    const res = await upsertFranqueadoSpe(spe.id, draftToSpeUpsert(draft));
    setSalvando(false);
    setMsg(res.ok ? 'Cadastro salvo.' : res.error);
    if (res.ok) onRefresh();
  }

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
    <div className="mb-4 space-y-4 rounded-lg border border-stone-200 bg-stone-50/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-600">Cadastro da SPE</p>
        <button
          type="button"
          disabled={salvando || vinculando}
          onClick={() => void salvarCadastro()}
          className="inline-flex items-center gap-1 rounded bg-moni-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Salvar cadastro
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block sm:col-span-2 lg:col-span-3">
          <span className="text-[11px] font-medium text-stone-500">Nome do projeto</span>
          <input
            value={draft.nome_projeto}
            onChange={(e) => setDraft((d) => ({ ...d, nome_projeto: e.target.value }))}
            className={inputCls}
            placeholder="Ex.: Residencial Horizonte"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[11px] font-medium text-stone-500">Razão social</span>
          <input
            value={draft.razao_social}
            onChange={(e) => setDraft((d) => ({ ...d, razao_social: e.target.value }))}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-medium text-stone-500">CNPJ</span>
          <input
            value={draft.cnpj}
            onChange={(e) => setDraft((d) => ({ ...d, cnpj: e.target.value }))}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-medium text-stone-500">Insc. municipal</span>
          <input
            value={draft.inscricao_municipal}
            onChange={(e) => setDraft((d) => ({ ...d, inscricao_municipal: e.target.value }))}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-medium text-stone-500">Insc. estadual</span>
          <input
            value={draft.inscricao_estadual}
            onChange={(e) => setDraft((d) => ({ ...d, inscricao_estadual: e.target.value }))}
            className={inputCls}
            placeholder="Opcional"
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-medium text-stone-500">Status</span>
          <select
            value={draft.status}
            onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as FranqueadoEmpresaStatus }))}
            className={inputCls}
          >
            {(Object.keys(FRANQUEADO_EMPRESA_STATUS_LABEL) as FranqueadoEmpresaStatus[]).map((s) => (
              <option key={s} value={s}>
                {FRANQUEADO_EMPRESA_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2 lg:col-span-3">
          <span className="text-[11px] font-medium text-stone-500">Conta bancária</span>
          <div className="mt-0.5 grid gap-2 sm:grid-cols-3">
            <input
              value={draft.conta_banco}
              onChange={(e) => setDraft((d) => ({ ...d, conta_banco: e.target.value }))}
              className={inputCls.replace('mt-0.5 ', '')}
              placeholder="Banco"
            />
            <input
              value={draft.conta_agencia}
              onChange={(e) => setDraft((d) => ({ ...d, conta_agencia: e.target.value }))}
              className={inputCls.replace('mt-0.5 ', '')}
              placeholder="Agência"
            />
            <input
              value={draft.conta_numero}
              onChange={(e) => setDraft((d) => ({ ...d, conta_numero: e.target.value }))}
              className={inputCls.replace('mt-0.5 ', '')}
              placeholder="Conta"
            />
          </div>
          {formatContaBancariaEmpresa(draft.conta_banco, draft.conta_agencia, draft.conta_numero) !== '—' ? (
            <p className="mt-1 text-[10px] text-stone-500">
              Resumo: {formatContaBancariaEmpresa(draft.conta_banco, draft.conta_agencia, draft.conta_numero)}
            </p>
          ) : null}
        </label>
      </div>

      <div className="border-t border-stone-200 pt-3">
        <p className="text-[11px] font-medium text-stone-600">Vínculo com card do Funil</p>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="min-w-[12rem] flex-1">
            <span className="text-[11px] text-stone-500">ID do card Kanban</span>
            <input
              value={cardIdInput}
              onChange={(e) => setCardIdInput(e.target.value)}
              placeholder="UUID do card Kanban"
              className="mt-0.5 w-full rounded border border-stone-200 px-2 py-1 font-mono text-[11px]"
            />
          </label>
          <button
            type="button"
            disabled={vinculando || salvando || !cardIdInput.trim()}
            onClick={() => void vincular()}
            className="inline-flex items-center gap-1 rounded bg-stone-800 px-2 py-1 text-[11px] text-white disabled:opacity-50"
          >
            <Link2 className="h-3 w-3" />
            Vincular
          </button>
          {spe.kanban_card_id ? (
            <button
              type="button"
              disabled={vinculando || salvando}
              onClick={() => void desvincular()}
              className="inline-flex items-center gap-1 rounded border border-stone-300 px-2 py-1 text-[11px] disabled:opacity-50"
            >
              <Unlink className="h-3 w-3" />
              Desvincular
            </button>
          ) : null}
        </div>
        <p className="mt-1 text-[10px] text-stone-500">
          Ao vincular, os Dados das Empresas do card são preenchidos com esta SPE.
        </p>
      </div>

      {msg ? <p className="text-[11px] text-stone-600">{msg}</p> : null}
    </div>
  );
}

export function RedeFranqueadoSpeSection({ redeId, spes: spesIniciais, permiteCriar }: Props) {
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
        {permiteCriar ? (
          <button
            type="button"
            disabled={criando}
            onClick={() => void criarSpe()}
            className="inline-flex items-center gap-1 rounded border border-stone-300 bg-white px-2 py-1 text-xs text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            {criando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            Nova SPE
          </button>
        ) : null}
      </div>

      {spes.length === 0 ? (
        <p className="text-sm text-stone-500">
          {permiteCriar ? 'Nenhuma SPE cadastrada para este franqueado.' : 'Nenhuma SPE cadastrada.'}
        </p>
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
