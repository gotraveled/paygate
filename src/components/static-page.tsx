export function StaticPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{title}</h1>
      {updated && <p className="mt-2 text-xs text-zinc-500">Last updated: {updated}</p>}
      <div className="prose-sm mt-8 space-y-5 text-[15px] leading-7 text-zinc-700 [&_h2]:pt-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-zinc-900 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6 [&_a]:text-sky-700 [&_a]:underline">
        {children}
      </div>
    </main>
  );
}
