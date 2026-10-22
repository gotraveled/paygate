import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-transparent bg-ink-900 text-ink-50",
        secondary: "border-transparent bg-zinc-100 text-zinc-700",
        outline: "border-zinc-300 text-zinc-700",
        success: "border-mint-200 bg-mint-50 text-mint-800",
        warning: "border-warm-200 bg-warm-50 text-warm-800",
        danger: "border-red-200 bg-red-50 text-red-800",
        info: "border-brand-200 bg-brand-50 text-brand-800",
        muted: "border-zinc-200 bg-zinc-50 text-zinc-500",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
