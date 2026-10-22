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
    <main>
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 pb-7 pt-10">
          <h1 className="text-[28px] font-bold tracking-tight text-ink-950">{title}</h1>
          {updated && (
            <p className="mt-2 text-xs text-zinc-500">Last updated: {updated}</p>
          )}
        </div>
      </div>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="space-y-5 text-[15px] leading-7 text-zinc-700 [&_h2]:pt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-ink-950 [&_h3]:pt-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-ink-950 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-6 [&_a]:font-medium [&_a]:text-brand-700 [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-brand-800 [&_strong]:font-semibold [&_strong]:text-ink-950">
          {children}
        </div>
      </div>
    </main>
  );
}
