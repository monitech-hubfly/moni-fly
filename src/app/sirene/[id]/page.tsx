import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getChamado } from '../actions';
import { canActAsBombeiro } from '@/lib/sirene';
import { DetalheChamadoConteudo } from '../DetalheChamadoConteudo';
import type { Chamado } from '@/types/sirene';

export default async function SireneChamadoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const chamadoId = parseInt(id, 10);
  if (Number.isNaN(chamadoId)) redirect('/sirene');

  const result = await getChamado(chamadoId);
  if (!result.ok) redirect('/sirene');

  const { chamado, userContext, currentUserId, isFrank } = result;
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

      <DetalheChamadoConteudo
        chamado={chamado as Chamado}
        userContext={ctx}
        podeActuarComoBombeiro={podeActuarComoBombeiro}
        podePreencherTemaMapeamento={podePreencherTemaMapeamento}
        mostrarControlesBombeiro={isHdmTeam || (isBombeiroReal && chamado.tipo !== 'hdm')}
        mostrarRedirecionarHDM={isBombeiroReal && chamado.tipo === 'padrao'}
        isCriador={isCriador}
        isFrank={isFrank}
        podeEditarResumoChamado={isCriador || isBombeiroReal}
        isBombeiroReal={isBombeiroReal}
        isHdmTeam={isHdmTeam}
      />
    </main>
  );
}
