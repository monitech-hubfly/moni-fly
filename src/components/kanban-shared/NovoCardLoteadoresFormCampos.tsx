'use client';

import { useEffect, useMemo, useState } from 'react';
import { listarCondominiosCadastro } from '@/lib/actions/kanban-card-condominio';
import { listarCondominiosIntakePublico } from '@/lib/actions/loteador-externo-actions';
import { normalizarParaBuscaCondominio } from '@/lib/condominios';
import type { NovoCardLoteadoresFormulario } from '@/lib/kanban/loteadores-novo-card-form';
import { UFS_BRASIL } from '@/lib/uf';

type OpcaoCondominio = { id: string; nome: string; cidade: string | null; estado: string | null };

type Props = {
  value: NovoCardLoteadoresFormulario;
  onChange: (patch: Partial<NovoCardLoteadoresFormulario>) => void;
  disabled?: boolean;
  idPrefix?: string;
  /** Preenchimento externo: lista o cadastro depois de validar o link. */
  tokenPublico?: string;
};

const inputCls = 'mt-1 w-full px-3 py-2 text-sm focus:outline-none disabled:opacity-60';
const inputStyle = {
  border: '0.5px solid var(--moni-border-default)',
  borderRadius: 'var(--moni-radius-md)',
  color: 'var(--moni-text-primary)',
  background: 'var(--moni-surface-0)',
  minHeight: 44,
  fontFamily: 'var(--moni-font-sans)',
} as const;
const labelCls = 'block text-sm font-medium';
const labelStyle = { color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' } as const;

function Obrigatorio() {
  return <span style={{ color: 'var(--moni-danger)' }}> *</span>;
}

function Opcional() {
  return (
    <span className="text-xs font-normal" style={{ color: 'var(--moni-text-tertiary)' }}>
      {' '}
      (opcional)
    </span>
  );
}

function Secao({ titulo }: { titulo: string }) {
  return (
    <p className="text-sm font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
      {titulo}
    </p>
  );
}

export function NovoCardLoteadoresFormCampos({
  value,
  onChange,
  disabled = false,
  idPrefix = 'novo-loteador',
  tokenPublico,
}: Props) {
  const [listaCondominios, setListaCondominios] = useState<OpcaoCondominio[]>([]);
  const [buscaCondo, setBuscaCondo] = useState('');

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      if (tokenPublico) {
        const res = await listarCondominiosIntakePublico(tokenPublico);
        if (!cancelado && res.ok) setListaCondominios(res.opcoes);
        return;
      }
      const rows = await listarCondominiosCadastro();
      if (!cancelado) {
        setListaCondominios(
          rows.map((r) => ({ id: r.id, nome: r.nome, cidade: r.cidade, estado: r.estado })),
        );
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [tokenPublico]);
  const id = (suffix: string) => `${idPrefix}-${suffix}`;
  const set =
    (key: keyof NovoCardLoteadoresFormulario) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      onChange({ [key]: e.target.value });
    };

  const escolhido = listaCondominios.find((c) => c.id === value.condominioId) ?? null;
  const resultadosCondo = useMemo(() => {
    const q = normalizarParaBuscaCondominio(buscaCondo);
    if (!q) return [];
    return listaCondominios
      .filter((c) =>
        normalizarParaBuscaCondominio([c.nome, c.cidade, c.estado].filter(Boolean).join(' ')).includes(q),
      )
      .slice(0, 12);
  }, [buscaCondo, listaCondominios]);

  return (
    <div className="space-y-4">
      <Secao titulo="Cadastro Loteadores" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor={id('nome-loteadora')} className={labelCls} style={labelStyle}>
            Nome Loteadora
            <Obrigatorio />
          </label>
          <input
            id={id('nome-loteadora')}
            type="text"
            required
            value={value.nomeLoteadora}
            onChange={set('nomeLoteadora')}
            disabled={disabled}
            className={inputCls}
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor={id('cnpj')} className={labelCls} style={labelStyle}>
            CNPJ Loteadora
            <Opcional />
          </label>
          <input
            id={id('cnpj')}
            type="text"
            value={value.cnpjLoteadora}
            onChange={set('cnpjLoteadora')}
            disabled={disabled}
            className={inputCls}
            style={inputStyle}
            placeholder="00.000.000/0000-00"
          />
        </div>
        <div>
          <label htmlFor={id('cidade-loteadora')} className={labelCls} style={labelStyle}>
            Cidade Loteadora
            <Obrigatorio />
          </label>
          <input
            id={id('cidade-loteadora')}
            type="text"
            required
            value={value.cidadeLoteadora}
            onChange={set('cidadeLoteadora')}
            disabled={disabled}
            className={inputCls}
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor={id('estado-loteadora')} className={labelCls} style={labelStyle}>
            Estado Loteadora
            <Obrigatorio />
          </label>
          <select
            id={id('estado-loteadora')}
            required
            value={value.estadoLoteadora}
            onChange={set('estadoLoteadora')}
            disabled={disabled}
            className={inputCls}
            style={inputStyle}
          >
            <option value="">UF</option>
            {UFS_BRASIL.map((uf) => (
              <option key={uf.sigla} value={uf.sigla}>
                {uf.sigla}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Secao titulo="Cadastro Condomínios" />
      <div className="space-y-2">
        <label htmlFor={id('busca-condo')} className={labelCls} style={labelStyle}>
          Buscar condomínio
        </label>
        <input
          id={id('busca-condo')}
          type="search"
          value={buscaCondo}
          onChange={(e) => setBuscaCondo(e.target.value)}
          disabled={disabled}
          className={inputCls}
          style={inputStyle}
          placeholder="Digite para ver os condomínios já cadastrados"
          autoComplete="off"
        />
        {buscaCondo.trim() ? (
          <div
            className="max-h-40 overflow-y-auto"
            style={{
              border: '0.5px solid var(--moni-border-default)',
              borderRadius: 'var(--moni-radius-md)',
              background: 'var(--moni-surface-0)',
            }}
          >
            {resultadosCondo.length === 0 ? (
              <p className="px-3 py-2 text-sm" style={{ color: 'var(--moni-text-tertiary)' }}>
                Nenhum condomínio encontrado.
              </p>
            ) : (
              <ul>
                {resultadosCondo.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        onChange({
                          condominioId: c.id,
                          nomeCondominio: c.nome,
                          cadastrarCondominioNovo: false,
                        });
                        setBuscaCondo('');
                      }}
                      className="min-h-[44px] w-full px-3 py-2 text-left text-sm hover:bg-[var(--moni-surface-50)]"
                      style={{
                        color: 'var(--moni-text-primary)',
                        fontFamily: 'var(--moni-font-sans)',
                        background:
                          value.condominioId === c.id && !value.cadastrarCondominioNovo
                            ? 'var(--moni-surface-50)'
                            : 'transparent',
                      }}
                    >
                      {c.nome}
                      {c.cidade || c.estado ? (
                        <span style={{ color: 'var(--moni-text-tertiary)' }}>
                          {' '}
                          · {[c.cidade, c.estado].filter(Boolean).join('/')}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
        {escolhido && !value.cadastrarCondominioNovo ? (
          <p className="text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
            Selecionado: {escolhido.nome}
            {escolhido.cidade || escolhido.estado
              ? ` · ${[escolhido.cidade, escolhido.estado].filter(Boolean).join('/')}`
              : ''}
          </p>
        ) : null}
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            onChange({
              cadastrarCondominioNovo: true,
              condominioId: '',
            })
          }
          className="min-h-[44px] px-3 py-2 text-sm font-medium"
          style={{
            border: '0.5px solid var(--moni-border-default)',
            borderRadius: 'var(--moni-radius-md)',
            background: value.cadastrarCondominioNovo ? 'var(--moni-navy-800)' : 'var(--moni-surface-0)',
            color: value.cadastrarCondominioNovo ? 'var(--moni-surface-0)' : 'var(--moni-text-primary)',
          }}
        >
          Não encontrei
        </button>
      </div>
      {value.cadastrarCondominioNovo ? (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor={id('nome-condo')} className={labelCls} style={labelStyle}>
            Nome
            <Obrigatorio />
          </label>
          <input
            id={id('nome-condo')}
            type="text"
            required
            value={value.nomeCondominio}
            onChange={set('nomeCondominio')}
            disabled={disabled}
            className={inputCls}
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor={id('endereco')} className={labelCls} style={labelStyle}>
            Endereço
            <Obrigatorio />
          </label>
          <input
            id={id('endereco')}
            type="text"
            required
            value={value.endereco}
            onChange={set('endereco')}
            disabled={disabled}
            className={inputCls}
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor={id('numero')} className={labelCls} style={labelStyle}>
            Número
            <Obrigatorio />
          </label>
          <input
            id={id('numero')}
            type="text"
            required
            value={value.numero}
            onChange={set('numero')}
            disabled={disabled}
            className={inputCls}
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor={id('cep')} className={labelCls} style={labelStyle}>
            CEP
            <Obrigatorio />
          </label>
          <input
            id={id('cep')}
            type="text"
            required
            value={value.cep}
            onChange={set('cep')}
            disabled={disabled}
            className={inputCls}
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor={id('cidade-condo')} className={labelCls} style={labelStyle}>
            Cidade
            <Obrigatorio />
          </label>
          <input
            id={id('cidade-condo')}
            type="text"
            required
            value={value.cidadeCondominio}
            onChange={set('cidadeCondominio')}
            disabled={disabled}
            className={inputCls}
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor={id('estado-condo')} className={labelCls} style={labelStyle}>
            Estado
            <Obrigatorio />
          </label>
          <select
            id={id('estado-condo')}
            required
            value={value.estadoCondominio}
            onChange={set('estadoCondominio')}
            disabled={disabled}
            className={inputCls}
            style={inputStyle}
          >
            <option value="">UF</option>
            {UFS_BRASIL.map((uf) => (
              <option key={`condo-${uf.sigla}`} value={uf.sigla}>
                {uf.sigla}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={id('descricao')} className={labelCls} style={labelStyle}>
            Descrição breve
            <Opcional />
          </label>
          <textarea
            id={id('descricao')}
            rows={2}
            value={value.descricaoBreve}
            onChange={set('descricaoBreve')}
            disabled={disabled}
            className={inputCls}
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor={id('ticket-lote')} className={labelCls} style={labelStyle}>
            Ticket médio lote
            <Opcional />
          </label>
          <input
            id={id('ticket-lote')}
            type="text"
            value={value.ticketMedioLote}
            onChange={set('ticketMedioLote')}
            disabled={disabled}
            className={inputCls}
            style={inputStyle}
            placeholder="Valor ou faixa"
          />
        </div>
        <div>
          <label htmlFor={id('ticket-casas')} className={labelCls} style={labelStyle}>
            Ticket médio casas
            <Opcional />
          </label>
          <input
            id={id('ticket-casas')}
            type="text"
            value={value.ticketMedioCasas}
            onChange={set('ticketMedioCasas')}
            disabled={disabled}
            className={inputCls}
            style={inputStyle}
            placeholder="Valor ou faixa"
          />
        </div>
        <div>
          <label htmlFor={id('lancamento')} className={labelCls} style={labelStyle}>
            Data de lançamento (vendas de lote)
            <Opcional />
          </label>
          <input
            id={id('lancamento')}
            type="date"
            value={value.dataLancamentoVendas}
            onChange={set('dataLancamentoVendas')}
            disabled={disabled}
            className={inputCls}
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor={id('tvo')} className={labelCls} style={labelStyle}>
            Data liberação TVO (permissão de construir casas)
            <Opcional />
          </label>
          <input
            id={id('tvo')}
            type="date"
            value={value.dataLiberacaoTvo}
            onChange={set('dataLiberacaoTvo')}
            disabled={disabled}
            className={inputCls}
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor={id('metragem-lotes')} className={labelCls} style={labelStyle}>
            Metragem dos lotes (média ou faixas)
            <Opcional />
          </label>
          <input
            id={id('metragem-lotes')}
            type="text"
            value={value.metragemLotes}
            onChange={set('metragemLotes')}
            disabled={disabled}
            className={inputCls}
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor={id('metragem-casas')} className={labelCls} style={labelStyle}>
            Metragem / tipologia média das casas (média ou faixas)
            <Opcional />
          </label>
          <input
            id={id('metragem-casas')}
            type="text"
            value={value.metragemCasas}
            onChange={set('metragemCasas')}
            disabled={disabled}
            className={inputCls}
            style={inputStyle}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={id('planta')} className={labelCls} style={labelStyle}>
            Planta cadastral do condomínio / lotes com medidas (frente e lateral)
            <Opcional />
          </label>
          <input
            id={id('planta')}
            type="text"
            value={value.plantaCadastral}
            onChange={set('plantaCadastral')}
            disabled={disabled}
            className={inputCls}
            style={inputStyle}
            placeholder="Link ou referência"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={id('manual')} className={labelCls} style={labelStyle}>
            Manual de obras
            <Opcional />
          </label>
          <input
            id={id('manual')}
            type="text"
            value={value.manualObras}
            onChange={set('manualObras')}
            disabled={disabled}
            className={inputCls}
            style={inputStyle}
            placeholder="Link ou referência"
          />
        </div>
      </div>
      ) : null}

      <Secao titulo="Cadastro Loteadores" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={id('lotes-disp')} className={labelCls} style={labelStyle}>
            Quantos lotes tem disponíveis para venda
            <Opcional />
          </label>
          <input
            id={id('lotes-disp')}
            type="number"
            min={0}
            step={1}
            value={value.lotesDisponiveis}
            onChange={set('lotesDisponiveis')}
            disabled={disabled}
            className={inputCls}
            style={inputStyle}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={id('info')} className={labelCls} style={labelStyle}>
            Informações adicionais
            <Opcional />
          </label>
          <textarea
            id={id('info')}
            rows={3}
            value={value.informacoesAdicionais}
            onChange={set('informacoesAdicionais')}
            disabled={disabled}
            className={inputCls}
            style={inputStyle}
          />
        </div>
      </div>
    </div>
  );
}
