import { redirect } from 'next/navigation';

/** Legado: /universidade/biblioteca → /universidade/ferramentas */
export default function UniversidadeBibliotecaRedirectPage() {
  redirect('/universidade/ferramentas');
}
