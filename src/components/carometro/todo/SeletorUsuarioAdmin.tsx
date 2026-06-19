'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export type SimulacaoUsuario = {
  profileId: string;
  areaId: string;
  nomeUsuario: string;
  label: string;
};

export function useSimulacaoUsuario() {
  const [simulacao, setSimulacao] = useState<SimulacaoUsuario | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('carometro_simulacao');
      if (raw) setSimulacao(JSON.parse(raw) as SimulacaoUsuario);
    } catch {}
  }, []);

  const definir = useCallback((data: SimulacaoUsuario) => {
    localStorage.setItem('carometro_simulacao', JSON.stringify(data));
    setSimulacao(data);
  }, []);

  const limpar = useCallback(() => {
    localStorage.removeItem('carometro_simulacao');
    setSimulacao(null);
  }, []);

  return { simulacao, definir, limpar };
}

type ProfileOpcao = {
  profileId: string;
  fullName: string;
  email: string;
  areas: { areaId: string; areaNome: string; nomeUsuario: string }[];
};

const ADMIN_EMAIL = 'danilo.n@moni.casa';

export function SeletorUsuarioAdmin() {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<ProfileOpcao[]>([]);
  const [areaSelecionada, setAreaSelecionada] = useState<string>('');
  const { simulacao, definir, limpar } = useSimulacaoUsuario();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setEmail(user.email);
    });
  }, [supabase]);

  useEffect(() => {
    if (email !== ADMIN_EMAIL) return;

    void (async () => {
      // 1. Busca area_pessoas com profile_id vinculado
      type ApRow = { nome: string; area_id: string; profile_id: string; areas: { nome: string } | null };
      const { data: apData } = await supabase
        .from('area_pessoas')
        .select('nome, area_id, profile_id, areas(nome)')
        .not('profile_id', 'is', null)
        .eq('ativo', true);

      const apRows = (apData ?? []) as unknown as ApRow[];

      // IDs únicos de profile com vínculo
      const profileIds = [...new Set(apRows.map(r => r.profile_id))];
      if (profileIds.length === 0) return;

      // 2. Busca profiles únicos
      type ProfRow = { id: string; full_name: string | null; email: string | null };
      const { data: profData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', profileIds)
        .order('full_name');

      const profRows = (profData ?? []) as ProfRow[];

      // 3. Monta estrutura: um profile com suas áreas
      const lista: ProfileOpcao[] = profRows.map(p => ({
        profileId: p.id,
        fullName:  p.full_name ?? p.email ?? p.id,
        email:     p.email ?? '',
        areas:     apRows
          .filter(r => r.profile_id === p.id)
          .map(r => ({
            areaId:      r.area_id,
            areaNome:    r.areas?.nome ?? '',
            nomeUsuario: r.nome,
          })),
      }));

      setProfiles(lista);
    })();
  }, [email, supabase]);

  // Quando muda o profile selecionado, reseta o select de área
  const profileAtual = profiles.find(p => p.profileId === simulacao?.profileId);
  const areasDisponiveis = profileAtual?.areas ?? [];

  // Sincroniza areaSelecionada com a simulação ativa
  useEffect(() => {
    setAreaSelecionada(simulacao?.areaId ?? '');
  }, [simulacao?.areaId]);

  const handleProfileChange = (profileId: string) => {
    if (!profileId) { limpar(); return; }
    const p = profiles.find(x => x.profileId === profileId);
    if (!p) return;
    const primeiraArea = p.areas[0];
    if (!primeiraArea) return;
    definir({
      profileId:    p.profileId,
      areaId:       primeiraArea.areaId,
      nomeUsuario:  primeiraArea.nomeUsuario,
      label:        `${p.fullName} — ${primeiraArea.areaNome}`,
    });
  };

  const handleAreaChange = (areaId: string) => {
    if (!profileAtual) return;
    const area = profileAtual.areas.find(a => a.areaId === areaId);
    if (!area) return;
    definir({
      profileId:   profileAtual.profileId,
      areaId:      area.areaId,
      nomeUsuario: area.nomeUsuario,
      label:       `${profileAtual.fullName} — ${area.areaNome}`,
    });
  };

  if (email !== ADMIN_EMAIL) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-1.5">
      <span className="text-yellow-700 font-medium whitespace-nowrap">Visualizar como:</span>

      <select
        className="rounded border border-yellow-300 bg-white px-2 py-1 text-xs text-gray-700"
        value={simulacao?.profileId ?? ''}
        onChange={e => handleProfileChange(e.target.value)}
      >
        <option value="">— meu próprio perfil —</option>
        {profiles.map(p => (
          <option key={p.profileId} value={p.profileId}>
            {p.fullName} ({p.email})
          </option>
        ))}
      </select>

      {areasDisponiveis.length > 1 && (
        <>
          <span className="text-yellow-600 whitespace-nowrap">Área:</span>
          <select
            className="rounded border border-yellow-300 bg-white px-2 py-1 text-xs text-gray-700"
            value={areaSelecionada}
            onChange={e => handleAreaChange(e.target.value)}
          >
            {areasDisponiveis.map(a => (
              <option key={a.areaId} value={a.areaId}>
                {a.areaNome}
              </option>
            ))}
          </select>
        </>
      )}

      {simulacao && (
        <button
          type="button"
          onClick={limpar}
          className="whitespace-nowrap text-yellow-700 hover:text-red-600 font-medium transition-colors"
        >
          Limpar
        </button>
      )}
    </div>
  );
}
