import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { DOCX_MIME, PPTX_MIME, extractOfficeText, transformDocumentBlocks, validateOfficePackage } from '@/lib/office-documents';
import { OfficeDocumentPreview } from '@/components/content/office-document-preview';

const xml = (body: string) => `<?xml version="1.0" encoding="UTF-8"?><root xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${body}</root>`;

function testFile(bytes: Uint8Array, name: string, type: string) {
  const copy = new Uint8Array(bytes.byteLength); copy.set(bytes);
  const file = new File([copy.buffer], name, { type });
  Object.defineProperty(file, 'arrayBuffer', { value: async () => copy.buffer });
  return file;
}

async function docx(body: string, extra: Record<string, string> = {}) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types><Override ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml" PartName="/word/document.xml"/></Types>');
  zip.file('word/document.xml', xml(`<w:document><w:body>${body}</w:body></w:document>`));
  for (const [path, value] of Object.entries(extra)) zip.file(path, value);
  return testFile(await zip.generateAsync({ type: 'uint8array' }), 'brief.docx', DOCX_MIME);
}

async function pptx(slideXml: string, notesXml?: string) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types><Override ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml" PartName="/ppt/presentation.xml"/></Types>');
  zip.file('ppt/presentation.xml', xml('<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rIdSlide"/></p:sldIdLst></p:presentation>'));
  zip.file('ppt/_rels/presentation.xml.rels', '<Relationships><Relationship Id="rIdSlide" Target="slides/slide1.xml" Type="slide"/></Relationships>');
  zip.file('ppt/slides/slide1.xml', slideXml);
  if (notesXml) {
    zip.file('ppt/slides/_rels/slide1.xml.rels', '<Relationships><Relationship Id="notes" Target="../notesSlides/notesSlide1.xml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide"/></Relationships>');
    zip.file('ppt/notesSlides/notesSlide1.xml', notesXml);
  }
  return testFile(await zip.generateAsync({ type: 'uint8array' }), 'pitch.pptx', PPTX_MIME);
}

