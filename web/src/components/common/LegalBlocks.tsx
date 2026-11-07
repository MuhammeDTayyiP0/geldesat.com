import { Fragment, type ReactNode } from "react";

type Block = { type: "p"; lines: string[] } | { type: "ul" | "ol"; items: string[] };

/** The light markup of legal pages: "- " and "1. " lists and paragraphs, line by line. */
export function legalBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const last = blocks[blocks.length - 1];
    if (!line) {
      blocks.push({ type: "p", lines: [] });
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.*)$/);
    const numbered = line.match(/^\d+\.\s+(.*)$/);
    if (bullet || numbered) {
      const type = bullet ? "ul" : "ol";
      const item = (bullet ?? numbered)![1];
      if (last?.type === type) last.items.push(item);
      else blocks.push({ type, items: [item] });
    } else if (last?.type === "p") last.lines.push(line);
    else blocks.push({ type: "p", lines: [line] });
  }
  return blocks.filter((b) => b.type !== "p" || b.lines.length);
}

/** E-mail addresses in the text become links. */
function withMailLinks(text: string): ReactNode {
  return text.split(/([\w.+-]+@[\w-]+\.[\w.-]*\w)/).map((part, i) =>
    i % 2 ? (
      <a key={i} href={`mailto:${part}`} className="text-primary hover:underline">
        {part}
      </a>
    ) : (
      part
    ),
  );
}

export function LegalBlocks({ text }: { text: string }) {
  return (
    <>
      {legalBlocks(text).map((block, i) =>
        block.type === "p" ? (
          <p key={i} className="my-3">
            {block.lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 ? <br /> : null}
                {withMailLinks(line)}
              </Fragment>
            ))}
          </p>
        ) : block.type === "ul" ? (
          <ul key={i} className="my-3 list-disc space-y-1 pl-5">
            {block.items.map((item, j) => (
              <li key={j}>{withMailLinks(item)}</li>
            ))}
          </ul>
        ) : (
          <ol key={i} className="my-3 list-decimal space-y-1 pl-5">
            {block.items.map((item, j) => (
              <li key={j}>{withMailLinks(item)}</li>
            ))}
          </ol>
        ),
      )}
    </>
  );
}
