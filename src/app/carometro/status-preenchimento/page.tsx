'use client';

import { useEffect, useMemo, useState } from 'react';
import { StatusPreenchimentoBoard } from '@/components/carometro/status-preenchimento/StatusPreenchimentoBoard';
import {
  StatusPreenchimentoEntregaModal,
  type EntregaModalContext,
} from '@/components/carometro/status-preenchimento/StatusPreenchimentoEntregaModal';
import { StatusPreenchimentoModal } from '@/components/carometro/status-preenchimento/StatusPreenchimentoModal';
import { useStatusPreenchimentoData } from '@/components/carometro/status-preenchimento/useStatusPreenchimentoData';
import { useAdmin } from '@/context/AdminContext';
import { semanaIsoComOffset, type SemanaColuna } from '@/utils/statusPreenchimento';

export default function StatusPreenchimentoPage() {
  const {
    supabase,
    loading,
    erro,
    areas,
    registros,
    semanasColunas,
    ganttRows,
    indicadorIdsPorArea,
    lancamentosInd,
    temDadosGanttAreaSemana,
    temDadosIndicadoresAreaSemana,
    recarregar,
  } = useStatusPreenchimentoData();
  const { isAdmin } = useAdmin();

  const [modalOpen, setModalOpen] = useState(false);
  const [entregaModalOpen, setEntregaModalOpen] = useState(false);
  const [entregaContext, setEntregaContext] = useState<EntregaModalContext | null>(null);
  const [modalAreaId, setModalAreaId] = useState<string | null>(null);
  const [modalRespId, setModalRespId] = useState<string | null>(null);
  const [modalSemana, setModalSemana] = useState<SemanaColuna>(() => semanaIsoComOffset(0));
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authNome, setAuthNome] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setAuthUserId(data.user?.id ?? null);
      setAuthNome(data.user?.email ?? data.user?.user_metadata?.full_name ?? 'Usuário');
    });
  }, [supabase]);

  useEffect(() => {
    if (!areas.length) return;
    const ids = new Set(areas.map((a) => String(a.id)));
    const fromStorage = localStorage.getItem('carometro_ultima_area');
    const next =
      (fromStorage && ids.has(fromStorage) ? fromStorage : null) ||
      (areas[0]?.id ? String(areas[0].id) : null);
    if (next) {
      setModalAreaId(next);
      localStorage.setItem('carometro_ultima_area', next);
    }
  }, [areas]);

  const semanaAtual = useMemo(() => semanaIsoComOffset(0), []);
  const primeiraArea = areas[0]?.id ?? null;

  function abrirModal(areaId: string | null, respId: string | null, semana: SemanaColuna) {
    setModalAreaId(areaId);
    if (areaId) localStorage.setItem('carometro_ultima_area', areaId);
    setModalRespId(respId);
    setModalSemana(semana);
    setModalOpen(true);
  }

  return (
    <div className="sp-page">
      <header className="sp-page-header">
        <div>
          <h1 className="carometro-page-title">Status de Preenchimento</h1>
          <p className="carometro-page-subtitle">
            Acompanhe o registro semanal por área. Prazo: toda sexta-feira — após o prazo o registro é bloqueado
            automaticamente. Em caso de feriado, antecipe para o último dia útil da semana.
          </p>
        </div>
        <button
          type="button"
          className="sp-btn-registrar"
          onClick={() =>
            abrirModal(
              modalAreaId || primeiraArea,
              modalRespId,
              semanaAtual,
            )
          }
        >
          Registrar Entrega Semanal
        </button>
      </header>

      <div className="sp-alerta" role="status">
        O registro só é liberado quando há dados preenchidos em Planejamento (Gantt) e Indicadores daquela semana. Após a
        sexta-feira o campo é bloqueado sem exceção.
      </div>

      {erro && (
        <div className="sp-erro-banner" role="alert">
          {erro}
        </div>
      )}

      {loading ? (
        <p className="sp-loading">Carregando…</p>
      ) : (
        <StatusPreenchimentoBoard
          areas={areas}
          semanasColunas={semanasColunas}
          registros={registros}
          temDadosGanttAreaSemana={temDadosGanttAreaSemana}
          temDadosIndicadoresAreaSemana={temDadosIndicadoresAreaSemana}
          onCelulaClick={(areaId, respId, col) => abrirModal(areaId, respId, col)}
          onCelulaOkClick={(payload) => {
            setEntregaContext(payload);
            setEntregaModalOpen(true);
          }}
          authUserId={authUserId}
          authNome={authNome}
        />
      )}

      <StatusPreenchimentoEntregaModal
        open={entregaModalOpen}
        onClose={() => {
          setEntregaModalOpen(false);
          setEntregaContext(null);
        }}
        supabase={supabase}
        context={entregaContext}
        authUserId={authUserId}
        authNome={authNome}
        isAdmin={isAdmin}
        onDesfeito={recarregar}
      />

      <StatusPreenchimentoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        supabase={supabase}
        areas={areas}
        semanaInicial={modalSemana}
        areaInicialId={modalAreaId}
        responsavelInicialId={modalRespId}
        ganttRows={ganttRows}
        indicadorIdsPorArea={indicadorIdsPorArea}
        lancamentosInd={lancamentosInd}
        onConfirmado={recarregar}
      />
    </div>
  );
}
