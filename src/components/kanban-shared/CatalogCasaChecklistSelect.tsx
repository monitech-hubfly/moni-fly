'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Props = {
  label: string;
  obrigatorio?: boolean;
  value: string;
  salvando?: boolean;
  onChange: (catalogoCasaId: string) => void;
};

export function CatalogCasaChecklistSelect({ label, obrigatorio, value, salvando, onChange }: Props) {
  const [opcoes, setOpcoes] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase.from('catalogo_casas').select('id, nome').order('nome');
      if (!cancelado) {
        setOpcoes(
          ((data ?? []) as { id: string; nome: string }[]).map((r) => ({
            id: String(r.id),
            nome: String(r.nome ?? '').trim() || '—',
          })),
        );
        setLoading(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const inputClass =
    'w-full rounded-md border px-3 py-1.5 text-sm outline-none focus:ring-1' +
    ' bg-white border-[var(--moni-border-default)] text-[var(--moni-text-primary)]' +
    ' focus:ring-[var(--moni-primary-500)] focus:border-[var(--moni-primary-500)]';

  return (
    <div>
      <span className="mb-1 block text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
        {label}
        {obrigatorio ? <span className="ml-1 text-red-500">*</span> : null}
        {salvando ? <Loader2 size={10} className="ml-1 inline animate-spin" /> : null}
      </span>
      {loading ? (
        <p className="text-xs text-stone-500">Carregando catálogo…</p>
      ) : (
        <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Selecione uma casa…</option>
          {opcoes.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nome}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
