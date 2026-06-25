'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { SearchableSelect } from '@/components/SearchableSelect';
import { createClient } from '@/lib/supabase/client';
import { MONI_TODOS_EMAILS } from '@/lib/times-responsaveis';

type ProfileOpcaoRow = { id: string; full_name: string | null; email?: string | null };
type OpcaoUsuario = { id: string; nome: string };

type Props = {
  label: string;
  obrigatorio?: boolean;
  value: string;
  salvando?: boolean;
  onChange: (userId: string) => void;
  /** Quando informado, mescla com a lista buscada no cliente. */
  opcoes?: OpcaoUsuario[];
  /** Tamanho compacto (11px) por padrão — usado em todos os kanbans/funis. */
  size?: 'xs' | 'compact' | 'sm';
  placeholder?: string;
  selectedLabelOverride?: string;
  menuPortal?: boolean;
};

function profileToOpcao(r: ProfileOpcaoRow): OpcaoUsuario {
  return {
    id: String(r.id),
    nome:
      String(r.full_name ?? '').trim() ||
      String(r.email ?? '').trim() ||
      String(r.id).slice(0, 8),
  };
}

function mergeOpcoesUsuarios(...listas: OpcaoUsuario[][]): OpcaoUsuario[] {
  const byId = new Map<string, OpcaoUsuario>();
  for (const lista of listas) {
    for (const o of lista) {
      const id = String(o.id ?? '').trim();
      if (!id) continue;
      byId.set(id, { id, nome: String(o.nome ?? '').trim() || id.slice(0, 8) });
    }
  }
  return [...byId.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

function idsEquivalentes(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

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
  const [opcoes, setOpcoes] = useState<OpcaoUsuario[]>(opcoesProp ?? []);
  const [loading, setLoading] = useState(!opcoesProp?.length);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      setLoading(true);
      const supabase = createClient();
      const listas: OpcaoUsuario[][] = [];

      if (opcoesProp?.length) {
        listas.push(opcoesProp);
      } else {
        const [bulkRes, moniRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, full_name, email')
            .order('full_name', { ascending: true, nullsFirst: false })
            .limit(500),
          supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('email', [...MONI_TODOS_EMAILS]),
        ]);
        listas.push(
          ((bulkRes.data ?? []) as ProfileOpcaoRow[]).map(profileToOpcao),
          ((moniRes.data ?? []) as ProfileOpcaoRow[]).map(profileToOpcao),
        );
      }

      let merged = mergeOpcoesUsuarios(...listas);
      const valor = String(value ?? '').trim();
      if (valor && !merged.some((o) => idsEquivalentes(o.id, valor))) {
        const { data: sel } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('id', valor)
          .maybeSingle();
        if (sel) {
          merged = mergeOpcoesUsuarios(merged, [profileToOpcao(sel as ProfileOpcaoRow)]);
        }
      }

      if (!cancelado) {
        setOpcoes(merged);
        setLoading(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [opcoesProp, value]);

  const selectOptions = useMemo(
    () => opcoes.map((o) => ({ value: o.id, label: o.nome })),
    [opcoes],
  );

  const labelSelecionado = useMemo(() => {
    const v = String(value ?? '').trim();
    if (!v) return selectedLabelOverride?.trim() || '';
    const hit = opcoes.find((o) => idsEquivalentes(o.id, v));
    return hit?.nome?.trim() || selectedLabelOverride?.trim() || '';
  }, [opcoes, value, selectedLabelOverride]);

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
          selectedLabelOverride={labelSelecionado || selectedLabelOverride}
          menuPortal={menuPortal}
          aria-label={label || 'Selecionar usuário'}
        />
      )}
    </div>
  );
}
