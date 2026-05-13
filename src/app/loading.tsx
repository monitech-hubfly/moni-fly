export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8" aria-label="Carregando">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-moni-primary border-t-transparent" />
        <p className="text-sm text-stone-500">Carregando...</p>
      </div>
    </div>
  );
}
