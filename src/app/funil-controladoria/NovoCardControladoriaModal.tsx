'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import {
  criarCardControladoria,
  listarEntidadesContabeis,
  listarProfilesMoniCasa,
} from './actions';

/* ------------------------------------------------------------------ */
/* Tipos internos                                                       */
/* ------------------------------------------------------------------ */
type EntidadeOpcao = { id: string; nome: string; tipo: string };
type ProfileOpcao  = { id: string; nome: string; email: string };

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
function mesAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function mesParaLabel(mes: string): string {
  const [ano, m] = mes.split('-');
  const nomes = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
  ];
  return `${nomes[(parseInt(m, 10) - 1) % 12]}/${ano}`;
}

/* ------------------------------------------------------------------ */
/* Estilos                                                             */
/* ------------------------------------------------------------------ */
const inputCls = 'mt-1 w-full px-4 py-2 text-sm disabled:opacity-60 focus:outline-none';
const inputStyle: React.CSSProperties = {
  border: '0.5px solid var(--moni-border-default)',
  borderRadius: 'var(--moni-radius-md)',
  color: 'var(--moni-text-primary)',
  background: 'var(--moni-surface-elevated, #fff)',
};
const labelCls = 'block text-xs font-medium';
const labelStyle: React.CSSProperties = { color: 'var(--moni-text-primary)' };

/* ================================================================== */
/* Modal — Rotina Contábil                                             */
/* ================================================================== */
function ModalContabil({
  kanbanId,
  basePath,
  onClose,
}: {
  kanbanId: string;
  basePath: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [entidades, setEntidades] = useState<EntidadeOpcao[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [empresaId, setEmpresaId] = useState('');
  const [mes, setMes]   = useState(mesAtual);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    void listarEntidadesContabeis().then((r) => {
      setCarregando(false);
      if (r.ok) setEntidades(r.entidades ?? []);
    });
  }, []);

  const empresaSelecionada = entidades.find((e) => e.id === empresaId);
  const titulo = empresaSelecionada
    ? `${empresaSelecionada.nome} — ${mesParaLabel(mes)}`
    : '';

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setErro(null);
    if (!empresaId) { setErro('Selecione uma empresa.'); return; }

    setLoading(true);
    const res = await criarCardControladoria({ kanbanId, titulo });
    setLoading(false);

    if (!res.ok) { setErro(res.error ?? 'Erro ao criar card.'); return; }
    onClose();
    router.refresh();
  }

  const _ = basePath; // usado via router.refresh()

  return (
    <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto p-6">
      {/* Cabeçalho do form */}
      <div>
        <label htmlFor="ctrl-empresa" className={labelCls} style={labelStyle}>
          Empresa / Entidade <span className="text-red-500">*</span>
        </label>
        <select
          id="ctrl-empresa"
          value={empresaId}
          onChange={(e) => setEmpresaId(e.target.value)}
          required
          disabled={loading || carregando}
          className={inputCls}
          style={inputStyle}
        >
          <option value="">{carregando ? 'Carregando…' : 'Selecione a empresa'}</option>
          {['Gestora', 'Empresa adicional', 'SPE'].map((tipo) => {
            const grupo = entidades.filter((e) => e.tipo === tipo);
            if (!grupo.length) return null;
            return (
              <optgroup key={tipo} label={tipo}>
                {grupo.map((e) => (
                  <option key={e.id} value={e.id}>{e.nome}</option>
                ))}
              </optgroup>
            );
          })}
        </select>
        <p className="mt-1 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
          Empresas ativas em Configuração. Acesse Configuração para ativar/desativar.
        </p>
      </div>

      <div>
        <label htmlFor="ctrl-mes" className={labelCls} style={labelStyle}>
          Mês de referência <span className="text-red-500">*</span>
        </label>
        <input
          id="ctrl-mes"
          type="month"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          required
          disabled={loading}
          className={inputCls}
          style={inputStyle}
        />
      </div>

      {titulo ? (
        <div
          className="rounded p-3 text-xs"
          style={{
            background: 'var(--moni-surface-50, #f9f9f7)',
            border: '0.5px solid var(--moni-border-default)',
            borderRadius: 'var(--moni-radius-md)',
            color: 'var(--moni-text-secondary)',
          }}
        >
          <span className="font-medium" style={{ color: 'var(--moni-text-primary)' }}>Título do card:</span>{' '}
          {titulo}
        </div>
      ) : null}

      <div
        className="rounded p-3 text-xs"
        style={{
          background: 'var(--moni-surface-50, #f9f9f7)',
          border: '0.5px solid var(--moni-border-default)',
          borderRadius: 'var(--moni-radius-md)',
          color: 'var(--moni-text-secondary)',
        }}
      >
        Fase inicial: <span className="font-medium">Enviar Docs para Contabilidade</span>
      </div>

      {erro ? (
        <p className="text-sm" role="alert" style={{ color: 'var(--moni-danger, #b42318)' }}>
          {erro}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="min-h-[44px] px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{
            borderRadius: 'var(--moni-radius-md)',
            border: '0.5px solid var(--moni-border-default)',
            color: 'var(--moni-text-secondary)',
          }}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="min-h-[44px] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          style={{
            borderRadius: 'var(--moni-radius-md)',
            background: 'var(--moni-navy-800)',
          }}
        >
          {loading ? 'Criando…' : 'Criar card'}
        </button>
      </div>
    </form>
  );
}

