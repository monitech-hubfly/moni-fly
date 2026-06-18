'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Props = {
  label: string;
  obrigatorio?: boolean;
  value: string;
  salvando?: boolean;
  onChange: (userId: string) => void;
  /** Quando informado, usa esta lista em vez de buscar profiles no cliente. */
  opcoes?: { id: string; nome: string }[];
};

export function UsuarioChecklistSelect({
  label,
  obrigatorio,
  value,
  salvando,
  onChange,
  opcoes: opcoesProp,
}: Props) {
  const [opcoes, setOpcoes] = useState<{ id: string; nome: string }[]>(opcoesProp ?? []);
  const [loading, setLoading] = useState(!opcoesProp?.length);

  useEffect(() => {
    if (opcoesProp?.length) {
      setOpcoes(opcoesProp);
      setLoading(false);
      return;
    }

    let cancelado = false;
    void (async () => {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name', { ascending: true, nullsFirst: false })
        .limit(500);
      if (!cancelado) {
        setOpcoes(
          ((data ?? []) as { id: string; full_name: string | null; email?: string | null }[]).map(
            (r) => ({
              id: String(r.id),
              nome:
                String(r.full_name ?? '').trim() ||
                String(r.email ?? '').trim() ||
                String(r.id).slice(0, 8),
            }),
          ),
        );
        setLoading(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [opcoesProp]);

  const inputClass =
    'w-full rounded-md border px-2.5 py-1 text-[11px] leading-tight outline-none focus:ring-1' +
    ' bg-white border-[var(--moni-border-default)] text-[var(--moni-text-primary)]' +
    ' focus:ring-[var(--moni-primary-500)] focus:border-[var(--moni-primary-500)]';

  return (
    <div>
      {label ? (
        <span className="mb-1 block text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
          {label}
          {obrigatorio ? <span className="ml-1 text-red-500">*</span> : null}
          {salvando ? <Loader2 size={10} className="ml-1 inline animate-spin" /> : null}
        </span>
      ) : salvando ? (
        <Loader2 size={10} className="mb-1 inline animate-spin" />
      ) : null}
      {loading ? (
        <p className="text-xs text-stone-500">Carregando usuários…</p>
      ) : (
        <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Selecione…</option>
          {opcoes.map((o) => (
            <option key={o.id} value={o.id} className="text-[11px]">
              {o.nome}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
