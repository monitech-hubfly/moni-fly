import type { RedeFranqueadoDbKey } from '@/lib/rede-franqueados';
import { formatAreaAtuacaoLinhas } from '@/lib/rede-area-atuacao';
import { RedeFranqueadoCellClamp } from '@/components/RedeFranqueadoCellClamp';

const DATE_KEYS = new Set<RedeFranqueadoDbKey>([
  'data_ass_cof',
  'data_ass_contrato',
  'data_expiracao_franquia',
  'data_nasc_frank',
  'data_recebimento_kit_boas_vindas',
]);

function statusFranquiaDotColor(value: string): string {
  const n = value.trim().toLowerCase();
  if (n.includes('transferência') || n.includes('transferencia')) {
    return 'var(--moni-card-status-amarelo)'; // dourado atenção (--moni-gold-400)
  }
  if (/em\s*opera/i.test(n)) return 'var(--moni-card-status-verde)';
  return 'var(--moni-card-status-cinza)';
}

function StatusBadge({ value }: { value: string }) {
  const v = value.trim();
  if (!v) return <span className="text-stone-400">—</span>;
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-stone-200/90 bg-stone-50 px-2.5 py-0.5 text-xs font-medium text-stone-800">
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: statusFranquiaDotColor(v) }}
        aria-hidden
      />
      <span className="truncate">{v}</span>
    </span>
  );
}

function ClassificacaoBadge({ value }: { value: string }) {
  const v = value.trim();
  if (!v) return <span className="text-stone-400">—</span>;
  return (
    <span className="inline-flex max-w-full rounded-full border border-stone-200 bg-white px-2.5 py-0.5 text-xs font-medium text-stone-700">
      <span className="truncate">{v}</span>
    </span>
  );
}

type Props = {
  field: RedeFranqueadoDbKey;
  text: string;
  titleText?: string;
};

export function RedeFranqueadoCellValue({ field, text, titleText }: Props) {
  if (field === 'status_franquia') {
    return <StatusBadge value={text} />;
  }
  if (field === 'classificacao_franqueado') {
    return <ClassificacaoBadge value={text} />;
  }
  if (field === 'n_franquia') {
    const display = text.trim() || '—';
    return (
      <span
        className="font-mono text-xs font-medium tabular-nums text-stone-500"
        title={titleText ?? (text.trim() || undefined)}
      >
        {display}
      </span>
    );
  }
  if (field === 'nome_completo') {
    return (
      <div className="min-w-0 max-w-[min(14rem,100%)]">
        <span
          className="block min-w-0 max-w-full overflow-hidden break-words font-medium leading-snug text-stone-900 line-clamp-2"
          title={titleText ?? (text.trim() || undefined)}
        >
          {text.trim() || '—'}
        </span>
      </div>
    );
  }
  if (DATE_KEYS.has(field)) {
    const display = text.trim() || '—';
    return (
      <span
        className="text-xs tabular-nums text-stone-500"
        title={titleText ?? (text.trim() || undefined)}
      >
        {display}
      </span>
    );
  }
  if (field === 'area_atuacao') {
    const linhas = formatAreaAtuacaoLinhas(text);
    const tip = (titleText ?? text).trim() || undefined;
    if (!linhas) return <span className="text-[var(--moni-text-tertiary)]">—</span>;
    return (
      <div className="min-w-0 max-w-[min(16rem,100%)]">
        <span
          className="block whitespace-pre-line break-words text-xs leading-snug text-[var(--moni-text-secondary)]"
          title={tip}
        >
          {linhas}
        </span>
      </div>
    );
  }
  return <RedeFranqueadoCellClamp text={text} titleText={titleText} />;
}
