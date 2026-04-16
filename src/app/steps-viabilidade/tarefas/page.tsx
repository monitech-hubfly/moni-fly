import { redirect } from 'next/navigation';

export default function StepsViabilidadeTarefasRedirect() {
  redirect('/painel-novos-negocios?tab=painel');
}
