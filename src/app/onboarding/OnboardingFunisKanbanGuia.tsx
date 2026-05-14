'use client';

/**
 * Conteúdo alinhado a FUNIL_STEPONE_KANBAN.md e ao código do Kanban (SLA em dias úteis — ver dias-uteis.ts).
 */

export function OnboardingFunisKanbanGuia() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-stone-50">
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-12">
        <header className="border-b border-stone-200 pb-6">
          <h1 className="text-2xl font-bold tracking-tight text-moni-primary md:text-3xl">
            Kanban Moní e Kanban Frank
          </h1>
          <p className="mt-2 text-sm text-stone-600 md:text-base">
            No Hub existe um único board <strong>Funil Step One</strong>. Consultores e admin vêem dados de todos
            os franqueados; o franqueado (Frank) vê e edita os seus cards e, no checklist, apenas os campos com{' '}
            <code className="rounded bg-stone-200 px-1 text-xs">visivel_candidato</code> ativo. Documentação de
            apoio no repositório: <code className="rounded bg-stone-200 px-1 text-xs">FUNIL_STEPONE_KANBAN.md</code>
            .
          </p>
        </header>

        <section className="mt-8 space-y-4 rounded-xl border border-stone-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-lg font-bold text-stone-900">Funil Step One — o que é</h2>
          <p className="text-sm text-stone-700 md:text-base">
            Kanban para mapeamento e viabilidade inicial de novos negócios: um <strong>card</strong> por linha de
            trabalho (em geral associado ao franqueado), <strong>colunas</strong> = fases,{' '}
            <strong>checklist estrutural</strong> por fase (itens na base de dados, respostas por card),{' '}
            <strong>modal de detalhe</strong> com histórico e ação atual, e indicadores de SLA nos cards.
          </p>
          <p className="text-sm font-medium text-stone-800">Fases (ordem) e prazo configurado por fase</p>
          <p className="text-xs text-stone-600 md:text-sm">
            O número na coluna (ex.: 7, 14) é o SLA em <strong>dias úteis</strong>: o Hub calcula vencimento e
            atraso com fins de semana fora do calendário e pode excluir feriados nacionais quando a tabela de
            feriados estiver preenchida — não confundir com dias corridos.
          </p>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-stone-700 md:text-base">
            <li>Dados da Cidade — 7 d.u.</li>
            <li>Lista de Condomínios — 7 d.u.</li>
            <li>Dados dos Condomínios — 10 d.u.</li>
            <li>Lotes disponíveis — 7 d.u.</li>
            <li>Mapa de Competidores — 7 d.u.</li>
            <li>BCA + Batalha de Casas — 14 d.u.</li>
            <li>Hipóteses — 7 d.u.</li>
          </ol>
          <p className="text-sm text-stone-600">
            Slugs canónicos (checklist): <code>dados_cidade</code>, <code>lista_condominios</code>,{' '}
            <code>dados_condominios</code>, <code>lotes_disponiveis</code>, <code>mapa_competidores</code>,{' '}
            <code>bca_batalha_casas</code>, <code>hipoteses</code>.
          </p>
        </section>

        <section className="mt-6 rounded-xl border border-stone-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-lg font-bold text-stone-900">Rotas e abas no Hub</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-stone-700 md:text-base">
            <li>
              <a className="font-medium text-moni-primary underline" href="/funil-stepone">
                /funil-stepone
              </a>{' '}
              — board principal; aba <strong>Kanban</strong> (predefinida) e aba <strong>Painel</strong> de
              performance (<code>?tab=painel</code>).
            </li>
            <li>
              <code>/funil-stepone/novo</code> e <code>/funil-stepone/[id]</code> — rotas legadas; o fluxo atual
              usa o botão “+ Novo card” e o modal de detalhe sobre o board.
            </li>
            <li>
              Menu lateral: <strong>Novos Negócios &gt; Funil Step One</strong>, antes de Portfolio + Operações.
            </li>
          </ul>
        </section>

        <section className="mt-6 rounded-xl border border-stone-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-lg font-bold text-stone-900">O que vê em cada coluna e em cada card</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-stone-700 md:text-base">
            <li>Por fase: nome, quantidade de cards e o número de SLA (d.u.) da fase.</li>
            <li>
              Por card: título, data de criação, estado do SLA (ex.: atrasado, vence hoje, vence em 1 d.u., N d.u.
              restantes).
            </li>
            <li>
              Nome do franqueado no card: em geral visível para <strong>admin/consultor</strong> (confirmar política
              da sua instância).
            </li>
          </ul>
        </section>

        <section className="mt-6 rounded-xl border border-stone-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-lg font-bold text-stone-900">Mapa de competidores (checklist vs Step One)</h2>
          <p className="text-sm text-stone-700 md:text-base">
            No Funil Step One, a fase “Mapa de Competidores” é um <strong>cadastro estruturado</strong> de
            concorrentes (quem, distância, oferta, ameaça, notas). O mapa Leaflet e o motor numérico de batalha de
            casas do módulo de viabilidade são <strong>complementares</strong> — ver{' '}
            <a className="font-medium text-moni-primary underline" href="/step-one">
              Step One
            </a>{' '}
            e{' '}
            <a className="font-medium text-moni-primary underline" href="/onboarding/mapa-batalha-bca-spe">
              Mapa, batalha, BCA e SPE
            </a>
            .
          </p>
        </section>

        <section className="mt-6 rounded-xl border border-stone-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-lg font-bold text-stone-900">Identidade visual (tokens)</h2>
          <p className="text-sm text-stone-700 md:text-base">
            Cores definidas em <code className="text-xs">moni-tokens.css</code>:{' '}
            <code>--moni-kanban-stepone</code>, <code>--moni-kanban-stepone-light</code>,{' '}
            <code>--moni-kanban-stepone-accent</code>. Tags de SLA: atrasado (vermelho), atenção / vence hoje ou
            amanhã (dourado), normal (texto com dias úteis restantes).
          </p>
        </section>

        <section className="mt-6 rounded-xl border border-stone-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-lg font-bold text-stone-900">Permissões (resumo RLS)</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-stone-700">
            <li>
              <code>kanbans</code> / <code>kanban_fases</code>: leitura autenticados; escrita admin/consultor.
            </li>
            <li>
              <code>kanban_cards</code>: leitura e atualização pelo dono do card ou admin/consultor; inserção com{' '}
              <code>franqueado_id</code> coerente com as regras do ambiente.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
