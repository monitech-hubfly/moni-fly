'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { computeChecklistLegalCompleto, computeChecklistLegalProgresso } from '@/lib/checklist-legal/compute-completo';
import {
  CHECKLIST_LEGAL_SECTIONS,
  CHECKLIST_LEGAL_SECTION_COUNT,
  type ChecklistLegalFieldDef,
} from '@/lib/checklist-legal/form-definition';
import type { ChecklistLegalArquivos, ChecklistLegalFileMeta, ChecklistLegalRespostas } from '@/lib/checklist-legal/types';

type Props = {
  respostas: ChecklistLegalRespostas;
  arquivos: ChecklistLegalArquivos;
  onChangeRespostas: (next: ChecklistLegalRespostas) => void;
  onChangeArquivos: (next: ChecklistLegalArquivos) => void;
  onSaveDraft: () => Promise<void>;
  onConcluir?: () => Promise<void>;
  onUploadFiles: (fieldKey: string, files: File[]) => Promise<ChecklistLegalFileMeta[]>;
  readOnly?: boolean;
  compact?: boolean;
};

function mergeFiles(
  prev: ChecklistLegalArquivos,
  fieldKey: string,
  uploaded: ChecklistLegalFileMeta[],
  multiple?: boolean,
): ChecklistLegalArquivos {
  const key = fieldKey as keyof ChecklistLegalArquivos;
  const existing = prev[key] ?? [];
  return {
    ...prev,
    [key]: multiple ? [...existing, ...uploaded] : uploaded,
  };
}

