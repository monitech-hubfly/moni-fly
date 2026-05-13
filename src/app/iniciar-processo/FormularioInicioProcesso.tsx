'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createProcesso } from '@/app/step-one/actions';
import type { DadosNovoCard, DadosNovoStep1 } from '@/app/step-one/actions';
import { getProximoNFranquia } from '@/app/rede-franqueados/actions';
import { UFS_BRASIL } from '@/lib/uf';
import { createClient } from '@/lib/supabase/client';
import type { RedeFranqueadoRowDb } from '@/lib/rede-franqueados';
import { Copy, Check, Plus, X } from 'lucide-react';

type CidadeIBGE = { id: number; nome: string };

type AreaAtuacaoItem = { estado: string; cidade: string };

type CidadeComboboxProps = {
  id: string;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
  value: string;
  onChange: (cidade: string) => void;
  items: CidadeIBGE[];
};

function CidadeCombobox({
  id,
  disabled,
  loading,
  placeholder = '— Selecione a cidade —',
  value,
  onChange,
  items,
}: CidadeComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((c) => c.nome.toLowerCase().includes(q));
  }, [items, query]);

  // Reset query quando trocar lista (ex.: mudou UF)
  useEffect(() => {
    setQuery('');
  }, [items]);

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
        }}
        className={`mt-2 w-full rounded-lg border px-3 py-2 text-left text-sm ${
          disabled ? 'border-stone-200 bg-stone-100 text-stone-500' : 'border-stone-300 bg-white'
        }`}
      >
        {value ? value : loading ? 'Carregando...' : placeholder}
      </button>

      {open && !disabled && (
        <div
          className="absolute z-30 mt-2 w-full overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lg"
          role="dialog"
          aria-label="Selecionar cidade"
        >
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
          <ul
            id={id}
            role="listbox"
            className="max-h-64 overflow-auto py-1"
            aria-activedescendant={value ? `${id}-${value}` : undefined}
          >
            {loading ? (
              <li className="px-3 py-2 text-sm text-stone-500">Carregando...</li>
            ) : filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-stone-500">Nenhuma cidade encontrada.</li>
            ) : (
              filtered.map((c) => {
                const selected = c.nome === value;
                return (
                  <li
                    key={c.id}
                    id={`${id}-${c.nome}`}
                    role="option"
                    aria-selected={selected}
                    onMouseDown={(e) => {
                      // onMouseDown para não perder foco antes de selecionar
                      e.preventDefault();
                      onChange(c.nome);
                      setOpen(false);
                    }}
                    className={`cursor-pointer px-3 py-2 text-sm hover:bg-stone-50 ${
                      selected ? 'bg-moni-primary/10 font-medium text-moni-dark' : 'text-stone-700'
                    }`}
                  >
                    {c.nome}
                  </li>
                );
              })
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

type FranqueadoComboboxProps = {
  valueId: string | null;
  valueNome: string;
  loading?: boolean;
  items: RedeFranqueadoRowDb[];
  onSelect: (fr: RedeFranqueadoRowDb) => void;
};

function FranqueadoCombobox({ valueId, valueNome, items, loading, onSelect }: FranqueadoComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 15);
    return items
      .filter((f) => {
        const nome = String(f.nome_completo ?? '').toLowerCase();
        const num = String(f.n_franquia ?? '').toLowerCase();
        return nome.includes(q) || num.includes(q) || String(f.id).includes(q);
      })
      .slice(0, 15);
  }, [items, query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const inputValue = open ? query : valueNome;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`mt-1 w-full rounded-lg border px-3 py-2 text-left text-sm ${
          open ? 'border-moni-accent bg-white' : 'border-stone-300 bg-white'
        }`}
      >
        {inputValue ? inputValue : loading ? 'Carregando…' : '— Selecione o franqueado —'}
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lg" role="dialog">
          <div className="border-b border-stone-200 p-2">
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome ou nº da franquia"
              className="w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
            />
          </div>
          <ul className="max-h-56 overflow-auto py-1" role="listbox">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-stone-500">Nenhum franqueado encontrado.</li>
            ) : (
              filtered.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-stone-100 ${
                      valueId === f.id ? 'bg-moni-primary/10 font-medium text-moni-dark' : 'text-stone-800'
                    }`}
                    onClick={() => {
                      onSelect(f);
                      setQuery('');
                      setOpen(false);
                    }}
                  >
                    {f.nome_completo ?? 'Sem nome'}
                    {(f.n_franquia ?? null) && f.nome_completo ? <span className="ml-1 text-stone-500">({f.n_franquia})</span> : null}
                    {valueId === f.id ? <span className="ml-2 text-[11px] text-stone-400">(selecionado)</span> : null}
                  </button>
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

/** Lista da pergunta 5: Tipo de negociação do terreno (foto). */
const OPCOES_TIPO_NEGOCIACAO_TERRENO = [
  { value: 'Permuta', label: 'Permuta' },
  { value: 'Permuta + Compra e venda', label: 'Permuta + Compra e venda' },
  { value: 'Compra e Venda', label: 'Compra e Venda' },
] as const;

/** Status da Franquia (Novo Step 1). */
const OPCOES_STATUS_FRANQUIA = [
  { value: 'Em Operação', label: 'Em Operação' },
  { value: 'Operação Encerrada', label: 'Operação Encerrada' },
] as const;

/** Classificação do Franqueado (Novo Step 1). */
const OPCOES_CLASSIFICACAO_FRANQUEADO = [
  { value: 'Beta', label: 'Beta' },
  { value: 'Pagante', label: 'Pagante' },
] as const;

/** Lista da pergunta 8: Produto/ Modelo da Casa (foto). */
const OPCOES_PRODUTO_MODELO_CASA = [
  { value: 'Lis (Carbon/ita)', label: 'Lis (Carbon/ita)' },
  { value: 'Cissa (Vista)', label: 'Cissa (Vista)' },
  { value: 'Gal (Moni One)', label: 'Gal (Moni One)' },
  { value: 'Ivy (Fly Standard)', label: 'Ivy (Fly Standard)' },
  { value: 'Eva (Fly Premium)', label: 'Eva (Fly Premium)' },
  { value: 'Mia (Birá)', label: 'Mia (Birá)' },
  { value: 'Sol', label: 'Sol' },
] as const;

type Props = {
  sharePath?: string;
  /** step_1 = Novo Step 1 (card cai no Step 1); step_2 = Novo Negócio (card cai no Step 2). */
  destinoEtapa?: 'step_1' | 'step_2';
  /** Título da página (ex.: "Novo Step 1" ou "Iniciar um processo"). */
  titulo?: string;
  /** Descrição curta abaixo do título. */
  descricao?: string;
  /** Usuário logado para preencher nome e e-mail no formulário Novo Card. */
  user?: { full_name?: string | null; email?: string | null } | null;
};

export function FormularioInicioProcesso({
  sharePath = '/iniciar-processo',
  destinoEtapa = 'step_2',
  titulo = 'Iniciar um processo',
  descricao = 'Preencha o formulário abaixo para abrir um novo processo de viabilidade. Os dados serão usados no Step 1 (Mapeamento da Região).',
  user,
}: Props) {
  const router = useRouter();
  const [estado, setEstado] = useState('');
  const [cidade, setCidade] = useState('');
  const [cidades, setCidades] = useState<CidadeIBGE[]>([]);
  const [observacoes, setObservacoes] = useState('');
  const [loadingCidades, setLoadingCidades] = useState(false);
  const [errorCidades, setErrorCidades] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Área de atuação (Novo Step 1): múltiplos estado/cidade
  const [areaAtuacaoItens, setAreaAtuacaoItens] = useState<AreaAtuacaoItem[]>([]);
  const [estadoAtuacao, setEstadoAtuacao] = useState('');
  const [cidadeAtuacao, setCidadeAtuacao] = useState('');
  const [cidadesAtuacao, setCidadesAtuacao] = useState<CidadeIBGE[]>([]);
  const [loadingCidadesAtuacao, setLoadingCidadesAtuacao] = useState(false);

  // Endereço da casa do franqueado (Novo Step 1)
  const [enderecoCasaRuaFrank, setEnderecoCasaRuaFrank] = useState('');
  const [enderecoCasaNumeroFrank, setEnderecoCasaNumeroFrank] = useState('');
  const [enderecoCasaComplementoFrank, setEnderecoCasaComplementoFrank] = useState('');
  const [cepCasaFrank, setCepCasaFrank] = useState('');
  const [estadoCasaFrank, setEstadoCasaFrank] = useState('');
  const [cidadeCasaFrank, setCidadeCasaFrank] = useState('');
  const [cidadesCasaFrank, setCidadesCasaFrank] = useState<CidadeIBGE[]>([]);
  const [loadingCidadesCasa, setLoadingCidadesCasa] = useState(false);

  // Campos do formulário Novo Negócio (perguntas 1–9 da foto)
  const [nomeFranqueado, setNomeFranqueado] = useState(destinoEtapa === 'step_2' ? '' : user?.full_name ?? '');
  const [emailFranqueado, setEmailFranqueado] = useState(destinoEtapa === 'step_2' ? '' : user?.email ?? '');
  const [nomeCondominio, setNomeCondominio] = useState('');
  const [quadra, setQuadra] = useState('');
  const [lote, setLote] = useState('');
  const [tipoNegociacaoTerreno, setTipoNegociacaoTerreno] = useState<string>('');
  const [valorTerreno, setValorTerreno] = useState('');
  const [vgvPretendido, setVgvPretendido] = useState('');
  const [produtoModeloCasa, setProdutoModeloCasa] = useState<string>('');
  const [linkPastaDrive, setLinkPastaDrive] = useState('');

  // Campos do formulário Novo Step 1 (imagens: franquia, modalidade, responsável, sócios)
  const [numeroFranquia, setNumeroFranquia] = useState('');
  const [modalidade, setModalidade] = useState('');
  const [nomeCompletoStep1, setNomeCompletoStep1] = useState(destinoEtapa === 'step_2' ? '' : user?.full_name ?? '');
  const [statusFranquia, setStatusFranquia] = useState('');
  const [classificacaoFranqueado, setClassificacaoFranqueado] = useState('');
  const [dataAssCof, setDataAssCof] = useState('');
  const [dataAssContrato, setDataAssContrato] = useState('');
  const [dataExpiracaoFranquia, setDataExpiracaoFranquia] = useState('');
  const [telefoneFrank, setTelefoneFrank] = useState('');
  const [cpfFrank, setCpfFrank] = useState('');
  const [dataNascFrank, setDataNascFrank] = useState('');
  const [emailFrank, setEmailFrank] = useState(destinoEtapa === 'step_2' ? '' : user?.email ?? '');
  const [responsavelComercial, setResponsavelComercial] = useState('');
  const [tamanhoCamisetaFrank, setTamanhoCamisetaFrank] = useState('');
  const [socios, setSocios] = useState('');

  // Rede de Franqueados (usado no Step 2: Novo Negócio)
  const [redeFranqueados, setRedeFranqueados] = useState<RedeFranqueadoRowDb[]>([]);
  const [loadingRedeFranqueados, setLoadingRedeFranqueados] = useState(false);
  const [franqueadoSelecionadoId, setFranqueadoSelecionadoId] = useState<string | null>(null);

  const estadosPermitidosStep2 = useMemo(() => {
    if (destinoEtapa !== 'step_2' || !franqueadoSelecionadoId) return [] as string[];
    return Array.from(new Set(areaAtuacaoItens.map((i) => i.estado.trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }),
    );
  }, [destinoEtapa, franqueadoSelecionadoId, areaAtuacaoItens]);

  const cidadesPermitidasDoEstadoStep2 = useMemo(() => {
    if (destinoEtapa !== 'step_2' || !franqueadoSelecionadoId || !estado) return [] as string[];
    return Array.from(
      new Set(
        areaAtuacaoItens
          .filter((i) => i.estado.trim() === estado)
          .map((i) => i.cidade.trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  }, [destinoEtapa, franqueadoSelecionadoId, areaAtuacaoItens, estado]);

  useEffect(() => {
    // Para Step 2, o franqueado deve vir da "rede_franqueados" (combobox).
    // Para Step 1, podemos pré-preencher com os dados do login.
    if (destinoEtapa === 'step_2') return;
    if (user?.full_name != null) {
      setNomeFranqueado((prev) => (prev ? prev : user.full_name ?? ''));
      setNomeCompletoStep1((prev) => (prev ? prev : user.full_name ?? ''));
    }
    if (user?.email != null) {
      setEmailFranqueado((prev) => (prev ? prev : user.email ?? ''));
      setEmailFrank((prev) => (prev ? prev : user.email ?? ''));
    }
  }, [user?.full_name, user?.email, destinoEtapa]);

  // Auto-preenche o Nº da franquia (FKxxxx) apenas no "Novo Step 1" (destinoEtapa === step_1).
  useEffect(() => {
    if (destinoEtapa !== 'step_1') return;
    if (numeroFranquia.trim()) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getProximoNFranquia();
        if (cancelled) return;
        if (res.ok) setNumeroFranquia(res.valor);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [destinoEtapa, numeroFranquia]);

  // Carrega a lista de franqueados para o combobox do Step 2.
  useEffect(() => {
    if (destinoEtapa !== 'step_2') return;

    let cancelled = false;
    const run = async () => {
      try {
        setLoadingRedeFranqueados(true);
        const supabase = createClient();
        const { data, error } = await supabase
          .from('rede_franqueados')
          .select(
            [
              'id',
              'ordem',
              'n_franquia',
              'modalidade',
              'nome_completo',
              'status_franquia',
              'classificacao_franqueado',
              'data_ass_cof',
              'data_ass_contrato',
              'data_expiracao_franquia',
              'area_atuacao',
              'email_frank',
              'responsavel_comercial',
              'telefone_frank',
              'cpf_frank',
              'data_nasc_frank',
              'endereco_casa_frank',
              'endereco_casa_frank_numero',
              'endereco_casa_frank_complemento',
              'cep_casa_frank',
              'estado_casa_frank',
              'cidade_casa_frank',
              'tamanho_camisa_frank',
              'socios',
            ].join(','),
          )
          .order('ordem', { ascending: true });

        if (cancelled) return;
        if (error) throw error;
        setRedeFranqueados((data ?? []) as unknown as RedeFranqueadoRowDb[]);
      } catch {
        if (!cancelled) setRedeFranqueados([]);
      } finally {
        if (!cancelled) setLoadingRedeFranqueados(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [destinoEtapa]);

  useEffect(() => {
    if (!estado) {
      setCidades([]);
      setCidade('');
      setErrorCidades('');
      return;
    }
    if (destinoEtapa === 'step_2') {
      const lista = cidadesPermitidasDoEstadoStep2.map((nome, idx) => ({ id: idx + 1, nome }));
      setCidades(lista);
      setErrorCidades(
        franqueadoSelecionadoId && lista.length === 0
          ? 'Este franqueado não possui cidades de atuação para o estado selecionado.'
          : '',
      );
      if (cidade && !lista.some((c) => c.nome === cidade)) setCidade('');
      return;
    }
    const controller = new AbortController();
    const fetchCidades = async () => {
      try {
        setLoadingCidades(true);
        setErrorCidades('');
        const res = await fetch(
          `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${estado}/municipios`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(`IBGE retornou ${res.status}`);
        const lista = (await res.json()) as CidadeIBGE[];
        setCidades(Array.isArray(lista) ? lista : []);
        setCidade('');
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setErrorCidades('Não foi possível carregar as cidades para este estado.');
        setCidades([]);
      } finally {
        setLoadingCidades(false);
      }
    };
    fetchCidades();
    return () => controller.abort();
  }, [estado, destinoEtapa, cidadesPermitidasDoEstadoStep2, franqueadoSelecionadoId, cidade]);

  // Cidades para adicionar à área de atuação (Step 1)
  useEffect(() => {
    if (!estadoAtuacao) {
      setCidadesAtuacao([]);
      setCidadeAtuacao('');
      return;
    }
    const controller = new AbortController();
    const fetchCidades = async () => {
      try {
        setLoadingCidadesAtuacao(true);
        const res = await fetch(
          `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${estadoAtuacao}/municipios`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(`IBGE retornou ${res.status}`);
        const lista = (await res.json()) as CidadeIBGE[];
        setCidadesAtuacao(Array.isArray(lista) ? lista : []);
        setCidadeAtuacao('');
      } catch {
        setCidadesAtuacao([]);
      } finally {
        setLoadingCidadesAtuacao(false);
      }
    };
    fetchCidades();
    return () => controller.abort();
  }, [estadoAtuacao]);

  // Cidades para endereço da casa do franqueado (Step 1)
  useEffect(() => {
    if (!estadoCasaFrank) {
      setCidadesCasaFrank([]);
      setCidadeCasaFrank('');
      return;
    }
    const controller = new AbortController();
    const fetchCidades = async () => {
      try {
        setLoadingCidadesCasa(true);
        const res = await fetch(
          `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${estadoCasaFrank}/municipios`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(`IBGE retornou ${res.status}`);
        const lista = (await res.json()) as CidadeIBGE[];
        setCidadesCasaFrank(Array.isArray(lista) ? lista : []);
        // No Step 2, a cidade vem do franqueado selecionado na "rede_franqueados".
        // Então não limpamos aqui (evita apagar o valor já preenchido automaticamente).
        if (destinoEtapa === 'step_1') setCidadeCasaFrank('');
      } catch {
        setCidadesCasaFrank([]);
      } finally {
        setLoadingCidadesCasa(false);
      }
    };
    fetchCidades();
    return () => controller.abort();
  }, [estadoCasaFrank, destinoEtapa]);

  // Data de Expiração da Franquia = Data Ass. Contrato + 5 anos
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

  const parseAreaAtuacaoRede = (raw: string | null | undefined): AreaAtuacaoItem[] => {
    if (!raw) return [];
    const parts = raw
      .split(';')
      .map((p) => p.trim())
      .filter(Boolean);
    const out: AreaAtuacaoItem[] = [];
    for (const part of parts) {
      const segs = part.split('-').map((s) => s.trim());
      if (segs.length < 2) continue;
      const estado = segs[0] ?? '';
      const cidade = segs.slice(1).join('-').trim();
      if (estado && cidade) out.push({ estado, cidade });
    }
    return out;
  };

  const normalizeDateInput = (val: unknown): string => {
    if (!val) return '';
    if (typeof val === 'string') return val.slice(0, 10);
    if (val instanceof Date) return val.toISOString().slice(0, 10);
    return String(val).slice(0, 10);
  };

  const sanitizeMoedaInput = (val: string): string => {
    const cleaned = String(val ?? '').replace(/[^\d.,]/g, '');
    if (!cleaned) return '';

    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    const lastSep = Math.max(lastComma, lastDot);

    // Sem separador decimal: só dígitos
    if (lastSep === -1) return cleaned.replace(/[.,]/g, '');

    const intPart = cleaned.slice(0, lastSep).replace(/[.,]/g, '');
    const decRaw = cleaned.slice(lastSep + 1).replace(/[.,]/g, '');
    const decPart = decRaw.slice(0, 2);
    const intClean = intPart || '0';

    // Se o usuário digitou separador mas não digitou decimais (ex.: "1.000.000"),
    // tratamos como valor inteiro.
    if (!decPart) return intClean;

    // Armazenar sempre como decimal com vírgula (BR)
    return `${intClean},${decPart}`;
  };

  const preencherComRedeFranqueados = (fr: RedeFranqueadoRowDb) => {
    setFranqueadoSelecionadoId(fr.id);

    const nome = String(fr.nome_completo ?? '').trim();
    const email = String(fr.email_frank ?? '').trim();
    const numero = String(fr.n_franquia ?? '').trim();

    // Dados que aparecem no card (nome/e-mail)
    setNomeFranqueado(nome);
    setEmailFranqueado(email);

    // Dados Step 1 (usados no card: numero_franquia, dados pessoais/endereço etc.)
    setNumeroFranquia(numero);
    setNomeCompletoStep1(nome);
    setEmailFrank(email);
    setModalidade(String(fr.modalidade ?? '').trim());
    setStatusFranquia(String(fr.status_franquia ?? '').trim());
    setClassificacaoFranqueado(String(fr.classificacao_franqueado ?? '').trim());
    const areas = parseAreaAtuacaoRede(fr.area_atuacao ?? null);
    setAreaAtuacaoItens(areas);
    setEstado('');
    setCidade('');
    setErrorCidades('');
    // Campos digitáveis do Step 2 devem ser limpos ao trocar o franqueado
    setQuadra('');
    setLote('');
    setResponsavelComercial(String(fr.responsavel_comercial ?? '').trim());
    setTamanhoCamisetaFrank(String(fr.tamanho_camisa_frank ?? '').trim());
    setSocios(String(fr.socios ?? '').trim());

    // Datas
    setDataAssCof(normalizeDateInput(fr.data_ass_cof));
    const contrato = normalizeDateInput(fr.data_ass_contrato);
    setDataAssContrato(contrato);
    // Também preenche a expiração para evitar race ao submeter rapidamente.
    if (contrato) {
      const d = new Date(contrato + 'T12:00:00');
      if (!isNaN(d.getTime())) {
        d.setFullYear(d.getFullYear() + 5);
        setDataExpiracaoFranquia(d.toISOString().slice(0, 10));
      }
    }
    // Endereço
    setEnderecoCasaRuaFrank(String(fr.endereco_casa_frank ?? '').trim());
    setEnderecoCasaNumeroFrank(String(fr.endereco_casa_frank_numero ?? '').trim());
    setEnderecoCasaComplementoFrank(String(fr.endereco_casa_frank_complemento ?? '').trim());
    setCepCasaFrank(String(fr.cep_casa_frank ?? '').trim());
    setEstadoCasaFrank(String(fr.estado_casa_frank ?? '').trim());
    setCidadeCasaFrank(String(fr.cidade_casa_frank ?? '').trim());

    setTelefoneFrank(String(fr.telefone_frank ?? '').trim());
    setCpfFrank(String(fr.cpf_frank ?? '').trim());
    setDataNascFrank(normalizeDateInput(fr.data_nasc_frank));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cidadeProcesso = destinoEtapa === 'step_1'
      ? (areaAtuacaoItens[0]?.cidade ?? '').trim()
      : cidade.trim();
    const estadoProcesso = destinoEtapa === 'step_1'
      ? (areaAtuacaoItens[0]?.estado ?? '').trim()
      : estado.trim();
    if (destinoEtapa === 'step_1' && (!cidadeProcesso || !estadoProcesso)) {
      setError(destinoEtapa === 'step_1' ? 'Adicione pelo menos um estado e cidade na Área de atuação.' : 'Selecione estado e cidade.');
      return;
    }
    setError('');
    setLoading(true);
    const dadosNovoCard: DadosNovoCard | null =
      destinoEtapa === 'step_2'
        ? {
            nomeFranqueado: nomeFranqueado.trim() || null,
            emailFranqueado: emailFranqueado.trim() || null,
            nomeCondominio: nomeCondominio.trim() || null,
            quadraLote: (() => {
              const q = quadra.trim();
              const l = lote.trim();
              const hasQ = q.length > 0;
              const hasL = l.length > 0;
              if (!hasQ && !hasL) return null;
              if (hasQ && hasL) return `${q}, ${l}`;
              if (hasQ) return q;
              return l;
            })(),
            tipoNegociacaoTerreno: tipoNegociacaoTerreno.trim() || null,
            valorTerreno: valorTerreno.trim() || null,
            vgvPretendido: vgvPretendido.trim() || null,
            produtoModeloCasa: produtoModeloCasa.trim() || null,
            linkPastaDrive: linkPastaDrive.trim() || null,
            observacoes: observacoes.trim() || null,
          }
        : null;
    const areaAtuacaoStr =
      areaAtuacaoItens.length > 0 ? areaAtuacaoItens.map((i) => `${i.estado} - ${i.cidade}`).join('; ') : '';
    const dadosNovoStep1: DadosNovoStep1 | null =
      destinoEtapa === 'step_1'
        ? {
            numeroFranquia: numeroFranquia.trim() || null,
            modalidade: modalidade.trim() || null,
            nomeCompletoFranqueado: nomeCompletoStep1.trim() || null,
            statusFranquia: statusFranquia.trim() || null,
            classificacaoFranqueado: classificacaoFranqueado.trim() || null,
            areaAtuacaoFranquia: areaAtuacaoStr || null,
            emailFrank: emailFrank.trim() || null,
            responsavelComercial: responsavelComercial.trim() || null,
            tamanhoCamisetaFrank: tamanhoCamisetaFrank.trim() || null,
            socios: socios.trim() || null,
            observacoes: observacoes.trim() || null,
            enderecoCasaRuaFrank: enderecoCasaRuaFrank.trim() || null,
            enderecoCasaNumeroFrank: enderecoCasaNumeroFrank.trim() || null,
            enderecoCasaComplementoFrank: enderecoCasaComplementoFrank.trim() || null,
            cepCasaFrank: cepCasaFrank.trim() || null,
            estadoCasaFrank: estadoCasaFrank.trim() || null,
            cidadeCasaFrank: cidadeCasaFrank.trim() || null,
            dataAssCof: dataAssCof.trim() || null,
            dataAssContrato: dataAssContrato.trim() || null,
            dataExpiracaoFranquia: dataExpiracaoFranquia.trim() || null,
            telefoneFrank: telefoneFrank.trim() || null,
            cpfFrank: cpfFrank.trim() || null,
            dataNascFrank: dataNascFrank.trim() || null,
          }
        : destinoEtapa === 'step_2' && franqueadoSelecionadoId
          ? {
              numeroFranquia: numeroFranquia.trim() || null,
              modalidade: modalidade.trim() || null,
              nomeCompletoFranqueado: nomeCompletoStep1.trim() || null,
              statusFranquia: statusFranquia.trim() || null,
              classificacaoFranqueado: classificacaoFranqueado.trim() || null,
              areaAtuacaoFranquia: areaAtuacaoStr || null,
              emailFrank: emailFrank.trim() || null,
              responsavelComercial: responsavelComercial.trim() || null,
              tamanhoCamisetaFrank: tamanhoCamisetaFrank.trim() || null,
              socios: socios.trim() || null,
              observacoes: null,
              enderecoCasaRuaFrank: enderecoCasaRuaFrank.trim() || null,
              enderecoCasaNumeroFrank: enderecoCasaNumeroFrank.trim() || null,
              enderecoCasaComplementoFrank: enderecoCasaComplementoFrank.trim() || null,
              cepCasaFrank: cepCasaFrank.trim() || null,
              estadoCasaFrank: estadoCasaFrank.trim() || null,
              cidadeCasaFrank: cidadeCasaFrank.trim() || null,
              dataAssCof: dataAssCof.trim() || null,
              dataAssContrato: dataAssContrato.trim() || null,
              dataExpiracaoFranquia: dataExpiracaoFranquia.trim() || null,
              telefoneFrank: telefoneFrank.trim() || null,
              cpfFrank: cpfFrank.trim() || null,
              dataNascFrank: dataNascFrank.trim() || null,
            }
          : null;
    const result = await createProcesso(
      cidadeProcesso,
      estadoProcesso,
      destinoEtapa === 'step_2' ? (tipoNegociacaoTerreno.trim() || null) : null,
      observacoes.trim() || null,
      destinoEtapa,
      dadosNovoCard,
      dadosNovoStep1,
    );
    setLoading(false);
    if (result.ok) {
      router.push('/painel-novos-negocios');
      router.refresh();
    } else {
      setError(result.error);
    }
  };

  const copyShareLink = () => {
    // Para garantir que o destinatário abra o mesmo formulário (mesmas regras),
    // usamos exatamente a URL atual desta tela.
    const url =
      typeof window !== 'undefined'
        ? window.location.origin + window.location.pathname + window.location.search
        : '';
    void navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  const cidadesFiltradas = cidades;
  const cidadesAtuacaoFiltradas = cidadesAtuacao;
  const cidadesCasaFiltradas = cidadesCasaFrank;

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">{titulo}</h1>
        <p className="mt-2 text-stone-600">{descricao}</p>
      </div>

      <div className="rounded-xl border border-stone-200 bg-amber-50/50 p-4">
        <p className="text-sm font-medium text-stone-700">Link para compartilhar</p>
        <p className="mt-1 text-xs text-stone-500">
          Envie este link para que outra pessoa preencha o formulário e inicie um processo (é
          necessário estar logado na ferramenta).
        </p>
        <button
          type="button"
          onClick={copyShareLink}
          className="mt-3 flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 transition hover:bg-stone-50"
        >
          {linkCopied ? (
            <>
              <Check className="h-4 w-4 text-green-600" />
              Link copiado
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copiar link
            </>
          )}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        {destinoEtapa === 'step_2' ? (
          <>
            <div>
              <label htmlFor="estado" className="block text-sm font-medium text-stone-700">
                Estado (UF)
              </label>
              <select
                id="estado"
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
              >
                <option value="">— Selecione o estado —</option>
                {(franqueadoSelecionadoId ? UFS_BRASIL.filter((uf) => estadosPermitidosStep2.includes(uf.sigla)) : UFS_BRASIL).map((uf) => (
                  <option key={uf.sigla} value={uf.sigla}>
                    {uf.sigla} — {uf.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="cidade-busca" className="block text-sm font-medium text-stone-700">
                Cidade
              </label>
              <CidadeCombobox
                id="cidade"
                value={cidade}
                onChange={(v) => setCidade(v)}
                disabled={!estado || loadingCidades}
                loading={loadingCidades}
                items={cidadesFiltradas}
                placeholder={!estado ? 'Selecione o estado' : '— Selecione a cidade —'}
              />
              {errorCidades && <p className="mt-1 text-xs text-red-600">{errorCidades}</p>}
            </div>
          </>
        ) : null}

        {destinoEtapa === 'step_2' ? (
          <>
            <div>
              <label className="block text-sm font-medium text-stone-700">
                1. Nome Completo do Franqueado
              </label>
              <FranqueadoCombobox
                valueId={franqueadoSelecionadoId}
                valueNome={nomeFranqueado}
                items={redeFranqueados}
                loading={loadingRedeFranqueados}
                onSelect={(fr) => preencherComRedeFranqueados(fr)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700">
                2. Nº da franquia
              </label>
              <input
                type="text"
                value={numeroFranquia}
                readOnly
                className="mt-1 w-full rounded-lg border border-stone-200 bg-stone-100 px-3 py-2 text-stone-600"
                placeholder="—"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700">
                3. E-mail do Franqueado
              </label>
              <input
                type="email"
                value={emailFranqueado}
                readOnly
                className="mt-1 w-full rounded-lg border border-stone-200 bg-stone-100 px-3 py-2 text-stone-600"
                placeholder="—"
              />
            </div>
            <div>
              <label htmlFor="nome-condominio" className="block text-sm font-medium text-stone-700">
                4. Nome do Condomínio
              </label>
              <input
                id="nome-condominio"
                type="text"
                value={nomeCondominio}
                onChange={(e) => setNomeCondominio(e.target.value)}
                placeholder="Nome do condomínio"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
              />
            </div>
            <div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="quadra" className="block text-sm font-medium text-stone-700">
                    5. Quadra (se houver definido)
                  </label>
                  <input
                    id="quadra"
                    type="text"
                    value={quadra}
                    onChange={(e) => setQuadra(e.target.value)}
                    placeholder="Ex.: Quadra A"
                    className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
                  />
                </div>
                <div>
                  <label htmlFor="lote" className="block text-sm font-medium text-stone-700">
                    Lote (se houver definido)
                  </label>
                  <input
                    id="lote"
                    type="text"
                    value={lote}
                    onChange={(e) => setLote(e.target.value)}
                    placeholder="Ex.: Lote 12"
                    className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
                  />
                </div>
              </div>
            </div>
            <div>
              <label htmlFor="tipo-negociacao" className="block text-sm font-medium text-stone-700">
                6. Tipo de negociação do terreno
              </label>
              <select
                id="tipo-negociacao"
                value={tipoNegociacaoTerreno}
                onChange={(e) => setTipoNegociacaoTerreno(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
              >
                <option value="">— Selecione —</option>
                {OPCOES_TIPO_NEGOCIACAO_TERRENO.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="valor-terreno" className="block text-sm font-medium text-stone-700">
                7. Valor do terreno
              </label>
              <div className="mt-1 flex items-center rounded-lg border border-stone-300 px-3 py-2 focus-within:border-moni-accent focus-within:outline-none focus-within:ring-1 focus-within:ring-moni-accent">
                <span className="mr-2 text-sm font-medium text-stone-500">R$</span>
                <input
                  id="valor-terreno"
                  type="text"
                  inputMode="decimal"
                  value={valorTerreno}
                  onChange={(e) => setValorTerreno(sanitizeMoedaInput(e.target.value))}
                  placeholder="0,00"
                  className="w-full border-0 bg-transparent p-0 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label htmlFor="vgv-pretendido" className="block text-sm font-medium text-stone-700">
                8. VGV Pretendido
              </label>
              <div className="mt-1 flex items-center rounded-lg border border-stone-300 px-3 py-2 focus-within:border-moni-accent focus-within:outline-none focus-within:ring-1 focus-within:ring-moni-accent">
                <span className="mr-2 text-sm font-medium text-stone-500">R$</span>
                <input
                  id="vgv-pretendido"
                  type="text"
                  inputMode="decimal"
                  value={vgvPretendido}
                  onChange={(e) => setVgvPretendido(sanitizeMoedaInput(e.target.value))}
                  placeholder="0,00"
                  className="w-full border-0 bg-transparent p-0 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label htmlFor="produto-modelo-casa" className="block text-sm font-medium text-stone-700">
                9. Produto/ Modelo da Casa
              </label>
              <select
                id="produto-modelo-casa"
                value={produtoModeloCasa}
                onChange={(e) => setProdutoModeloCasa(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
              >
                <option value="">— Selecione —</option>
                {OPCOES_PRODUTO_MODELO_CASA.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="link-pasta-drive" className="block text-sm font-medium text-stone-700">
                10. Link pasta no drive compartilhado
              </label>
              <input
                id="link-pasta-drive"
                type="url"
                value={linkPastaDrive}
                onChange={(e) => setLinkPastaDrive(e.target.value)}
                placeholder="https://..."
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
              />
            </div>
            <div>
              <label htmlFor="observacoes-novo-card" className="block text-sm font-medium text-stone-700">
                Observações (opcional)
              </label>
              <textarea
                id="observacoes-novo-card"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={3}
                placeholder="Alguma informação adicional..."
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
              />
            </div>
          </>
        ) : (
          <>
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
                  <label htmlFor="estado-atuacao" className="block text-xs font-medium text-stone-600">Estado</label>
                  <select
                    id="estado-atuacao"
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
                <div className="min-w-[180px] flex-1">
                  <label htmlFor="cidade-atuacao-busca" className="block text-xs font-medium text-stone-600">Cidade</label>
                  <CidadeCombobox
                    id="cidade-atuacao"
                    value={cidadeAtuacao}
                    onChange={(v) => setCidadeAtuacao(v)}
                    disabled={!estadoAtuacao || loadingCidadesAtuacao}
                    loading={loadingCidadesAtuacao}
                    items={cidadesAtuacaoFiltradas}
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
                  className="flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar
                </button>
              </div>
              {areaAtuacaoItens.length === 0 && (
                <p className="mt-2 text-xs text-amber-700">Adicione pelo menos um estado e cidade.</p>
              )}
            </div>
            <div>
              <label htmlFor="numero-franquia" className="block text-sm font-medium text-stone-700">
                Nº de franquia
              </label>
              <input
                id="numero-franquia"
                type="text"
                value={numeroFranquia}
                onChange={(e) => setNumeroFranquia(e.target.value)}
                placeholder="Número da franquia"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
              />
            </div>
            <div>
              <label htmlFor="modalidade" className="block text-sm font-medium text-stone-700">
                Modalidade
              </label>
              <input
                id="modalidade"
                type="text"
                value={modalidade}
                onChange={(e) => setModalidade(e.target.value)}
                placeholder="Modalidade"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
              />
            </div>
            <div>
              <label htmlFor="nome-completo-step1" className="block text-sm font-medium text-stone-700">
                Nome Completo do Franqueado
              </label>
              <input
                id="nome-completo-step1"
                type="text"
                value={nomeCompletoStep1}
                onChange={(e) => setNomeCompletoStep1(e.target.value)}
                placeholder="Nome completo"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
              />
            </div>
            <div>
              <label htmlFor="status-franquia" className="block text-sm font-medium text-stone-700">
                Status da Franquia
              </label>
              <select
                id="status-franquia"
                value={statusFranquia}
                onChange={(e) => setStatusFranquia(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
              >
                <option value="">— Selecione —</option>
                {OPCOES_STATUS_FRANQUIA.map((op) => (
                  <option key={op.value} value={op.value}>{op.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="classificacao-franqueado" className="block text-sm font-medium text-stone-700">
                Classificação do Franqueado
              </label>
              <select
                id="classificacao-franqueado"
                value={classificacaoFranqueado}
                onChange={(e) => setClassificacaoFranqueado(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
              >
                <option value="">— Selecione —</option>
                {OPCOES_CLASSIFICACAO_FRANQUEADO.map((op) => (
                  <option key={op.value} value={op.value}>{op.label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="data-ass-cof" className="block text-sm font-medium text-stone-700">
                  Data de Ass. COF
                </label>
                <input
                  id="data-ass-cof"
                  type="date"
                  value={dataAssCof}
                  onChange={(e) => setDataAssCof(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
                />
              </div>
              <div>
                <label htmlFor="data-ass-contrato" className="block text-sm font-medium text-stone-700">
                  Data de Ass. Contrato
                </label>
                <input
                  id="data-ass-contrato"
                  type="date"
                  value={dataAssContrato}
                  onChange={(e) => setDataAssContrato(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
                />
              </div>
              <div>
                <label htmlFor="data-expiracao-franquia" className="block text-sm font-medium text-stone-700">
                  Data de Expiração da Franquia
                </label>
                <input
                  id="data-expiracao-franquia"
                  type="date"
                  value={dataExpiracaoFranquia}
                  readOnly
                  className="mt-1 w-full rounded-lg border border-stone-200 bg-stone-100 px-3 py-2 text-stone-600"
                  title="Calculado: Data Ass. Contrato + 5 anos"
                />
                <p className="mt-0.5 text-xs text-stone-500">Data Ass. Contrato + 5 anos</p>
              </div>
            </div>
            <div>
              <label htmlFor="telefone-frank" className="block text-sm font-medium text-stone-700">
                Telefone do Franqueado
              </label>
              <input
                id="telefone-frank"
                type="tel"
                value={telefoneFrank}
                onChange={(e) => setTelefoneFrank(e.target.value)}
                placeholder="(00) 00000-0000"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
              />
            </div>
            <div>
              <label htmlFor="cpf-frank" className="block text-sm font-medium text-stone-700">
                CPF do Franqueado
              </label>
              <input
                id="cpf-frank"
                type="text"
                inputMode="numeric"
                value={cpfFrank}
                onChange={(e) => setCpfFrank(e.target.value)}
                placeholder="000.000.000-00"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
              />
            </div>
            <div>
              <label htmlFor="data-nasc-frank" className="block text-sm font-medium text-stone-700">
                Data de Nasc. do Franqueado
              </label>
              <input
                id="data-nasc-frank"
                type="date"
                value={dataNascFrank}
                onChange={(e) => setDataNascFrank(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
              />
            </div>
            <div>
              <label htmlFor="email-frank" className="block text-sm font-medium text-stone-700">
                E-mail do Frank
              </label>
              <input
                id="email-frank"
                type="email"
                value={emailFrank}
                onChange={(e) => setEmailFrank(e.target.value)}
                placeholder="e-mail@exemplo.com"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
              />
            </div>
            <div className="rounded-lg border border-stone-200 bg-stone-50/50 p-4">
              <h3 className="text-sm font-semibold text-stone-800">Endereço do franqueado (cidade e estado da casa)</h3>
              <div className="mt-3 space-y-3">
                <div>
                  <label htmlFor="endereco-casa-rua" className="block text-xs font-medium text-stone-600">Rua</label>
                  <input
                    id="endereco-casa-rua"
                    type="text"
                    value={enderecoCasaRuaFrank}
                    onChange={(e) => setEnderecoCasaRuaFrank(e.target.value)}
                    placeholder="Rua do franqueado"
                    className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="endereco-casa-numero" className="block text-xs font-medium text-stone-600">Número</label>
                    <input
                      id="endereco-casa-numero"
                      type="text"
                      value={enderecoCasaNumeroFrank}
                      onChange={(e) => setEnderecoCasaNumeroFrank(e.target.value)}
                      placeholder="Nº"
                      className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="endereco-casa-complemento" className="block text-xs font-medium text-stone-600">Complemento</label>
                    <input
                      id="endereco-casa-complemento"
                      type="text"
                      value={enderecoCasaComplementoFrank}
                      onChange={(e) => setEnderecoCasaComplementoFrank(e.target.value)}
                      placeholder="Apto, bloco, etc."
                      className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="cep-casa-frank" className="block text-xs font-medium text-stone-600">CEP</label>
                  <input
                    id="cep-casa-frank"
                    type="text"
                    value={cepCasaFrank}
                    onChange={(e) => setCepCasaFrank(e.target.value)}
                    placeholder="00000-000"
                    className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="estado-casa-frank" className="block text-xs font-medium text-stone-600">Estado (UF) da casa</label>
                    <select
                      id="estado-casa-frank"
                      value={estadoCasaFrank}
                      onChange={(e) => setEstadoCasaFrank(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                    >
                      <option value="">— Selecione —</option>
                      {UFS_BRASIL.map((uf) => (
                        <option key={uf.sigla} value={uf.sigla}>{uf.sigla} — {uf.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="cidade-casa-frank-busca" className="block text-xs font-medium text-stone-600">Cidade da casa</label>
                    <CidadeCombobox
                      id="cidade-casa-frank"
                      value={cidadeCasaFrank}
                      onChange={(v) => setCidadeCasaFrank(v)}
                      disabled={!estadoCasaFrank || loadingCidadesCasa}
                      loading={loadingCidadesCasa}
                      items={cidadesCasaFiltradas}
                      placeholder={!estadoCasaFrank ? 'Selecione o estado' : '— Selecione a cidade —'}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div>
              <label htmlFor="responsavel-comercial" className="block text-sm font-medium text-stone-700">
                Responsável Comercial
              </label>
              <input
                id="responsavel-comercial"
                type="text"
                value={responsavelComercial}
                onChange={(e) => setResponsavelComercial(e.target.value)}
                placeholder="Nome do responsável comercial"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
              />
            </div>
            <div>
              <label htmlFor="tamanho-camiseta" className="block text-sm font-medium text-stone-700">
                Tamanho da Camiseta do Frank
              </label>
              <select
                id="tamanho-camiseta"
                value={tamanhoCamisetaFrank}
                onChange={(e) => setTamanhoCamisetaFrank(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
              >
                <option value="">— Selecione —</option>
                <option value="P">P</option>
                <option value="M">M</option>
                <option value="G">G</option>
                <option value="GG">GG</option>
              </select>
            </div>
            <div>
              <label htmlFor="socios" className="block text-sm font-medium text-stone-700">
                Sócios (Listar: Nome, Nascimento, Telefone, E-mail, CPF, Endereço Completo, Tamanho da camiseta)
              </label>
              <textarea
                id="socios"
                value={socios}
                onChange={(e) => setSocios(e.target.value)}
                rows={4}
                placeholder="Um sócio por linha ou texto livre com os dados solicitados..."
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
              />
            </div>
            <div>
              <label htmlFor="observacoes" className="block text-sm font-medium text-stone-700">
                Observações (opcional)
              </label>
              <textarea
                id="observacoes"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={3}
                placeholder="Alguma informação adicional para o processo..."
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
              />
            </div>
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Criando…' : destinoEtapa === 'step_1' ? 'Criar no Step 1' : 'Criar Novo Negócio'}
          </button>
          <Link href="/painel-novos-negocios" className="text-sm text-stone-500 hover:text-moni-primary">
            Voltar ao Painel
          </Link>
        </div>
      </form>
    </div>
  );
}
