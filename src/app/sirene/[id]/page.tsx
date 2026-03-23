import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getChamado } from '../actions';
import { canActAsBombeiro, formatarStatus } from '@/lib/sirene';
import { DetalheChamadoConteudo } from '../DetalheChamadoConteudo';
import type { Chamado } from '@/types/sirene';

export default async function SireneChamadoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const chamadoId = parseInt(id, 10);
  if (Number.isNaN(chamadoId)) redirect('/sirene');

  const result = await getChamado(chamadoId);
  if (!result.ok) redirect('/sirene');

  const { chamado, userContext, currentUserId } = result;
  const ctx = userContext ?? { papel: null, time: null };
  const isBombeiroReal = ctx.papel === 'bombeiro';
  const isCriador = chamado.aberto_por != null && currentUserId != null && chamado.aberto_por === currentUserId;
  const isHdmTeam =
    chamado.tipo === 'hdm' &&
    chamado.hdm_responsavel != null &&
    ctx.time === chamado.hdm_responsavel;
  const podeActuarComoBombeiro = canActAsBombeiro(ctx, chamado);
  // Bombeiro preenche tema/mapeamento quando: não HDM ou (HDM e criador já aprovou uma vez); e status em_andamento (não aguardando criador)
  const podePreencherTemaMapeamento =
    isBombeiroReal &&
    (chamado.tipo !== 'hdm' || chamado.resolucao_suficiente === true) &&
    chamado.status === 'em_andamento';

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      {/* Breadcrumb: voltar para Dashboard ou Chamados */}
      <div className="mb-6 flex items-center gap-2 text-sm">
        <Link href="/sirene" className="text-stone-400 hover:text-stone-200">
          ← Sirene
        </Link>
        <span className="text-stone-600">/</span>
        <Link href="/sirene/chamados" className="text-stone-400 hover:text-stone-200">
          Chamados
        </Link>
        <span className="text-stone-600">/</span>
        <span className="font-medium text-white">#{chamado.numero}</span>
      </div>
      {/* Header do chamado */}
      <div className="rounded-xl border border-stone-700 bg-stone-800/80 p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-white">
              #{chamado.numero} — {chamado.incendio}
            </h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded bg-stone-600 px-2 py-0.5 text-sm text-stone-200">
                {formatarStatus(chamado.status)}
              </span>
              <span className="text-sm text-stone-400">{chamado.prioridade}</span>
              {chamado.tipo === 'hdm' && chamado.hdm_responsavel && (
                <span className="rounded bg-[#1e3a5f] px-2 py-0.5 text-sm font-medium text-white">
                  HDM — {chamado.hdm_responsavel}
                </span>
              )}
              {chamado.trava && (
                <span className="rounded bg-amber-500/20 px-2 py-0.5 text-sm text-amber-400">
                  Trava
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Banners HDM */}
      {chamado.tipo === 'hdm' && isBombeiroReal && !isHdmTeam && (
        <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Este chamado está sendo atendido por <strong>{chamado.hdm_responsavel}</strong>.
        </div>
      )}
      {chamado.tipo === 'hdm' && isHdmTeam && (
        <div className="mt-4 rounded-lg border border-[#1e3a5f]/50 bg-[#1e3a5f]/20 px-4 py-3 text-sm text-blue-200">
          Você está atuando como responsável HDM neste chamado.
        </div>
      )}

      <DetalheChamadoConteudo
        chamado={chamado as Chamado}
        userContext={ctx}
        podeActuarComoBombeiro={podeActuarComoBombeiro}
        podePreencherTemaMapeamento={podePreencherTemaMapeamento}
        mostrarControlesBombeiro={isHdmTeam || (isBombeiroReal && chamado.tipo !== 'hdm')}
        mostrarRedirecionarHDM={isBombeiroReal && chamado.tipo === 'padrao'}
        isCriador={isCriador}
      />
    </main>
  );
}
