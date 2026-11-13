import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { FileText, ImageIcon, LoaderCircle, Presentation, Type, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { channels, contentFieldsSchema, contentFileRules, needsExtractedTextConfirmation, TEXT_LIMIT, type ContentFields, type ContentType } from '@/lib/content';
import { createContent, registerContentDocumentMap, registerContentFile, saveContentDraft } from '@/lib/content.functions';
import { extractPdfText } from '@/lib/pdf-text';
import { extractOfficeText, type OfficeTextBlock, type OfficeTextResult } from '@/lib/office-documents';

type Existing = { id: string; version: number; type: ContentType; fields: ContentFields; file_name: string | null; document_blocks?: OfficeTextBlock[] | null };
const empty: ContentFields = { title: '', channel: 'Web', audience: '', goal: '', body_text: '', alt_text: '', text_color: null, background_color: null };
const typeOptions = [
  { v: 'text', label: 'Text', description: 'Write and check copy directly.', icon: Type },
  { v: 'image', label: 'Image', description: 'Add alt text and optional brand colours.', icon: ImageIcon },
  { v: 'pdf', label: 'PDF', description: 'Extract text, review it, then confirm.', icon: FileText },
  { v: 'docx', label: 'Word', description: 'Review paragraphs, table cells and image descriptions.', icon: FileText },
  { v: 'pptx', label: 'PowerPoint', description: 'Review slide text, tables, speaker notes and image descriptions.', icon: Presentation },
] as const;
const extOf: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'application/pdf': 'pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx' };

