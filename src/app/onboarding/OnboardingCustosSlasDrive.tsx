'use client';

export function OnboardingCustosSlasDrive() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-stone-50">
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-12">
        <header className="border-b border-stone-200 pb-6">
          <h1 className="text-2xl font-bold tracking-tight text-moni-primary md:text-3xl">
            Custos, SLAs, Drive e lição de casa
          </h1>
          <p className="mt-2 text-sm text-stone-600 md:text-base">
            Custos referenciados no material de treinamento; SLAs internos Moní ainda a calibrar com o time; Drive
            e lição de casa conforme envio operacional.
          </p>
        </header>

        <section className="mt-8 rounded-xl border border-stone-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-lg font-bold text-stone-900">Custos e aporte (referências enviadas)</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-stone-700 md:text-base">
            <li>
              <strong>Taxa de plataforma:</strong> referência interna de <strong>7%</strong> sobre o custo da
              casa (confirmar base e vigência no contrato da unidade).
            </li>
            <li>
              <strong>Gestão de obra:</strong> referência interna de <strong>8%</strong> sobre o custo da casa.
            </li>
            <li>
              <strong>Pacote de caixa para taxas e transação:</strong> ordem de grandeza citada de{' '}
              <strong>R$ 25.000</strong> para taxas de aprovação, custos do terreno, carta fiança ou seguro-garantia,
              diligência e custos cartorários — tratar como <strong>premissa de planejamento</strong> até existir
              tabela oficial por praça.
            </li>
            <li>
              Outros itens mencionados no fluxo de negociação: carta fiança, seguro garantia, taxas de aprovação,
              projetos, gestão e plataforma, custo da obra, custos fixos do terreno a partir do alvará (depende da
              negociação).
            </li>
          </ul>
        </section>

        <section className="mt-6 rounded-xl border border-amber-200/80 bg-amber-50/70 p-5 md:p-6">
          <h2 className="text-lg font-bold text-amber-950">SLAs</h2>
          <p className="text-sm text-amber-950/90">
            <strong>Kanban Funil Step One:</strong> SLAs por fase no seed (7, 7, 10, 7, 7, 14, 7 dias corridos).
          </p>
          <p className="mt-2 text-sm text-amber-950/90">
            <strong>SLAs de resposta Moní → Frank</strong> (ex.: acoplamento em 5 dias úteis, jurídico em 3 dias
            úteis): <strong>a definir e publicar</strong> quando a mesa aprovar os números — deixar registro aqui
            após alinhamento.
          </p>
        </section>

        <section className="mt-6 rounded-xl border border-stone-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-lg font-bold text-stone-900">Sugestão de pastas no Drive (franqueado)</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-stone-700 md:text-base">
            <li>
              <code>00_Admin</code> — contratos sociais, credenciais, atas (com controle de acesso).
            </li>
            <li>
              <code>01_Cidade</code> — dados macro, mapas, ranking de condomínios e notas de praça.
            </li>
            <li>
              <code>02_Condominios</code> — uma subpasta por condomínio com checklist de demanda, fotos e contatos
              de corretores.
            </li>
            <li>
              <code>03_Lotes</code> — fichas de lote, recuos, atributos (lixeira, vista, aclive, garagem).
            </li>
            <li>
              <code>04_Competidores</code> — exports do mapa de competidores e prints de anúncios.
            </li>
            <li>
              <code>05_BCA_Batalha</code> — versões prévias e finais do BCA, planilhas de batalha, prints do
              configurador.
            </li>
            <li>
              <code>06_Comite_Diligencia</code> — pareceres, minutas comentadas, relatórios de escritório
              homologado.
            </li>
            <li>
              <code>07_Credito_Legal</code> — checklists, termos de autorização, status de parceiros.
            </li>
          </ol>
        </section>

        <section className="mt-6 rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-5 md:p-6">
          <h2 className="text-lg font-bold text-emerald-950">Lição de casa e material prévio</h2>
          <p className="text-sm text-emerald-900/90">
            Antes do kick-off estruturado: receber material de onboarding e completar lição de casa —{' '}
            <strong>cidade</strong>, <strong>ranking de condomínios</strong> e <strong>ranking de lotes</strong>{' '}
            conforme metodologia do Step One. Anexar evidências nas pastas sugeridas acima.
          </p>
        </section>
      </div>
    </div>
  );
}
