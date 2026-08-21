'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Loader2, Upload, RefreshCw } from 'lucide-react';
import { atualizarRedeFranqueadosCSV, importarRedeFranqueadosCSV } from './actions';
import { redeAlertError, redeAlertSuccess, redeBtnGhost, redeBtnPrimary } from './rede-ui';

type ModoImport = 'inserir' | 'atualizar';

export function ImportarRedeCSVButton() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const modoRef = useRef<ModoImport>('inserir');
  const [loadingModo, setLoadingModo] = useState<ModoImport | null>(null);
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  const abrirArquivo = (modo: ModoImport) => {
    modoRef.current = modo;
    fileRef.current?.click();
  };

  const importFile = async (file: File) => {
    setMensagem(null);
    const modo = modoRef.current;
    setLoadingModo(modo);
    try {
      const text = await file.text();
      const result =
        modo === 'atualizar'
          ? await atualizarRedeFranqueadosCSV(text)
          : await importarRedeFranqueadosCSV(text);
      if (result.ok) {
        setMensagem({ tipo: 'sucesso', texto: result.mensagem });
        router.refresh();
      } else {
        setMensagem({ tipo: 'erro', texto: result.error });
      }
    } finally {
      setLoadingModo(null);
    }
  };

  return (
    <>
      <div className="flex shrink-0 items-center gap-2">
        <a href="/templates/rede-franqueados-template.csv" download className={redeBtnGhost}>
          <Download className="h-4 w-4" />
          Template CSV
        </a>
        <button
          type="button"
          onClick={() => abrirArquivo('inserir')}
          disabled={loadingModo !== null}
          className={redeBtnPrimary}
          title="Adiciona linhas novas e pode criar cards no Step 1"
        >
          {loadingModo === 'inserir' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Importando…
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Importar CSV
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => abrirArquivo('atualizar')}
          disabled={loadingModo !== null}
          className={redeBtnGhost}
          title="Atualiza linhas pelo Nº de Franquia; células vazias não apagam dados"
        >
          {loadingModo === 'atualizar' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Atualizando…
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Atualizar CSV
            </>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            void importFile(file);
          }}
        />
      </div>

      {mensagem ? (
        <div
          className={`absolute right-0 top-full z-20 mt-2 min-w-[16rem] max-w-lg shadow-md ${mensagem.tipo === 'sucesso' ? redeAlertSuccess : redeAlertError}`}
          role="status"
        >
          {mensagem.texto}
        </div>
      ) : null}
    </>
  );
}