export function ContentEditor({ workspaceId, existing, onSaved }: { workspaceId: string; existing?: Existing; onSaved?: () => void }) {
  const [type, setType] = useState<ContentType>(existing?.type ?? 'text');
  const [f, setF] = useState<ContentFields>(existing?.fields ?? empty);
  const [file, setFile] = useState<File | null>(null);
  const [pdfText, setPdfText] = useState<string | null>(null); const [confirmed, setConfirmed] = useState(false);
  const [officeText, setOfficeText] = useState<OfficeTextResult | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const create = useServerFn(createContent); const save = useServerFn(saveContentDraft); const register = useServerFn(registerContentFile); const registerMap = useServerFn(registerContentDocumentMap);
  const navigate = useNavigate(); const qc = useQueryClient();
  const set = (k: keyof ContentFields, v: string | null) => setF(p => ({ ...p, [k]: v }));

  async function pickFile(next: File | null) {
    setError(''); setFile(next); setPdfText(null); setOfficeText(null); setConfirmed(false);
    if (!next) return;
    const rule = contentFileRules[type as Exclude<ContentType, 'text'>];
    if (!rule.types[next.type]) { setError(`Unsupported file. Use ${rule.label}.`); setFile(null); return; }
    if (next.size > rule.maxBytes) { setError(`The file is too large. Use ${rule.label}.`); setFile(null); return; }
    if (type === 'pdf') { try { setPdfText(await extractPdfText(next)); } catch { setError('Could not read text from this PDF.'); setFile(null); } }
    if (type === 'docx' || type === 'pptx') { try { setOfficeText(await extractOfficeText(next, type)); } catch (error) { setError(error instanceof Error ? error.message : 'Could not read this Office document.'); setFile(null); } }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError('');
    const parsed = contentFieldsSchema.safeParse(f); if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Check the form'); return; }
    if (type !== 'text' && !existing?.file_name && !file) { setError(type === 'image' ? 'Choose an image to upload.' : type === 'pdf' ? 'Choose a PDF to upload.' : type === 'docx' ? 'Choose a Word document to upload.' : 'Choose a PowerPoint presentation to upload.'); return; }
    if (needsExtractedTextConfirmation(type, !!file, confirmed)) { setError('Review the extracted text and confirm it before saving.'); return; }
    setBusy(true);
    let id = existing?.id;
    try {
      const fields = parsed.data;
      let version = existing?.version ?? 1;
      if (!id) { id = (await create({ data: { workspace_id: workspaceId, type, fields: { ...fields, body_text: type === 'text' ? fields.body_text : '' } } })).id; }
      else if (!file || type === 'image') {
        version = (await save({ data: { workspace_id: workspaceId, id, expected_version: version, type, fields, pdf_text_confirmed: false } })).version;
        if ((type === 'docx' || type === 'pptx') && existing?.document_blocks) {
          await registerMap({ data: { workspace_id: workspaceId, id, expected_version: version, blocks: existing.document_blocks } });
        }
      }
      if (file) {
        const path = `${workspaceId}/${id}/${crypto.randomUUID()}.${extOf[file.type]}`;
        const up = await supabase.storage.from('content-files').upload(path, file, { contentType: file.type, upsert: false });
        if (up.error) throw new Error(up.error.message);
        version = (await register({ data: { workspace_id: workspaceId, id, expected_version: version, path, name: file.name.slice(0, 200) } })).version;
        const extractedText = type === 'pdf' ? pdfText : officeText?.text ?? null;
        if (extractedText !== null) {
          version = (await save({ data: { workspace_id: workspaceId, id, expected_version: version, type, fields: { ...fields, body_text: extractedText }, pdf_text_confirmed: true } })).version;
          if ((type === 'docx' || type === 'pptx') && officeText) {
            await registerMap({ data: { workspace_id: workspaceId, id, expected_version: version, blocks: officeText.blocks } });
          }
        }
      }
      await qc.invalidateQueries({ queryKey: ['content'] });
      toast.success('Draft saved');
      if (existing) { setFile(null); setPdfText(null); setOfficeText(null); setConfirmed(false); onSaved?.(); } else await navigate({ to: '/content/$id', params: { id } });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to save';
      // A new draft may already exist when the file step fails; open it so a retry does not create a duplicate.
      if (!existing && id) { toast.error(`Draft saved, but the file was not accepted: ${message}`); await qc.invalidateQueries({ queryKey: ['content'] }); await navigate({ to: '/content/$id', params: { id } }); }
      else setError(message);
    } finally { setBusy(false); }
  }

  const selectedType = typeOptions.find(o => o.v === type)!;
  const previewTitle = f.title.trim() || 'Untitled draft';
  const previewBody = type === 'text' ? f.body_text : type === 'pdf' ? (pdfText ?? f.body_text) : type === 'docx' || type === 'pptx' ? (officeText?.text ?? f.body_text) : f.alt_text;

  return <form onSubmit={submit} className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_290px]">
    <div className="min-w-0 overflow-hidden rounded-2xl border border-t-4 border-t-brand-blue bg-card shadow-sm">
      <header className="border-b bg-blue-50/65 px-5 py-5 sm:px-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-blue">Draft editor</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-brand-ink">Build your content</h2>
        <p className="mt-1 text-sm text-muted-foreground">Add the context and source material your team will need when reviewing it.</p>
      </header>
      <div className="space-y-7 p-5 sm:p-7">
        {!existing && <fieldset>
          <legend className="text-sm font-semibold text-brand-ink">Choose a format</legend>
          <p className="mt-1 text-xs text-muted-foreground">Select the type of content you want to prepare.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{typeOptions.map(o => <button type="button" key={o.v} aria-pressed={type === o.v} onClick={() => { setType(o.v); setFile(null); setPdfText(null); setOfficeText(null); setError(''); }} className={`group min-w-0 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue ${type === o.v ? 'border-brand-blue bg-blue-50 shadow-sm ring-1 ring-brand-blue/20' : 'border-border bg-background hover:border-brand-blue/30 hover:bg-slate-50'}`}>
            <span className={`flex size-10 items-center justify-center rounded-xl ${type === o.v ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600 group-hover:bg-blue-50 group-hover:text-brand-blue'}`}><o.icon className="size-5" /></span>
            <span className="mt-3 block text-sm font-semibold text-brand-ink">{o.label}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{o.description}</span>
          </button>)}</div>
        </fieldset>}

        <section aria-labelledby="content-details-title">
          <div className="mb-4 flex items-center gap-3"><span className="flex size-8 items-center justify-center rounded-lg bg-teal-50 text-teal-800">1</span><div><h3 id="content-details-title" className="text-sm font-semibold text-brand-ink">Content details</h3><p className="text-xs text-muted-foreground">Give reviewers the context behind this piece.</p></div></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="title">Title</Label><Input id="title" value={f.title} maxLength={160} onChange={e => set('title', e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="channel">Channel</Label><select id="channel" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-blue" value={f.channel} onChange={e => set('channel', e.target.value)}>{channels.map(c => <option key={c}>{c}</option>)}</select></div>
            <div className="space-y-1.5"><Label htmlFor="audience">Audience</Label><Input id="audience" value={f.audience} maxLength={300} onChange={e => set('audience', e.target.value)} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="goal">Goal</Label><Input id="goal" value={f.goal} maxLength={500} onChange={e => set('goal', e.target.value)} /></div>
          </div>
        </section>

        {type === 'text' && <section className="border-t pt-6" aria-labelledby="content-body-title">
          <div className="mb-3 flex items-start justify-between gap-3"><div><h3 id="content-body-title" className="text-sm font-semibold text-brand-ink">Content</h3><p className="mt-1 text-xs text-muted-foreground">Paste or write the copy you want reviewed.</p></div><span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-blue-800">Text</span></div>
          <div className="space-y-1.5"><Label htmlFor="body">Draft text</Label><Textarea id="body" rows={14} value={f.body_text} onChange={e => set('body_text', e.target.value)} className="min-h-72 resize-y rounded-xl border-slate-200 bg-[#fbfaf6] leading-7 shadow-inner" /><p className={`text-right text-xs ${f.body_text.length > TEXT_LIMIT ? 'text-destructive' : 'text-muted-foreground'}`} aria-live="polite">{f.body_text.length.toLocaleString()} / {TEXT_LIMIT.toLocaleString()} characters</p></div>
        </section>}

        {type !== 'text' && <section className="border-t pt-6" aria-labelledby="file-source-title">
          <div className="mb-3"><h3 id="file-source-title" className="text-sm font-semibold text-brand-ink">Source file</h3><p className="mt-1 text-xs text-muted-foreground">Upload the original {type === 'image' ? 'image' : type === 'pdf' ? 'PDF' : type === 'docx' ? 'Word document' : 'PowerPoint presentation'} for this review.</p></div>
          <div className="space-y-2"><Label htmlFor="file">{existing?.file_name ? 'Replace file' : type === 'image' ? 'Image' : type === 'pdf' ? 'PDF' : type === 'docx' ? 'Word document' : 'PowerPoint presentation'}</Label>
            <label htmlFor="file" className="flex cursor-pointer items-center gap-4 rounded-xl border border-dashed border-brand-blue/35 bg-blue-50/45 p-5 text-sm transition-colors hover:border-brand-blue/60 hover:bg-blue-50/75"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-brand-blue"><Upload className="size-5" /></span><span className="min-w-0"><span className="block truncate font-medium text-brand-ink">{file ? file.name : existing?.file_name ? `Current: ${existing.file_name}` : `Choose a file (${contentFileRules[type as Exclude<ContentType, 'text'>].label})`}</span><span className="mt-1 block text-xs text-muted-foreground">{file ? 'Selected for this draft' : `Supported: ${contentFileRules[type as Exclude<ContentType, 'text'>].label}`}</span></span></label>
            <input id="file" type="file" className="sr-only" accept={Object.keys(contentFileRules[type as Exclude<ContentType, 'text'>].types).join(',')} onChange={e => void pickFile(e.target.files?.[0] ?? null)} />
            {existing?.file_name && <p className="text-xs text-muted-foreground">Earlier files stay in the version history.</p>}
          </div>
        </section>}

        {type === 'image' && <section className="border-t pt-6" aria-labelledby="image-accessibility-title">
          <div className="mb-4"><h3 id="image-accessibility-title" className="text-sm font-semibold text-brand-ink">Image accessibility & colour</h3><p className="mt-1 text-xs text-muted-foreground">Optional brand context helps reviewers assess the visual.</p></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="alt">Alt text</Label><Input id="alt" value={f.alt_text ?? ''} maxLength={500} onChange={e => set('alt_text', e.target.value)} /><p className="text-xs text-muted-foreground">Describe the image for screen readers. You can leave it empty; a later check will flag it.</p></div>
            <div className="space-y-1.5"><Label htmlFor="tc">Text colour (optional)</Label><Input id="tc" placeholder="#1F2A44" value={f.text_color ?? ''} onChange={e => set('text_color', e.target.value || null)} /></div>
            <div className="space-y-1.5"><Label htmlFor="bg">Background colour (optional)</Label><Input id="bg" placeholder="#FFFFFF" value={f.background_color ?? ''} onChange={e => set('background_color', e.target.value || null)} /></div>
          </div>
        </section>}

        {(type === 'pdf' || type === 'docx' || type === 'pptx') && existing && !file && <section className="border-t pt-6"><h3 className="mb-2 text-sm font-semibold text-brand-ink">Saved extracted text</h3><p className="max-h-48 overflow-auto whitespace-pre-wrap rounded-xl border bg-slate-50 p-4 text-sm leading-6">{f.body_text || 'No text saved.'}</p></section>}
        {type === 'pdf' && pdfText !== null && <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4" aria-labelledby="pdf-confirm-title"><div className="mb-2"><h3 id="pdf-confirm-title" className="text-sm font-semibold text-amber-950">Review extracted text</h3><p className="mt-1 text-xs text-amber-900/80">Confirm the text is correct before saving the PDF draft.</p></div><p className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-amber-200/70 bg-white p-4 text-sm leading-6">{pdfText || 'No text found in this PDF.'}</p>
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-medium text-amber-950"><Checkbox checked={confirmed} onCheckedChange={v => setConfirmed(v === true)} aria-label="I confirm the extracted text is correct" />I confirm the extracted text is correct</label></section>}
        {(type === 'docx' || type === 'pptx') && officeText && <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4" aria-labelledby="office-confirm-title"><div className="mb-2"><h3 id="office-confirm-title" className="text-sm font-semibold text-amber-950">Review extracted document text</h3><p className="mt-1 text-xs text-amber-900/80">Check the reading order and labels before confirming. Markwise checks this text; it does not edit the Office file.</p></div><div className="max-h-72 space-y-2 overflow-auto rounded-lg border border-amber-200/70 bg-white p-3">{officeText.blocks.length ? officeText.blocks.map((block, index) => <div key={`${block.location}-${index}`} className="rounded-md border border-slate-100 px-3 py-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-brand-blue">{block.location}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{block.text}</p></div>) : <p className="text-sm text-muted-foreground">No selectable text was found. Image-only pages and slides need OCR, which is not enabled.</p>}</div>{officeText.limitations.map((limitation, index) => <p key={index} className="mt-2 text-xs text-amber-900/80">{limitation}</p>)}
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-medium text-amber-950"><Checkbox checked={confirmed} onCheckedChange={v => setConfirmed(v === true)} aria-label="I confirm the extracted Office document text is correct" />I confirm the extracted text and reading order are correct</label></section>}
      </div>
    </div>

    <aside className="min-w-0 space-y-4 xl:sticky xl:top-24">
      <section className="overflow-hidden rounded-2xl bg-brand-ink text-white shadow-[0_16px_38px_-28px_rgba(15,23,42,0.8)]" aria-label="Live draft preview">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">Live draft preview</span><span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-medium text-white">{selectedType.label}</span></div>
        <div className="p-5"><h3 className="break-words text-lg font-semibold leading-snug">{previewTitle}</h3>
          <div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full bg-blue-400/15 px-2.5 py-1 text-[11px] font-medium text-blue-100">{f.channel || 'No channel'}</span>{f.audience && <span className="rounded-full bg-teal-400/15 px-2.5 py-1 text-[11px] font-medium text-teal-100">{f.audience}</span>}</div>
          {f.goal && <p className="mt-4 border-l-2 border-teal-300/70 pl-3 text-xs leading-5 text-slate-200">{f.goal}</p>}
          {type === 'text' && <p className="mt-4 whitespace-pre-wrap border-t border-white/10 pt-4 text-xs leading-6 text-slate-300">{previewBody?.trim() ? `${previewBody.trim().slice(0, 260)}${previewBody.trim().length > 260 ? '…' : ''}` : 'Your text preview will appear here as you write.'}</p>}
          {type !== 'text' && <p className="mt-4 border-t border-white/10 pt-4 text-xs leading-5 text-slate-300">{file?.name ?? existing?.file_name ?? `No ${selectedType.label.toLowerCase()} selected yet.`}</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-teal-200 bg-teal-50/70 p-5" aria-label="What happens next">
        <div className="flex items-center gap-2 text-teal-900"><span className="flex size-8 items-center justify-center rounded-lg bg-teal-100"><FileText className="size-4" /></span><h3 className="text-sm font-semibold">What happens next</h3></div>
        <ol className="mt-4 space-y-4 text-xs leading-5 text-teal-950">
          <li className="flex gap-3"><span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-teal-800 ring-1 ring-teal-200">1</span><span><strong>Save a draft.</strong> Keep editing until it is ready to submit.</span></li>
          <li className="flex gap-3"><span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-teal-800 ring-1 ring-teal-200">2</span><span><strong>Submit for review.</strong> The submitted version receives automatic and AI review.</span></li>
          <li className="flex gap-3"><span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-teal-800 ring-1 ring-teal-200">3</span><span><strong>People decide.</strong> AI suggestions support the human approval process.</span></li>
        </ol>
      </section>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      <Button type="submit" className="w-full shadow-sm" size="lg" disabled={busy}>{busy ? <LoaderCircle className="animate-spin" /> : <Upload />}{busy ? 'Saving…' : existing ? 'Save draft changes' : 'Save draft'}</Button>
      <p className="text-center text-[11px] leading-5 text-muted-foreground">{existing ? 'Saving creates a new version. Earlier versions remain in history.' : 'Your content is saved as a draft in this workspace.'}</p>
    </aside>
  </form>;
}
