'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  mascaraMoeda,
  mascaraTelefone,
  moedaParaNumero,
  normalizarCondicional,
} from '@/lib/formularios/apresentacao';
import { SearchableSelect } from '@/components/SearchableSelect';
import { fetchMunicipiosPorUfs } from '@/lib/ibge';
import { UFS_BRASIL } from '@/lib/uf';
import type { Formulario, FormularioCampo, FormularioCampoGrupoDef, FormularioSecao } from '@/types/formularios';

type Props = {
  formulario: Formulario;
  token: string;
  cardId?: string | null;
  redeFranqueadoId?: string | null;
};

const OPCOES_UF = UFS_BRASIL.map((uf) => ({
  value: uf.sigla,
  label: `${uf.sigla} — ${uf.nome}`,
}));

const selectTriggerClass =
  '!min-h-[44px] !rounded-[var(--moni-radius-md)] !border-[color:var(--moni-border-default)] ![border-width:var(--moni-border-width)] !bg-[var(--moni-surface-0)] !px-3 !text-[15px] !font-normal ![font-family:var(--moni-font-sans)] !text-[var(--moni-text-primary)]';

const selectBuscaClass = '!min-h-[44px] !px-3 !text-[15px]';
const selectOpcaoClass = '!min-h-[44px] !px-3 !text-[15px]';

const campoStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 44,
  borderRadius: 'var(--moni-radius-md)',
  border: 'var(--moni-border-width) solid var(--moni-border-default)',
  background: 'var(--moni-surface-0)',
  color: 'var(--moni-text-primary)',
  fontFamily: 'var(--moni-font-sans)',
  fontSize: 15,
  padding: '8px 12px',
};

const botao: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 'var(--moni-radius-md)',
  background: 'var(--moni-navy-800)',
  color: 'white',
  fontFamily: 'var(--moni-font-sans)',
  fontSize: 14,
  fontWeight: 600,
  padding: '0 16px',
  border: 'none',
};

function valorCondicional(
  campoId: string,
  campos: FormularioCampo[],
  textos: Record<string, string>,
  listas: Record<string, string[]>,
): string[] {
  const campo = campos.find((item) => item.id === campoId);
  if (!campo) return [];
  if (campo.tipo === 'checkbox') return listas[campoId] ?? [];
  const texto = textos[campoId] ?? '';
  return texto ? [texto] : [];
}

function condicaoOk(
  alvoId: string | null,
  esperado: string | null,
  campos: FormularioCampo[],
  textos: Record<string, string>,
  listas: Record<string, string[]>,
  visiveis: Set<string>,
): boolean {
  if (!alvoId) return true;
  if (!visiveis.has(alvoId)) return false;
  const atual = valorCondicional(alvoId, campos, textos, listas);
  const alvo = normalizarCondicional(esperado);
  return atual.some((item) => normalizarCondicional(item) === alvo);
}

