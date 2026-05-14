'use client';

export function OnboardingOperacoesPreObra() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-stone-50">
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-12">
        <header className="border-b border-stone-200 pb-6">
          <h1 className="text-2xl font-bold tracking-tight text-moni-primary md:text-3xl">Operações pré-obra</h1>
          <p className="mt-2 text-sm text-stone-600 md:text-base">
            Após <strong>contrato final assinado</strong>, o franqueado migra para o onboarding de Operações pré-obra.
            Este módulo está <strong>em construção</strong> — o conteúdo será anexado aqui quando a mesa enviar o
            pacote definitivo (checklist, SLAs, responsáveis e ligação ao funil de operações).
          </p>
        </header>

        <div className="mt-8 rounded-xl border border-dashed border-stone-300 bg-stone-100/80 p-6 text-center text-sm text-stone-600">
          Secção reservada — sem conteúdo final publicado nesta data.
        </div>

        <p className="mt-6 text-sm text-stone-600">
          Enquanto isso, use o funil de{' '}
          <a className="font-medium text-moni-primary underline" href="/operacoes">
            Operações
          </a>{' '}
          no Hub quando já estiver liberado para a unidade.
        </p>
      </div>
    </div>
  );
}
