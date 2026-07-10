import type { ReactNode } from 'react';
import '@/App.css';
import { SimulacaoUsuarioProvider } from '@/components/carometro/todo/SeletorUsuarioAdmin';

export default function CarometroLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <SimulacaoUsuarioProvider>
      <div className='carometro-root'>{children}</div>
    </SimulacaoUsuarioProvider>
  );
}
