/** Prefixo da app (ex.: deploy com basePath). */
export function appPathBase(): string {
  return (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/$/, '');
}

export function appPath(segment: string): string {
  const s = segment.startsWith('/') ? segment : `/${segment}`;
  const b = appPathBase();
  return `${b}${s}` || s;
}
