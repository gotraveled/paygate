import { Badge } from "@/components/ui/badge";
import {
  STATUS_LABELS,
  INDUSTRY_STATUS_LABELS,
  type SupportStatus,
  type IndustryStatus,
} from "@/lib/constants";

const STATUS_VARIANT: Record<string, "success" | "danger" | "warning" | "info" | "muted" | "secondary"> = {
  supported: "success",
  not_supported: "danger",
  prohibited: "danger",
  conditional: "warning",
  restricted: "warning",
  conflicting: "warning",
  undisclosed: "muted",
  unverified: "muted",
  outdated: "secondary",
};

export function StatusBadge({ status }: { status: SupportStatus | IndustryStatus | string }) {
  const label =
    (STATUS_LABELS as Record<string, string>)[status] ??
    (INDUSTRY_STATUS_LABELS as Record<string, string>)[status] ??
    status;
  return <Badge variant={STATUS_VARIANT[status] ?? "muted"}>{label}</Badge>;
}
