import { Highlighted } from '@/components/content/findings-panel';
import type { OfficeTextBlock } from '@/lib/office-documents';

export type OfficePreviewFinding = {
  id: string;
  check_name: string;
  severity: string;
  span_start: number | null;
  span_end: number | null;
  quoted_text: string;
  explanation: string;
  cited_kind: string;
  cited_code: string;
  cited_passage: string;
  outcome: string;
};

export function OfficeDocumentPreview({ blocks, text, findings }: { blocks: OfficeTextBlock[] | null; text: string; findings: OfficePreviewFinding[] }) {
  if (!blocks?.length) return <div className="mx-auto max-w-[68ch]"><p className="whitespace-pre-wrap font-serif text-[15px] leading-8 text-slate-800">{text || 'No selectable text was extracted.'}</p><p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Document location metadata is unavailable for this version. Open the original file to inspect its layout.</p></div>;
  return <div className="mx-auto max-w-[72ch] space-y-3">{blocks.map((block, index) => {
    const localFindings = findings.flatMap(f => {
      if (f.span_start === null || f.span_end === null || f.span_start >= block.end || f.span_end <= block.start) return [];
      const start = Math.max(f.span_start, block.start); const end = Math.min(f.span_end, block.end);
      return [{ ...f, span_start: start - block.start, span_end: end - block.start }];
    });
    return <section key={`${block.location}-${index}`} aria-label={block.location} className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_5px_18px_-16px_rgba(15,23,42,0.4)] sm:p-5">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-blue">{block.location}</p>
      <div className="font-serif text-[15px] leading-8 text-slate-800">{localFindings.length ? <Highlighted text={block.text} findings={localFindings} /> : <p className="whitespace-pre-wrap">{block.text}</p>}</div>
    </section>;
  })}</div>;
}
