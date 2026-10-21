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
            <h3 key={i} id={slugify(t)} className="scroll-mt-20 pt-2 text-lg font-semibold text-zinc-900">
              {inline(t)}
            </h3>
          );
        }
        if (block.startsWith("## ")) {
          const t = block.slice(3);
          return (
            <h2 key={i} id={slugify(t)} className="scroll-mt-20 pt-4 text-xl font-semibold text-zinc-900">
              {inline(t)}
            </h2>
          );
        }
        if (block.split("\n").every((l) => l.trimStart().startsWith("> "))) {
          return (
            <blockquote key={i} className="rounded-r-md border-l-4 border-amber-300 bg-amber-50 px-4 py-2 text-[14px] text-zinc-700">
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
              <div key={i} className="overflow-x-auto">
                <table className="w-full border-collapse text-[14px]">
                  <thead>
                    <tr>
                      {head.map((c, j) => (
                        <th key={j} className="border-b border-zinc-200 px-3 py-2 text-left font-semibold text-zinc-900">
                          {inline(c)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {body.map((r, j) => (
                      <tr key={j}>
                        {r.map((c, k) => (
                          <td key={k} className="border-b border-zinc-100 px-3 py-2 align-top">
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
  const parts = text.split(/(\[[^\]]*\]\([^)\s]+\)|\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const link = part.match(/^\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (link) {
      const external = /^https?:/.test(link[2]);
      return (
        <a
          key={i}
          href={link[2]}
          className="text-blue-700 underline decoration-blue-300 underline-offset-2 hover:decoration-blue-600"
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {link[1]}
        </a>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}
