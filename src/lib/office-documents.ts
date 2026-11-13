import JSZip from 'jszip';
import { TEXT_LIMIT } from './content';

export type OfficeContentType = 'docx' | 'pptx';
export type OfficeBlockKind = 'paragraph' | 'table_cell' | 'shape' | 'notes' | 'alt_text';
export type OfficeTextBlock = { kind: OfficeBlockKind; location: string; text: string; start: number; end: number };
export type OfficeTextResult = { text: string; blocks: OfficeTextBlock[]; limitations: string[] };
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 64 * 1024 * 1024;
const MAX_ENTRY_BYTES = 20 * 1024 * 1024;
const MAX_ENTRIES = 2_000;

type ZipEntry = { name: string; compressed: number; uncompressed: number };

function readZipDirectory(bytes: Uint8Array): ZipEntry[] {
  if (bytes.length < 22 || bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) {
    throw new Error('This file is not a valid Office Open XML package.');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const min = Math.max(0, bytes.length - 65_557); let eocd = -1;
  for (let i = bytes.length - 22; i >= min; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('The Office file archive is incomplete.');
  const disk = view.getUint16(eocd + 4, true); const directoryDisk = view.getUint16(eocd + 6, true);
  const diskEntries = view.getUint16(eocd + 8, true); const totalEntries = view.getUint16(eocd + 10, true);
  const directorySize = view.getUint32(eocd + 12, true); const directoryOffset = view.getUint32(eocd + 16, true);
  const commentLength = view.getUint16(eocd + 20, true);
  if (disk !== 0 || directoryDisk !== 0 || diskEntries !== totalEntries || totalEntries === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff ||
      eocd + 22 + commentLength !== bytes.length || directoryOffset + directorySize > eocd || totalEntries > MAX_ENTRIES) {
    throw new Error('This Office file uses an unsupported, split or oversized archive format.');
  }
  const decoder = new TextDecoder('utf-8', { fatal: true }); const entries: ZipEntry[] = []; const seen = new Set<string>();
  let offset = directoryOffset; let totalUncompressed = 0;
  try {
    for (let index = 0; index < totalEntries; index++) {
      if (offset + 46 > directoryOffset + directorySize || view.getUint32(offset, true) !== 0x02014b50) throw new Error();
      const flags = view.getUint16(offset + 8, true); const method = view.getUint16(offset + 10, true);
      const compressed = view.getUint32(offset + 20, true); const uncompressed = view.getUint32(offset + 24, true);
      const nameLength = view.getUint16(offset + 28, true); const extraLength = view.getUint16(offset + 30, true); const commentSize = view.getUint16(offset + 32, true);
      const startDisk = view.getUint16(offset + 34, true); const localOffset = view.getUint32(offset + 42, true);
      const end = offset + 46 + nameLength + extraLength + commentSize;
      if (end > directoryOffset + directorySize || !nameLength || flags & 1 || ![0, 8].includes(method) || startDisk !== 0 ||
          compressed === 0xffffffff || uncompressed === 0xffffffff || uncompressed > MAX_ENTRY_BYTES || localOffset + 30 > directoryOffset) throw new Error();
      const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
      if (name.includes('\\') || name.startsWith('/') || name.split('/').some(part => part === '..') || seen.has(name)) throw new Error();
      if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error();
      if (compressed === 0 ? uncompressed !== 0 : uncompressed / compressed > 100) throw new Error();
      totalUncompressed += uncompressed;
      if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) throw new Error();
      seen.add(name); entries.push({ name, compressed, uncompressed }); offset = end;
    }
  } catch {
    throw new Error('This Office file contains an invalid or unsafe archive structure.');
  }
  if (offset !== directoryOffset + directorySize) throw new Error('The Office file archive directory is malformed.');
  if (entries.some(entry => /(^|\/)vbaProject\.(bin|xml)$/i.test(entry.name))) throw new Error('Macro-enabled Office documents are not accepted.');
  return entries;
}

async function loadOfficeArchive(bytes: Uint8Array, type: OfficeContentType) {
  if (bytes.byteLength === 0) throw new Error('The file is empty.');
  if (bytes.byteLength > MAX_FILE_BYTES) throw new Error('Office files must be 20 MB or smaller.');
  const entries = readZipDirectory(bytes); const names = new Set(entries.map(entry => entry.name));
  if (!names.has('[Content_Types].xml')) throw new Error('This is not a supported Office document.');
  const documentPart = type === 'docx' ? 'word/document.xml' : 'ppt/presentation.xml';
  if (!names.has(documentPart)) throw new Error(`The expected ${type.toUpperCase()} document part is missing.`);
  if (type === 'pptx' && !entries.some(entry => /^ppt\/slides\/slide\d+\.xml$/i.test(entry.name))) throw new Error('The presentation contains no readable slides.');
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: true, createFolders: false });
  const contentTypes = await zip.file('[Content_Types].xml')!.async('string');
  const lowerTypes = contentTypes.toLowerCase();
  if (lowerTypes.includes('macroenabled') || lowerTypes.includes('vbaproject')) throw new Error('Macro-enabled Office documents are not accepted.');
  const expectedMainType = type === 'docx'
    ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml'
    : 'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml';
  if (!lowerTypes.includes(expectedMainType)) throw new Error(`The package content type does not match ${type.toUpperCase()}.`);
  return zip;
}

