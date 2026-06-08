'use client';

type AreaPar = { uf: string; cidade: string };

type Props = {
  modo: 'cidade' | 'estado';
  label: string;
  obrigatorio: boolean;
  areas: AreaPar[];
  valor: string;
  estadoReferencia: string;
  salvando: boolean;
  erro: string | null;
  podeEditar: boolean;
  onChange: (valor: string) => void;
  onBlur: (valor: string) => void;
  /** Ao escolher cidade, informa UF correspondente (para auto-preencher Estado). */
  onSelectCidadeComUf?: (cidade: string, uf: string) => void;
};

function labelEl(label: string, obrigatorio: boolean, salvando: boolean) {
  return (
    <span className="mb-1 block text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
      {label}
      {obrigatorio ? <span className="ml-1 text-red-500">*</span> : null}
      {salvando ? (
        <span className="ml-1 inline-block h-2.5 w-2.5 animate-spin rounded-full border border-stone-300 border-t-stone-600" />
      ) : null}
    </span>
  );
}

export function ChecklistAreaAtuacaoSelect({
  modo,
  label,
  obrigatorio,
  areas,
  valor,
  estadoReferencia,
  salvando,
  erro,
  podeEditar,
  onChange,
  onBlur,
  onSelectCidadeComUf,
}: Props) {
  const inputClass =
    'w-full rounded-md border px-3 py-1.5 text-sm outline-none focus:ring-1' +
    ' bg-white border-[var(--moni-border-default)] text-[var(--moni-text-primary)]' +
    ' focus:ring-[var(--moni-primary-500)] focus:border-[var(--moni-primary-500)]';

  if (areas.length === 0) {
    return (
      <div>
        {labelEl(label, obrigatorio, salvando)}
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Cadastre a área de atuação do franqueado em Rede de Franqueados (formato{' '}
          <strong>UF - Cidade</strong>) e vincule este card ao franqueado correto.
        </p>
      </div>
    );
  }

  if (!podeEditar) {
    return (
      <div>
        {labelEl(label, obrigatorio, salvando)}
        <p className="text-sm" style={{ color: 'var(--moni-text-primary)' }}>
          {valor.trim() || '—'}
        </p>
      </div>
    );
  }

  if (modo === 'estado') {
    const ufs = [...new Set(areas.map((a) => a.uf))].sort();
    return (
      <div>
        {labelEl(label, obrigatorio, salvando)}
        <select
          className={inputClass}
          value={valor.trim().toUpperCase()}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v);
            onBlur(v);
          }}
        >
          <option value="">— Selecione o estado —</option>
          {ufs.map((uf) => (
            <option key={uf} value={uf}>
              {uf}
            </option>
          ))}
        </select>
        {erro ? <p className="mt-1 text-xs text-red-500">{erro}</p> : null}
      </div>
    );
  }

  const ufRef = estadoReferencia.trim().toUpperCase();
  const opcoes = ufRef
    ? areas.filter((a) => a.uf === ufRef)
    : areas;

  return (
    <div>
      {labelEl(label, obrigatorio, salvando)}
      {!ufRef ? (
        <p className="mb-1.5 text-[11px] text-stone-500">
          Selecione o estado primeiro ou escolha abaixo (cidade + UF).
        </p>
      ) : null}
      <select
        className={inputClass}
        value={valor}
        onChange={(e) => {
          const raw = e.target.value;
          if (!raw) {
            onChange('');
            onBlur('');
            return;
          }
          const sep = raw.indexOf('::');
          if (sep >= 0) {
            const uf = raw.slice(0, sep);
            const cidade = raw.slice(sep + 2);
            onChange(cidade);
            onSelectCidadeComUf?.(cidade, uf);
            onBlur(cidade);
            return;
          }
          onChange(raw);
          onBlur(raw);
        }}
      >
        <option value="">— Selecione a cidade —</option>
        {opcoes.map((a) => {
          const key = `${a.uf}::${a.cidade}`;
          const rotulo = ufRef ? a.cidade : `${a.cidade} (${a.uf})`;
          return (
            <option key={key} value={ufRef ? a.cidade : key}>
              {rotulo}
            </option>
          );
        })}
      </select>
      {erro ? <p className="mt-1 text-xs text-red-500">{erro}</p> : null}
    </div>
  );
}
