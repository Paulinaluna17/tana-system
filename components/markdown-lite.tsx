/**
 * Markdown mínimo y seguro (sin HTML): ### títulos, **negrita**, listas con "- " y párrafos.
 */
function inline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>,
  );
}

export function MarkdownLite({ text }: { text: string }) {
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      out.push(
        <ul key={`l${out.length}`}>
          {list.map((l, i) => (
            <li key={i}>{inline(l)}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  for (const raw of text.split("\n")) {
    const l = raw.trim();
    if (l.startsWith("- ")) {
      list.push(l.slice(2));
      continue;
    }
    flush();
    if (!l) continue;
    if (l.startsWith("### ")) out.push(<h3 key={`h${out.length}`}>{inline(l.slice(4))}</h3>);
    else if (l.startsWith("## ")) out.push(<h3 key={`h${out.length}`}>{inline(l.slice(3))}</h3>);
    else out.push(<p key={`p${out.length}`}>{inline(l)}</p>);
  }
  flush();
  return <>{out}</>;
}
