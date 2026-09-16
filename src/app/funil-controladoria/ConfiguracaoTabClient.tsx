'use client';

import { useTransition } from 'react';
import { toggleEntidade, dispararMes } from './actions';

type Entidade = {
  id: string;
  nome: string;
  subtipo: string | null;
  tipo: string;
  ativo: boolean;
};

type Props = {
  entidades: Entidade[];
  isAdmin: boolean;
};

const GRUPOS: { label: string; tipos: string[] }[] = [
  { label: 'Gestora',             tipos: ['Gestora'] },
  { label: 'Empresas adicionais', tipos: ['Empresa adicional'] },
  { label: 'SPEs por projeto',    tipos: ['SPE'] },
  { label: 'Funcionários',        tipos: ['Funcionário'] },
  { label: 'Obras',               tipos: ['Obra'] },
];

function contarAtivos(entidades: Entidade[], tipos: string[]): number {
  return entidades.filter((e) => tipos.includes(e.tipo) && e.ativo).length;
}

export function ConfiguracaoTabClient({ entidades, isAdmin }: Props) {
  const [pending, startTransition] = useTransition();

  function handleToggle(id: string, novoAtivo: boolean) {
    startTransition(() => {
      void toggleEntidade(id, novoAtivo);
    });
  }

  function handleDisparar(mes: string, aba: 'contabil' | 'fiscal') {
    startTransition(async () => {
      const r = await dispararMes(mes, aba);
      if (r.ok) {
        alert(
          `Disparo ${mes} (${aba === 'contabil' ? 'Contábil' : 'Fiscal'}) concluído!\n` +
          `${r.criados} card(s) criado(s) · ${r.ignorados} já existiam.`,
        );
      } else {
        alert(`Erro ao disparar: ${r.error ?? 'Erro desconhecido'}`);
      }
    });
  }

  // Mês atual formatado "MMM/AA"
  const mesAtual = (() => {
    const d = new Date();
    const meses = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
    return `${meses[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
  })();

  const totalContabilAtivos = contarAtivos(entidades, ['Gestora', 'Empresa adicional', 'SPE']);
  const totalFiscalAtivos   = contarAtivos(entidades, ['Funcionário', 'Obra']);

  return (
    <main className="mx-auto w-full min-w-0 max-w-[1200px] px-6 py-8">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            className="mb-1 text-xl font-bold"
            style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
          >
            Configuração — Disparo Mensal
          </h1>
          <p className="text-sm" style={{ color: 'var(--moni-text-tertiary)' }}>
            Entidades ativas geram cards automaticamente no 1º dia útil de cada mês.
            Fonte:{' '}
            <a
              href="/rede-franqueados/c4dbc081-5a45-45f8-b0ed-bfb9269d5113#empresas"
              className="underline underline-offset-2"
              style={{ color: '#2d3d4a' }}
            >
              Rede de Franqueados → Empresas
            </a>
          </p>
        </div>

        {isAdmin && (
          <div className="flex flex-wrap gap-3">
            <button
              disabled={pending}
              onClick={() => handleDisparar(mesAtual, 'contabil')}
              className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
              style={{ background: '#2d3d4a', color: '#D4EDAA' }}
            >
              ▶ Disparar Contábil — {mesAtual}
            </button>
            <button
              disabled={pending}
              onClick={() => handleDisparar(mesAtual, 'fiscal')}
              className="flex items-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
              style={{ borderColor: '#2d3d4a', color: '#2d3d4a', background: 'transparent' }}
            >
              ▶ Disparar Fiscal — {mesAtual}
            </button>
          </div>
        )}
      </div>

      {/* Cards por grupo */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Contábil */}
        <div
          className="rounded-xl border p-5"
          style={{
            background: '#fff',
            borderWidth: '0.5px',
            borderColor: 'var(--moni-border-default)',
            borderRadius: 'var(--moni-radius-lg)',
          }}
        >
          <div className="mb-4 flex items-start justify-between border-b pb-3" style={{ borderColor: 'var(--moni-border-default)', borderWidth: '0.5px' }}>
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
                🏦 Rotina Contábil
              </div>
              <div className="mt-0.5 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                1 card por empresa ativa · fase inicial: Enviar Docs
              </div>
            </div>
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: 'rgba(45,61,74,.08)', color: '#2d3d4a' }}
            >
              {totalContabilAtivos} ativa{totalContabilAtivos !== 1 ? 's' : ''}
            </span>
          </div>

          {GRUPOS.filter((g) => ['Gestora', 'Empresa adicional', 'SPE'].some((t) => g.tipos.includes(t))).map((grupo) => {
            const itens = entidades.filter((e) => grupo.tipos.includes(e.tipo));
            if (!itens.length) return null;
            return (
              <div key={grupo.label} className="mb-4">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--moni-text-tertiary)' }}>
                  {grupo.label}
                </div>
                <div className="overflow-hidden rounded-lg border" style={{ borderWidth: '0.5px', borderColor: 'var(--moni-border-default)' }}>
                  {itens.map((e) => (
                    <EntidadeRow key={e.id} entidade={e} isAdmin={isAdmin} onToggle={handleToggle} disabled={pending} />
                  ))}
                </div>
              </div>
            );
          })}

          <div
            className="mt-3 flex items-start gap-2 rounded-lg p-3 text-xs"
            style={{ background: 'rgba(45,61,74,.04)', border: '0.5px solid rgba(45,61,74,.14)', color: 'var(--moni-text-secondary)' }}
          >
            🔗 Lista sincronizada com{' '}
            <a href="/rede-franqueados/c4dbc081-5a45-45f8-b0ed-bfb9269d5113#empresas" className="underline" style={{ color: '#2d3d4a' }}>
              Rede de Franqueados → Empresas
            </a>
          </div>
        </div>

        {/* Fiscal */}
        <div
          className="rounded-xl border p-5"
          style={{
            background: '#fff',
            borderWidth: '0.5px',
            borderColor: 'var(--moni-border-default)',
            borderRadius: 'var(--moni-radius-lg)',
          }}
        >
          <div className="mb-4 flex items-start justify-between border-b pb-3" style={{ borderColor: 'var(--moni-border-default)', borderWidth: '0.5px' }}>
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
                🧾 Rotina Fiscal
              </div>
              <div className="mt-0.5 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                1 card por funcionário + 1 por obra ativa
              </div>
            </div>
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: 'rgba(45,61,74,.08)', color: '#2d3d4a' }}
            >
              {totalFiscalAtivos} ativo{totalFiscalAtivos !== 1 ? 's' : ''}
            </span>
          </div>

          {GRUPOS.filter((g) => ['Funcionário', 'Obra'].some((t) => g.tipos.includes(t))).map((grupo) => {
            const itens = entidades.filter((e) => grupo.tipos.includes(e.tipo));
            if (!itens.length) return null;
            return (
              <div key={grupo.label} className="mb-4">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--moni-text-tertiary)' }}>
                  {grupo.label}
                </div>
                <div className="overflow-hidden rounded-lg border" style={{ borderWidth: '0.5px', borderColor: 'var(--moni-border-default)' }}>
                  {itens.map((e) => (
                    <EntidadeRow key={e.id} entidade={e} isAdmin={isAdmin} onToggle={handleToggle} disabled={pending} />
                  ))}
                </div>
              </div>
            );
          })}

          <div
            className="mt-3 flex items-start gap-2 rounded-lg p-3 text-xs"
            style={{ background: '#FFF3E0', border: '0.5px solid #FFB74D', color: '#7C4A00' }}
          >
            ⚠️ Fonte a confirmar com Fe (Pastelaria/RH). Nomes acima são placeholders.
          </div>
        </div>
      </div>
    </main>
  );
}

function EntidadeRow({
  entidade,
  isAdmin,
  onToggle,
  disabled,
}: {
  entidade: Entidade;
  isAdmin: boolean;
  onToggle: (id: string, ativo: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div
      className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
      style={{
        borderColor: 'var(--moni-border-default)',
        borderWidth: '0.5px',
        opacity: entidade.ativo ? 1 : 0.5,
      }}
    >
      <div className="min-w-0 flex-1">
        <div
          className="text-sm font-medium"
          style={{
            color: 'var(--moni-text-primary)',
            textDecoration: entidade.ativo ? 'none' : 'line-through',
          }}
        >
          {entidade.nome}
        </div>
        {entidade.subtipo && (
          <div className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
            {entidade.subtipo}
          </div>
        )}
      </div>

      {isAdmin && (
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            className="sr-only"
            checked={entidade.ativo}
            disabled={disabled}
            onChange={(e) => onToggle(entidade.id, e.target.checked)}
          />
          <div
            className="h-5 w-9 rounded-full transition-colors"
            style={{ background: entidade.ativo ? '#2d3d4a' : '#D1D0C9' }}
          >
            <div
              className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
              style={{ transform: entidade.ativo ? 'translateX(16px)' : 'translateX(2px)' }}
            />
          </div>
        </label>
      )}
    </div>
  );
}
