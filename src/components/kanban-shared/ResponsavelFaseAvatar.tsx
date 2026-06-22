'use client';

import { responsavelAvatarStyle, responsavelIniciais } from '@/lib/pastelaria/responsavel';

type Props = {
  nome: string | null | undefined;
  size?: 'sm' | 'md';
  className?: string;
};

const SIZE_PX = { sm: 22, md: 28 } as const;
const FONT_PX = { sm: 9, md: 11 } as const;

/** Bolinha com iniciais do responsável do card (card fechado no board). */
export function ResponsavelFaseAvatar({ nome, size = 'sm', className = '' }: Props) {
  const label = nome?.trim();
  if (!label) return null;

  const px = SIZE_PX[size];
  const style = responsavelAvatarStyle(label);

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold leading-none ${className}`.trim()}
      style={{
        width: px,
        height: px,
        fontSize: FONT_PX[size],
        background: style.background,
        color: style.color,
        border: '0.5px solid var(--moni-border-subtle)',
      }}
      title={label}
      aria-label={`Responsável: ${label}`}
    >
      {responsavelIniciais(label)}
    </span>
  );
}