export function FormularioPublicoClient({ token, formulario }: Props) {
  const secoes = formulario.secoes;
  const campos = useMemo(() => secoes.flatMap((secao) => secao.campos), [secoes]);
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [listas, setListas] = useState<Record<string, string[]>>({});
  const [arquivos, setArquivos] = useState<Record<string, File[]>>({});
  const [passo, setPasso] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const visiveis = useMemo(() => {
    const ids = new Set<string>();
    for (let i = 0; i < 16; i += 1) {
      const proximo = new Set<string>();
      for (const campo of campos) {
        const secao = secoes.find((item) => item.id === campo.secao_id);
        const secaoOk = secao
          ? condicaoOk(secao.condicional_campo_id, secao.condicional_valor, campos, textos, listas, ids)
          : true;
        const campoOk = condicaoOk(campo.condicional_campo_id, campo.condicional_valor, campos, textos, listas, ids);
        if (secaoOk && campoOk) proximo.add(campo.id);
      }
      if (proximo.size === ids.size && [...proximo].every((id) => ids.has(id))) break;
      ids.clear();
      proximo.forEach((id) => ids.add(id));
    }
    return ids;
  }, [campos, secoes, textos, listas]);

  const secoesVisiveis = secoes.filter((secao) => {
    const secaoOk = condicaoOk(secao.condicional_campo_id, secao.condicional_valor, campos, textos, listas, visiveis);
    return secaoOk && secao.campos.some((campo) => visiveis.has(campo.id));
  });
  const secaoAtual = secoesVisiveis[Math.min(passo, Math.max(secoesVisiveis.length - 1, 0))] ?? null;
  const ultimo = passo >= secoesVisiveis.length - 1;

  function setTexto(id: string, valor: string) {
    setErro(null);
    setTextos((atual) => {
      const next = { ...atual, [id]: valor };
      if ((atual[id] ?? '') === valor) return next;
      for (const campo of campos) {
        if (campo.tipo === 'select_cidade' && campo.config?.estado_campo_id === id) next[campo.id] = '';
      }
      return next;
    });
  }

  function faltando(secao: FormularioSecao | null): string | null {
    if (!secao) return null;
    for (const campo of secao.campos) {
      if (!campo.obrigatorio || !visiveis.has(campo.id)) continue;
      if (campo.tipo === 'grupo_repetivel') {
        const linhas = parseGrupoRepetivel(textos[campo.id]);
        const defs = (campo.config?.campos ?? []).filter((def) => !ehTemaGrupo(def));
        const preenchidas = linhas.filter((linha) => defs.some((def) => linhaTemValor(def, linha)));
        if (campo.obrigatorio && preenchidas.length === 0) return `Preencha: ${campo.label}`;
        for (const linha of preenchidas) {
          for (const def of defs) {
            if (!def.obrigatorio) continue;
            const incompleto = ehFaixaMoeda(def)
              ? !String(linha[`${def.key}_de`] ?? '').trim() || !String(linha[`${def.key}_ate`] ?? '').trim()
              : !String(linha[def.key] ?? '').trim();
            if (incompleto) return `Preencha: ${def.label}`;
          }
        }
        continue;
      }
      if (campo.tipo === 'checkbox' && (listas[campo.id] ?? []).length === 0) return `Preencha: ${campo.label}`;
      if (campo.tipo === 'arquivo_multiplo' && (arquivos[campo.id] ?? []).length === 0) return `Anexe: ${campo.label}`;
      if (campo.tipo === 'link_ou_arquivo') {
        const temUrl = Boolean((textos[campo.id] ?? '').trim());
        const temArquivo = (arquivos[campo.id] ?? []).length > 0;
        if (!temUrl && !temArquivo) return `Informe o link ou o arquivo: ${campo.label}`;
        continue;
      }
      if (!(textos[campo.id] ?? '').trim()) return `Preencha: ${campo.label}`;
    }
    return null;
  }

  function avancar() {
    const msg = faltando(secaoAtual);
    if (msg) {
      setErro(msg);
      return;
    }
    setErro(null);
    setPasso((atual) => Math.min(atual + 1, secoesVisiveis.length - 1));
  }

  async function enviar() {
    for (const secao of secoesVisiveis) {
      const msg = faltando(secao);
      if (msg) {
        setErro(msg);
        setPasso(secoesVisiveis.findIndex((item) => item.id === secao.id));
        return;
      }
    }
    setEnviando(true);
    setErro(null);
    try {
      const inicio = await fetch('/api/formularios/iniciar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const aberto = (await inicio.json()) as { ok: boolean; error?: string; respostaId?: string; tokenId?: string };
      if (!inicio.ok || !aberto.ok || !aberto.respostaId) {
        setErro(aberto.error ?? 'Não foi possível iniciar o envio.');
        return;
      }
      for (const campo of campos) {
        if (!visiveis.has(campo.id)) continue;
        const files = arquivos[campo.id] ?? [];
        for (const file of files) {
          const fd = new FormData();
          fd.set('token', token);
          fd.set('respostaId', aberto.respostaId);
          fd.set('campoId', campo.id);
          fd.set('arquivo', file);
          const up = await fetch('/api/formularios/upload', { method: 'POST', body: fd });
          const upJson = (await up.json()) as { ok: boolean; error?: string };
          if (!up.ok || !upJson.ok) {
            setErro(upJson.error ?? `Falha ao enviar ${file.name}.`);
            return;
          }
        }
      }
      const valores = campos
        .filter((campo) => visiveis.has(campo.id))
        .filter((campo) => campo.tipo !== 'arquivo_multiplo')
        .map((campo) => {
          if (campo.tipo === 'checkbox') {
            return { campoId: campo.id, valorJson: listas[campo.id] ?? [] };
          }
          if (campo.tipo === 'moeda') {
            return { campoId: campo.id, valorTexto: textos[campo.id] ?? '', valorNumero: moedaParaNumero(textos[campo.id] ?? '') };
          }
          if (campo.tipo === 'numero') {
            const texto = textos[campo.id] ?? '';
            const numeroValor = texto.trim() === '' ? null : Number(texto);
            return { campoId: campo.id, valorTexto: texto, valorNumero: Number.isFinite(numeroValor) ? numeroValor : null };
          }
          if (campo.tipo === 'data') return { campoId: campo.id, valorData: textos[campo.id] || null };
          return { campoId: campo.id, valorTexto: textos[campo.id] ?? '' };
        });
      const sub = await fetch('/api/formularios/submeter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          tokenId: aberto.tokenId,
          respostaId: aberto.respostaId,
          valores,
        }),
      });
      const subJson = (await sub.json()) as { ok: boolean; error?: string };
      if (!sub.ok || !subJson.ok) {
        setErro(subJson.error ?? 'Não foi possível enviar.');
        return;
      }
      setEnviado(true);
    } catch {
      setErro('Falha de conexão. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <p className="text-sm" style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}>
          Casa Moní
        </p>
        <h1
          className="mt-2 text-3xl"
          style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
        >
          Resposta enviada
        </h1>
        <p className="mt-3 text-sm" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
          Recebemos as informações de {formulario.nome}. Este link continua aberto: um novo envio registra outra resposta.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8 sm:py-12">
      <p className="text-sm" style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}>
        Casa Moní
      </p>
      <h1 className="mt-2 text-3xl" style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}>
        {formulario.nome}
      </h1>
      {formulario.descricao ? (
        <p className="mt-2 text-sm" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
          {formulario.descricao}
        </p>
      ) : null}
      {secoesVisiveis.length > 1 ? (
        <p className="mt-4 text-xs" style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}>
          Etapa {Math.min(passo + 1, secoesVisiveis.length)} de {secoesVisiveis.length}
        </p>
      ) : null}

      <div
        className="mt-6 space-y-4 p-4 sm:p-6"
        style={{
          background: 'var(--moni-surface-0)',
          border: 'var(--moni-border-width) solid var(--moni-border-default)',
          borderRadius: 'var(--moni-radius-lg)',
          boxShadow: 'var(--moni-shadow-card)',
        }}
      >
        {secaoAtual ? (
          <div className="space-y-4">
            <h2 className="text-lg" style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}>
              {secaoAtual.titulo}
            </h2>
            {secaoAtual.campos.filter((campo) => visiveis.has(campo.id)).map((campo) => (
              <CampoPublico
                key={campo.id}
                campo={campo}
                textos={textos}
                texto={textos[campo.id] ?? ''}
                lista={listas[campo.id] ?? []}
                arquivos={arquivos[campo.id] ?? []}
                onTexto={(valor) => setTexto(campo.id, valor)}
                onLista={(valor) => setListas((atual) => ({ ...atual, [campo.id]: valor }))}
                onArquivos={(valor) => setArquivos((atual) => ({ ...atual, [campo.id]: valor }))}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
            Este formulário ainda não tem campos visíveis.
          </p>
        )}

        {erro ? (
          <p className="text-sm" style={{ color: 'var(--moni-status-overdue-text)', fontFamily: 'var(--moni-font-sans)' }}>
            {erro}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {passo > 0 ? (
            <button type="button" onClick={() => { setErro(null); setPasso((atual) => atual - 1); }} style={{ ...botao, background: 'transparent', color: 'var(--moni-text-primary)', border: 'var(--moni-border-width) solid var(--moni-border-default)' }}>
              Voltar
            </button>
          ) : null}
          {secaoAtual && !ultimo ? (
            <button type="button" onClick={avancar} style={botao}>
              Continuar
            </button>
          ) : null}
          {secaoAtual && ultimo ? (
            <button type="button" disabled={enviando} onClick={() => void enviar()} style={botao}>
              {enviando ? 'Enviando…' : 'Enviar'}
            </button>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function mascaraAreaM2(entrada: string): string {
  const texto = entrada.replace(/\./g, ',').replace(/[^\d,]/g, '');
  const [bruto, ...resto] = texto.split(',');
  const inteiro = bruto.replace(/^0+(?=\d)/, '');
  if (!texto.includes(',')) return inteiro;
  return `${inteiro},${resto.join('').slice(0, 2)}`;
}

function parseGrupoRepetivel(raw: string | undefined): Record<string, string>[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item === 'object') as Record<string, string>[];
  } catch {
    return [];
  }
}

function CampoPublico({
  campo,
  textos,
  texto,
  lista,
  arquivos,
  onTexto,
  onLista,
  onArquivos,
}: {
  campo: FormularioCampo;
  textos: Record<string, string>;
  texto: string;
  lista: string[];
  arquivos: File[];
  onTexto: (valor: string) => void;
  onLista: (valor: string[]) => void;
  onArquivos: (valor: File[]) => void;
}) {
  const label = (
    <span className="mb-1 block text-sm" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
      {campo.label}
      {campo.obrigatorio ? ' *' : ''}
    </span>
  );

  if (campo.tipo === 'texto_longo') {
    return (
      <label className="block">
        {label}
        <textarea value={texto} onChange={(e) => onTexto(e.target.value)} rows={4} style={campoStyle} />
      </label>
    );
  }
  if (campo.tipo === 'email') {
    return (
      <label className="block">
        {label}
        <input type="email" value={texto} onChange={(e) => onTexto(e.target.value)} style={campoStyle} />
      </label>
    );
  }
  if (campo.tipo === 'telefone') {
    return (
      <label className="block">
        {label}
        <input type="tel" value={texto} onChange={(e) => onTexto(mascaraTelefone(e.target.value))} style={campoStyle} />
      </label>
    );
  }
  if (campo.tipo === 'moeda') {
    return (
      <label className="block">
        {label}
        <input type="text" inputMode="numeric" value={texto} onChange={(e) => onTexto(mascaraMoeda(e.target.value))} style={campoStyle} />
      </label>
    );
  }
  if (campo.tipo === 'numero') {
    return (
      <label className="block">
        {label}
        <input type="number" value={texto} onChange={(e) => onTexto(e.target.value)} style={campoStyle} />
      </label>
    );
  }
  if (campo.tipo === 'data') {
    return (
      <label className="block">
        {label}
        <input type="date" value={texto} onChange={(e) => onTexto(e.target.value)} style={campoStyle} />
      </label>
    );
  }
  if (campo.tipo === 'link') {
    return (
      <label className="block">
        {label}
        <input type="url" value={texto} onChange={(e) => onTexto(e.target.value)} style={campoStyle} />
      </label>
    );
  }
  if (campo.tipo === 'select_estado') {
    return (
      <div className="block">
        {label}
        <SearchableSelect
          value={texto}
          onChange={onTexto}
          options={OPCOES_UF}
          placeholder="Selecione"
          searchPlaceholder="Buscar estado"
          size="md"
          menuPortal
          aria-label={campo.label}
          triggerClassName={selectTriggerClass}
          searchClassName={selectBuscaClass}
          optionClassName={selectOpcaoClass}
        />
      </div>
    );
  }
  if (campo.tipo === 'select_cidade') {
    const estadoId = campo.config?.estado_campo_id ?? '';
    return (
      <SelectCidadeCampo
        label={label}
        rotulo={campo.label}
        uf={textos[estadoId] ?? ''}
        valor={texto}
        onTexto={onTexto}
      />
    );
  }
  if (campo.tipo === 'grupo_repetivel') {
    return (
      <GrupoRepetivelCampo
        label={label}
        defs={campo.config?.campos ?? []}
        botao={campo.config?.label_adicionar ?? 'Adicionar'}
        valor={texto}
        onTexto={onTexto}
      />
    );
  }
  if (campo.tipo === 'select') {
    return (
      <label className="block">
        {label}
        <select value={texto} onChange={(e) => onTexto(e.target.value)} style={campoStyle}>
          <option value="">Selecione</option>
          {campo.opcoes.map((opcao) => (
            <option key={opcao} value={opcao}>
              {opcao}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (campo.tipo === 'checkbox') {
    return (
      <fieldset>
        {label}
        {campo.opcoes.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}>
            Opções deste campo ainda não foram cadastradas.
          </p>
        ) : (
          <div className="space-y-2">
            {campo.opcoes.map((opcao) => {
              const marcado = lista.includes(opcao);
              return (
                <label key={opcao} className="flex min-h-[44px] items-center gap-2 text-sm" style={{ fontFamily: 'var(--moni-font-sans)', color: 'var(--moni-text-primary)' }}>
                  <input
                    type="checkbox"
                    checked={marcado}
                    onChange={() => onLista(marcado ? lista.filter((item) => item !== opcao) : [...lista, opcao])}
                  />
                  {opcao}
                </label>
              );
            })}
          </div>
        )}
      </fieldset>
    );
  }
  if (campo.tipo === 'arquivo_multiplo' || campo.tipo === 'link_ou_arquivo') {
    return (
      <div>
        {label}
        {campo.tipo === 'link_ou_arquivo' ? (
          <input
            type="url"
            placeholder="https://"
            value={texto}
            onChange={(e) => onTexto(e.target.value)}
            style={{ ...campoStyle, marginBottom: 8 }}
          />
        ) : null}
        <input
          type="file"
          multiple
          onChange={(e) => onArquivos(Array.from(e.target.files ?? []))}
          style={{ ...campoStyle, paddingTop: 10 }}
        />
        {arquivos.length > 0 ? (
          <p className="mt-1 text-xs" style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}>
            {arquivos.map((file) => file.name).join(', ')}
          </p>
        ) : null}
      </div>
    );
  }
  return (
    <label className="block">
      {label}
      <input type="text" value={texto} onChange={(e) => onTexto(e.target.value)} style={campoStyle} />
    </label>
  );
}

function SelectCidadeCampo({
  label,
  rotulo,
  uf,
  valor,
  onTexto,
}: {
  label: ReactNode;
  rotulo: string;
  uf: string;
  valor: string;
  onTexto: (valor: string) => void;
}) {
  const [cidades, setCidades] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    const sigla = uf.trim().toUpperCase();
    if (sigla.length !== 2) {
      setCidades([]);
      return;
    }
    const ctrl = new AbortController();
    setCarregando(true);
    void fetchMunicipiosPorUfs([sigla], ctrl.signal)
      .then((lista) => {
        if (!ctrl.signal.aborted) setCidades(lista.map((cidade) => cidade.nome));
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setCidades([]);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setCarregando(false);
      });
    return () => ctrl.abort();
  }, [uf]);

  const semEstado = !uf.trim();
  const placeholder = semEstado ? 'Selecione o estado' : carregando ? 'Carregando cidades…' : 'Selecione';
  const opcoes = cidades.map((cidade) => ({ value: cidade, label: cidade }));

  return (
    <div className="block">
      {label}
      <SearchableSelect
        value={valor}
        onChange={onTexto}
        options={opcoes}
        placeholder={placeholder}
        searchPlaceholder="Buscar cidade"
        disabled={semEstado || carregando}
        emptyOption={semEstado || carregando ? null : { value: '', label: 'Selecione' }}
        size="md"
        menuPortal
        aria-label={rotulo}
        triggerClassName={selectTriggerClass}
        searchClassName={selectBuscaClass}
        optionClassName={selectOpcaoClass}
      />
    </div>
  );
}

function ehTemaGrupo(def: FormularioCampoGrupoDef): boolean {
  return def.tipo === 'titulo' || def.key === 'composicao_media';
}

function ehFaixaMoeda(def: FormularioCampoGrupoDef): boolean {
  return def.tipo === 'faixa_moeda' || def.key === 'faixa_preco';
}

function ehNumeroInteiro(def: FormularioCampoGrupoDef): boolean {
  return (
    def.tipo === 'numero' ||
    def.key === 'giro_vendas' ||
    def.key === 'num_suites' ||
    def.key === 'vagas_cobertas'
  );
}

function apenasDigitos(entrada: string): string {
  return entrada.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
}

function linhaTemValor(def: FormularioCampoGrupoDef, linha: Record<string, string>): boolean {
  if (ehFaixaMoeda(def)) {
    const de = String(linha[`${def.key}_de`] ?? linha[def.key] ?? '').trim();
    const ate = String(linha[`${def.key}_ate`] ?? '').trim();
    return Boolean(de || ate);
  }
  return Boolean(String(linha[def.key] ?? '').trim());
}

function blocosDoGrupo(defs: FormularioCampoGrupoDef[]) {
  const blocos: { tema: FormularioCampoGrupoDef | null; campos: FormularioCampoGrupoDef[] }[] = [];
  let atual: { tema: FormularioCampoGrupoDef | null; campos: FormularioCampoGrupoDef[] } = { tema: null, campos: [] };
  for (const def of defs) {
    if (ehTemaGrupo(def)) {
      if (atual.tema || atual.campos.length > 0) blocos.push(atual);
      atual = { tema: def, campos: [] };
    } else {
      atual.campos.push(def);
    }
  }
  if (atual.tema || atual.campos.length > 0) blocos.push(atual);
  return blocos;
}

function GrupoRepetivelCampo({
  label,
  defs,
  botao: rotuloAdicionar,
  valor,
  onTexto,
}: {
  label: ReactNode;
  defs: FormularioCampoGrupoDef[];
  botao: string;
  valor: string;
  onTexto: (valor: string) => void;
}) {
  const linhas = parseGrupoRepetivel(valor);
  const blocos = blocosDoGrupo(defs);
  const vazio = () => {
    const entrada: Record<string, string> = {};
    for (const def of defs) {
      if (ehTemaGrupo(def)) continue;
      if (ehFaixaMoeda(def)) {
        entrada[`${def.key}_de`] = '';
        entrada[`${def.key}_ate`] = '';
        continue;
      }
      entrada[def.key] = '';
    }
    return entrada;
  };

  function gravar(next: Record<string, string>[]) {
    onTexto(next.length > 0 ? JSON.stringify(next) : '');
  }

  return (
    <fieldset className="space-y-3">
      <legend className="mb-1">{label}</legend>
      {linhas.map((linha, index) => (
        <div
          key={index}
          className="space-y-2 rounded-[var(--moni-radius-md)] p-3"
          style={{ border: '0.5px solid var(--moni-border-subtle)' }}
        >
          {blocos.map((bloco) => (
            <div key={bloco.tema?.key ?? 'inicio'} className="space-y-2">
              {bloco.tema ? (
                <p
                  className="pt-2 text-base"
                  style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-display)' }}
                >
                  {bloco.tema.label}
                </p>
              ) : null}
              <div
                className={bloco.tema ? 'space-y-2 pl-3' : 'space-y-2'}
                style={bloco.tema ? { borderLeft: '0.5px solid var(--moni-border-default)' } : undefined}
              >
          {bloco.campos.map((def) => {
            const CampoTag = ehFaixaMoeda(def) ? 'div' : 'label';
            return (
            <CampoTag key={def.key} className="block">
              <span className="mb-1 block text-xs" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
                {def.label}
                {def.obrigatorio ? ' *' : ''}
              </span>
              {ehFaixaMoeda(def) ? (
                <div className="flex flex-wrap items-center gap-2">
                  {(['de', 'à'] as const).map((rotulo) => {
                    const lado = rotulo === 'de' ? 'de' : 'ate';
                    const chave = `${def.key}_${lado}`;
                    const valorAtual = String(linha[chave] ?? (lado === 'de' ? linha[def.key] : '') ?? '');
                    return (
                      <label key={lado} className="flex min-w-[180px] flex-1 items-center gap-2">
                        <span
                          className="shrink-0 text-sm"
                          style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}
                        >
                          {rotulo === 'de' ? 'De' : 'à'}
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="R$ 0,00"
                          aria-label={`${rotulo === 'de' ? 'De' : 'à'}, ${def.label}`}
                          value={valorAtual}
                          onChange={(e) => {
                            const mascarado = mascaraMoeda(e.target.value);
                            const next = linhas.map((item, i) => {
                              if (i !== index) return item;
                              const deAtual = String(item[`${def.key}_de`] ?? item[def.key] ?? '');
                              const ateAtual = String(item[`${def.key}_ate`] ?? '');
                              const resto = { ...item };
                              delete resto[def.key];
                              return {
                                ...resto,
                                [`${def.key}_de`]: lado === 'de' ? mascarado : deAtual,
                                [`${def.key}_ate`]: lado === 'ate' ? mascarado : ateAtual,
                              };
                            });
                            gravar(next);
                          }}
                          style={{ ...campoStyle, width: 'auto', flex: '1 1 140px' }}
                        />
                      </label>
                    );
                  })}
                </div>
              ) : def.tipo === 'select' ? (
                <select
                  value={String(linha[def.key] ?? '')}
                  onChange={(e) => {
                    const next = linhas.map((item, i) => (i === index ? { ...item, [def.key]: e.target.value } : item));
                    gravar(next);
                  }}
                  style={campoStyle}
                >
                  <option value="">Selecione</option>
                  {(def.opcoes ?? []).map((opcao) => (
                    <option key={opcao} value={opcao}>
                      {opcao}
                    </option>
                  ))}
                </select>
              ) : def.tipo === 'moeda' || def.key === 'preco_medio_venda' ? (
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="R$ 0,00"
                  value={String(linha[def.key] ?? '')}
                  onChange={(e) => {
                    const valor = mascaraMoeda(e.target.value);
                    const next = linhas.map((item, i) => (i === index ? { ...item, [def.key]: valor } : item));
                    gravar(next);
                  }}
                  style={campoStyle}
                />
              ) : def.tipo === 'm2' || def.key === 'metragem_construida' ? (
                <div className="flex items-center" style={{ ...campoStyle, padding: 0 }}>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    aria-label={`${def.label} em metros quadrados`}
                    value={String(linha[def.key] ?? '')}
                    onChange={(e) => {
                      const valor = mascaraAreaM2(e.target.value);
                      const next = linhas.map((item, i) => (i === index ? { ...item, [def.key]: valor } : item));
                      gravar(next);
                    }}
                    className="min-w-0 flex-1 bg-transparent px-3 outline-none"
                    style={{
                      minHeight: 44,
                      border: 'none',
                      color: 'var(--moni-text-primary)',
                      fontFamily: 'var(--moni-font-sans)',
                      fontSize: 15,
                    }}
                  />
                  <span
                    className="shrink-0 pr-3 text-sm"
                    style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}
                  >
                    m²
                  </span>
                </div>
              ) : ehNumeroInteiro(def) ? (
                <input
                  type="text"
                  inputMode="numeric"
                  value={String(linha[def.key] ?? '')}
                  onChange={(e) => {
                    const valor = apenasDigitos(e.target.value);
                    const next = linhas.map((item, i) => (i === index ? { ...item, [def.key]: valor } : item));
                    gravar(next);
                  }}
                  style={campoStyle}
                />
              ) : (
                <input
                  type="text"
                  value={String(linha[def.key] ?? '')}
                  onChange={(e) => {
                    const next = linhas.map((item, i) => (i === index ? { ...item, [def.key]: e.target.value } : item));
                    gravar(next);
                  }}
                  style={campoStyle}
                />
              )}
            </CampoTag>
            );
          })}
              </div>
            </div>
          ))}
          <button
            type="button"
            className="min-h-[44px] text-xs underline"
            style={{ color: 'var(--moni-text-tertiary)' }}
            onClick={() => gravar(linhas.filter((_, i) => i !== index))}
          >
            Remover
          </button>
        </div>
      ))}
      <button type="button" onClick={() => gravar([...linhas, vazio()])} style={botao}>
        {rotuloAdicionar}
      </button>
    </fieldset>
  );
}

export default FormularioPublicoClient;
