import type { ReactNode } from 'react';
/**
 * Estilos legados do Carômetro (Vite): `index.css` define tokens em :root; `App.css` contém
 * a UI do Gantt, Conquistas, etc. O layout raiz só carrega `globals.css` + Tailwind — sem isto,
 * as páginas em /carometro/* ficam sem as classes utilitárias herdadas do app antigo.
 */
import '@/index.css';
import '@/App.css';

export default function CarometroLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
