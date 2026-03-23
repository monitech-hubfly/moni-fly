'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { criarLinhaRedeECard, getProximoNFranquia } from './actions';
import { UFS_BRASIL } from '@/lib/uf';

type CidadeIBGE = { id: number; nome: string };
type AreaAtuacaoItem = { estado: string; cidade: string };

const OPCOES_STATUS_FRANQUIA = [
  { value: 'Em Operação', label: 'Em Operação' },
  { value: 'Operação Encerrada', label: 'Operação Encerrada' },
] as const;

const OPCOES_CLASSIFICACAO_FRANQUEADO = [
  { value: 'Beta', label: 'Beta' },
  { value: 'Pagante', label: 'Pagante' },
] as const;

const OPCOES_MODALIDADE = [
  { value: 'Franquia', label: 'Franquia' },
  { value: 'Corporação', label: 'Corporação' },
] as const;

const OPCOES_REGIONAL = [
  { value: 'C-oeste', label: 'C-oeste' },
  { value: 'Nordeste', label: 'Nordeste' },
  { value: 'Norte', label: 'Norte' },
  { value: 'Sudeste', label: 'Sudeste' },
  { value: 'Sul', label: 'Sul' },
] as const;

const OPCOES_RESPONSAVEL_COMERCIAL = [
  { value: 'Helenna Luz', label: 'Helenna Luz' },
] as const;

