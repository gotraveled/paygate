import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm placeholder:text-zinc-400 focus-visible:outline-2 focus-visible:outline-zinc-900",
        className
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "flex h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-zinc-900",
        className
      )}
      {...props}
    />
  );
}
