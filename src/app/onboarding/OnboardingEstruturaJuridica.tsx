'use client';

import type { ReactNode } from 'react';

/**
 * Estrutura jurídica típica em operações Moní — incorporadora, gestora e SPE.
 */

const BLOCOS: {
  titulo: string;
  definicao: ReactNode;
  papel: string[];
  nota?: string;
}[] = [
  {
    titulo: 'Empresa incorporadora',
    definicao: (
      <>
        É a sociedade que assume formalmente o papel de{' '}
        <strong>incorporadora imobiliária</strong> perante o mercado e os compradores: responsável pelo
        empreendimento perante a legislação de incorporações, registro de patrimônio de afetação (quando
        aplicável), contratos com adquirentes e cumprimento das obrigações legais da incorporação.
      </>
    ),
    papel: [
      'Costuma figurar na cadeia contratual com os clientes finais (venda de unidades) e na interface com órgãos e registros do empreendimento.',
      'Pode ou não ser a mesma pessoa jurídica que detém o controle societário do projeto em todas as fases — o que importa é quem assina e responde como incorporadora perante lei e terceiros.',
      'Na rede Moní, o desenho exato (matriz, franqueado ou veículo local) segue o modelo aprovado para cada negócio e região.',
    ],
  },
  {
    titulo: 'Gestora',
    definicao: (
      <>
        É a entidade (em geral uma sociedade) que <strong>administra e opera</strong> o veículo do projeto — em
        especial quando existe uma <strong>SPE</strong> ou estrutura patrimonial separada: recebe mandato dos
        sócios, toma decisões de rotina, representa a SPE em contratos autorizados e presta contas.
      </>
    ),
    papel: [
      'Foca em governança: orçamento, fluxo de caixa da SPE, contratações operacionais dentro de limites, reporting a investidores ou sócios.',
      'Pode cobrar taxa de gestão ou remuneração pelo serviço administrativo, conforme contrato social e acordos de sócios.',
      'Distingue-se da incorporadora: uma coisa é incorporar e vender ao público (papel civil e consumerista); outra é gerir o veículo que detém ativos e passivos do empreendimento.',
    ],
    nota: 'Em operações mais simples, incorporadora e gestora podem coincidir na mesma sociedade — o relevante é o papel funcional de cada uma no contrato e na legislação.',
  },
  {
    titulo: 'SPE (Sociedade de propósito específico)',
    definicao: (
      <>
        É uma sociedade criada em regra para <strong>concentrar um único projeto</strong> (ou conjunto restrito
        de ativos): detém o terreno ou direitos sobre ele, assume passivos do empreendimento e recebe receitas
        da venda das unidades, com patrimônio <strong>afeto</strong> ao empreendimento quando cabível.
      </>
    ),
    papel: [
      'Objetivo típico: isolamento de risco — credores e investidores enxergam um patrimônio delimitado, separado do restante do grupo econômico.',
      'A SPE “vive” o ciclo do projeto: aquisição ou permuta do ativo, obra, vendas e distribuição de resultados; ao final, pode ser extinta ou fundida, conforme planejamento.',
      'A relação entre sócios da SPE, gestora e incorporadora é definida em contrato social, acordo de quotistas e documentos de afetação — área central do Check Legal no Hub.',
    ],
    nota: 'Não existe um “modelo único” de SPE: há variações (participações, garantias, subscrição de capital). Valide sempre o pacote societário com o time jurídico Moní.',
  },
];

export function OnboardingEstruturaJuridica() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-stone-50">
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-12">
        <header className="border-b border-stone-200 pb-6">
          <h1 className="text-2xl font-bold tracking-tight text-moni-primary md:text-3xl">Estrutura jurídica</h1>
          <p className="mt-2 text-sm text-stone-600 md:text-base">
            Incorporadora, gestora e SPE são peças recorrentes na organização de um empreendimento. Abaixo, o
            sentido de cada uma no ecossistema Moní — sem substituir parecer jurídico formal.
          </p>
        </header>

        <p className="mt-6 rounded-lg border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-xs leading-relaxed text-amber-950 md:text-sm">
          <strong>Nota:</strong> cada negócio tem desenho societário e fiscal próprio. Use esta página como{' '}
          <strong>mapa de conceitos</strong> e confirme sempre estrutura, assinaturas e obrigações com{' '}
          <strong>Jurídico</strong> e com os documentos vigentes do processo.
        </p>

        <ul className="mt-8 list-none space-y-6 p-0">
          {BLOCOS.map((b) => (
            <li key={b.titulo} className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm md:p-6">
              <h2 className="text-lg font-bold text-stone-900 md:text-xl">{b.titulo}</h2>
              <p className="mt-3 text-sm leading-relaxed text-stone-700 md:text-base">{b.definicao}</p>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-stone-600 marker:text-stone-400">
                {b.papel.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              {b.nota && (
                <p className="mt-4 border-t border-stone-100 pt-4 text-xs italic leading-relaxed text-stone-500 md:text-sm">
                  {b.nota}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
