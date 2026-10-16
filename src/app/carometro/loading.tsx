export default function CarometroLoading() {
  return (
    <main className="mx-auto w-full min-w-0 max-w-[1600px] px-6 py-8">
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-64 rounded-lg bg-stone-200" />
        <div className="h-10 w-full rounded-lg bg-stone-100" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 w-full rounded-lg bg-stone-100" />
        ))}
      </div>
      <p className="mt-6 text-center text-sm text-stone-400">Carregando Carômetro…</p>
    </main>
  );
}
