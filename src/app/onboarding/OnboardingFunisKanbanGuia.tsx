'use client';

export function OnboardingFunisKanbanGuia() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-stone-50">
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-12">
        <header className="border-b border-stone-200 pb-6">
          <h1 className="text-2xl font-bold tracking-tight text-moni-primary md:text-3xl">
            Kanban Moní e Kanban Frank
          </h1>
          <p className="mt-2 text-sm text-stone-600 md:text-base">
            Visão resumida: existem fluxos no Hub para acompanhamento interno (Moní / consultores) e para o
            franqueado (Frank). A documentação detalhada de permissões está nas migrações e em{' '}
            <code className="rounded bg-stone-200 px-1 text-xs">FUNIL_STEPONE_KANBAN.md</code> no repositório.
          </p>
        </header>

        <section className="mt-8 space-y-4 rounded-xl border border-stone-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-lg font-bold text-stone-900">Funil Step One (Kanban no Hub)</h2>
          <p className="text-sm text-stone-700 md:text-base">
            É um Kanban próprio no Hub Fly para acompanhar o mapeamento e a viabilidade inicial de novos negócios:
            cards por franqueado, colunas = fases, SLA por fase, modal de detalhe do card e checklist estrutural
            por fase (itens vêm do banco; respostas são por card).
          </p>
          <p className="text-sm font-medium text-stone-800">Fases iniciais (seed) e SLAs em dias corridos:</p>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-stone-700 md:text-base">
            <li>Dados da Cidade — 7</li>
            <li>Lista de Condomínios — 7</li>
            <li>Dados dos Condomínios — 10</li>
            <li>Lotes disponíveis — 7</li>
            <li>Mapa de Competidores — 7</li>
            <li>BCA + Batalha de Casas — 14</li>
            <li>Hipóteses — 7</li>
          </ol>
          <p className="text-sm text-stone-600">
            Slugs canónicos das fases (checklist): <code>dados_cidade</code>, <code>lista_condominios</code>,{' '}
            <code>dados_condominios</code>, <code>lotes_disponiveis</code>, <code>mapa_competidores</code>,{' '}
            <code>bca_batalha_casas</code>, <code>hipoteses</code>.
          </p>
          <p className="text-sm text-stone-600">
            O checklist da fase “Mapa de Competidores” no Kanban é um cadastro estruturado de concorrentes (quem,
            distância, oferta, ameaça, notas). O mapa Leaflet da etapa de viabilidade e o motor numérico de
            batalha de casas vivem no módulo Step One de viabilidade — complementam o conceito, não substituem o
            checklist.
          </p>
        </section>

        <section className="mt-6 rounded-xl border border-stone-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-lg font-bold text-stone-900">Permissões (resumo)</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-stone-700">
            <li>
              <code>kanbans</code> / <code>kanban_fases</code>: leitura autenticados; escrita admin/consultor.
            </li>
            <li>
              <code>kanban_cards</code>: leitura/escrita dono do card ou admin/consultor; inserção com{' '}
              <code>franqueado_id</code> coerente.
            </li>
            <li>
              Itens de checklist com <code>visivel_candidato</code>: o Frank vê só o que estiver marcado como
              visível; admin vê todos.
            </li>
          </ul>
        </section>

        <p className="mt-6 text-sm text-stone-600">
          Rota do board: <code>/funil-stepone</code>. Para visão interna vs franqueado, use as permissões acima e
          o mesmo board — não duplicar dados entre “dois kanbans” sem necessidade operacional.
        </p>
      </div>
    </div>
  );
}
