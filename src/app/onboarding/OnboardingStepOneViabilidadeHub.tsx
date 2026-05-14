'use client';

/**
 * Conteúdo derivado de docs/STEP_ONE_ESPEC.md e docs/PASSO_A_PASSO.md (fluxo pedagógico no Hub).
 * Não substitui a especificação ténica completa — orienta o Frank e a equipa na ordem de uso.
 */

type EtapaRow = {
  n: number;
  nome: string;
  objetivo: string;
  entregavel: string;
};

const ETAPAS: EtapaRow[] = [
  {
    n: 1,
    nome: 'Análise da praça',
    objetivo:
      'Caracterizar a cidade com dados de referência (IBGE integrado; Atlas/Google em evolução) e narrativa de análise.',
    entregavel: 'Dados estruturados + narrativa da praça (elementos urbanos, eixos, divisão administrativa).',
  },
  {
    n: 2,
    nome: 'Condomínios e checklist',
    objetivo:
      'Mapear condomínios da cidade com casas acima de ~R$ 5 milhões e responder o checklist (lotes, casas, locação, giro).',
    entregavel: 'Lista de condomínios qualificados + respostas do checklist (16 itens no doc de especificação).',
  },
  {
    n: 3,
    nome: 'Tabela resumo e conclusão',
    objetivo: 'Sintetizar por condomínio tickets, estoque e velocidade; concluir ranking e oportunidade.',
    entregavel: 'Tabela-resumo + texto de conclusão (ranking, faixa de m² líquido, erros de mercado, oportunidade).',
  },
  {
    n: 4,
    nome: 'Casas à venda (listagem)',
    objetivo: 'Registrar concorrentes anunciados (hoje listagem manual; integração ZAP/Apify prevista).',
    entregavel: 'Linhas de casas com campos de praça, recuos, preço, fotos, link — conforme modelo da etapa.',
  },
  {
    n: 5,
    nome: 'Lotes à venda',
    objetivo: 'Listar e ranquear lotes por condomínio.',
    entregavel: 'Listagem de lotes ranqueada da melhor para a pior oportunidade.',
  },
  {
    n: 6,
    nome: 'Catálogo Moní',
    objetivo: 'Consultar modelos oficiais (áreas, tipologias, custo/venda, gadgets) para comparar com o mercado.',
    entregavel: 'Uso da tabela `catalogo_casas` — modelos disponíveis ao processo.',
  },
  {
    n: 7,
    nome: 'Lote escolhido',
    objetivo: 'Fixar o lote-alvo com dados de oferta e localização no condomínio.',
    entregavel: 'Formulário do lote escolhido salvo (praça, condomínio, medidas, preço/m², foto).',
  },
  {
    n: 8,
    nome: 'Batalhas (preço, produto, localização)',
    objetivo:
      'Comparar cada casa do mercado (etapa 4) contra os 3 modelos do catálogo escolhidos; notas de −2 a +2.',
    entregavel: 'Matriz de batalhas; Frank valida especialmente a dimensão de produto onde for exigido.',
  },
  {
    n: 9,
    nome: 'Ranking do catálogo',
    objetivo: 'Escolher qual modelo Moní melhor encaixa após as batalhas.',
    entregavel: 'Ranking justificado (qual casa do catálogo seguir e por quê).',
  },
  {
    n: 10,
    nome: 'BCA (3 opções)',
    objetivo: 'Gerar três opções de caso de negócio com base no ranking.',
    entregavel: 'Três BCAs preenchidos automaticamente a partir das melhores opções do catálogo.',
  },
  {
    n: 11,
    nome: 'PDF de hipóteses',
    objetivo: 'Consolidar tudo para envio e aprovação (auditoria de exportação no sistema).',
    entregavel: 'PDF único de hipóteses; log com utilizador, hipótese, modelo, timestamp e hash.',
  },
];