function FieldInput({
  field,
  respostas,
  arquivos,
  readOnly,
  onChangeRespostas,
  onUpload,
}: {
  field: ChecklistLegalFieldDef;
  respostas: ChecklistLegalRespostas;
  arquivos: ChecklistLegalArquivos;
  readOnly?: boolean;
  onChangeRespostas: (next: ChecklistLegalRespostas) => void;
  onUpload: (fieldKey: string, files: File[]) => Promise<void>;
}) {
  const [uploading, setUploading] = useState(false);

  if (field.type === 'checkbox_group') {
    const selected = (respostas[field.key] as string[] | undefined) ?? [];
    return (
      <div className="rounded-lg border border-stone-200 p-3">
        <p className="text-sm font-medium text-stone-800">
          {field.label}
          {field.required ? <span className="text-red-600"> *</span> : null}
        </p>
        {field.hint ? <p className="mt-1 text-xs text-stone-500">{field.hint}</p> : null}
        <div className="mt-2 space-y-2">
          {(field.options ?? []).map((opt) => (
            <label key={opt} className="flex items-start gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                disabled={readOnly}
                checked={selected.includes(opt)}
                onChange={(e) => {
                  const next = e.target.checked ? [...selected, opt] : selected.filter((x) => x !== opt);
                  onChangeRespostas({ ...respostas, [field.key]: next });
                }}
                className="mt-0.5 h-4 w-4"
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === 'file') {
    const ak = (field.arquivoKey ?? field.key) as keyof ChecklistLegalArquivos;
    const list = arquivos[ak] ?? [];
    return (
      <div>
        <label className="block text-sm font-medium text-stone-700">
          {field.label}
          {field.required ? <span className="text-red-600"> *</span> : null}
        </label>
        {!readOnly ? (
          <input
            type="file"
            accept=".pdf,application/pdf"
            multiple={field.multiple}
            className="mt-1 w-full text-xs"
            disabled={uploading}
            onChange={(e) => {
              const selected = e.target.files ? Array.from(e.target.files) : [];
              if (!selected.length) return;
              setUploading(true);
              void onUpload(String(ak), selected).finally(() => {
                setUploading(false);
                e.target.value = '';
              });
            }}
          />
        ) : null}
        <div className="mt-2 space-y-1 text-xs text-stone-500">
          {list.length === 0 ? <div>—</div> : null}
          {list.map((f, idx) => (
            <div key={`${f.storage_path}-${idx}`}>{f.nome_original ?? f.storage_path}</div>
          ))}
        </div>
        {uploading ? (
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-stone-500">
            <Loader2 className="h-3 w-3 animate-spin" /> Enviando…
          </p>
        ) : null}
      </div>
    );
  }

  const value = String(respostas[field.key] ?? '');
  if (field.type === 'textarea') {
    return (
      <label className="block">
        <span className="text-sm font-medium text-stone-700">
          {field.label}
          {field.required ? <span className="text-red-600"> *</span> : null}
        </span>
        {field.hint ? <p className="mt-1 text-xs text-stone-500">{field.hint}</p> : null}
        <textarea
          rows={4}
          disabled={readOnly}
          value={value}
          onChange={(e) => onChangeRespostas({ ...respostas, [field.key]: e.target.value })}
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
        />
      </label>
    );
  }

  return (
    <label className="block">
      <span className="text-sm font-medium text-stone-700">
        {field.label}
        {field.required ? <span className="text-red-600"> *</span> : null}
      </span>
      {field.hint ? <p className="mt-1 text-xs text-stone-500">{field.hint}</p> : null}
      <input
        type="text"
        disabled={readOnly}
        value={value}
        onChange={(e) => onChangeRespostas({ ...respostas, [field.key]: e.target.value })}
        className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
      />
    </label>
  );
}

export function ChecklistLegalFormWizard({
  respostas,
  arquivos,
  onChangeRespostas,
  onChangeArquivos,
  onSaveDraft,
  onConcluir,
  onUploadFiles,
  readOnly = false,
  compact = false,
}: Props) {
  const [page, setPage] = useState(0);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const progresso = useMemo(() => computeChecklistLegalProgresso(respostas, arquivos), [respostas, arquivos]);
  const completo = useMemo(() => computeChecklistLegalCompleto(respostas, arquivos), [respostas, arquivos]);
  const section = CHECKLIST_LEGAL_SECTIONS[page];

  async function handleUpload(fieldKey: string, files: File[]) {
    setErro(null);
    const uploaded = await onUploadFiles(fieldKey, files);
    const field = CHECKLIST_LEGAL_SECTIONS.flatMap((s) => s.fields).find(
      (f) => (f.arquivoKey ?? f.key) === fieldKey,
    );
    onChangeArquivos(mergeFiles(arquivos, fieldKey, uploaded, field?.multiple));
  }

  async function goPage(target: number) {
    if (target === page) return;
    if (!readOnly) {
      setSaving(true);
      setErro(null);
      try {
        await onSaveDraft();
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro ao salvar rascunho.');
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    setPage(target);
    setOkMsg(null);
  }

  async function salvar() {
    setSaving(true);
    setErro(null);
    setOkMsg(null);
    try {
      await onSaveDraft();
      setOkMsg('Rascunho salvo.');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function concluir() {
    if (!onConcluir) return;
    setSaving(true);
    setErro(null);
    setOkMsg(null);
    try {
      await onConcluir();
      setOkMsg('Checklist Legal concluído.');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao concluir.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <div>
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-stone-900">{section.title}</p>
            <p className="text-xs text-stone-500">
              Seção {page + 1} / {CHECKLIST_LEGAL_SECTION_COUNT} · {progresso.preenchidos}/{progresso.total}{' '}
              obrigatórios
            </p>
          </div>
          {completo ? (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-800">
              Completo
            </span>
          ) : (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
              Pendente
            </span>
          )}
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded bg-stone-100">
          <div
            className="h-full bg-moni-accent transition-all"
            style={{ width: `${((page + 1) / CHECKLIST_LEGAL_SECTION_COUNT) * 100}%` }}
          />
        </div>
      </div>

      <div className="space-y-4">
        {section.fields.map((field) => (
          <FieldInput
            key={field.key}
            field={field}
            respostas={respostas}
            arquivos={arquivos}
            readOnly={readOnly}
            onChangeRespostas={onChangeRespostas}
            onUpload={handleUpload}
          />
        ))}
      </div>

      {erro ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div> : null}
      {okMsg ? <div className="text-sm text-green-700">{okMsg}</div> : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={page <= 0 || saving}
          onClick={() => void goPage(page - 1)}
          className="inline-flex items-center gap-1 rounded border border-stone-300 bg-white px-3 py-1.5 text-sm disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" /> Anterior
        </button>
        <button
          type="button"
          disabled={page >= CHECKLIST_LEGAL_SECTION_COUNT - 1 || saving}
          onClick={() => void goPage(page + 1)}
          className="inline-flex items-center gap-1 rounded border border-stone-300 bg-white px-3 py-1.5 text-sm disabled:opacity-50"
        >
          Próxima <ChevronRight className="h-4 w-4" />
        </button>
        {!readOnly ? (
          <>
            <button
              type="button"
              disabled={saving}
              onClick={() => void salvar()}
              className="rounded bg-stone-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? 'Salvando…' : 'Salvar rascunho'}
            </button>
            {onConcluir ? (
              <button
                type="button"
                disabled={saving || !completo}
                onClick={() => void concluir()}
                className="rounded bg-moni-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                Concluir checklist
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

export { mergeFiles };
