'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, ExternalLink, X } from 'lucide-react';
import {
  buscarRedeLoteadoresParaNovoCard,
  carregarRedeLoteadorParaNovoCard,
  criarCardLoteadoresComCadastro,
  getProximoNLoteador,
  type BuscarRedeLoteadoresOpcao,
  type CriarCardLoteadoresCadastroModo,
} from '@/lib/actions/loteadores-novo-card';
import { obterLinkIntakePublicoLoteador } from '@/lib/actions/loteador-externo-actions';
import { montarTituloCardLoteadoresSync } from '@/lib/kanban/loteadores-card-titulo';

export function NovoCardMonINCModal({
  faseId,
  kanbanId: _kanbanId,
  isAdmin,
  basePath = '/funil-moni-inc',
  onClose,
}: {
  faseId: string;
  kanbanId: string;
  /** Staff (admin/team) — Frank não gerencia cadastro. */
  isAdmin: boolean;
  basePath?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const podeGerirCadastro = Boolean(isAdmin);

  const [modo, setModo] = useState<CriarCardLoteadoresCadastroModo>('novo');
  const [redeLoteadorId, setRedeLoteadorId] = useState('');
  const [busca, setBusca] = useState('');
  const [opcoes, setOpcoes] = useState<BuscarRedeLoteadoresOpcao[]>([]);
  const [carregandoBusca, setCarregandoBusca] = useState(false);

  const [nomeLoteador, setNomeLoteador] = useState('');
  const [nLoteador, setNLoteador] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [nomeResponsavel, setNomeResponsavel] = useState('');
  const [cargoFuncao, setCargoFuncao] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [nomeCondominio, setNomeCondominio] = useState('');
  const [quadra, setQuadra] = useState('');
  const [lote, setLote] = useState('');

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [linkIntake, setLinkIntake] = useState<string | null>(null);
  const [linkCopiado, setLinkCopiado] = useState(false);

  const limparForm = useCallback(() => {
    setRedeLoteadorId('');
    setNomeLoteador('');
    setNLoteador('');
    setCnpj('');
    setNomeResponsavel('');
    setCargoFuncao('');
    setTelefone('');
    setEmail('');
    setNomeCondominio('');
    setQuadra('');
    setLote('');
    setBusca('');
  }, []);

  useEffect(() => {
    if (!podeGerirCadastro) return;
    let cancelled = false;
    void obterLinkIntakePublicoLoteador().then((res) => {
      if (cancelled || !res.ok) return;
      setLinkIntake(res.url);
    });
    return () => {
      cancelled = true;
    };
  }, [podeGerirCadastro]);

  async function copiarLinkIntake() {
    if (!linkIntake) return;
    try {
      await navigator.clipboard.writeText(linkIntake);
      setLinkCopiado(true);
      window.setTimeout(() => setLinkCopiado(false), 1600);
    } catch {
      setErro('Não foi possível copiar o link.');
    }
  }

  useEffect(() => {
    if (!podeGerirCadastro || modo !== 'novo') return;
    if (nLoteador.trim()) return;
    let cancelled = false;
    void (async () => {
      const res = await getProximoNLoteador();
      if (cancelled) return;
      if (res.ok) setNLoteador(res.valor);
    })();
    return () => {
      cancelled = true;
    };
  }, [podeGerirCadastro, modo, nLoteador]);

  useEffect(() => {
    if (!podeGerirCadastro || modo !== 'existente') return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      void (async () => {
        setCarregandoBusca(true);
        const res = await buscarRedeLoteadoresParaNovoCard(busca);
        if (cancelled) return;
        setCarregandoBusca(false);
        if (!res.ok) {
          setErro(res.error);
          setOpcoes([]);
          return;
        }
        setOpcoes(res.opcoes);
      })();
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [modo, busca, podeGerirCadastro]);

  async function selecionarCadastro(id: string) {
    setRedeLoteadorId(id);
    setErro(null);
    if (!id) return;
    setLoading(true);
    try {
      const res = await carregarRedeLoteadorParaNovoCard(id);
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      const d = res.draft;
      setNomeLoteador(d.nome);
      setNLoteador(String(res.row.n_loteador ?? res.row.codigo ?? '').trim());
      setCnpj(d.cnpj);
      setNomeResponsavel(d.interlocutor_nome || d.contato_nome);
      setCargoFuncao(d.interlocutor_cargo);
      setTelefone(d.interlocutor_telefone || d.contato_telefone);
      setEmail(d.interlocutor_email || d.contato_email);
      setNomeCondominio(d.condominio_nome);
    } finally {
      setLoading(false);
    }
  }

  const tituloPreview = useMemo(() => {
    return (
      montarTituloCardLoteadoresSync({
        nLoteador: nLoteador.trim(),
        nomeCondominio: nomeCondominio.trim(),
        tituloFallback: nomeLoteador.trim(),
      }) ?? ''
    );
  }, [nLoteador, nomeCondominio, nomeLoteador]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!podeGerirCadastro) {
      setErro('Sem permissão para criar card / cadastro de loteador (apenas staff).');
      return;
    }
    if (!faseId) {
      setErro('Fase inicial não configurada. Recarregue após aplicar a migration.');
      return;
    }
    if (modo === 'existente' && !redeLoteadorId) {
      setErro('Selecione um cadastro existente.');
      return;
    }

    setLoading(true);
    try {
      const res = await criarCardLoteadoresComCadastro({
        faseId,
        basePath,
        modo,
        redeLoteadorId: modo === 'existente' ? redeLoteadorId : undefined,
        parceiro: {
          nomeLoteador: nomeLoteador.trim(),
          nLoteador: nLoteador.trim() || undefined,
          nomeResponsavel: nomeResponsavel.trim(),
          cargoFuncao: cargoFuncao.trim(),
          telefone: telefone.trim(),
          email: email.trim(),
          cnpj: cnpj.trim() || undefined,
          condominioNome: nomeCondominio.trim() || undefined,
        },
        quadra: quadra.trim() || undefined,
        lote: lote.trim() || undefined,
      });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      onClose();
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    'mt-1 w-full px-4 py-2 text-sm disabled:opacity-60 focus:outline-none';
  const inputStyle = {
    border: '0.5px solid var(--moni-border-default)',
    borderRadius: 'var(--moni-radius-md)',
    color: 'var(--moni-text-primary)',
    background: 'var(--moni-surface-elevated, #fff)',
  } as const;
  const labelCls = 'block text-sm font-medium';
  const labelStyle = { color: 'var(--moni-text-primary)' } as const;

  if (!podeGerirCadastro) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={onClose}
        role="presentation"
      >
        <div
          className="w-full max-w-md bg-white p-6"
          style={{
            borderRadius: 'var(--moni-radius-xl)',
            border: '0.5px solid var(--moni-border-default)',
          }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <p className="text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
            Frank e franqueados só visualizam o funil. A criação de cards e cadastros é restrita ao
            staff.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 min-h-[44px] w-full rounded-lg px-4 py-2 text-sm font-medium text-white"
            style={{ background: 'var(--moni-navy-800)', borderRadius: 'var(--moni-radius-md)' }}
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex max-h-[90vh] w-full flex-col overflow-hidden bg-white"
        style={{
          maxWidth: '560px',
          borderRadius: 'var(--moni-radius-xl)',
          border: '0.5px solid var(--moni-border-default)',
          boxShadow: 'var(--moni-shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="novo-card-moni-inc-titulo"
      >
        <div
          className="flex shrink-0 items-center justify-between border-b bg-white px-6 py-4"
          style={{ borderColor: 'var(--moni-border-default)' }}
        >
          <h2
            id="novo-card-moni-inc-titulo"
            className="text-lg font-bold"
            style={{ color: 'var(--moni-text-primary)' }}
          >
            Novo Card
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

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto p-6">
          {linkIntake ? (
            <div
              className="space-y-2 p-3"
              style={{
                border: '0.5px solid var(--moni-border-default)',
                borderRadius: 'var(--moni-radius-md)',
                background: 'var(--moni-surface-50)',
              }}
            >
              <p className="text-sm font-medium" style={labelStyle}>
                Link de preenchimento externo
              </p>
              <p className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                Sempre o mesmo. Cada envio cria um cadastro e um card novos na fase Novo Loteador.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <p
                  className="min-w-0 flex-1 truncate text-xs"
                  style={{ color: 'var(--moni-text-secondary)' }}
                  title={linkIntake}
                >
                  {linkIntake}
                </p>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => void copiarLinkIntake()}
                    className="inline-flex min-h-[44px] items-center gap-1.5 px-3 text-xs font-medium"
                    style={{
                      border: '0.5px solid var(--moni-border-default)',
                      borderRadius: 'var(--moni-radius-md)',
                      color: 'var(--moni-text-secondary)',
                      background: 'var(--moni-surface-0)',
                    }}
                  >
                    {linkCopiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {linkCopiado ? 'Copiado' : 'Copiar'}
                  </button>
                  <a
                    href={linkIntake}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[44px] items-center gap-1.5 px-3 text-xs font-medium"
                    style={{
                      border: '0.5px solid var(--moni-border-default)',
                      borderRadius: 'var(--moni-radius-md)',
                      color: 'var(--moni-text-secondary)',
                      background: 'var(--moni-surface-0)',
                    }}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Abrir
                  </a>
                </div>
              </div>
            </div>
          ) : null}

          <fieldset>
            <legend className="text-sm font-medium" style={labelStyle}>
              Cadastro do loteador
            </legend>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <label
                className="flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-2 px-3 py-2 text-sm"
                style={{
                  border: '0.5px solid var(--moni-border-default)',
                  borderRadius: 'var(--moni-radius-md)',
                  background: modo === 'existente' ? 'var(--moni-navy-800)' : 'transparent',
                  color: modo === 'existente' ? '#fff' : 'var(--moni-text-secondary)',
                }}
              >
                <input
                  type="radio"
                  name="modo-cadastro-loteador"
                  className="sr-only"
                  checked={modo === 'existente'}
                  onChange={() => {
                    setModo('existente');
                    limparForm();
                    setErro(null);
                  }}
                />
                Cadastro existente
              </label>
              <label
                className="flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-2 px-3 py-2 text-sm"
                style={{
                  border: '0.5px solid var(--moni-border-default)',
                  borderRadius: 'var(--moni-radius-md)',
                  background: modo === 'novo' ? 'var(--moni-navy-800)' : 'transparent',
                  color: modo === 'novo' ? '#fff' : 'var(--moni-text-secondary)',
                }}
              >
                <input
                  type="radio"
                  name="modo-cadastro-loteador"
                  className="sr-only"
                  checked={modo === 'novo'}
                  onChange={() => {
                    setModo('novo');
                    limparForm();
                    setErro(null);
                  }}
                />
                Criar novo cadastro
              </label>
            </div>
          </fieldset>

          {modo === 'existente' ? (
            <div className="space-y-3">
              <div>
                <label htmlFor="busca-loteador" className={labelCls} style={labelStyle}>
                  Buscar (nome ou CNPJ)
                </label>
                <input
                  id="busca-loteador"
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  disabled={loading}
                  className={inputCls}
                  style={inputStyle}
                  placeholder="Digite para filtrar…"
                  autoComplete="off"
                />
              </div>
              <div>
                <label htmlFor="select-loteador" className={labelCls} style={labelStyle}>
                  Cadastro <span className="text-red-500">*</span>
                </label>
                <select
                  id="select-loteador"
                  value={redeLoteadorId}
                  onChange={(e) => void selecionarCadastro(e.target.value)}
                  required
                  disabled={loading || carregandoBusca}
                  className={inputCls}
                  style={inputStyle}
                >
                  <option value="">
                    {carregandoBusca ? 'Carregando…' : 'Selecione um loteador'}
                  </option>
                  {opcoes.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.n_loteador || o.codigo ? `${o.n_loteador || o.codigo} — ` : ''}
                      {o.nome}
                      {o.cnpj ? ` · ${o.cnpj}` : ''}
                      {o.condominio_nome ? ` (${o.condominio_nome})` : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                  Ao selecionar, os campos abaixo são preenchidos e permanecem editáveis.
                </p>
              </div>
            </div>
          ) : null}

          <div>
            <label htmlFor="n-loteador" className={labelCls} style={labelStyle}>
              N do Loteador
            </label>
            <input
              id="n-loteador"
              type="text"
              value={nLoteador}
              onChange={(e) => setNLoteador(e.target.value.toUpperCase())}
              disabled={loading || modo === 'existente'}
              className={inputCls}
              style={inputStyle}
              placeholder="LO0000"
              autoComplete="off"
            />
            <p className="mt-1 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
              Gerado automaticamente (LOxxxx). Editável só em cadastro novo.
            </p>
          </div>

          <div>
            <label htmlFor="nome-loteador" className={labelCls} style={labelStyle}>
              Nome do loteador <span className="text-red-500">*</span>
            </label>
            <input
              id="nome-loteador"
              type="text"
              value={nomeLoteador}
              onChange={(e) => setNomeLoteador(e.target.value)}
              required
              disabled={loading}
              className={inputCls}
              style={inputStyle}
              placeholder="Empresa / loteador"
            />
          </div>

          <div>
            <label htmlFor="cnpj-loteador" className={labelCls} style={labelStyle}>
              CNPJ{' '}
              <span className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                (opcional)
              </span>
            </label>
            <input
              id="cnpj-loteador"
              type="text"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              disabled={loading}
              className={inputCls}
              style={inputStyle}
              placeholder="00.000.000/0000-00"
            />
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium" style={labelStyle}>
              Dados do responsável / parceiro
            </legend>
            <div>
              <label htmlFor="nome-responsavel" className={labelCls} style={labelStyle}>
                Nome do responsável <span className="text-red-500">*</span>
              </label>
              <input
                id="nome-responsavel"
                type="text"
                value={nomeResponsavel}
                onChange={(e) => setNomeResponsavel(e.target.value)}
                required
                disabled={loading}
                className={inputCls}
                style={inputStyle}
              />
            </div>
            <div>
              <label htmlFor="cargo-funcao" className={labelCls} style={labelStyle}>
                Cargo / função <span className="text-red-500">*</span>
              </label>
              <input
                id="cargo-funcao"
                type="text"
                value={cargoFuncao}
                onChange={(e) => setCargoFuncao(e.target.value)}
                required
                disabled={loading}
                className={inputCls}
                style={inputStyle}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="telefone-parceiro" className={labelCls} style={labelStyle}>
                  Telefone <span className="text-red-500">*</span>
                </label>
                <input
                  id="telefone-parceiro"
                  type="tel"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  required
                  disabled={loading}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
              <div>
                <label htmlFor="email-parceiro" className={labelCls} style={labelStyle}>
                  E-mail <span className="text-red-500">*</span>
                </label>
                <input
                  id="email-parceiro"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
            </div>
          </fieldset>

          <div>
            <label htmlFor="nome-condominio" className={labelCls} style={labelStyle}>
              Condomínio{' '}
              <span className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                (opcional)
              </span>
            </label>
            <input
              id="nome-condominio"
              type="text"
              value={nomeCondominio}
              onChange={(e) => setNomeCondominio(e.target.value)}
              disabled={loading}
              className={inputCls}
              style={inputStyle}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="quadra" className={labelCls} style={labelStyle}>
                Quadra
              </label>
              <input
                id="quadra"
                type="text"
                value={quadra}
                onChange={(e) => setQuadra(e.target.value)}
                disabled={loading}
                className={inputCls}
                style={inputStyle}
              />
            </div>
            <div>
              <label htmlFor="lote" className={labelCls} style={labelStyle}>
                Lote
              </label>
              <input
                id="lote"
                type="text"
                value={lote}
                onChange={(e) => setLote(e.target.value)}
                disabled={loading}
                className={inputCls}
                style={inputStyle}
              />
            </div>
          </div>

          {tituloPreview ? (
            <p className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
              Título do card: {tituloPreview}
            </p>
          ) : null}

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
              className="min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
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
              className="min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              style={{
                borderRadius: 'var(--moni-radius-md)',
                background: 'var(--moni-navy-800)',
              }}
            >
              {loading
                ? 'Salvando…'
                : modo === 'existente'
                  ? 'Atualizar cadastro e criar card'
                  : 'Criar cadastro e card'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
