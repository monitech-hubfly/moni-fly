import { redirect } from 'next/navigation';

/** Funil Jurídico desativado — redireciona para o hub de funis. */
export default function FunilJuridicoPage() {
  redirect('/hub-funis');
}
