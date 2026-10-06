'use client';

import { useMemo, useState } from 'react';
import {
  mascaraMoeda,
  mascaraTelefone,
  moedaParaNumero,
  normalizarCondicional,
} from '@/lib/formularios/apresentacao';
import type { FormularioCampo, FormularioListaItem, FormularioSecao, FormularioValorSubmit } from '@/types/formularios';

type Props = {
  token: string;
  tokenId: string;
  avulso: boolean;
  formulario: FormularioListaItem;
  secoes: FormularioSecao[];
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

export function FormularioPublicoClient({ token, tokenId, avulso, formulario, secoes }: Props) {
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
    setTextos((atual) => ({ ...atual, [id]: valor }));
  }

  function faltando(secao: FormularioSecao | null, incluirAvulso: boolean): string | null {
    if (incluirAvulso && avulso && (!numero.trim() || !nome.trim())) {
      return 'Informe o número e o nome do franqueado.';
    }
    if (!secao) return null;
    for (const campo of secao.campos) {
      if (!campo.obrigatorio || !visiveis.has(campo.id)) continue;
      if (campo.tipo === 'checkbox' && (listas[campo.id] ?? []).length === 0) return `Preencha: ${campo.nome}`;
      if (campo.tipo === 'arquivo_multiplo' && (arquivos[campo.id] ?? []).length === 0) return `Anexe: ${campo.nome}`;
      if (campo.tipo === 'link_ou_arquivo') {
        const temUrl = Boolean((textos[campo.id] ?? '').trim());
        const temArquivo = (arquivos[campo.id] ?? []).length > 0;
        if (!temUrl && !temArquivo) return `Informe o link ou o arquivo: ${campo.nome}`;
        continue;
      }
      if (!(textos[campo.id] ?? '').trim()) return `Preencha: ${campo.nome}`;
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
      const valores: FormularioValorSubmit[] = campos
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
          tokenId: aberto.tokenId ?? tokenId,
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
              Nº da Franquia
              <input value={numero} onChange={(e) => setNumero(e.target.value)} required style={{ ...campoStyle, display: 'block', marginTop: 4 }} />
            </label>
            <label className="block text-sm" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
              Nome do Franqueado
              <input value={nome} onChange={(e) => setNome(e.target.value)} required style={{ ...campoStyle, display: 'block', marginTop: 4 }} />
            </label>
          </div>
        ) : null}

        {secaoAtual ? (
          <div className="space-y-4">
            <h2 className="text-lg" style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}>
              {secaoAtual.nome}
            </h2>
            {secaoAtual.campos.filter((campo) => visiveis.has(campo.id)).map((campo) => (
              <CampoPublico
                key={campo.id}
                campo={campo}
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

function CampoPublico({
  campo,
  texto,
  lista,
  arquivos,
  onTexto,
  onLista,
  onArquivos,
}: {
  campo: FormularioCampo;
  texto: string;
  lista: string[];
  arquivos: File[];
  onTexto: (valor: string) => void;
  onLista: (valor: string[]) => void;
  onArquivos: (valor: File[]) => void;
}) {
  const label = (
    <span className="mb-1 block text-sm" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
      {campo.nome}
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
  if (campo.tipo === 'select') {
    return (
      <label className="block">
        {label}
        <select value={texto} onChange={(e) => onTexto(e.target.value)} style={campoStyle}>
          <option value="">Selecione</option>
          {campo.opcoes.map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>
              {opcao.rotulo}
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
              const marcado = lista.includes(opcao.valor);
              return (
                <label key={opcao.valor} className="flex min-h-[44px] items-center gap-2 text-sm" style={{ fontFamily: 'var(--moni-font-sans)', color: 'var(--moni-text-primary)' }}>
                  <input
                    type="checkbox"
                    checked={marcado}
                    onChange={() =>
                      onLista(marcado ? lista.filter((item) => item !== opcao.valor) : [...lista, opcao.valor])
                    }
                  />
                  {opcao.rotulo}
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
