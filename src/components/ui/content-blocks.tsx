/**
 * Renderizador minimalista e SEGURO de markdown (sem dangerouslySetInnerHTML e
 * sem dependências): recebe texto com headings/listas/páragrafos e gera
 * elementos React. O conteúdo é editado no admin por equipe interna.
 */
function inline(text: string): string {
  // Não permite HTML cru: o texto é tratado como puro (escape implícito pelo React).
  return text;
}

interface Block {
  kind: "h2" | "h3" | "ul" | "p";
  lines: string[];
}

function parse(markdown: string): Block[] {
  const blocks: Block[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let current: Block | null = null;

  const push = () => {
    if (current && current.lines.length) blocks.push(current);
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      push();
      current = null;
      continue;
    }
    if (line.startsWith("## ")) {
      push();
      current = { kind: "h2", lines: [inline(line.slice(3))] };
    } else if (line.startsWith("### ")) {
      push();
      current = { kind: "h3", lines: [inline(line.slice(4))] };
    } else if (line.startsWith("- ")) {
      if (current?.kind !== "ul") {
        push();
        current = { kind: "ul", lines: [] };
      }
      current.lines.push(inline(line.slice(2)));
    } else {
      if (current?.kind !== "p") {
        push();
        current = { kind: "p", lines: [] };
      }
      current.lines.push(inline(line));
    }
  }
  push();
  return blocks;
}

export function ContentBlocks({ markdown }: { markdown: string }) {
  const blocks = parse(markdown);

  return (
    <div className="max-w-[65ch] text-[15px] leading-relaxed text-stone-700">
      {blocks.map((b, i) => {
        if (b.kind === "h2")
          return (
            <h2 key={i} className="mt-10 font-serif text-2xl text-ink first:mt-0">
              {b.lines[0]}
            </h2>
          );
        if (b.kind === "h3")
          return (
            <h3 key={i} className="mt-8 text-lg font-semibold text-ink">
              {b.lines[0]}
            </h3>
          );
        if (b.kind === "ul")
          return (
            <ul key={i} className="mt-4 list-disc space-y-1.5 pl-5">
              {b.lines.map((li, j) => (
                <li key={j}>{li}</li>
              ))}
            </ul>
          );
        return (
          <p key={i} className="mt-4">
            {b.lines.join(" ")}
          </p>
        );
      })}
    </div>
  );
}
