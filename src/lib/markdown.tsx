import React from "react";

/**
 * Minimal, safe markdown renderer for generated guide content.
 * Supports: ## / ### headings, paragraphs, - lists, **bold**.
 * Raw HTML is never rendered — everything is escaped by React.
 */
export function Markdown({ source }: { source: string }) {
  const blocks = source.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);

  return (
    <div className="space-y-4 text-[15px] leading-7 text-zinc-700">
      {blocks.map((block, i) => {
        if (block.startsWith("### ")) {
          return (
            <h3 key={i} className="pt-2 text-lg font-semibold text-zinc-900">
              {inline(block.slice(4))}
            </h3>
          );
        }
        if (block.startsWith("## ")) {
          return (
            <h2 key={i} className="pt-4 text-xl font-semibold text-zinc-900">
              {inline(block.slice(3))}
            </h2>
          );
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
        return <p key={i}>{inline(block)}</p>;
      })}
    </div>
  );
}

function inline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
}
