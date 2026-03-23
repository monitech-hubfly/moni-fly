import { redirect } from 'next/navigation';

/** Cadastro unificado em `/login?tab=cadastro`. */
export default function SignupRedirectPage() {
  redirect('/login?tab=cadastro');
}
