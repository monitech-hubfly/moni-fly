'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { GerarLinkFormularioButton } from '@/components/formularios/GerarLinkFormularioButton';
import { FormularioClassificacaoBarra } from '@/components/formularios/FormularioClassificacaoBarra';
import type { CategoriaHub } from '@/lib/constants/categorias-hub';

export type FormularioCatalogoItem = {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: CategoriaHub | null;
  visivel_franqueado: boolean;
};

export type FormularioCatalogoGrupo = {
  nome: string;
  itens: FormularioCatalogoItem[];
};

const TODAS = 'todas';

function filtraItens(itens: FormularioCatalogoItem[], busca: string) {
  const termo = busca.trim().toLowerCase();
  if (!termo) return itens;
  return itens.filter((item) => {
    const nome = item.nome.toLowerCase();
    const descricao = (item.descricao ?? '').toLowerCase();
    return nome.includes(termo) || descricao.includes(termo);
  });
}

function rotuloQuantidade(total: number) {
  return total === 1 ? '1 formulário' : `${total} formulários`;
}

function idCategoria(nome: string) {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function FormularioCard({ formulario }: { formulario: FormularioCatalogoItem }) {
  return (
    <li
      className="flex h-full flex-col gap-3 p-4 sm:p-5"
      style={{
        background: 'var(--moni-surface-0)',
        border: 'var(--moni-border-width) solid var(--moni-border-default)',
        borderRadius: 'var(--moni-radius-lg)',
        boxShadow: 'var(--moni-shadow-card)',
      }}
    >
      <div className="min-w-0 flex-1">
        <Link
          href={`/formularios/${formulario.id}`}
          className="text-sm font-semibold leading-snug"
          style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' }}
        >
          {formulario.nome}
        </Link>
        {formulario.descricao ? (
          <p className="mt-2 line-clamp-3 text-xs leading-relaxed" style={{ color: 'var(--moni-text-secondary)' }}>
            {formulario.descricao}
          </p>
        ) : null}
      </div>
      <FormularioClassificacaoBarra
        formularioId={formulario.id}
        categoria={formulario.categoria}
        visivelFranqueado={formulario.visivel_franqueado}
      />
      <div className="mt-auto flex flex-wrap gap-2">
        <Link
          href={`/formularios/${formulario.id}`}
          className="inline-flex min-h-[44px] min-w-[8.5rem] flex-1 items-center justify-center px-3 font-semibold"
          style={{
            borderRadius: 'var(--moni-radius-md)',
            border: 'var(--moni-border-width) solid var(--moni-border-default)',
            color: 'var(--moni-text-primary)',
            background: 'var(--moni-surface-0)',
            fontFamily: 'var(--moni-font-sans)',
            fontSize: 13,
          }}
        >
          Ver respostas
        </Link>
        <div className="min-w-[8.5rem] flex-1 [&_button]:w-full">
          <GerarLinkFormularioButton formularioId={formulario.id} />
        </div>
      </div>
    </li>
  );
}

function mensagemVazia(busca: string, categoria: string) {
  if (busca.trim()) return 'Nenhum formulário encontrado para essa busca.';
  if (categoria === TODAS) return 'Nenhum formulário cadastrado.';
  return 'Nenhum formulário nesta categoria.';
}

export function FormulariosCatalogo({ grupos }: { grupos: FormularioCatalogoGrupo[] }) {
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState<string>(TODAS);

  const totalCadastrado = grupos.reduce((soma, grupo) => soma + grupo.itens.length, 0);
  const categoriasComFormulario = grupos.filter((grupo) => grupo.itens.length > 0).length;

  const gruposFiltrados = useMemo(
    () =>
      grupos.map((grupo) => ({
        nome: grupo.nome,
        itens: filtraItens(grupo.itens, busca),
      })),
    [grupos, busca],
  );

  const totalOriginal = new Map(grupos.map((grupo) => [grupo.nome, grupo.itens.length]));
  const comItens = gruposFiltrados.filter((grupo) => (totalOriginal.get(grupo.nome) ?? 0) > 0);
  const semItens = gruposFiltrados.filter((grupo) => (totalOriginal.get(grupo.nome) ?? 0) === 0);
  const totalVisivel = gruposFiltrados.reduce((soma, grupo) => soma + grupo.itens.length, 0);

  const gruposNaGrade =
    categoria === TODAS
      ? comItens.filter((grupo) => grupo.itens.length > 0)
      : gruposFiltrados.filter((grupo) => grupo.nome === categoria);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8" style={{ fontFamily: 'var(--moni-font-sans)' }}>
      <header>
        <h1 className="text-3xl" style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}>
          Formulários
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: 'var(--moni-text-secondary)' }}>
          Cada formulário tem um link público fixo. Quem recebe pode responder mais de uma vez, e cada envio fica registrado.
        </p>
        <p className="mt-3 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
          {rotuloQuantidade(totalCadastrado)}
          {categoriasComFormulario > 0
            ? ` · ${categoriasComFormulario === 1 ? '1 categoria' : `${categoriasComFormulario} categorias`}`
            : ''}
        </p>
      </header>

      <div
        className="sticky top-0 z-10 -mx-4 mt-6 space-y-3 px-4 pb-4 pt-3"
        style={{
          background: 'var(--moni-surface-50)',
          borderBottom: 'var(--moni-border-width) solid var(--moni-border-default)',
        }}
      >
        <div className="relative max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            aria-hidden
            style={{ color: 'var(--moni-text-tertiary)' }}
          />
          <input
            type="search"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar por nome ou descrição"
            aria-label="Buscar formulário"
            className="w-full pl-9 pr-3 text-sm"
            style={{
              minHeight: 44,
              borderRadius: 'var(--moni-radius-md)',
              border: 'var(--moni-border-width) solid var(--moni-border-default)',
              background: 'var(--moni-surface-0)',
              color: 'var(--moni-text-primary)',
              fontFamily: 'var(--moni-font-sans)',
            }}
          />
        </div>

        <div className="space-y-2">
          <div
            className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0"
            role="group"
            aria-label="Categorias"
          >
            <CategoriaChip
              nome="Todas"
              total={totalVisivel}
              ativo={categoria === TODAS}
              onClick={() => setCategoria(TODAS)}
            />
            {comItens.map((grupo) => (
              <CategoriaChip
                key={grupo.nome}
                nome={grupo.nome}
                total={grupo.itens.length}
                ativo={categoria === grupo.nome}
                onClick={() => setCategoria(grupo.nome)}
              />
            ))}
          </div>
          {semItens.length > 0 ? (
            <details>
              <summary
                className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 px-3 text-sm [&::-webkit-details-marker]:hidden"
                style={{
                  borderRadius: 'var(--moni-radius-md)',
                  color: 'var(--moni-text-tertiary)',
                  fontFamily: 'var(--moni-font-sans)',
                }}
              >
                Categorias sem formulário
                <span className="text-xs tabular-nums">{semItens.length}</span>
              </summary>
              <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Categorias sem formulário">
                {semItens.map((grupo) => (
                  <CategoriaChip
                    key={grupo.nome}
                    nome={grupo.nome}
                    total={0}
                    ativo={categoria === grupo.nome}
                    vazio
                    onClick={() => setCategoria(grupo.nome)}
                  />
                ))}
              </div>
            </details>
          ) : null}
        </div>
      </div>

      {gruposNaGrade.length === 0 || gruposNaGrade.every((grupo) => grupo.itens.length === 0) ? (
        <div className="mt-8">
          {categoria !== TODAS ? (
            <h2 className="text-2xl" style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}>
              {categoria}
            </h2>
          ) : null}
          <p
            className="mt-4 px-6 py-16 text-center text-sm"
            style={{
              color: 'var(--moni-text-secondary)',
              background: 'var(--moni-surface-0)',
              border: 'var(--moni-border-width) solid var(--moni-border-default)',
              borderRadius: 'var(--moni-radius-lg)',
            }}
          >
            {mensagemVazia(busca, categoria)}
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          {gruposNaGrade.map((grupo) =>
            grupo.itens.length === 0 ? null : (
              <section key={grupo.nome} aria-labelledby={`categoria-${idCategoria(grupo.nome)}`}>
                <div
                  className="mb-4 flex items-baseline justify-between gap-3 pb-2"
                  style={{ borderBottom: 'var(--moni-border-width) solid var(--moni-border-default)' }}
                >
                  <h2
                    id={`categoria-${idCategoria(grupo.nome)}`}
                    className="text-2xl"
                    style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
                  >
                    {grupo.nome}
                  </h2>
                  <p className="shrink-0 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                    {rotuloQuantidade(grupo.itens.length)}
                  </p>
                </div>
                <ul
                  className={`grid grid-cols-1 gap-4 ${grupo.itens.length > 1 ? 'lg:grid-cols-2' : 'max-w-xl'}`}
                >
                  {grupo.itens.map((formulario) => (
                    <FormularioCard key={formulario.id} formulario={formulario} />
                  ))}
                </ul>
              </section>
            ),
          )}
        </div>
      )}
    </main>
  );
}

function CategoriaChip({
  nome,
  total,
  ativo,
  vazio = false,
  onClick,
}: {
  nome: string;
  total: number;
  ativo: boolean;
  vazio?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className="inline-flex min-h-[44px] shrink-0 items-center gap-2 px-3 text-sm"
      style={{
        borderRadius: 'var(--moni-radius-md)',
        fontFamily: 'var(--moni-font-sans)',
        background: ativo ? 'var(--moni-navy-800)' : 'var(--moni-surface-0)',
        color: ativo ? 'white' : vazio ? 'var(--moni-text-tertiary)' : 'var(--moni-text-primary)',
        border: `var(--moni-border-width) solid ${ativo ? 'var(--moni-navy-800)' : 'var(--moni-border-default)'}`,
      }}
    >
      <span>{nome}</span>
      <span
        className="text-xs tabular-nums"
        style={{ color: ativo ? 'color-mix(in srgb, white 72%, transparent)' : 'var(--moni-text-tertiary)' }}
      >
        {total}
      </span>
    </button>
  );
}
