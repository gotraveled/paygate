import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-brand-600 text-white shadow-sm hover:bg-brand-700 hover:shadow-md",
        navy: "bg-ink-900 text-white hover:bg-ink-800",
        secondary: "bg-zinc-100 text-zinc-900 hover:bg-zinc-200",
        outline:
          "border border-zinc-300 bg-white text-zinc-800 hover:border-brand-400 hover:text-brand-700",
        ghost: "text-zinc-700 hover:bg-zinc-100 hover:text-ink-900",
        link: "text-brand-700 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export function Button({
  className,
  variant,
  size,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
