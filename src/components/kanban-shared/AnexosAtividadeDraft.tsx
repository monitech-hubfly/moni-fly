'use client';

import { useRef } from 'react';
import { Paperclip, X } from 'lucide-react';

type Props = {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  compact?: boolean;
};

export function AnexosAtividadeDraft({ files, onChange, disabled = false, compact = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const iconCls = compact ? 'h-3.5 w-3.5' : 'h-4 w-4';

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!picked.length) return;
    onChange([...files, ...picked]);
  }

  function remover(idx: number) {
    onChange(files.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-wrap items-start gap-1.5">
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1 rounded p-0.5 text-stone-500 hover:bg-stone-200/80 hover:text-stone-700 disabled:opacity-50"
        title="Anexar arquivo à atividade"
        aria-label="Anexar arquivo à atividade"
      >
        <Paperclip className={iconCls} aria-hidden />
        {files.length > 0 ? (
          <span className="min-w-[1.1rem] rounded-full bg-stone-600 px-1 text-center text-[9px] font-bold leading-tight text-white">
            {files.length > 99 ? '99+' : files.length}
          </span>
        ) : null}
      </button>
      <input ref={inputRef} type="file" className="hidden" onChange={onPick} disabled={disabled} />
      {files.length > 0 ? (
        <ul className="flex min-w-0 flex-1 flex-col gap-0.5">
          {files.map((f, idx) => (
            <li key={`${f.name}-${idx}`} className="flex max-w-full items-center gap-1 text-[10px] text-stone-600">
              <span className="min-w-0 truncate">{f.name}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => remover(idx)}
                className="shrink-0 rounded p-0.5 text-stone-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                aria-label={`Remover anexo ${f.name}`}
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