describe('Office document extraction', () => {
  it('extracts Word paragraphs, table cells and image descriptions in reading order', async () => {
    const file = await docx('<w:p><w:r><w:t>Approved headline</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Fact cell</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Second cell</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p><w:r><w:drawing><wp:docPr descr="Product photo of a bottle"/></w:drawing></w:r></w:p>');
    const result = await extractOfficeText(file, 'docx');
    expect(result.text).toBe('Approved headline\n\nFact cell\n\nSecond cell\n\nProduct photo of a bottle');
    expect(result.blocks.map(block => block.location)).toEqual(['Paragraph 1', 'Table 1 · Row 1 · Cell 1', 'Table 1 · Row 1 · Cell 2', 'Word document · Image alt text 1']);
    expect(result.blocks.every(block => result.text.slice(block.start, block.end) === block.text)).toBe(true);
  });

  it('extracts PowerPoint shape text, table cells, image descriptions, and notes', async () => {
    const slide = xml('<p:sp><p:txBody><a:p><a:r><a:t>Slide headline</a:t></a:r></a:p></p:txBody></p:sp><p:graphicFrame><a:graphic><a:graphicData><a:tbl><a:tr><a:tc><a:p><a:r><a:t>Slide fact</a:t></a:r></a:p></a:tc></a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame><p:pic><p:nvPicPr><p:cNvPr descr="Chart showing adoption"/></p:nvPicPr></p:pic>');
    const notes = xml('<p:sp><p:nvSpPr><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Presenter context</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:nvPr><p:ph type="sldNum"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>1</a:t></a:r></a:p></p:txBody></p:sp>');
    const result = await extractOfficeText(await pptx(slide, notes), 'pptx');
    expect(result.blocks.map(block => block.location)).toEqual(['Slide 1 · Text block 1', 'Slide 1 · Table 1 · Row 1 · Cell 1', 'Slide 1 · Image alt text 1', 'Slide 1 · Speaker notes']);
    expect(result.text).toContain('Presenter context');
    expect(result.text).not.toContain('\n\n1');
  });

  it('rejects wrong types, malformed archives, macros and corrupted CRC data', async () => {
    const good = await docx('<w:p><w:r><w:t>Safe</w:t></w:r></w:p>');
    const goodBytes = new Uint8Array(await good.arrayBuffer());
    await expect(validateOfficePackage(goodBytes, 'pptx', 'pptx')).rejects.toThrow('PPTX document part is missing');
    await expect(validateOfficePackage(new Uint8Array([1, 2, 3]), 'docx', 'docx')).rejects.toThrow('valid Office Open XML');
    const macro = await docx('<w:p/>', { 'word/vbaProject.bin': 'not-a-macro' });
    await expect(extractOfficeText(macro, 'docx')).rejects.toThrow('Macro-enabled');
    const corrupted = goodBytes.slice(); corrupted[40] = (corrupted[40] ?? 0) ^ 0xff;
    await expect(extractOfficeText(testFile(corrupted, 'bad.docx', DOCX_MIME), 'docx')).rejects.toThrow();
    await expect(extractOfficeText(testFile(goodBytes, 'brief.docx', 'application/octet-stream'), 'docx')).rejects.toThrow('valid .docx Office file');
    await expect(validateOfficePackage(goodBytes, 'docx', 'pdf')).rejects.toThrow('Choose a .docx file');
    const encrypted = goodBytes.slice(); const encryptedView = new DataView(encrypted.buffer, encrypted.byteOffset, encrypted.byteLength);
    let central = -1;
    for (let i = 0; i <= encrypted.length - 4; i++) if (encryptedView.getUint32(i, true) === 0x02014b50) { central = i; break; }
    expect(central).toBeGreaterThan(0);
    encryptedView.setUint16(6, encryptedView.getUint16(6, true) | 1, true);
    encryptedView.setUint16(central + 8, encryptedView.getUint16(central + 8, true) | 1, true);
    await expect(extractOfficeText(testFile(encrypted, 'locked.docx', DOCX_MIME), 'docx')).rejects.toThrow('invalid or unsafe archive');
  });

  it('preserves empty documents as empty text and remaps blocks after a finding rewrite', async () => {
    const empty = await extractOfficeText(await docx('<w:p/>'), 'docx');
    expect(empty.text).toBe(''); expect(empty.blocks).toEqual([]);
    const original = await extractOfficeText(await docx('<w:p><w:r><w:t>Use approved 20% claim</w:t></w:r></w:p><w:p><w:r><w:t>Keep this paragraph</w:t></w:r></w:p>'), 'docx');
    const changed = original.text.replace('20%', '15%');
    const blocks = transformDocumentBlocks(original.blocks, original.text, changed);
    expect(blocks.map(block => block.text)).toEqual(['Use approved 15% claim', 'Keep this paragraph']);
    expect(blocks[1]?.start).toBe(changed.indexOf('Keep'));
  });

  it('keeps the serialized location map aligned when a rewrite crosses block boundaries', async () => {
    const original = await extractOfficeText(await docx('<w:p><w:r><w:t>Alpha claim</w:t></w:r></w:p><w:p><w:r><w:t>Keep this paragraph</w:t></w:r></w:p>'), 'docx');
    const changed = original.text.replace('claim\n\nKeep', 'updated');
    const blocks = transformDocumentBlocks(original.blocks, original.text, changed);
    expect(blocks.map(block => block.text).join('\n\n')).toBe(changed);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.location).toContain('Paragraph 1');
    expect(blocks[0]?.location).toContain('Paragraph 2');
  });

  it('renders block locations and highlights a finding in its exact document block', () => {
    render(createElement(OfficeDocumentPreview, { blocks: [{ kind: 'paragraph', location: 'Slide 2 · Text block 1', text: 'A claim needs checking.', start: 4, end: 27 }], text: '', findings: [
      { id: 'finding-1', check_name: 'numeric_claim', severity: 'medium', span_start: 6, span_end: 11, quoted_text: 'claim', explanation: 'Verify this claim.', cited_kind: 'fact', cited_code: 'FACT-1', cited_passage: 'Approved wording', outcome: 'cannot_verify' },
    ] }));
    expect(screen.getByRole('region', { name: 'Slide 2 · Text block 1' })).toBeInTheDocument();
    expect(screen.getByText('claim', { selector: 'mark' })).toHaveAttribute('title', 'Verify this claim.');
  });

  it('rejects a file that exceeds the upload limit before reading it', async () => {
    const file = new File([new Uint8Array(0)], 'large.docx', { type: DOCX_MIME });
    Object.defineProperty(file, 'size', { value: 20 * 1024 * 1024 + 1 });
    Object.defineProperty(file, 'arrayBuffer', { value: async () => { throw new Error('must reject before reading'); } });
    await expect(extractOfficeText(file, 'docx')).rejects.toThrow('20 MB or smaller');
  });
});
