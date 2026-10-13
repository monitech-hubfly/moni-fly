'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  mascaraMoeda,
  mascaraTelefone,
  moedaParaNumero,
  normalizarCondicional,
} from '@/lib/formularios/apresentacao';
import { fetchMunicipiosPorUfs } from '@/lib/ibge';
import { UFS_BRASIL } from '@/lib/uf';
import type { Formulario, FormularioCampo, FormularioCampoGrupoDef, FormularioSecao } from '@/types/formularios';

type Props = {
  formulario: Formulario;
  token: string;
  cardId?: string | null;
  redeFranqueadoId?: string | null;
  avulso: boolean;
};

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

export function FormularioPublicoClient({ token, avulso, formulario }: Props) {
  const secoes = formulario.secoes;
  const campos = useMemo(() => secoes.flatMap((secao) => secao.campos), [secoes]);
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [listas, setListas] = useState<Record<string, string[]>>({});
  const [arquivos, setArquivos] = useState<Record<string, File[]>>({});
  const [numero, setNumero] = useState('');
  const [nome, setNome] = useState('');
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
    setTextos((atual) => {
      const next = { ...atual, [id]: valor };
      if ((atual[id] ?? '') === valor) return next;
      for (const campo of campos) {
        if (campo.tipo === 'select_cidade' && campo.config?.estado_campo_id === id) next[campo.id] = '';
      }
      return next;
    });
  }

  function faltando(secao: FormularioSecao | null, incluirAvulso: boolean): string | null {
    if (incluirAvulso && avulso && !nome.trim()) {
      return 'Informe o nome do franqueado.';
    }
    if (!secao) return null;
    for (const campo of secao.campos) {
      if (!campo.obrigatorio || !visiveis.has(campo.id)) continue;
      if (campo.tipo === 'grupo_repetivel') {
        const linhas = parseGrupoRepetivel(textos[campo.id]);
        const defs = campo.config?.campos ?? [];
        const preenchidas = linhas.filter((linha) =>
          defs.some((def) => String(linha[def.key] ?? '').trim()),
        );
        if (campo.obrigatorio && preenchidas.length === 0) return `Preencha: ${campo.label}`;
        for (const linha of preenchidas) {
          for (const def of defs) {
            if (def.obrigatorio && !String(linha[def.key] ?? '').trim()) return `Preencha: ${def.label}`;
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
    const msg = faltando(secaoAtual, passo === 0);
    if (msg) {
      setErro(msg);
      return;
    }
    setErro(null);
    setPasso((atual) => Math.min(atual + 1, secoesVisiveis.length - 1));
  }

  async function enviar() {
    for (const secao of secoesVisiveis) {
      const msg = faltando(secao, true);
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
        body: JSON.stringify({ token, numeroFranquia: numero, nomeFranqueado: nome }),
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
          numeroFranquia: numero,
          nomeFranqueado: nome,
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
          Recebemos as informações de {formulario.nome}.
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
        {passo === 0 && avulso ? (
          <div className="space-y-3">
            <label className="block text-sm" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
              Nome do Franqueado
              <input value={nome} onChange={(e) => setNome(e.target.value)} required style={{ ...campoStyle, display: 'block', marginTop: 4 }} />
            </label>
          </div>
        ) : null}

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
      <label className="block">
        {label}
        <select value={texto} onChange={(e) => onTexto(e.target.value)} style={campoStyle}>
          <option value="">Selecione</option>
          {UFS_BRASIL.map((uf) => (
            <option key={uf.sigla} value={uf.sigla}>
              {uf.sigla} — {uf.nome}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (campo.tipo === 'select_cidade') {
    const estadoId = campo.config?.estado_campo_id ?? '';
    return <SelectCidadeCampo label={label} uf={textos[estadoId] ?? ''} valor={texto} onTexto={onTexto} />;
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
  uf,
  valor,
  onTexto,
}: {
  label: ReactNode;
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

  return (
    <label className="block">
      {label}
      <select
        value={valor}
        disabled={!uf.trim() || carregando}
        onChange={(e) => onTexto(e.target.value)}
        style={campoStyle}
      >
        <option value="">{uf.trim() ? (carregando ? 'Carregando cidades…' : 'Selecione') : 'Selecione o estado'}</option>
        {cidades.map((cidade) => (
          <option key={cidade} value={cidade}>
            {cidade}
          </option>
        ))}
      </select>
    </label>
  );
}

function GrupoRepetivelCampo({
  label,
  defs,
  botao,
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
  const vazio = () => Object.fromEntries(defs.map((def) => [def.key, '']));

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
          {defs.map((def) => (
            <label key={def.key} className="block">
              <span className="mb-1 block text-xs" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
                {def.label}
                {def.obrigatorio ? ' *' : ''}
              </span>
              {def.tipo === 'select' ? (
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
              ) : (
                <input
                  type={def.tipo === 'numero' ? 'number' : 'text'}
                  value={String(linha[def.key] ?? '')}
                  onChange={(e) => {
                    const next = linhas.map((item, i) => (i === index ? { ...item, [def.key]: e.target.value } : item));
                    gravar(next);
                  }}
                  style={campoStyle}
                />
              )}
            </label>
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
        {botao}
      </button>
    </fieldset>
  );
}

export default FormularioPublicoClient;
