/** Labels de checklist da fase BCA (Funil Step One). */

export const BCA_CHECKLIST_LABEL_SIMULADOR = 'Simulador BCA — casas por condomínio';

export const BCA_CHECKLIST_LABEL_CONFIRMADO =
  'BCA confirmado para todos os condomínios';

export type BcaWizardStep = 'modelo' | 'custo' | 'terreno' | 'cenarios' | 'resultado';

export const BCA_WIZARD_STEPS: { id: BcaWizardStep; label: string }[] = [
  { id: 'modelo', label: 'Modelo' },
  { id: 'custo', label: 'Custo' },
  { id: 'terreno', label: 'Terreno' },
  { id: 'cenarios', label: 'Preços' },
  { id: 'resultado', label: 'Resultado' },
];