/* ================================================================== */
/* Modal — Rotina Fiscal                                               */
/* ================================================================== */
function ModalFiscal({
  kanbanId,
  basePath,
  onClose,
}: {
  kanbanId: string;
  basePath: string;
  onClose: () => void;
}) {
  const router = useRouter();
  type TipoCard = 'funcionario' | 'obra';
  const [tipo, setTipo] = useState<TipoCard>('funcionario');

  // Funcionários
  const [profiles, setProfiles]    = useState<ProfileOpcao[]>([]);
  const [profileId, setProfileId]  = useState('');
  const [loadingProfiles, setLoadingProfiles] = useState(true);

  // Obra
  const [nomeObra, setNomeObra]         = useState('');
  const [vinculoCnpj, setVinculoCnpj]   = useState(''); // descrição livre
  const [entidadesContab, setEntidadesContab] = useState<EntidadeOpcao[]>([]);
  const [vinculoEntidadeId, setVinculoEntidadeId] = useState('');
  const [loadingEntidades, setLoadingEntidades]   = useState(false);

  // Compartilhados
  const [mes, setMes]   = useState(mesAtual);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    void listarProfilesMoniCasa().then((r) => {
      setLoadingProfiles(false);
      if (r.ok) setProfiles(r.profiles ?? []);
    });
  }, []);

  useEffect(() => {
    if (tipo !== 'obra' || entidadesContab.length) return;
    setLoadingEntidades(true);
    void listarEntidadesContabeis().then((r) => {
      setLoadingEntidades(false);
      if (r.ok) setEntidadesContab(r.entidades ?? []);
    });
  }, [tipo, entidadesContab.length]);

  // Monta o título do card conforme o tipo
  const profileSelecionado = profiles.find((p) => p.id === profileId);
  const entidadeVinculo    = entidadesContab.find((e) => e.id === vinculoEntidadeId);

  function buildTituloLocal(): string {
    const mesLabel = mesParaLabel(mes);
    if (tipo === 'funcionario') {
      return profileSelecionado ? `Func: ${profileSelecionado.nome} — ${mesLabel}` : '';
    }
    if (!nomeObra.trim()) return '';
    const vinculo = entidadeVinculo ? ` (${entidadeVinculo.nome})` : vinculoCnpj ? ` (${vinculoCnpj})` : '';
    return `Obra: ${nomeObra.trim()}${vinculo} — ${mesLabel}`;
  }

  const titulo = buildTituloLocal();
  const _ = basePath;

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setErro(null);

    if (tipo === 'funcionario' && !profileId) {
      setErro('Selecione um funcionário.'); return;
    }
    if (tipo === 'obra' && !nomeObra.trim()) {
      setErro('Informe o nome da obra.'); return;
    }

    setLoading(true);
    const res = await criarCardControladoria({ kanbanId, titulo });
    setLoading(false);

    if (!res.ok) { setErro(res.error ?? 'Erro ao criar card.'); return; }
    onClose();
    router.refresh();
  }

  const tipoStyle = (t: TipoCard): React.CSSProperties => ({
    border: '0.5px solid var(--moni-border-default)',
    borderRadius: 'var(--moni-radius-md)',
    background: tipo === t ? 'var(--moni-navy-800)' : 'transparent',
    color: tipo === t ? '#fff' : 'var(--moni-text-secondary)',
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto p-6">
      {/* Seleção do tipo de card */}
      <fieldset>
        <legend className="text-xs font-medium mb-2" style={labelStyle}>
          Tipo de card <span className="text-red-500">*</span>
        </legend>
        <div className="flex gap-2">
          {(['funcionario', 'obra'] as const).map((t) => (
            <label
              key={t}
              className="flex-1 flex min-h-[44px] cursor-pointer items-center justify-center gap-2 px-3 py-2 text-sm"
              style={tipoStyle(t)}
            >
              <input
                type="radio"
                name="ctrl-fiscal-tipo"
                className="sr-only"
                checked={tipo === t}
                onChange={() => {
                  setTipo(t);
                  setErro(null);
                  setProfileId('');
                  setNomeObra('');
                  setVinculoCnpj('');
                  setVinculoEntidadeId('');
                }}
              />
              {t === 'funcionario' ? '👤 Funcionário' : '🏗️ Obra'}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Funcionário */}
      {tipo === 'funcionario' ? (
        <div>
          <label htmlFor="ctrl-fiscal-profile" className={labelCls} style={labelStyle}>
            Funcionário <span className="text-red-500">*</span>
          </label>
          <select
            id="ctrl-fiscal-profile"
            value={profileId}
            onChange={(e) => setProfileId(e.target.value)}
            required
            disabled={loading || loadingProfiles}
            className={inputCls}
            style={inputStyle}
          >
            <option value="">{loadingProfiles ? 'Carregando…' : `Selecione (${profiles.length} disponíveis)`}</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>{p.nome} — {p.email}</option>
            ))}
          </select>
        </div>
      ) : null}

      {/* Obra */}
      {tipo === 'obra' ? (
        <div className="space-y-3">
          <div>
            <label htmlFor="ctrl-fiscal-obra" className={labelCls} style={labelStyle}>
              Nome da Obra <span className="text-red-500">*</span>
            </label>
            <input
              id="ctrl-fiscal-obra"
              type="text"
              value={nomeObra}
              onChange={(e) => setNomeObra(e.target.value)}
              required
              disabled={loading}
              placeholder="Ex: Residencial Moní — Bloco A"
              className={inputCls}
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="ctrl-fiscal-vinculo-entidade" className={labelCls} style={labelStyle}>
              Vincular a empresa contábil{' '}
              <span className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>(opcional)</span>
            </label>
            <select
              id="ctrl-fiscal-vinculo-entidade"
              value={vinculoEntidadeId}
              onChange={(e) => { setVinculoEntidadeId(e.target.value); setVinculoCnpj(''); }}
              disabled={loading || loadingEntidades}
              className={inputCls}
              style={inputStyle}
            >
              <option value="">{loadingEntidades ? 'Carregando…' : 'Nenhuma (preencher CNPJ abaixo)'}</option>
              {entidadesContab.map((e) => (
                <option key={e.id} value={e.id}>{e.tipo} — {e.nome}</option>
              ))}
            </select>
          </div>

          {!vinculoEntidadeId ? (
            <div>
              <label htmlFor="ctrl-fiscal-cnpj" className={labelCls} style={labelStyle}>
                CNPJ / identificação da empresa{' '}
                <span className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>(opcional)</span>
              </label>
              <input
                id="ctrl-fiscal-cnpj"
                type="text"
                value={vinculoCnpj}
                onChange={(e) => setVinculoCnpj(e.target.value)}
                disabled={loading}
                placeholder="00.000.000/0000-00 ou nome livre"
                className={inputCls}
                style={inputStyle}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Mês */}
      <div>
        <label htmlFor="ctrl-fiscal-mes" className={labelCls} style={labelStyle}>
          Mês de referência <span className="text-red-500">*</span>
        </label>
        <input
          id="ctrl-fiscal-mes"
          type="month"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          required
          disabled={loading}
          className={inputCls}
          style={inputStyle}
        />
      </div>

      {/* Preview título */}
      {titulo ? (
        <div
          className="rounded p-3 text-xs"
          style={{
            background: 'var(--moni-surface-50, #f9f9f7)',
            border: '0.5px solid var(--moni-border-default)',
            borderRadius: 'var(--moni-radius-md)',
            color: 'var(--moni-text-secondary)',
          }}
        >
          <span className="font-medium" style={{ color: 'var(--moni-text-primary)' }}>Título do card:</span>{' '}
          {titulo}
        </div>
      ) : null}

      <div
        className="rounded p-3 text-xs"
        style={{
          background: 'var(--moni-surface-50, #f9f9f7)',
          border: '0.5px solid var(--moni-border-default)',
          borderRadius: 'var(--moni-radius-md)',
          color: 'var(--moni-text-secondary)',
        }}
      >
        Fase inicial: <span className="font-medium">Cobrança / Verificação do Regime Fiscal</span>
      </div>

      {erro ? (
        <p className="text-sm" role="alert" style={{ color: 'var(--moni-danger, #b42318)' }}>
          {erro}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="min-h-[44px] px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{
            borderRadius: 'var(--moni-radius-md)',
            border: '0.5px solid var(--moni-border-default)',
            color: 'var(--moni-text-secondary)',
          }}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="min-h-[44px] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          style={{
            borderRadius: 'var(--moni-radius-md)',
            background: 'var(--moni-navy-800)',
          }}
        >
          {loading ? 'Criando…' : 'Criar card'}
        </button>
      </div>
    </form>
  );
}

