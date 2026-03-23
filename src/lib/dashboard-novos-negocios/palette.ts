export const PALETTE = {
  petrol: '#0D1F2D',
  darkGreen: '#3B6D11',
  amber: '#BA7517',
  gold: '#C8B080',
  charcoal: '#2C2C2A',
  red: '#791F1F',
  gray: '#888780',
  lightAmber: '#D4A843',
  forestGreen: '#0F6E56',
} as const;

export type PaletteKey = keyof typeof PALETTE;
