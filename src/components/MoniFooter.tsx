/**
 * Rodapé inspirado em moni.casa e moni.casa/franquia — Parceria, Fale conosco.
 */
const MONI_BASE = 'https://moni.casa';
const MONI_FRANQUIA = 'https://moni.casa/franquia/';

export function MoniFooter() {
  return (
    <footer className="mt-20 border-t border-stone-200 bg-white/60">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="font-semibold text-moni-dark">Casa Moní</p>
            <p className="mt-1 text-sm text-stone-600">
              Ferramenta de viabilidade para franqueados.
            </p>
            <a
              href={MONI_BASE}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm font-medium text-moni-accent hover:underline"
            >
              moni.casa →
            </a>
            <a
              href={MONI_FRANQUIA}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block text-sm text-stone-500 hover:text-moni-accent hover:underline"
            >
              Conheça a franquia →
            </a>
          </div>
          <div className="text-sm">
            <p className="font-medium text-stone-700">Parceria</p>
            <ul className="mt-2 space-y-1 text-stone-600">
              <li>
                <a
                  href={MONI_BASE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-moni-accent hover:underline"
                >
                  Quero ser corretor
                </a>
              </li>
              <li>
                <a
                  href={MONI_BASE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-moni-accent hover:underline"
                >
                  Quero ser fornecedor
                </a>
              </li>
              <li>
                <a
                  href={MONI_BASE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-moni-accent hover:underline"
                >
                  Cadastrar lote
                </a>
              </li>
            </ul>
          </div>
          <div className="text-sm text-stone-600">
            <p className="font-medium text-stone-700">Fale conosco</p>
            <p className="mt-2">(11) 95421-6610</p>
            <a
              href="mailto:contato@moni.casa"
              className="mt-1 block hover:text-moni-accent hover:underline"
            >
              contato@moni.casa
            </a>
          </div>
        </div>
        <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-stone-200 pt-6 sm:flex-row">
          <p className="text-xs text-stone-500">
            © {new Date().getFullYear()} Casa Moní. Todos os direitos reservados.
          </p>
          <a
            href={`${MONI_BASE}/politica-privacidade`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-stone-500 hover:text-moni-accent hover:underline"
          >
            Política de uso e termos de privacidade
          </a>
        </div>
      </div>
    </footer>
  );
}