/* ================================================================== */
/* Componente principal exportado                                      */
/* ================================================================== */
export function NovoCardControladoriaModal({
  kanbanId,
  basePath,
  onClose,
}: {
  kanbanId: string;
  basePath?: string;
  onClose: () => void;
}) {
  const isContabil = kanbanId === KANBAN_IDS.CONTROLADORIA_CONTABIL;
  const titulo     = isContabil
    ? 'Novo Card — Rotina Contábil'
    : 'Novo Card — Rotina Fiscal';
  const base = basePath ?? '/funil-controladoria';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex max-h-[90vh] w-full flex-col overflow-hidden bg-white"
        style={{
          maxWidth: '520px',
          borderRadius: 'var(--moni-radius-xl)',
          border: '0.5px solid var(--moni-border-default)',
          boxShadow: 'var(--moni-shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ctrl-novo-card-titulo"
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-center justify-between border-b bg-white px-6 py-4"
          style={{ borderColor: 'var(--moni-border-default)' }}
        >
          <h2
            id="ctrl-novo-card-titulo"
            className="text-base font-bold"
            style={{ color: 'var(--moni-text-primary)' }}
          >
            {titulo}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body — delega para o modal correto */}
        {isContabil ? (
          <ModalContabil kanbanId={kanbanId} basePath={base} onClose={onClose} />
        ) : (
          <ModalFiscal kanbanId={kanbanId} basePath={base} onClose={onClose} />
        )}
      </div>
    </div>
  );
}
