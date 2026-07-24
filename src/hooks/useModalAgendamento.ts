'use client';

import { useCallback, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isoWeek } from '@/utils/periodos';
import { registrarLog } from '@/hooks/useAuditLog';
import type { DadosAgendamento, RecorrenciaConfig } from '@/components/carometro/todo/ModalAgendamento';
import { gerarOcorrencias } from '@/components/carometro/todo/ModalAgendamento';

type Modo = 'criar' | 'editar';

export type UseModalAgendamentoResult = {
  aberto: boolean;
  preenchido: Partial<DadosAgendamento>;
  modo: Modo;
  isSaving: boolean;
  erroSalvar: string | null;
  abrirParaCriar: (preenchido?: Partial<DadosAgendamento>) => void;
  abrirParaEditar: (id: string) => void;
  fechar: () => void;
  salvar: (dados: DadosAgendamento) => Promise<void>;
  excluir: () => Promise<void>;
};

export function useModalAgendamento(
  effectiveProfileId: string | null,
  areaId: string | null,
  onSalvo?: () => void,
): UseModalAgendamentoResult {
  const supabase   = useMemo(() => createClient(), []);
  const [aberto,     setAberto]     = useState(false);
  const [preenchido, setPreenchido] = useState<Partial<DadosAgendamento>>({});
  const [modo,       setModo]       = useState<Modo>('criar');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [isSaving,   setIsSaving]   = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  const abrirParaCriar = useCallback((dados?: Partial<DadosAgendamento>) => {
    setPreenchido(dados ?? {});
    setModo('criar');
    setEditandoId(null);
    setAberto(true);
  }, []);

  const abrirParaEditar = useCallback(async (id: string) => {
    const { data } = await supabase
      .from('gantt_planejamento')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (data) {
      const r = data as Record<string, unknown>;
      // Carregar participantes
      const { data: parts } = await supabase
        .from('gantt_agenda_participantes')
        .select('profile_id')
        .eq('gantt_id', id);
      const participantes = ((parts ?? []) as { profile_id: string }[]).map(p => p.profile_id);

      setPreenchido({
        acao_id:           (r.acao_id as string | null)           ?? null,
        objetivo_id:       (r.objetivo_id as string | null)       ?? null,
        data:              (r.data as string | null)              ?? null,
        hora_inicio:       (r.hora_inicio as string | null)       ?? null,
        hora_fim:          (r.hora_fim as string | null)          ?? null,
        casa_id:           (r.casa_id as string | null)           ?? null,
        franqueado_id:     (r.franqueado_id as string | null)     ?? null,
        rede_loteador_id:  (r.rede_loteador_id as string | null)  ?? null,
        condominio_id:     (r.condominio_id as string | null)     ?? null,
        adm_cnpj_id:       (r.adm_cnpj_id as string | null)      ?? null,
        sirene_chamado_id: (r.sirene_chamado_id as number | null) ?? null,
        card_id:           (r.card_id as string | null)           ?? null,
        recorrente:        Boolean(r.recorrente),
        recorrencia_config: (r.recorrencia_config as RecorrenciaConfig | null) ?? null,
        observacoes:       (r.comentario_conclusao as string | null) ?? null,
        link_reuniao:           (r.link_reuniao as string | null)           ?? null,
        titulo:                 (r.titulo as string | null)                 ?? null,
        participantes,
        participantes_externos: (r.participantes_externos as string[] | null) ?? [],
        origem_tipo:            (r.origem_tipo as DadosAgendamento['origem_tipo']) ?? null,
      });
    }
    setModo('editar');
    setEditandoId(id);
    setAberto(true);
  }, [supabase]);

  const fechar = useCallback(() => {
    setAberto(false);
    setPreenchido({});
    setEditandoId(null);
    setErroSalvar(null);
  }, []);

  const salvar = useCallback(async (dados: DadosAgendamento) => {
    if (!effectiveProfileId) return;
    setIsSaving(true);
    setErroSalvar(null);
    try {
      const semana = dados.data ? isoWeek(new Date(dados.data)) : null;
      const payload: Record<string, unknown> = {
        acao_id:             dados.acao_id,
        objetivo_id:         dados.objetivo_id,
        data:                dados.data,
        hora_inicio:         dados.hora_inicio,
        hora_fim:            dados.hora_fim,
        casa_id:             dados.casa_id,
        franqueado_id:       dados.franqueado_id,
        rede_loteador_id:    dados.rede_loteador_id,
        condominio_id:       dados.condominio_id,
        adm_cnpj_id:         dados.adm_cnpj_id,
        sirene_chamado_id:   dados.sirene_chamado_id,
        card_id:             dados.card_id,
        recorrente:          dados.recorrente,
        recorrencia_config:  dados.recorrente ? dados.recorrencia_config : null,
        comentario_conclusao: dados.observacoes,
        link_reuniao:           dados.link_reuniao,
        titulo:                 dados.titulo,
        origem_tipo:            dados.origem_tipo,
        participantes_externos: dados.participantes_externos ?? [],
      };

      if (modo === 'criar') {
        // ── Calcular datas: 1 ou N ocorrências ──────────────────────────────
        let datas: string[] = dados.data ? [dados.data] : [];
        if (dados.recorrente && dados.recorrencia_config && dados.data) {
          try {
            datas = gerarOcorrencias(dados.data, dados.recorrencia_config);
          } catch { /* usa apenas a data base */ }
        }

        // Gera grupo UUID para recorrências (mesmo ID em todas as ocorrências)
        const recorrenciaGrupoId = datas.length > 1
          ? crypto.randomUUID()
          : null;

        // Insere uma linha por ocorrência
        const inserts = datas.map(dt => {
          const semDt = isoWeek(new Date(dt));
          return {
            ...payload,
            data:                dt,
            semana_ano_inicio:   semDt,
            semana_ano_fim:      semDt,
            semanas_selecionadas: [semDt],
            profile_id:          effectiveProfileId,
            origem:              'agenda',
            recorrencia_grupo_id: recorrenciaGrupoId,
          };
        });

        const { data: inserted, error } = await supabase
          .from('gantt_planejamento')
          .insert(inserts)
          .select('id');
        if (error) throw error;

        // Participantes: inserir para cada registro criado
        const ids = ((inserted ?? []) as { id: string }[]).map(r => r.id);
        if (dados.participantes.length > 0 && ids.length > 0) {
          const partRows = ids.flatMap(gantt_id =>
            dados.participantes.map(profile_id => ({ gantt_id, profile_id }))
          );
          await supabase.from('gantt_agenda_participantes').insert(partRows);
        }

        void (registrarLog as unknown as (a: Record<string, unknown>) => Promise<void>)({
          modulo: 'Planejamento', area: areaId,
          entidade: 'gantt_planejamento', entidade_id: ids[0] ?? null,
          operacao: 'INSERT',
          descricao: `Nova atividade agendada para ${dados.data ?? ''}${datas.length > 1 ? ` (${datas.length} ocorrências)` : ''}`,
        });

      } else if (editandoId) {
        const { error } = await supabase
          .from('gantt_planejamento')
          .update(payload)
          .eq('id', editandoId);
        if (error) throw error;

        // Sincronizar participantes: apagar todos e re-inserir
        await supabase.from('gantt_agenda_participantes').delete().eq('gantt_id', editandoId);
        if (dados.participantes.length > 0) {
          await supabase.from('gantt_agenda_participantes').insert(
            dados.participantes.map(profile_id => ({ gantt_id: editandoId, profile_id }))
          );
        }

        void (registrarLog as unknown as (a: Record<string, unknown>) => Promise<void>)({
          modulo: 'Planejamento', area: areaId,
          entidade: 'gantt_planejamento', entidade_id: editandoId,
          operacao: 'UPDATE',
          descricao: `Atividade atualizada: ${dados.data ?? ''}`,
        });
      }

      fechar();
      onSalvo?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : JSON.stringify(e);
      console.error('[salvar] erro:', e);
      setErroSalvar(msg);
    } finally {
      setIsSaving(false);
    }
  }, [supabase, effectiveProfileId, areaId, modo, editandoId, fechar, onSalvo]);

  const excluir = useCallback(async () => {
    if (!editandoId) return;
    setIsSaving(true);
    setErroSalvar(null);
    try {
      await supabase.from('gantt_agenda_participantes').delete().eq('gantt_id', editandoId);
      const { error } = await supabase.from('gantt_planejamento').delete().eq('id', editandoId);
      if (error) throw error;
      fechar();
      onSalvo?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : JSON.stringify(e);
      setErroSalvar(msg);
    } finally {
      setIsSaving(false);
    }
  }, [supabase, editandoId, fechar, onSalvo]);

  return { aberto, preenchido, modo, isSaving, erroSalvar, abrirParaCriar, abrirParaEditar, fechar, salvar, excluir };
}
