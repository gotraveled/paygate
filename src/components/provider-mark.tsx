import { cn } from "@/lib/utils";

/**
 * Deterministic brand mark for providers — used when no licensed logo is
 * available. A hashed hue + initials produce a consistent identity per
 * provider without implying an official logo. Always labeled as a text
 * treatment, never presented as the provider's trademark.
 */
const HUES = [217, 174, 262, 152, 24, 190, 330, 200];

function hash(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

export function ProviderMark({
  name,
  slug,
  size = "md",
  className,
}: {
  name: string;
  slug: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const hue = HUES[hash(slug) % HUES.length];
  const initials = name
    .split(/[\s&-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

  const dims =
    size === "lg" ? "h-14 w-14 text-lg" : size === "sm" ? "h-8 w-8 text-xs" : "h-11 w-11 text-sm";

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg font-bold tracking-tight text-white",
        dims,
        className
      )}
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 62% 38%), hsl(${(hue + 24) % 360} 58% 26%))`,
      }}
    >
      {initials}
    </span>
  );
}