function parseXml(xml: string, part: string): XMLDocument {
  if (xml.length > MAX_ENTRY_BYTES / 2 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error(`The ${part} part is too large or contains unsupported XML declarations.`);
  const parsed = new DOMParser().parseFromString(xml, 'application/xml');
  if (parsed.getElementsByTagName('parsererror').length) throw new Error(`The ${part} part contains invalid XML.`);
  return parsed;
}

function children(node: Element, local: string): Element[] { return Array.from(node.children).filter(element => element.localName === local); }
function descendants(node: Element, local: string): Element[] { return Array.from(node.getElementsByTagName('*')).filter(element => element.localName === local); }
function textOf(node: Element): string {
  const result: string[] = [];
  const visit = (element: Element) => {
    if (element.localName === 'del' || element.localName === 'moveFrom') return;
    for (const child of Array.from(element.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE && element.localName === 't') result.push(child.textContent ?? '');
      else if (child.nodeType === Node.ELEMENT_NODE) {
        const childElement = child as Element;
        if (childElement.localName === 'tab') result.push('\t');
        else if (childElement.localName === 'br' || childElement.localName === 'cr') result.push('\n');
        else visit(childElement);
      }
    }
  };
  visit(node); return result.join('').trim();
}

function makeTextResult(drafts: Array<Omit<OfficeTextBlock, 'start' | 'end'>>, limitations: string[]): OfficeTextResult {
  const blocks = drafts.filter(block => block.text.length > 0); const chunks: string[] = []; let cursor = 0;
  const mapped = blocks.map(block => {
    if (chunks.length) { chunks.push('\n\n'); cursor += 2; }
    const start = cursor; chunks.push(block.text); cursor += block.text.length;
    return { ...block, start, end: cursor };
  });
  const text = chunks.join('');
  if (text.length > TEXT_LIMIT) throw new Error(`Extracted text exceeds Markwise’s ${TEXT_LIMIT.toLocaleString()} character review limit.`);
  return { text, blocks: mapped, limitations };
}

function addImageAltTexts(xml: XMLDocument, drafts: Array<Omit<OfficeTextBlock, 'start' | 'end'>>, prefix: string) {
  const nodes = Array.from(xml.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing', 'docPr'));
  nodes.forEach((node, index) => {
    const value = node.getAttribute('descr')?.trim();
    if (value) drafts.push({ kind: 'alt_text', location: `${prefix} · Image alt text ${index + 1}`, text: value });
  });
}

async function extractDocx(zip: JSZip): Promise<OfficeTextResult> {
  const xml = await zip.file('word/document.xml')!.async('string'); const document = parseXml(xml, 'word/document.xml');
  const body = descendants(document.documentElement, 'body')[0]; if (!body) throw new Error('The Word document body is missing.');
  const drafts: Array<Omit<OfficeTextBlock, 'start' | 'end'>> = []; let paragraph = 0; let table = 0;
  for (const child of Array.from(body.children)) {
    if (child.localName === 'p') {
      paragraph++; const text = textOf(child); if (text) drafts.push({ kind: 'paragraph', location: `Paragraph ${paragraph}`, text });
    } else if (child.localName === 'tbl') {
      table++; const rows = children(child, 'tr');
      rows.forEach((row, rowIndex) => children(row, 'tc').forEach((cell, columnIndex) => {
        const cellText = children(cell, 'p').map(textOf).filter(Boolean).join('\n');
        if (cellText) drafts.push({ kind: 'table_cell', location: `Table ${table} · Row ${rowIndex + 1} · Cell ${columnIndex + 1}`, text: cellText });
      }));
    }
  }
  addImageAltTexts(document, drafts, 'Word document');
  return makeTextResult(drafts, ['Word text, table cells and embedded-image alternative descriptions are extracted. Formatting and embedded images are preserved only in the downloadable original.']);
}

function resolvePackagePath(base: string, target: string): string {
  if (target.startsWith('/') || target.includes('\\')) throw new Error('The presentation contains an unsafe package relationship.');
  const stack = base.split('/').filter(Boolean);
  for (const segment of target.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') { if (!stack.length) throw new Error('The presentation contains an unsafe package relationship.'); stack.pop(); }
    else stack.push(segment);
  }
  return stack.join('/');
}

async function xmlPart(zip: JSZip, path: string): Promise<XMLDocument> {
  const file = zip.file(path); if (!file) throw new Error(`The presentation is missing ${path}.`);
  return parseXml(await file.async('string'), path);
}

function textParagraphs(node: Element): string[] {
  return descendants(node, 'p').map(paragraph => textOf(paragraph)).filter(Boolean);
}

async function extractPptx(zip: JSZip): Promise<OfficeTextResult> {
  const presentation = await xmlPart(zip, 'ppt/presentation.xml');
  const presentationRels = await xmlPart(zip, 'ppt/_rels/presentation.xml.rels');
  const relationById = new Map(descendants(presentationRels.documentElement, 'Relationship').map(relation => [relation.getAttribute('Id') ?? '', relation.getAttribute('Target') ?? '']));
  const slideIds = descendants(presentation.documentElement, 'sldId');
  if (!slideIds.length || slideIds.length > 500) throw new Error('The presentation must contain between 1 and 500 slides.');
  const drafts: Array<Omit<OfficeTextBlock, 'start' | 'end'>> = []; const limitations: string[] = [];
  for (const [slideIndex, slideId] of slideIds.entries()) {
    const relationId = Array.from(slideId.attributes).find(attribute => attribute.localName === 'id' && attribute.namespaceURI === 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')?.value ?? '';
    const target = relationById.get(relationId); if (!target) throw new Error(`Slide ${slideIndex + 1} has a missing presentation relationship.`);
    const slidePath = resolvePackagePath('ppt', target); const slide = await xmlPart(zip, slidePath); const slideLabel = `Slide ${slideIndex + 1}`;
    let tableIndex = 0; let shapeIndex = 0;
    const shapes = descendants(slide.documentElement, 'sp');
    for (const shape of shapes) {
      if (!children(shape, 'txBody').length) continue;
      shapeIndex++; const paragraphs = textParagraphs(children(shape, 'txBody')[0]!);
      if (paragraphs.length) drafts.push({ kind: 'shape', location: `${slideLabel} · Text block ${shapeIndex}`, text: paragraphs.join('\n') });
    }
    for (const frame of descendants(slide.documentElement, 'graphicFrame')) {
      const tables = descendants(frame, 'tbl');
      for (const pptTable of tables) {
        tableIndex++;
        descendants(pptTable, 'tr').forEach((row, rowIndex) => descendants(row, 'tc').forEach((cell, columnIndex) => {
          const text = textParagraphs(cell).join('\n');
          if (text) drafts.push({ kind: 'table_cell', location: `${slideLabel} · Table ${tableIndex} · Row ${rowIndex + 1} · Cell ${columnIndex + 1}`, text });
        }));
      }
    }
    const imageNodes = [...descendants(slide.documentElement, 'pic'), ...descendants(slide.documentElement, 'graphicFrame')]; let imageIndex = 0;
    for (const node of imageNodes) {
      const metadata = descendants(node, 'cNvPr')[0]; const description = metadata?.getAttribute('descr')?.trim();
      if (description) { imageIndex++; drafts.push({ kind: 'alt_text', location: `${slideLabel} · Image alt text ${imageIndex}`, text: description }); }
    }

    const base = slidePath.slice(0, slidePath.lastIndexOf('/') + 1); const relPath = `${base}_rels/${slidePath.slice(slidePath.lastIndexOf('/') + 1)}.rels`;
    if (zip.file(relPath)) {
      const rels = await xmlPart(zip, relPath);
      const notesTarget = descendants(rels.documentElement, 'Relationship').find(relation => (relation.getAttribute('Type') ?? '').endsWith('/notesSlide'))?.getAttribute('Target');
      if (notesTarget) {
        const notesPath = resolvePackagePath(base, notesTarget); const notes = await xmlPart(zip, notesPath);
        const notesParts = descendants(notes.documentElement, 'sp').flatMap(shape => {
          const placeholder = descendants(shape, 'ph')[0]?.getAttribute('type');
          if (['sldNum', 'dt', 'hdr', 'ftr'].includes(placeholder ?? '')) return [];
          const body = children(shape, 'txBody')[0]; return body ? textParagraphs(body) : [];
        }).filter(text => !/^\d+$/.test(text));
        if (notesParts.length) drafts.push({ kind: 'notes', location: `${slideLabel} · Speaker notes`, text: notesParts.join('\n') });
      }
    }
  }
  limitations.push('Slide text, speaker notes, table cells and embedded-image alternative descriptions are extracted. Charts, SmartArt, grouped-shape ordering and visual layout may not be represented in the text preview. The downloadable original preserves the source deck.');
  return makeTextResult(drafts, limitations);
}

export async function validateOfficePackage(bytes: Uint8Array, type: OfficeContentType, extension: string): Promise<void> {
  if (extension.toLowerCase() !== type) throw new Error(`Choose a .${type} file.`);
  await loadOfficeArchive(bytes, type);
}

export async function extractOfficeText(file: File, type: OfficeContentType): Promise<OfficeTextResult> {
  if (file.size === 0) throw new Error('The file is empty.');
  if (file.size > MAX_FILE_BYTES) throw new Error('Office files must be 20 MB or smaller.');
  const expectedMime = type === 'docx' ? DOCX_MIME : PPTX_MIME;
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (file.type !== expectedMime) throw new Error(`Choose a valid .${type} Office file.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const zip = await loadOfficeArchive(bytes, type);
  return type === 'docx' ? extractDocx(zip) : extractPptx(zip);
}

export function transformDocumentBlocks(blocks: OfficeTextBlock[], oldText: string, newText: string): OfficeTextBlock[] {
  if (oldText === newText) return blocks.map(block => ({ ...block }));
  let prefix = 0; const maxPrefix = Math.min(oldText.length, newText.length);
  while (prefix < maxPrefix && oldText[prefix] === newText[prefix]) prefix++;
  let suffix = 0; const maxSuffix = Math.min(oldText.length - prefix, newText.length - prefix);
  while (suffix < maxSuffix && oldText[oldText.length - 1 - suffix] === newText[newText.length - 1 - suffix]) suffix++;
  const oldChangeEnd = oldText.length - suffix; const newChangeEnd = newText.length - suffix; const delta = newText.length - oldText.length;
  if (!blocks.length) return [];

  // Keep a single map block for any rewrite that crosses paragraph/shape
  // boundaries. The map serializer joins blocks with two newlines, so merely
  // shifting each overlapping block would leave stale separators and fail the
  // server's exact-text validation for the new immutable version.
  const first = blocks.findIndex(block => block.end >= prefix);
  let last = -1;
  for (let index = blocks.length - 1; index >= 0; index--) {
    if (blocks[index]!.start <= oldChangeEnd) { last = index; break; }
  }
  if (first < 0 || last < first) return [];

  const before = blocks.slice(0, first).map(block => ({ ...block }));
  const start = blocks[first]!.start;
  const oldEnd = blocks[last]!.end;
  const end = Math.max(start, Math.min(newText.length, oldEnd + delta));
  const merged: OfficeTextBlock = {
    kind: blocks[first]!.kind,
    location: first === last ? blocks[first]!.location : `${blocks[first]!.location} – ${blocks[last]!.location}`,
    start,
    end,
    text: newText.slice(start, end),
  };
  const after = blocks.slice(last + 1).map(block => {
    const shiftedStart = Math.max(0, Math.min(newText.length, block.start + delta));
    const shiftedEnd = Math.max(shiftedStart, Math.min(newText.length, block.end + delta));
    return { ...block, start: shiftedStart, end: shiftedEnd, text: newText.slice(shiftedStart, shiftedEnd) };
  }).filter(block => block.text.length > 0);
  return [...before, ...(merged.text ? [merged] : []), ...after];
}