export function OnboardingStepOneViabilidadeHub() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-stone-50">
      <div className="mx-auto max-w-4xl px-4 py-8 md:px-8 md:py-12">
        <header className="border-b border-stone-200 pb-6">
          <h1 className="text-2xl font-bold tracking-tight text-moni-primary md:text-3xl">
            Step One de viabilidade — 11 etapas no Hub
          </h1>
          <p className="mt-2 text-sm text-stone-600 md:text-base">
            Este fluxo corresponde ao módulo técnico documentado em{' '}
            <code className="rounded bg-stone-200 px-1 text-xs">docs/STEP_ONE_ESPEC.md</code>. É{' '}
            <strong>complementar</strong> ao Funil Step One em Kanban (7 fases de checklist comercial): use os dois
            — o Kanban para ritmo e governança; as 11 etapas para o estudo numérico e documental até o PDF de
            hipóteses.
          </p>
        </header>

        <section className="mt-8 rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-5 md:p-6">
          <h2 className="text-lg font-bold text-emerald-950">1. Onde começar no aplicativo</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-emerald-900/95 md:text-base">
            <li>
              Aceda a{' '}
              <a className="font-semibold underline" href="/step-one">
                /step-one
              </a>
              , indique <strong>Cidade</strong> e <strong>UF</strong> e crie o processo.
            </li>
            <li>
              Será criado o registo em <code>processo_step_one</code> com progresso nas 11 etapas; navegue para{' '}
              <code>/step-one/[id]/etapa/[1–11]</code> conforme o menu do processo.
            </li>
            <li>
              Em paralelo, acompanhe o <strong>Funil Step One</strong> em{' '}
              <a className="font-semibold underline" href="/funil-stepone">
                /funil-stepone
              </a>{' '}
              — ver{' '}
              <a className="font-semibold underline" href="/onboarding/funil-step-one-guia">
                guia do checklist
              </a>
              .
            </li>
          </ol>
        </section>

        <section className="mt-6 rounded-xl border border-stone-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-lg font-bold text-stone-900">2. Visão das 11 etapas (ordem pedagógica)</h2>
          <p className="mt-2 text-sm text-stone-600 md:text-base">
            Cada etapa prepara a seguinte: primeiro a praça, depois condomínios e conclusão, em seguida evidências
            de mercado (casas e lotes), depois catálogo Moní e lote escolhido, então batalhas, ranking, BCA e
            exportação final.
          </p>
          <div className="mt-4 overflow-x-auto rounded-lg border border-stone-200">
            <table className="min-w-full border-collapse text-left text-xs md:text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-100">
                  <th className="px-3 py-2 font-semibold text-stone-800">#</th>
                  <th className="px-3 py-2 font-semibold text-stone-800">Etapa</th>
                  <th className="px-3 py-2 font-semibold text-stone-800">Objetivo</th>
                  <th className="px-3 py-2 font-semibold text-stone-800">Entregável</th>
                </tr>
              </thead>
              <tbody>
                {ETAPAS.map((e) => (
                  <tr key={e.n} className="border-b border-stone-100 last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 font-medium text-moni-primary">{e.n}</td>
                    <td className="px-3 py-2 font-medium text-stone-900">{e.nome}</td>
                    <td className="px-3 py-2 text-stone-700">{e.objetivo}</td>
                    <td className="px-3 py-2 text-stone-600">{e.entregavel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-amber-200/80 bg-amber-50/70 p-5 md:p-6">
          <h2 className="text-lg font-bold text-amber-950">3. Regras que não pode esquecer</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-amber-950/90 md:text-base">
            <li>
              <strong>Etapa 2 — filtro:</strong> foco em condomínios com casas acima de ~<strong>R$ 5 milhões</strong>{' '}
              (conforme especificação).
            </li>
            <li>
              <strong>Catálogo e batalhas:</strong> o Frank escolhe <strong>3 modelos</strong> do catálogo Moní; são
              esses três que “batalham” com as casas listadas e alimentam as <strong>3 opções de BCA</strong> na
              etapa 10.
            </li>
            <li>
              <strong>Notas na etapa 8:</strong> preço e localização podem ser automáticos; <strong>produto</strong>{' '}
              pode exigir validação humana (rubricas no sistema).
            </li>
            <li>
              <strong>Etapas 4 e 5:</strong> hoje a listagem é <strong>manual</strong>; integração Apify/ZAP está
              prevista — ver também <code>docs/PASSO_A_PASSO.md</code> (secção Apify) no repositório.
            </li>
            <li>
              <strong>Rede de contatos:</strong> manter condomínios, corretores e imobiliárias atualizados (meta de
              revisão <strong>quinzenal</strong> na especificação).
            </li>
          </ul>
        </section>

        <section className="mt-6 rounded-xl border border-stone-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-lg font-bold text-stone-900">4. Ligação ao material de campo</h2>
          <p className="text-sm text-stone-700 md:text-base">
            O checklist de demanda e as perguntas a corretores que publicámos em{' '}
            <a className="font-semibold text-moni-primary underline" href="/onboarding/step-one-operacional">
              Step One — demanda e campo
            </a>{' '}
            alimentam a mesma lógica da <strong>Etapa 2</strong> e das entrevistas de praça. Use-o como roteiro de
            perguntas enquanto preenche o processo no Hub.
          </p>
          <p className="mt-3 text-sm text-stone-700 md:text-base">
            Mapa de competidores, batalha e BCA no discurso comercial estão em{' '}
            <a className="font-semibold text-moni-primary underline" href="/onboarding/mapa-batalha-bca-spe">
              Mapa, batalha, BCA e SPE
            </a>{' '}
            — alinhe com as etapas 4–10 acima.
          </p>
        </section>

        <section className="mt-6 rounded-xl border border-stone-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-lg font-bold text-stone-900">5. Equipa Moní (consultor / admin)</h2>
          <p className="text-sm text-stone-700 md:text-base">
            A especificação prevê um <strong>painel</strong> com funil dos Franks nas 11 etapas, processos parados,
            PDFs gerados, consumo Apify e últimas atividades — útil para acompanhamento pedagógico e operacional.
          </p>
        </section>

        <section className="mt-6 rounded-xl border border-blue-200/80 bg-blue-50/50 p-5 md:p-6">
          <h2 className="text-lg font-bold text-blue-950">6. Documentação técnica no repositório</h2>
          <p className="text-sm text-blue-950/90 md:text-base">
            Para quem desenvolve ou audita o sistema (não é necessário para o dia a dia no Hub Fly já hospedado):
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-blue-950/85">
            <li>
              <code>docs/STEP_ONE_ESPEC.md</code> — especificação completa das etapas, campos e tabelas.
            </li>
            <li>
              <code>docs/PASSO_A_PASSO.md</code> — instalação, migrações, primeiro acesso e teste etapas 1–7.
            </li>
            <li>
              <code>GUIA_COMPLETO_VIABILIDADE.md</code> — guia longo (setup Node, Supabase, sprints).
            </li>
            <li>
              <code>docs/REDE_FRANQUEADOS.md</code> — rede de contatos e importação CSV.
            </li>
            <li>
              <code>docs/CATALOGO_CASAS_TABELA.md</code> — referência de campos do catálogo em tabela.
            </li>
            <li>
              <code>FUNIL_STEPONE_KANBAN.md</code> — Kanban de 7 fases no Hub.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
