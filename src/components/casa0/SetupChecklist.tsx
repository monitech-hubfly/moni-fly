'use client';

import { useCasa0Missao } from '@/hooks/useCasa0Missao';
import { useCasa0Progresso } from '@/hooks/useCasa0Progresso';
import type { SetupTaskItemStatus } from '@/components/casa0/SetupTaskItem';
import { MissionCard } from '@/components/casa0/MissionCard';
import { ProgressTracker } from '@/components/casa0/ProgressTracker';
import { SetupTaskItem } from '@/components/casa0/SetupTaskItem';
import { UnlockBanner } from '@/components/casa0/UnlockBanner';

export type SetupChecklistProps = {
  userId: string;
  /** Quando true, não renderiza o cabeçalho próprio (título/lead vêm do pai, ex. SectionBlock no hub). */
  omitHeading?: boolean;
};

type SetupItemDef = {
  id: string;
  titulo: string;
  descricao: string;
  orientacoes: string[];
  subtexto?: string;
};

/**
 * Checklist operacional Casa 0 — títulos e orientações alinhados ao material de onboarding (HubFly, Step One, BCA).
 */
const ITENS: readonly SetupItemDef[] = [
  {
    id: 'acesso-hubfly',
    titulo: 'Acesso ao Hub Fly',
    descricao: 'Entrar no hub, localizar os funis e entender onde o seu negócio “mora” no dia a dia.',
    orientacoes: [
      'Acesse o Hub Fly com o usuário fornecido pela Moní e confirme que o menu lateral carrega.',
      'Abra o funil Step One e identifique onde ficam os cards de lote e as fases do processo.',
      'Localize notificações e o atalho de perfil — você usará ambos com frequência.',
      'Se algo não carregar, limpe cache do navegador ou tente outro navegador antes de abrir chamado.',
    ],
  },
  {
    id: 'login-configurador',
    titulo: 'Login no Configurador',
    descricao: 'Acessar a ferramenta de precificação e cenários usada com o BCA e a hipótese de liquidez.',
    orientacoes: [
      'Use o link abaixo e valide login (guarde a senha em local seguro, não compartilhe em grupos públicos).',
      'Confirme que consegue abrir um projeto de teste ou tela inicial sem erro de permissão.',
      'Se a conta pedir troca de senha no primeiro acesso, conclua e anote a nova senha.',
    ],
    subtexto: 'https://moni-configurador.vercel.app — Senha: FKMONI',
  },
  {
    id: 'planilha-step-one',
    titulo: 'Planilha Step One',
    descricao: 'Ter a planilha de inteligência de praça pronta para registrar condomínios, corretores e concorrentes.',
    orientacoes: [
      'Baixe ou duplique o template oficial Step One (aba por condomínio, mapa de corretores e batalha de casas).',
      'Preencha ao menos o cabeçalho do seu território e uma linha de condomínio para validar estrutura.',
      'Salve em pasta pessoal no padrão Moní (ex.: 01_ONBOARDING / Step One) para localizar depois.',
    ],
  },
  {
    id: 'bca-geral-2026',
    titulo: 'BCA geral 2026',
    descricao: 'Conhecer a versão vigente do Business Case Analysis e onde cada bloco se conecta ao comitê.',
    orientacoes: [
      'Abra o BCA 2026 e percorra as abas Planta, Target e Liquidação — são o tripé da hipótese.',
      'Leia as instruções de preenchimento na primeira aba ou no treinamento BCA da biblioteca.',
      'Marque dúvidas para trazer na próxima reunião com CS ou no comitê regional.',
    ],
  },
  {
    id: 'google-drive',
    titulo: 'Google Drive da operação',
    descricao: 'Garantir acesso à pasta de trabalho onde ficam modelos, BCA e evidências de mercado.',
    orientacoes: [
      'Aceite o convite da pasta Google Drive do franqueado (e-mail Moní ou franquia).',
      'Crie subpasta do seu território se o padrão da rede pedir — mantenha nomenclatura 01_ONBOARDING etc.',
      'Teste upload de um arquivo pequeno para validar permissão de escrita.',
    ],
  },
  {
    id: 'corretores-mapeados',
    titulo: 'Corretores mapeados no HubFly',
    descricao: 'Registrar no sistema os corretores que atuam nos condomínios da sua praça.',
    orientacoes: [
      'No HubFly / Step One, cadastre ou atualize pelo menos três corretores com contato válido.',
      'Associe cada corretor aos condomínios em que atua (evita duplicidade e ajuda no comitê).',
      'Revise ortografia dos nomes — aparecem em relatórios enviados ao comitê e ao crédito.',
    ],
  },
];

export function SetupChecklist({ userId, omitHeading = false }: SetupChecklistProps) {
  const { itens, loading, error, updateItem, progresso, tudoConcluido } = useCasa0Progresso(userId);
  const { missao, salvarMissao, missaoConcluida } = useCasa0Missao(userId);

  function handleToggle(itemId: string, novoStatus: SetupTaskItemStatus) {
    void updateItem(itemId, novoStatus);
  }

  const body = (
    <>
      <ProgressTracker progresso={progresso} tudoConcluido={tudoConcluido} missaoConcluida={missaoConcluida} />

      {loading ? (
        <p className="text-sm text-slate-500">Carregando checklist…</p>
      ) : null}
      {error ? (
        <p className="text-sm font-medium text-red-600" role="alert">
          {error instanceof Error ? error.message : String(error)}
        </p>
      ) : null}

      <ul className="space-y-4">
        {ITENS.map((item) => (
          <li key={item.id}>
            <SetupTaskItem
              itemId={item.id}
              titulo={item.titulo}
              descricao={item.descricao}
              orientacoes={[...item.orientacoes]}
              status={itens[item.id] ?? 'pendente'}
              onToggle={handleToggle}
              obrigatorio
              subtexto={item.subtexto}
            />
          </li>
        ))}
      </ul>

      <MissionCard
        missao={{ conteudo: missao.conteudo, status: missao.status }}
        onSalvar={salvarMissao}
        bloqueada={!tudoConcluido}
      />

      <UnlockBanner
        desbloqueado={tudoConcluido && missaoConcluida}
        casaProxima="Casa 1 — Step One"
      />
    </>
  );

  if (omitHeading) {
    return <div className="w-full space-y-8">{body}</div>;
  }

  return (
    <section className="w-full space-y-8" aria-labelledby="setup-operacional-heading">
      <header className="border-b border-slate-200 pb-4">
        <h2 id="setup-operacional-heading" className="text-xl font-semibold tracking-tight text-slate-900">
          Setup Operacional
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Conclua os itens abaixo para liberar a primeira missão. O progresso é salvo automaticamente.
        </p>
      </header>
      {body}
    </section>
  );
}
