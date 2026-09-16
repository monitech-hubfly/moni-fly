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

type ProfileFiscal = {
  id: string;
  nome: string;
  email: string;
};

type Props = {
  entidades: Entidade[];
  profilesFiscal: ProfileFiscal[];
  isAdmin: boolean;
};

function contarAtivos(entidades: Entidade[], tipos: string[]): number {
  return entidades.filter((e) => tipos.includes(e.tipo) && e.ativo).length;
}

export function ConfiguracaoTabClient({ entidades, profilesFiscal, isAdmin }: Props) {
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

  // Mês atual formatado "MMM/AAAA" para input type="month"
  const mesAtualInput = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();

  // Mês atual formatado "MMM/AA" para exibição
  const mesAtualLabel = (() => {
    const d = new Date();
    const meses = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
    return `${meses[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
  })();

  const totalContabilAtivos = contarAtivos(entidades, ['Gestora', 'Empresa adicional', 'SPE']);
  // Fiscal: todos os profiles @moni.casa (sempre ativos) + obras ativas da entidades_cfg
  const totalObrasAtivas   = contarAtivos(entidades, ['Obra']);
  const totalFiscalAtivos  = profilesFiscal.length + totalObrasAtivas;

  const obrasEntidades = entidades.filter((e) => e.tipo === 'Obra');

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
            Fonte Contábil:{' '}
            <a
              href="/rede-franqueados/c4dbc081-5a45-45f8-b0ed-bfb9269d5113#empresas"
              className="underline underline-offset-2"
              style={{ color: '#2d3d4a' }}
            >
              Rede de Franqueados → Empresas
            </a>
            . Fonte Fiscal Funcionários: profiles @moni.casa.
          </p>
        </div>

        {isAdmin && (
          <div className="flex flex-wrap gap-3">
            <button
              disabled={pending}
              onClick={() => handleDisparar(mesAtualInput, 'contabil')}
              className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
              style={{ background: '#2d3d4a', color: '#D4EDAA' }}
            >
              ▶ Disparar Contábil — {mesAtualLabel}
            </button>
            <button
              disabled={pending}
              onClick={() => handleDisparar(mesAtualInput, 'fiscal')}
              className="flex items-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
              style={{ borderColor: '#2d3d4a', color: '#2d3d4a', background: 'transparent' }}
            >
              ▶ Disparar Fiscal — {mesAtualLabel}
            </button>
          </div>
        )}
      </div>

      {/* Cards por grupo */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* ── Contábil ─────────────────────────────────────────────────── */}
        <div
          className="rounded-xl border p-5"
          style={{
            background: '#fff',
            borderWidth: '0.5px',
            borderColor: 'var(--moni-border-default)',
            borderRadius: 'var(--moni-radius-lg)',
          }}
        >
          <div
            className="mb-4 flex items-start justify-between border-b pb-3"
            style={{ borderColor: 'var(--moni-border-default)', borderWidth: '0.5px' }}
          >
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

          {(['Gestora', 'Empresa adicional', 'SPE'] as const).map((tipo) => {
            const itens = entidades.filter((e) => e.tipo === tipo);
            if (!itens.length) return null;
            return (
              <div key={tipo} className="mb-4">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--moni-text-tertiary)' }}>
                  {tipo === 'Empresa adicional' ? 'Empresas adicionais' : tipo === 'SPE' ? 'SPEs por projeto' : tipo}
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

        {/* ── Fiscal ──────────────────────────────────────────────────────── */}
        <div
          className="rounded-xl border p-5"
          style={{
            background: '#fff',
            borderWidth: '0.5px',
            borderColor: 'var(--moni-border-default)',
            borderRadius: 'var(--moni-radius-lg)',
          }}
        >
          <div
            className="mb-4 flex items-start justify-between border-b pb-3"
            style={{ borderColor: 'var(--moni-border-default)', borderWidth: '0.5px' }}
          >
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
                🧾 Rotina Fiscal
              </div>
              <div className="mt-0.5 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                1 card por funcionário @moni.casa + 1 por obra ativa
              </div>
            </div>
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: 'rgba(45,61,74,.08)', color: '#2d3d4a' }}
            >
              {totalFiscalAtivos} ativo{totalFiscalAtivos !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Funcionários — todos os profiles @moni.casa (somente leitura) */}
          {profilesFiscal.length > 0 ? (
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--moni-text-tertiary)' }}>
                  Funcionários ({profilesFiscal.length})
                </span>
                <span className="text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
                  Fonte: @moni.casa
                </span>
              </div>
              <div
                className="overflow-hidden rounded-lg border"
                style={{ borderWidth: '0.5px', borderColor: 'var(--moni-border-default)' }}
              >
                {profilesFiscal.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
                    style={{ borderColor: 'var(--moni-border-default)', borderWidth: '0.5px' }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                        {p.nome}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                        {p.email}
                      </div>
                    </div>
                    {/* Indicador sempre ativo (somente leitura) */}
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{ background: 'rgba(47,74,58,.1)', color: '#2F4A3A' }}
                    >
                      ativo
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Obras — toggleable */}
          {obrasEntidades.length > 0 ? (
            <div className="mb-4">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--moni-text-tertiary)' }}>
                Obras ({totalObrasAtivas} ativa{totalObrasAtivas !== 1 ? 's' : ''})
              </div>
              <div className="overflow-hidden rounded-lg border" style={{ borderWidth: '0.5px', borderColor: 'var(--moni-border-default)' }}>
                {obrasEntidades.map((e) => (
                  <EntidadeRow key={e.id} entidade={e} isAdmin={isAdmin} onToggle={handleToggle} disabled={pending} />
                ))}
              </div>
            </div>
          ) : null}

          {obrasEntidades.length === 0 && profilesFiscal.length === 0 ? (
            <p className="py-4 text-center text-sm" style={{ color: 'var(--moni-text-tertiary)' }}>
              Nenhuma entidade fiscal cadastrada.
            </p>
          ) : null}

          <div
            className="mt-3 rounded-lg p-3 text-xs"
            style={{ background: 'rgba(45,61,74,.04)', border: '0.5px solid rgba(45,61,74,.14)', color: 'var(--moni-text-secondary)' }}
          >
            👤 Funcionários puxados automaticamente de todos os perfis com e-mail @moni.casa.
            Para obras, use o botão <strong>+ Adicionar Card</strong> na aba Rotina Fiscal.
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
