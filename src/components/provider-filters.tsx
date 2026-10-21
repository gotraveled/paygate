import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS, PROVIDER_CATEGORIES } from "@/lib/constants";

interface Props {
  q?: string;
  category?: string;
  country?: string;
  industry?: string;
  countries: { code: string; name: string }[];
  industries: { slug: string; name: string }[];
}

/** Server-rendered GET form — filters are plain query params for SEO/sharing. */
export function ProviderFilters({
  q,
  category,
  country,
  industry,
  countries,
  industries,
}: Props) {
  return (
    <form
      method="get"
      action="/providers"
      className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5"
    >
      <Input
        name="q"
        placeholder="Search providers…"
        defaultValue={q}
        aria-label="Search providers"
      />
      <Select name="category" defaultValue={category ?? ""} aria-label="Category">
        <option value="">All categories</option>
        {PROVIDER_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {CATEGORY_LABELS[c]}
          </option>
        ))}
      </Select>
      <Select name="country" defaultValue={country ?? ""} aria-label="Country">
        <option value="">All countries</option>
        {countries.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </Select>
      <Select name="industry" defaultValue={industry ?? ""} aria-label="Industry">
        <option value="">All industries</option>
        {industries.map((i) => (
          <option key={i.slug} value={i.slug}>
            {i.name}
          </option>
        ))}
      </Select>
      <Button type="submit">Filter</Button>
    </form>
  );
}
