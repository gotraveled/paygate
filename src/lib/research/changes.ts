import { db } from "@/lib/db";
import { SIGNIFICANT_FIELDS } from "@/lib/constants";

/**
 * Change detection. Compares a freshly extracted value with the stored value
 * and records a ChangeEvent. Low-risk fields may auto-apply; commercially
 * significant fields always route to review.
 */

export interface FieldDiff {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export function diffValues(
  field: string,
  oldValue: unknown,
  newValue: unknown
): FieldDiff | null {
  const a = JSON.stringify(oldValue ?? null);
  const b = JSON.stringify(newValue ?? null);
  if (a === b) return null;
  return { field, oldValue, newValue };
}

export function severityFor(field: string): "low" | "significant" {
  return SIGNIFICANT_FIELDS.has(field) ||
    [...SIGNIFICANT_FIELDS].some((f) => field.startsWith(f))
    ? "significant"
    : "low";
}

/**
 * Record a detected change. `autoApply` is allowed only for low-severity
 * fields with clear evidence; everything else becomes needs_review and gets a
 * ReviewItem so nothing significant goes live unchecked.
 */
export async function recordChange(opts: {
  providerId?: string;
  diff: FieldDiff;
  evidenceClear: boolean;
  notes?: string;
}) {
  const severity = severityFor(opts.diff.field);
  const autoApply = severity === "low" && opts.evidenceClear;

  const change = await db.changeEvent.create({
    data: {
      providerId: opts.providerId,
      field: opts.diff.field,
      oldValue: opts.diff.oldValue === undefined ? undefined : JSON.parse(JSON.stringify(opts.diff.oldValue)),
      newValue: opts.diff.newValue === undefined ? undefined : JSON.parse(JSON.stringify(opts.diff.newValue)),
      severity,
      status: autoApply ? "auto_applied" : "needs_review",
      notes: opts.notes,
    },
  });

  if (!autoApply) {
    await db.reviewItem.create({
      data: {
        entity: "change_event",
        entityId: change.id,
        reason: `${severity} change on ${opts.diff.field}: ${JSON.stringify(opts.diff.oldValue)} -> ${JSON.stringify(opts.diff.newValue)}`,
      },
    });
  }

  // Any published page derived from this provider's facts is now stale —
  // demote it so the public never sees outdated claims as current.
  if (opts.providerId) {
    await db.contentPage.updateMany({
      where: { providerId: opts.providerId, status: "published" },
      data: { status: "update_required" },
    });
  }

  return { change, applied: autoApply };
}

/** Mark a provider's stored field value after an applied/reviewed change. */
export async function applyChangeToProvider(
  providerId: string,
  field: string,
  newValue: unknown
) {
  // Only whitelisted JSON-ish fields may be written automatically.
  const WRITABLE = new Set([
    "summary",
    "suitableFor",
    "paymentTypes",
    "registrationRequirement",
    "ownerResidency",
    "limitations",
  ]);
  if (!WRITABLE.has(field)) return false;
  await db.provider.update({
    where: { id: providerId },
    data: { [field]: newValue } as Record<string, unknown>,
  });
  return true;
}
