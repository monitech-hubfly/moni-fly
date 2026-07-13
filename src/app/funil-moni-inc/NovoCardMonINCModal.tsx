'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { criarCard } from '@/lib/actions/card-actions';
import { KANBAN_NOME_FUNIL_LOTEADORES } from '@/lib/kanban/funil-loteadores';

export function NovoCardMonINCModal({
  faseId,
  kanbanId: _kanbanId,
  isAdmin: _isAdmin,
  basePath = '/funil-moni-inc',
  onClose,
}: {
  faseId: string;
  kanbanId: string;
  isAdmin: boolean;
  basePath?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [nomeParceiro, setNomeParceiro] = useState('');
  const [nomeCondominio, setNomeCondominio] = useState('');
  const [quadra, setQuadra] = useState('');
  const [lote, setLote] = useState('');
  const [tituloPreview, setTituloPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    // Título segue o padrão do cadastro: Loteador - Condomínio (contato entra após vincular o cadastro).
    const partes = [nomeParceiro.trim(), nomeCondominio.trim()].filter(Boolean);
    setTituloPreview(partes.join(' - '));
  }, [nomeParceiro, nomeCondominio]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const parceiro = nomeParceiro.trim();
    if (!parceiro) {
      setErro('Informe o nome do parceiro / loteador.');
      return;
    }
    if (!faseId) {
      setErro('Fase inicial não configurada. Recarregue após aplicar a migration.');
      return;
    }

    const titulo =
      tituloPreview.trim() || [parceiro, nomeCondominio.trim()].filter(Boolean).join(' - ');

    setLoading(true);
    try {
      const res = await criarCard({
        titulo,
        kanban_nome: KANBAN_NOME_FUNIL_LOTEADORES,
        fase_id: faseId,
        basePath,
        nomeLoteador: parceiro,
        nomeCondominio: nomeCondominio.trim() || undefined,
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
    'mt-1 w-full px-4 py-2 text-sm disabled:bg-stone-50 focus:outline-none';
  const inputStyle = {
    border: '0.5px solid var(--moni-border-default)',
    borderRadius: 'var(--moni-radius-md)',
    color: 'var(--moni-text-primary)',
  } as const;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative w-full overflow-hidden bg-white"
        style={{
          maxWidth: '500px',
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
          className="flex items-center justify-between border-b bg-white px-6 py-4"
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

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label
              htmlFor="nome-parceiro-moni-inc"
              className="block text-sm font-medium"
              style={{ color: 'var(--moni-text-primary)' }}
            >
              Parceiro / loteador <span className="text-red-500">*</span>
            </label>
            <input
              id="nome-parceiro-moni-inc"
              type="text"
              value={nomeParceiro}
              onChange={(e) => setNomeParceiro(e.target.value)}
              required
              disabled={loading}
              autoFocus
              className={inputCls}
              style={inputStyle}
              placeholder="Nome do parceiro ou loteador"
            />
          </div>

          <div>
            <label
              htmlFor="nome-condominio-moni-inc"
              className="block text-sm font-medium"
              style={{ color: 'var(--moni-text-primary)' }}
            >
              Nome do Condomínio{' '}
              <span className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                (opcional)
              </span>
            </label>
            <input
              id="nome-condominio-moni-inc"
              type="text"
              value={nomeCondominio}
              onChange={(e) => setNomeCondominio(e.target.value)}
              disabled={loading}
              className={inputCls}
              style={inputStyle}
              placeholder="Ex: Residencial Alphaville"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="quadra-moni-inc"
                className="block text-sm font-medium"
                style={{ color: 'var(--moni-text-primary)' }}
              >
                Quadra{' '}
                <span className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                  (opcional)
                </span>
              </label>
              <input
                id="quadra-moni-inc"
                type="text"
                value={quadra}
                onChange={(e) => setQuadra(e.target.value)}
                disabled={loading}
                className={inputCls}
                style={inputStyle}
                placeholder="Ex: A"
              />
            </div>
            <div>
              <label
                htmlFor="lote-moni-inc"
                className="block text-sm font-medium"
                style={{ color: 'var(--moni-text-primary)' }}
              >
                Lote{' '}
                <span className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                  (opcional)
                </span>
              </label>
              <input
                id="lote-moni-inc"
                type="text"
                value={lote}
                onChange={(e) => setLote(e.target.value)}
                disabled={loading}
                className={inputCls}
                style={inputStyle}
                placeholder="Ex: 12"
              />
            </div>
          </div>

          {tituloPreview ? (
            <div
              className="rounded-lg p-4"
              style={{
                background: 'var(--moni-surface-50)',
                border: '0.5px solid var(--moni-border-default)',
                borderRadius: 'var(--moni-radius-md)',
              }}
            >
              <p className="text-xs font-medium" style={{ color: 'var(--moni-text-tertiary)' }}>
                Título do card
              </p>
              <p className="mt-1 text-sm font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                {tituloPreview}
              </p>
            </div>
          ) : null}

          {erro ? (
            <p className="text-sm text-red-600" role="alert">
              {erro}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
              style={{ minHeight: '44px' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !nomeParceiro.trim()}
              className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              style={{ background: 'var(--moni-navy-800)', minHeight: '44px' }}
            >
              {loading ? 'Salvando…' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
