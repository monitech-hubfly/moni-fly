import Link from 'next/link';
import { rotuloNumeroFranquia } from '@/lib/formularios/resposta-identidade';
import type { FormularioRespostaListaItem } from '@/types/formularios';

function quando(iso: string | null): string {
  if (!iso) return '—';
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '—';
  return data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function celula(valor: string | null | undefined): string {
  const texto = String(valor ?? '').trim();
  return texto || '—';
}

const COLUNAS = '7.5rem minmax(10rem,1.4fr) minmax(8rem,1fr) minmax(10rem,1.2fr) minmax(8rem,1fr) 5.5rem 9.5rem';

export function RespostasFormularioTabela({ respostas }: { respostas: FormularioRespostaListaItem[] }) {
  if (respostas.length === 0) {
    return (
      <p className="px-3 py-4 text-sm" style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}>
        Nenhuma resposta enviada neste formulário.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[880px]">
        <div
          className="grid items-center gap-3 px-3 py-2 text-[11px] uppercase tracking-wide"
          style={{
            gridTemplateColumns: COLUNAS,
            color: 'var(--moni-text-tertiary)',
            borderBottom: 'var(--moni-border-width) solid var(--moni-border-default)',
            fontFamily: 'var(--moni-font-sans)',
          }}
        >
          <span>Nº franquia</span>
          <span>Título do card</span>
          <span>Fase</span>
          <span>Nome completo</span>
          <span>Cidade</span>
          <span>Estado</span>
          <span>Último preenchimento</span>
        </div>
        <ul>
          {respostas.map((resposta) => (
            <li key={resposta.id}>
              <Link
                href={`/formularios/${resposta.formulario_id}/${resposta.id}`}
                className="grid items-center gap-3 px-3 py-2.5 text-[13px] transition-colors hover:bg-[var(--moni-surface-100)]"
                style={{
                  gridTemplateColumns: COLUNAS,
                  color: 'var(--moni-text-primary)',
                  borderBottom: 'var(--moni-border-width) solid var(--moni-border-default)',
                  fontFamily: 'var(--moni-font-sans)',
                  minHeight: 44,
                }}
              >
                <span className="truncate">{celula(rotuloNumeroFranquia(resposta.numero_franquia))}</span>
                <span className="truncate" title={resposta.card_titulo ?? undefined}>
                  {celula(resposta.card_titulo)}
                </span>
                <span className="truncate" title={resposta.card_fase ?? undefined}>
                  {celula(resposta.card_fase)}
                </span>
                <span className="truncate" title={resposta.nome_completo ?? undefined}>
                  {celula(resposta.nome_completo)}
                </span>
                <span className="truncate" title={resposta.cidade ?? undefined}>
                  {celula(resposta.cidade)}
                </span>
                <span className="truncate">{celula(resposta.estado)}</span>
                <span className="truncate">{quando(resposta.enviado_em ?? resposta.criado_em)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
