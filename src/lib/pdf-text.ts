// Browser-only: pdf.js is loaded on demand so it never runs during server rendering.
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i); const content = await page.getTextContent();
    pages.push(content.items.map(it => ('str' in it ? it.str + (it.hasEOL ? '\n' : ' ') : '')).join('').trim());
  }
  return pages.join('\n\n').trim();
}
