'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileSearch, Loader2 } from 'lucide-react';
import { completarRedeFranqueadosDeDocumentos } from './actions';
import { redeBtnGhost } from './rede-ui';

export function CompletarCamposDocumentosButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  const executar = async () => {
    if (
      !window.confirm(
        'Ler os documentos anexados (COF, contrato e nº de franquia) e preencher campos vazios da tabela? Apenas dados do franqueado; corporação e responsável comercial não são alterados.',
      )
    ) {
      return;
    }
    setLoading(true);
    setMensagem(null);
    try {
      const r = await completarRedeFranqueadosDeDocumentos();
      if (!r.ok) {
        setMensagem({ tipo: 'erro', texto: r.error });
        return;
      }
      let texto = r.mensagem;
      if (r.detalhes.length > 0) {
        const amostra = r.detalhes
          .slice(0, 8)
          .map((d) => `${d.n_franquia}: ${d.campos.join(', ')}`)
          .join(' · ');
        texto += ` Ex.: ${amostra}${r.detalhes.length > 8 ? '…' : ''}`;
      }
      setMensagem({ tipo: 'sucesso', texto });
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => void executar()}
        disabled={loading}
        className={redeBtnGhost}
        title="Extrair dados dos PDFs anexados e preencher campos vazios"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}
        Completar de documentos
      </button>
      {mensagem ? (
        <p
          className={`absolute left-0 top-full z-20 mt-1 max-w-md whitespace-normal rounded-lg border px-3 py-2 text-xs shadow-sm ${
            mensagem.tipo === 'sucesso'
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
          role="status"
        >
          {mensagem.texto}
        </p>
      ) : null}
    </div>
  );
}
