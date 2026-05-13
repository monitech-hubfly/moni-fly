export default function SireneLoading() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 rounded bg-stone-700" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-stone-700/60" />
          ))}
        </div>
        <div className="h-64 rounded-xl bg-stone-700/40" />
        <div className="h-32 rounded-xl bg-stone-700/40" />
      </div>
      <p className="mt-6 text-center text-sm text-stone-500">Carregando Sirene…</p>
    </main>
  );
}
