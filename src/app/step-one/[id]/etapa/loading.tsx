export default function EtapaLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="card animate-pulse">
        <div className="h-6 w-48 rounded bg-stone-200" />
        <div className="mt-4 h-4 w-full max-w-xl rounded bg-stone-100" />
        <div className="mt-6 space-y-4">
          <div className="h-10 w-full rounded-lg bg-stone-100" />
          <div className="h-32 w-full rounded-lg bg-stone-100" />
          <div className="h-10 w-32 rounded-lg bg-stone-100" />
        </div>
      </div>
    </div>
  );
}
