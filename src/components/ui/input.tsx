import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm shadow-sm placeholder:text-zinc-400 transition-colors focus:border-brand-500 focus-visible:outline-2 focus-visible:outline-brand-600",
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
        "flex h-10 w-full appearance-none rounded-lg border border-zinc-300 bg-white bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2371717a%22 stroke-width=%222%22%3E%3Cpath d=%22m6 9 6 6 6-6%22/%3E%3C/svg%3E')] bg-[right_0.75rem_center] bg-no-repeat px-3 pr-9 text-sm shadow-sm transition-colors focus:border-brand-500 focus-visible:outline-2 focus-visible:outline-brand-600",
        className
      )}
      {...props}
    />
  );
}