function CidadeCombobox({
  id,
  disabled,
  loading,
  placeholder = '— Selecione a cidade —',
  value,
  onChange,
  items,
}: {
  id: string;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
  value: string;
  onChange: (cidade: string) => void;
  items: CidadeIBGE[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((c) => c.nome.toLowerCase().includes(q));
  }, [items, query]);
  useEffect(() => setQuery(''), [items]);

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
        }}
        className={`mt-1 w-full rounded-lg border px-3 py-2 text-left text-sm ${
          disabled ? 'border-stone-200 bg-stone-100 text-stone-500' : 'border-stone-300 bg-white'
        }`}
      >
        {value ? value : loading ? 'Carregando...' : placeholder}
      </button>
      {open && !disabled && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lg">
          <div className="border-b border-stone-200 p-2">
            <input
              id={`${id}-busca`}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar cidade..."
              className="w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
              autoFocus
            />
          </div>
          <ul id={id} role="listbox" className="max-h-64 overflow-auto py-1">
            {loading ? (
              <li className="px-3 py-2 text-sm text-stone-500">Carregando...</li>
            ) : filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-stone-500">Nenhuma cidade encontrada.</li>
            ) : (
              filtered.map((c) => (
                <li
                  key={c.id}
                  role="option"
                  aria-selected={c.nome === value}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(c.nome);
                    setOpen(false);
                  }}
                  className="cursor-pointer px-3 py-2 text-sm text-stone-700 hover:bg-stone-50"
                >
                  {c.nome}
                </li>
              ))
            )}
          </ul>
          <div className="border-t border-stone-200 p-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AdicionarRedeECardButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  // Campos do Novo Step 1 (mesma configuração)
  const [areaAtuacaoItens, setAreaAtuacaoItens] = useState<AreaAtuacaoItem[]>([]);
  const [estadoAtuacao, setEstadoAtuacao] = useState('');
  const [cidadeAtuacao, setCidadeAtuacao] = useState('');
  const [cidadesAtuacao, setCidadesAtuacao] = useState<CidadeIBGE[]>([]);
  const [loadingCidadesAtuacao, setLoadingCidadesAtuacao] = useState(false);

  const [numeroFranquia, setNumeroFranquia] = useState('');
  const [modalidade, setModalidade] = useState('');
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [statusFranquia, setStatusFranquia] = useState('');
  const [classificacaoFranqueado, setClassificacaoFranqueado] = useState('');
  const [dataAssCof, setDataAssCof] = useState('');
  const [dataAssContrato, setDataAssContrato] = useState('');
  const [dataExpiracaoFranquia, setDataExpiracaoFranquia] = useState('');

  const [regional, setRegional] = useState('');
  const [emailFrank, setEmailFrank] = useState('');
  const [telefoneFrank, setTelefoneFrank] = useState('');
  const [cpfFrank, setCpfFrank] = useState('');
  const [dataNascFrank, setDataNascFrank] = useState('');
  const [responsavelComercial, setResponsavelComercial] = useState('');
  const [tamanhoCamiseta, setTamanhoCamiseta] = useState('');
  const [socios, setSocios] = useState('');

  const [ruaCasa, setRuaCasa] = useState('');
  const [numeroCasa, setNumeroCasa] = useState('');
  const [complementoCasa, setComplementoCasa] = useState('');
  const [cepCasa, setCepCasa] = useState('');
  const [estadoCasa, setEstadoCasa] = useState('');
  const [cidadeCasa, setCidadeCasa] = useState('');
  const [cidadesCasa, setCidadesCasa] = useState<CidadeIBGE[]>([]);
  const [loadingCidadesCasa, setLoadingCidadesCasa] = useState(false);

  const close = () => {
    setOpen(false);
    setMsg(null);
    setSaving(false);
    setAreaAtuacaoItens([]);
    setEstadoAtuacao('');
    setCidadeAtuacao('');
    setNumeroFranquia('');
    setModalidade('');
    setNomeCompleto('');
    setStatusFranquia('');
    setClassificacaoFranqueado('');
    setDataAssCof('');
    setDataAssContrato('');
    setDataExpiracaoFranquia('');
    setRegional('');
    setEmailFrank('');
    setTelefoneFrank('');
    setCpfFrank('');
    setDataNascFrank('');
    setResponsavelComercial('');
    setTamanhoCamiseta('');
    setSocios('');
    setRuaCasa('');
    setNumeroCasa('');
    setComplementoCasa('');
    setCepCasa('');
    setEstadoCasa('');
    setCidadeCasa('');
  };

  // Auto-preencher o próximo FKxxxx quando abrir o modal (se ainda estiver vazio).
  useEffect(() => {
    if (!open) return;
    if (numeroFranquia.trim()) return;
    let cancelled = false;
    (async () => {
      const res = await getProximoNFranquia();
      if (cancelled) return;
      if (res.ok) setNumeroFranquia(res.valor);
    })().catch(() => {
      // ignore
    });
    return () => {
      cancelled = true;
    };
  }, [open, numeroFranquia]);

  useEffect(() => {
    if (!estadoAtuacao) {
      setCidadesAtuacao([]);
      setCidadeAtuacao('');
      return;
    }
    const controller = new AbortController();
    (async () => {
      try {
        setLoadingCidadesAtuacao(true);
        const res = await fetch(
          `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${estadoAtuacao}/municipios`,
          { signal: controller.signal },
        );
        const lista = (await res.json()) as CidadeIBGE[];
        setCidadesAtuacao(Array.isArray(lista) ? lista : []);
        setCidadeAtuacao('');
      } catch {
        setCidadesAtuacao([]);
      } finally {
        setLoadingCidadesAtuacao(false);
      }
    })();
    return () => controller.abort();
  }, [estadoAtuacao]);

  useEffect(() => {
    if (!estadoCasa) {
      setCidadesCasa([]);
      setCidadeCasa('');
      return;
    }
    const controller = new AbortController();
    (async () => {
      try {
        setLoadingCidadesCasa(true);
        const res = await fetch(
          `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${estadoCasa}/municipios`,
          { signal: controller.signal },
        );
        const lista = (await res.json()) as CidadeIBGE[];
        setCidadesCasa(Array.isArray(lista) ? lista : []);
        setCidadeCasa('');
      } catch {
        setCidadesCasa([]);
      } finally {
        setLoadingCidadesCasa(false);
      }
    })();
    return () => controller.abort();
  }, [estadoCasa]);

  // Expiração = contrato + 5 anos
  useEffect(() => {
    if (!dataAssContrato.trim()) {
      setDataExpiracaoFranquia('');
      return;
    }
    const d = new Date(dataAssContrato + 'T12:00:00');
    if (isNaN(d.getTime())) {
      setDataExpiracaoFranquia('');
      return;
    }
    d.setFullYear(d.getFullYear() + 5);
    setDataExpiracaoFranquia(d.toISOString().slice(0, 10));
  }, [dataAssContrato]);

  const submit = async () => {
    setMsg(null);
    if (areaAtuacaoItens.length === 0) {
      setMsg({ tipo: 'erro', texto: 'Adicione pelo menos um estado e cidade na Área de atuação.' });
      return;
    }
    setSaving(true);
    const patch = {
      n_franquia: numeroFranquia.trim() || null,
      modalidade: modalidade.trim() || null,
      nome_completo: nomeCompleto.trim() || null,
      status_franquia: statusFranquia.trim() || null,
      classificacao_franqueado: classificacaoFranqueado.trim() || null,
      regional: regional.trim() || null,
      area_atuacao: areaAtuacaoItens.map((i) => `${i.estado} - ${i.cidade}`).join('; '),
      email_frank: emailFrank.trim() || null,
      responsavel_comercial: responsavelComercial.trim() || null,
      telefone_frank: telefoneFrank.trim() || null,
      cpf_frank: cpfFrank.trim() || null,
      data_nasc_frank: dataNascFrank.trim() || null,
      data_ass_cof: dataAssCof.trim() || null,
      data_ass_contrato: dataAssContrato.trim() || null,
      data_expiracao_franquia: dataExpiracaoFranquia.trim() || null,
      tamanho_camisa_frank: tamanhoCamiseta.trim() || null,
      socios: socios.trim() || null,
      endereco_casa_frank: ruaCasa.trim() || null,
      endereco_casa_frank_numero: numeroCasa.trim() || null,
      endereco_casa_frank_complemento: complementoCasa.trim() || null,
      cep_casa_frank: cepCasa.trim() || null,
      estado_casa_frank: estadoCasa.trim() || null,
      cidade_casa_frank: cidadeCasa.trim() || null,
    } as const;
    const res = await criarLinhaRedeECard(patch, areaAtuacaoItens[0]?.cidade ?? null, areaAtuacaoItens[0]?.estado ?? null);
    setSaving(false);
    if (res.ok) {
      setMsg({ tipo: 'ok', texto: res.mensagem });
      router.refresh();
      // fecha após pequeno feedback
      setTimeout(() => close(), 600);
    } else {
      setMsg({ tipo: 'erro', texto: res.error });
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-moni-primary px-4 py-2 text-sm font-medium text-white hover:bg-moni-secondary"
      >
        <Plus className="h-4 w-4" />
        Adicionar franqueado (gera card Step 1)
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={close}>
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50 px-4 py-3">
              <div>
                <h2 className="font-semibold text-stone-900">Adicionar franqueado</h2>
                <p className="text-xs text-stone-500">Cria a linha na rede e já gera um card no Step 1 do Painel.</p>
              </div>
              <button type="button" onClick={close} className="rounded p-1.5 text-stone-500 hover:bg-stone-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-4">
              {msg && (
                <div className={`mb-3 rounded-lg border p-3 text-sm ${msg.tipo === 'ok' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
                  {msg.texto}
                </div>
              )}

              <div className="space-y-6">
                <div className="rounded-lg border border-stone-200 bg-stone-50/50 p-4">
                  <h3 className="text-sm font-semibold text-stone-800">Área de atuação do Franqueado *</h3>
                  <p className="mt-1 text-xs text-stone-600">Selecione um ou mais estado e cidade. O primeiro define a região do card.</p>
                  {areaAtuacaoItens.length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {areaAtuacaoItens.map((item, idx) => (
                        <li key={idx} className="inline-flex items-center gap-1 rounded-full bg-moni-primary/10 px-3 py-1 text-sm text-stone-800">
                          {item.estado} — {item.cidade}
                          <button
                            type="button"
                            onClick={() => setAreaAtuacaoItens((prev) => prev.filter((_, i) => i !== idx))}
                            className="rounded-full p-0.5 hover:bg-stone-300/50"
                            aria-label="Remover"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3 flex flex-wrap items-end gap-3">
                    <div className="min-w-[120px]">
                      <label className="block text-xs font-medium text-stone-600">Estado</label>
                      <select
                        value={estadoAtuacao}
                        onChange={(e) => setEstadoAtuacao(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-stone-300 px-2 py-1.5 text-sm"
                      >
                        <option value="">— UF —</option>
                        {UFS_BRASIL.map((uf) => (
                          <option key={uf.sigla} value={uf.sigla}>{uf.sigla}</option>
                        ))}
                      </select>
                    </div>
                    <div className="min-w-[220px] flex-1">
                      <label className="block text-xs font-medium text-stone-600">Cidade</label>
                      <CidadeCombobox
                        id="cidade-atuacao"
                        value={cidadeAtuacao}
                        onChange={setCidadeAtuacao}
                        disabled={!estadoAtuacao || loadingCidadesAtuacao}
                        loading={loadingCidadesAtuacao}
                        items={cidadesAtuacao}
                        placeholder={!estadoAtuacao ? 'Selecione o estado' : '— Selecione a cidade —'}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (estadoAtuacao && cidadeAtuacao) {
                          setAreaAtuacaoItens((prev) => [...prev, { estado: estadoAtuacao, cidade: cidadeAtuacao }]);
                          setCidadeAtuacao('');
                        }
                      }}
                      disabled={!estadoAtuacao || !cidadeAtuacao}
                      className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                    >
                      Adicionar
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-stone-700">Nº de franquia</label>
                    <input value={numeroFranquia} onChange={(e) => setNumeroFranquia(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700">Modalidade</label>
                    <select value={modalidade} onChange={(e) => setModalidade(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm">
                      <option value="">— Selecione —</option>
                      {OPCOES_MODALIDADE.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-stone-700">Nome Completo do Franqueado</label>
                    <input value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700">Status da Franquia</label>
                    <select value={statusFranquia} onChange={(e) => setStatusFranquia(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm">
                      <option value="">— Selecione —</option>
                      {OPCOES_STATUS_FRANQUIA.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700">Classificação do Franqueado</label>
                    <select value={classificacaoFranqueado} onChange={(e) => setClassificacaoFranqueado(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm">
                      <option value="">— Selecione —</option>
                      {OPCOES_CLASSIFICACAO_FRANQUEADO.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="block text-sm font-medium text-stone-700">Data de Ass. COF</label>
                      <input type="date" value={dataAssCof} onChange={(e) => setDataAssCof(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700">Data de Ass. Contrato</label>
                      <input type="date" value={dataAssContrato} onChange={(e) => setDataAssContrato(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700">Data de Expiração da Franquia</label>
                      <input type="date" value={dataExpiracaoFranquia} readOnly className="mt-1 w-full rounded-lg border border-stone-200 bg-stone-100 px-3 py-2 text-sm text-stone-600" />
                      <p className="mt-0.5 text-xs text-stone-500">Data Ass. Contrato + 5 anos</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700">Regional</label>
                    <select value={regional} onChange={(e) => setRegional(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm">
                      <option value="">— Selecione —</option>
                      {OPCOES_REGIONAL.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700">E-mail do Frank</label>
                    <input type="email" value={emailFrank} onChange={(e) => setEmailFrank(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700">Telefone do Franqueado</label>
                    <input type="tel" value={telefoneFrank} onChange={(e) => setTelefoneFrank(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700">CPF do Franqueado</label>
                    <input value={cpfFrank} onChange={(e) => setCpfFrank(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700">Data de Nasc. do Franqueado</label>
                    <input type="date" value={dataNascFrank} onChange={(e) => setDataNascFrank(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700">Responsável Comercial</label>
                    <select value={responsavelComercial} onChange={(e) => setResponsavelComercial(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm">
                      <option value="">— Selecione —</option>
                      {OPCOES_RESPONSAVEL_COMERCIAL.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700">Tamanho da Camiseta do Frank</label>
                    <select value={tamanhoCamiseta} onChange={(e) => setTamanhoCamiseta(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm">
                      <option value="">— Selecione —</option>
                      <option value="P">P</option>
                      <option value="M">M</option>
                      <option value="G">G</option>
                      <option value="GG">GG</option>
                    </select>
                  </div>
                </div>

                <div className="rounded-lg border border-stone-200 bg-stone-50/50 p-4">
                  <h3 className="text-sm font-semibold text-stone-800">Endereço do franqueado (cidade e estado da casa)</h3>
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-stone-600">Rua</label>
                      <input value={ruaCasa} onChange={(e) => setRuaCasa(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium text-stone-600">Número</label>
                        <input value={numeroCasa} onChange={(e) => setNumeroCasa(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-600">Complemento</label>
                        <input value={complementoCasa} onChange={(e) => setComplementoCasa(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-600">CEP</label>
                      <input value={cepCasa} onChange={(e) => setCepCasa(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium text-stone-600">Estado (UF) da casa</label>
                        <select value={estadoCasa} onChange={(e) => setEstadoCasa(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm">
                          <option value="">— Selecione —</option>
                          {UFS_BRASIL.map((uf) => <option key={uf.sigla} value={uf.sigla}>{uf.sigla} — {uf.nome}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-600">Cidade da casa</label>
                        <CidadeCombobox
                          id="cidade-casa"
                          value={cidadeCasa}
                          onChange={setCidadeCasa}
                          disabled={!estadoCasa || loadingCidadesCasa}
                          loading={loadingCidadesCasa}
                          items={cidadesCasa}
                          placeholder={!estadoCasa ? 'Selecione o estado' : '— Selecione a cidade —'}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700">
                    Sócios (Listar: Nome, Nascimento, Telefone, E-mail, CPF, Endereço Completo, Tamanho da camiseta)
                  </label>
                  <textarea value={socios} onChange={(e) => setSocios(e.target.value)} rows={4} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-stone-200 bg-white px-4 py-3">
              <button
                type="button"
                onClick={close}
                disabled={saving}
                className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={saving}
                className="rounded-lg bg-moni-primary px-4 py-2 text-sm font-medium text-white hover:bg-moni-secondary disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Salvando…
                  </>
                ) : (
                  'Adicionar e gerar card'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

