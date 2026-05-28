import {
  isRedeDocSlotCompleto,
  REDE_DOCS_FRANQUIA_SLOTS,
  REDE_SECAO_DOCS_EMPRESAS,
  REDE_SECAO_DOCS_FRANQUEADO,
  REDE_SECAO_DOCS_FRANQUIA,
} from '@/lib/rede-documentos-franquia';

type Props = {
  pathCof: string | null;
  pathContrato: string | null;
  pathNumeroFranquia: string | null;
  justificativaCof: string | null;
  justificativaContrato: string | null;
  justificativaNumeroFranquia: string | null;
};

function DocsSecao({
  titulo,
  children,
  vazio,
}: {
  titulo: string;
  children?: React.ReactNode;
  vazio?: boolean;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="border-b border-stone-100 pb-2 text-base font-semibold text-stone-900">{titulo}</h2>
      {vazio ? (
        <p className="text-sm text-stone-500">Nenhum documento padrão cadastrado nesta seção ainda.</p>
      ) : (
        children
      )}
    </section>
  );
}

function DocStatus({
  titulo,
  path,
  justificativa,
}: {
  titulo: string;
  path: string | null;
  justificativa: string | null;
}) {
  const completo = isRedeDocSlotCompleto(path, justificativa);
  return (
    <div className="rounded-lg border border-stone-100 bg-stone-50/50 p-3">
      <h3 className="text-sm font-semibold text-stone-800">{titulo}</h3>
      {path ? (
        <p className="mt-1 text-sm text-stone-700">Arquivo cadastrado.</p>
      ) : justificativa ? (
        <p className="mt-1 text-sm text-stone-700">Ausência justificada pela equipe.</p>
      ) : (
        <p className="mt-1 text-sm text-amber-800">Pendente (sem arquivo nem justificativa).</p>
      )}
      {!completo ? (
        <p className="mt-1 text-[11px] text-stone-500">Este item conta como cadastro incompleto na visão interna.</p>
      ) : null}
    </div>
  );
}

/** Visão somente leitura para o franqueado (portal). */
export function RedeFranqueadoDetalheDocsFranqueado({
  pathCof,
  pathContrato,
  pathNumeroFranquia,
  justificativaCof,
  justificativaContrato,
  justificativaNumeroFranquia,
}: Props) {
  const slots = [
    { slot: REDE_DOCS_FRANQUIA_SLOTS[0], path: pathCof, justificativa: justificativaCof },
    { slot: REDE_DOCS_FRANQUIA_SLOTS[1], path: pathContrato, justificativa: justificativaContrato },
    { slot: REDE_DOCS_FRANQUIA_SLOTS[2], path: pathNumeroFranquia, justificativa: justificativaNumeroFranquia },
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-stone-600">
        Os documentos assinados ficam armazenados pela equipe Moni. Você vê apenas se já há arquivo ou justificativa
        registrada; o download fica restrito ao time interno.
      </p>

      <DocsSecao titulo={REDE_SECAO_DOCS_FRANQUEADO.titulo} vazio />

      <DocsSecao titulo={REDE_SECAO_DOCS_FRANQUIA.titulo}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {slots.map(({ slot, path, justificativa }) => (
            <DocStatus key={slot.tipo} titulo={slot.titulo} path={path} justificativa={justificativa} />
          ))}
        </div>
      </DocsSecao>

      <DocsSecao titulo={REDE_SECAO_DOCS_EMPRESAS.titulo} vazio />
    </div>
  );
}
