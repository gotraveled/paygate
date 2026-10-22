import React from "react";

/**
 * Minimal, safe markdown renderer for generated guide content.
 * Supports: ## / ### headings, paragraphs, - lists, 1. numbered lists,
 * | pipe tables |, > callouts, **bold**, and [text](url) links.
 * Raw HTML is never rendered — everything is escaped by React.
 */

function slugify(h: string): string {
  return h.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
}

export function Markdown({ source }: { source: string }) {
  const blocks = source.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);

  return (
    <div className="space-y-4 text-[15px] leading-7 text-zinc-700">
      {blocks.map((block, i) => {
        if (block.startsWith("### ")) {
          const t = block.slice(4);
          return (
            <h3 key={i} id={slugify(t)} className="scroll-mt-24 pt-2 text-lg font-semibold tracking-tight text-ink-950">
              {inline(t)}
            </h3>
          );
        }
        if (block.startsWith("## ")) {
          const t = block.slice(3);
          return (
            <h2 key={i} id={slugify(t)} className="scroll-mt-24 pt-5 text-[22px] font-bold tracking-tight text-ink-950">
              <span className="mr-2.5 inline-block h-4 w-1 rounded-full bg-brand-600 align-baseline" aria-hidden="true" />
              {inline(t)}
            </h2>
          );
        }
        if (block.split("\n").every((l) => l.trimStart().startsWith("> "))) {
          return (
            <blockquote key={i} className="rounded-r-lg border-l-4 border-warm-300 bg-warm-50 px-4 py-2.5 text-[14px] text-warm-900">
              {block.split("\n").map((l, j) => (
                <p key={j}>{inline(l.trimStart().slice(2))}</p>
              ))}
            </blockquote>
          );
        }
        if (block.includes("\n") && block.split("\n").every((l) => l.includes("|"))) {
          const rows = block.split("\n").filter((l) => !/^\s*\|?[\s\-|]+\|?\s*$/.test(l));
          const cells = rows.map((r) => r.split("|").map((c) => c.trim()).filter(Boolean));
          if (cells.length > 1) {
            const [head, ...body] = cells;
            return (
              <div key={i} className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
                <table className="w-full border-collapse text-[14px]">
                  <thead>
                    <tr className="bg-zinc-50">
                      {head.map((c, j) => (
                        <th key={j} className="border-b border-zinc-200 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          {inline(c)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {body.map((r, j) => (
                      <tr key={j} className="last:[&>td]:border-0">
                        {r.map((c, k) => (
                          <td key={k} className="border-b border-zinc-100 px-4 py-2.5 align-top">
                            {inline(c)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
        }
        if (block.split("\n").every((l) => l.trimStart().startsWith("- "))) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-6">
              {block.split("\n").map((l, j) => (
                <li key={j}>{inline(l.trimStart().slice(2))}</li>
              ))}
            </ul>
          );
        }
        if (block.split("\n").every((l) => /^\d+\.\s/.test(l.trimStart()))) {
          return (
            <ol key={i} className="list-decimal space-y-1 pl-6">
              {block.split("\n").map((l, j) => (
                <li key={j}>{inline(l.trimStart().replace(/^\d+\.\s/, ""))}</li>
              ))}
            </ol>
          );
        }
        return <p key={i}>{inline(block)}</p>;
      })}
    </div>
  );
}

function inline(text: string): React.ReactNode {
  // Order matters: links, then bold (**), then italic (*) — single-star
  // emphasis must be tried after bold or "**" gets consumed first.
  const parts = text.split(
    /(\[[^\]]*\]\([^)\s]+\)|\*\*[^*]+\*\*|\*[^*]+\*)/g
  );
  return parts.map((part, i) => {
    const link = part.match(/^\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (link) {
      const external = /^https?:/.test(link[2]);
      return (
        <a
          key={i}
          href={link[2]}
          className="font-medium text-brand-700 underline decoration-brand-300 underline-offset-2 transition-colors hover:text-brand-800 hover:decoration-brand-500"
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {link[1]}
        </a>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}
