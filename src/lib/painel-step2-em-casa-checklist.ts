export type Step2EmCasaChecklistItem = {
  titulo: string;
  prazo: string;
  responsavelNome: string;
};

// Itens do print de "Em Casa card" para a etapa Step 2.
// Prazo é mantido como texto porque o print usa "rotina" e datas.
export const STEP2_EM_CASA_CHECKLIST: Step2EmCasaChecklistItem[] = [
  {
    titulo: 'acompanhar evolução de obra, relatórios, check-in/ check-out, cronograma',
    prazo: 'rotina',
    responsavelNome: 'Wayzer - Nath',
  },
  {
    titulo: 'conferir lançamentos do Nibo com gbox e banco',
    prazo: 'rotina',
    responsavelNome: 'Wayzer - Nath',
  },
  {
    titulo: 'definir solução para o telhado',
    prazo: '18/03/2026',
    responsavelNome: 'Wayzer - Nath',
  },
  {
    titulo:
      'falar com o Dani sobre como contar a questão do telhado com o cliente orçar telha TPO oeste',
    prazo: '18/03/2026',
    responsavelNome: 'Wayzer - Nath',
  },
  {
    titulo: 'fazer um ajuste pontual e monitorar Moni Care',
    prazo: '18/03/2026',
    responsavelNome: 'Wayzer - Nath',
  },
  {
    titulo: 'passar pagamentos para ADM, previsto 80k para esse semana',
    prazo: '16/03/2026',
    responsavelNome: 'Wayzer - Nath',
  },
  {
    titulo:
      'resolver pagamento da troca do forro com o pessoal do ACM: aguardando o Dani dar ok quanto à finalização do serviço',
    prazo: '04/03/2026',
    responsavelNome: 'Wayzer - Nath',
  },
];

