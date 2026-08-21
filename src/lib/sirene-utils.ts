export function podeExcluirChamadoSirene(opts: {
  role: string | null | undefined;
  cargo: string | null | undefined;
  userId: string | null | undefined;
  abertoPor: string | null | undefined;
}): boolean {
  const roleNorm = String(opts.role ?? '').trim().toLowerCase();
  const cargoNorm = String(opts.cargo ?? '').trim().toLowerCase();
  if (roleNorm === 'admin') return true;
  if (cargoNorm === 'adm') return true;
  const aberto = opts.abertoPor != null ? String(opts.abertoPor).trim() : '';
  const uid = opts.userId != null ? String(opts.userId).trim() : '';
  if (!aberto || !uid) return false;
  return aberto.toLowerCase() === uid.toLowerCase();
}
