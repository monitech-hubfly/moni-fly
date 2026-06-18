'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { SearchableSelect } from '@/components/SearchableSelect';
import { createClient } from '@/lib/supabase/client';

type Props = {
  label: string;
  obrigatorio?: boolean;
  value: string;
  salvando?: boolean;
  onChange: (userId: string) => void;
  /** Quando informado, usa esta lista em vez de buscar profiles no cliente. */
  opcoes?: { id: string; nome: string }[];
  /** Tamanho compacto (11px) por padrão — usado em todos os kanbans/funis. */
  size?: 'xs' | 'compact' | 'sm';
  placeholder?: string;
  selectedLabelOverride?: string;
  menuPortal?: boolean;
};

export function UsuarioChecklistSelect({
  label,
  obrigatorio,
  value,
  salvando,
  onChange,
  opcoes: opcoesProp,
  size = 'compact',
  placeholder = 'Selecione…',
  selectedLabelOverride,
  menuPortal = false,
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

  const selectOptions = useMemo(
    () => opcoes.map((o) => ({ value: o.id, label: o.nome })),
    [opcoes],
  );

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
        <p className="text-[11px] text-stone-500">Carregando usuários…</p>
      ) : (
        <SearchableSelect
          value={value}
          onChange={onChange}
          options={selectOptions}
          placeholder={placeholder}
          searchPlaceholder="Buscar usuário…"
          size={size}
          emptyOption={{ value: '', label: placeholder }}
          listMaxHeightClassName="max-h-48"
          triggerClassName="border-[var(--moni-border-default)] text-[var(--moni-text-primary)]"
          selectedLabelOverride={selectedLabelOverride}
          menuPortal={menuPortal}
          aria-label={label || 'Selecionar usuário'}
        />
      )}
    </div>
  );
}
