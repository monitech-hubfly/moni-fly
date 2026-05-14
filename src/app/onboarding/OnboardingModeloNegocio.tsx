'use client';

/**
 * Modelo de negócio — três modalidades de relação com o terreno / contrapartida.
 */

const MODELOS: {
  titulo: string;
  resumo: string;
  pontos: string[];
}[] = [
  {
    titulo: 'Permuta 100%',
    resumo:
      'A contrapartida pelo terreno ou lote é integralmente absorvida em permuta: o proprietário recebe, em regra, unidades e/ou direitos sobre o produto Moní no empreendimento, sem componente de compra em numerário pela totalidade do ativo negociado.',
    pontos: [
      'Alinha incentivos entre quem cede o terreno e o projeto: o upside está ligado ao sucesso das vendas das unidades permutadas.',
      'Exige disciplina de precificação, cronograma e governança contratual — a viabilidade depende do equilíbrio entre o valor do terreno e o estoque permutado.',
      'Costuma ser o cenário mais sensível a revisões de mix, área privativa e condições de entrega.',
    ],
  },
  {
    titulo: 'Compra parcial',
    resumo:
      'Combina pagamento em dinheiro com permuta ou outras formas de contrapartida (por exemplo, parte em unidades). O proprietário pode receber parcela em numerário e parcela em ativos do empreendimento.',
    pontos: [
      'Flexibiliza negociação quando o vendedor do terreno precisa de liquidez imediata, mas aceita diluir risco com produto.',
      'A estrutura jurídica e de crédito precisa separar claramente as tranches (preço, permuta, indexação, garantias).',
      'É comum em operações em que o “ticket” do solo não fecha só com produto na data da assinatura.',
    ],
  },
  {
    titulo: 'Compra e venda',
    resumo:
      'Modelo clássico de aquisição do terreno (ou direitos sobre ele) mediante preço em dinheiro, com a Moní / franqueado assumindo o risco de desenvolver e comercializar as unidades sobre o lote.',
    pontos: [
      'Maior previsibilidade para o vendedor do terreno (saída em caixa), e para o comprador a necessidade de capital e pipeline de crédito robusto.',
      'A margem do projeto vem da diferença entre custo de aquisição + obra + comercialização e o valor de venda das casas.',
      'Integra-se naturalmente à esteira de viabilidade (steps, check legal e crédito) com foco em price-ticket e absorção da praça.',
    ],
  },
];

export function OnboardingModeloNegocio() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-stone-50">
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-12">
        <header className="border-b border-stone-200 pb-6">
          <h1 className="text-2xl font-bold tracking-tight text-moni-primary md:text-3xl">Modelos de negócio</h1>
          <p className="mt-2 text-sm text-stone-600 md:text-base">
            Três formas usuais de estruturar a relação com o terreno e a contrapartida. Os detalhes contratuais e
            fiscais variam por operação — use isto como mapa conceitual e alinhe sempre com Jurídico e Crédito.
          </p>
        </header>

        <ul className="mt-8 space-y-6 list-none p-0">
          {MODELOS.map((m) => (
            <li
              key={m.titulo}
              className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm md:p-6"
            >
              <h2 className="text-lg font-bold text-stone-900 md:text-xl">{m.titulo}</h2>
              <p className="mt-3 text-sm leading-relaxed text-stone-700 md:text-base">{m.resumo}</p>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-stone-600 marker:text-stone-400">
                {m.pontos.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>

        <section className="mt-10 rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-5 shadow-sm md:p-6">
          <h2 className="text-lg font-bold text-emerald-950 md:text-xl">Tática em permuta (campo)</h2>
          <p className="mt-3 text-sm leading-relaxed text-emerald-900/95 md:text-base">
            Roteiro pedagógico enviado pelo time: costuma-se <strong>iniciar a conversa com permuta 100%</strong> e,
            conforme resposta do terrenista e viabilidade de caixa/crédito, <strong>evoluir para permuta parcial</strong>{' '}
            (parcela em dinheiro + parcela em produto). Isto não substitui o BCA nem o comitê — apenas organiza a
            sequência de abordagem na mesa de negociação.
          </p>
        </section>
      </div>
    </div>
  );
}
