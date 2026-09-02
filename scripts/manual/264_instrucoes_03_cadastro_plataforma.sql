-- 264 instruções completas (opcional) — capital_cadastro_plataforma
UPDATE public.kanban_fases
SET instrucoes = $instr$Crie uma conta como investidor em https://monicapital.divify.com.br

Após o cadastro, a equipe Moní ajusta o perfil para emissor da oferta.$instr$
WHERE kanban_id = (SELECT id FROM public.kanbans WHERE nome = 'Funil Moní Capital' LIMIT 1)
  AND slug = 'capital_cadastro_plataforma';
