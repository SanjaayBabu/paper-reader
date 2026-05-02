import type { Citation } from "@/types";

interface Props {
  citations: Citation[];
}

export default function FootnoteList({ citations }: Props) {
  if (citations.length === 0) return null;

  return (
    <section className="mt-12 border-t pt-8">
      <h2 className="text-lg font-semibold mb-4 text-slate-700">References</h2>
      <ol className="space-y-2">
        {citations.map((c) => (
          <li key={c.id} id={`fn-${c.id}`} className="flex gap-3 text-sm text-slate-600">
            <span className="shrink-0 font-medium text-slate-400 w-6 text-right">
              {c.id}.
            </span>
            <span>{c.originalText}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
