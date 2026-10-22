import { SITE_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * PayGate wordmark — an abstract "gate" made of two payment lanes
 * converging through a checkpoint node. Pure SVG, no assets.
 */
export function Logo({
  className,
  dark = false,
}: {
  className?: string;
  dark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg
        width="26"
        height="26"
        viewBox="0 0 28 28"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect
          x="1.5"
          y="1.5"
          width="25"
          height="25"
          rx="6.5"
          className={dark ? "fill-white/10" : "fill-ink-900"}
        />
        {/* two lanes converging through the checkpoint */}
        <path
          d="M5 9.5h7l4.5 4.5"
          stroke={dark ? "#93e8d0" : "#57d4b6"}
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M5 18.5h7l4.5-4.5"
          stroke={dark ? "#6397f7" : "#3d72f0"}
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="19.5" cy="14" r="2.6" className="fill-brand-400" />
        <circle
          cx="19.5"
          cy="14"
          r="4.6"
          stroke={dark ? "#c9f4e6" : "#93e8d0"}
          strokeWidth="1.2"
          fill="none"
          opacity="0.6"
        />
      </svg>
      <span
        className={cn(
          "text-[17px] font-bold tracking-tight",
          dark ? "text-white" : "text-ink-950"
        )}
      >
        {SITE_NAME}
        <span className={dark ? "text-mint-300" : "text-brand-600"}>.</span>
      </span>
    </span>
  );
}
