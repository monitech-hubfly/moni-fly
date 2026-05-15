import type { ReactNode } from 'react';
import '@/App.css';

export default function CarometroLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <div className='carometro-root'>{children}</div>;
}
