import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { FileText, ImageIcon, Type, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { channels, contentFieldsSchema, contentFileRules, TEXT_LIMIT, type ContentFields, type ContentType } from '@/lib/content';
import { createContent, registerContentFile, saveContentDraft } from '@/lib/content.functions';
import { extractPdfText } from '@/lib/pdf-text';

type Existing = { id: string; version: number; type: ContentType; fields: ContentFields; file_name: string | null };
const empty: ContentFields = { title: '', channel: 'Web', audience: '', goal: '', body_text: '', alt_text: '', text_color: null, background_color: null };
const typeOptions = [{ v: 'text', label: 'Text', icon: Type }, { v: 'image', label: 'Image', icon: ImageIcon }, { v: 'pdf', label: 'PDF', icon: FileText }] as const;
const extOf: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'application/pdf': 'pdf' };

export function ContentEditor({ workspaceId, existing, onSaved }: { workspaceId: string; existing?: Existing; onSaved?: () => void }) {
  const [type, setType] = useState<ContentType>(existing?.type ?? 'text');
  const [f, setF] = useState<ContentFields>(existing?.fields ?? empty);
  const [file, setFile] = useState<File | null>(null);
  const [pdfText, setPdfText] = useState<string | null>(null); const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const create = useServerFn(createContent); const save = useServerFn(saveContentDraft); const register = useServerFn(registerContentFile);
  const navigate = useNavigate(); const qc = useQueryClient();
  const set = (k: keyof ContentFields, v: string | null) => setF(p => ({ ...p, [k]: v }));

  async function pickFile(next: File | null) {
    setError(''); setFile(next); setPdfText(null); setConfirmed(false);
    if (!next) return;
    const rule = contentFileRules[type as 'image' | 'pdf'];
    if (!rule.types[next.type]) { setError(`Unsupported file. Use ${rule.label}.`); setFile(null); return; }
    if (next.size > rule.maxBytes) { setError(`The file is too large. Use ${rule.label}.`); setFile(null); return; }
    if (type === 'pdf') { try { setPdfText(await extractPdfText(next)); } catch { setError('Could not read text from this PDF.'); setFile(null); } }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError('');
    const parsed = contentFieldsSchema.safeParse(f); if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Check the form'); return; }
    if (type !== 'text' && !existing?.file_name && !file) { setError(type === 'image' ? 'Choose an image to upload.' : 'Choose a PDF to upload.'); return; }
    if (type === 'pdf' && file && !confirmed) { setError('Review the extracted text and confirm it before saving.'); return; }
    setBusy(true);
    let id = existing?.id;
    try {
      const fields = parsed.data;
      let version = existing?.version ?? 1;
      if (!id) { id = (await create({ data: { workspace_id: workspaceId, type, fields: { ...fields, body_text: type === 'text' ? fields.body_text : '' } } })).id; }
      else if (!file || type === 'image') { version = (await save({ data: { workspace_id: workspaceId, id, expected_version: version, type, fields, pdf_text_confirmed: false } })).version; }
      if (file) {
        const path = `${workspaceId}/${id}/${crypto.randomUUID()}.${extOf[file.type]}`;
        const up = await supabase.storage.from('content-files').upload(path, file, { contentType: file.type, upsert: false });
        if (up.error) throw new Error(up.error.message);
        version = (await register({ data: { workspace_id: workspaceId, id, expected_version: version, path, name: file.name.slice(0, 200) } })).version;
        if (type === 'pdf' && pdfText !== null) version = (await save({ data: { workspace_id: workspaceId, id, expected_version: version, type, fields: { ...fields, body_text: pdfText }, pdf_text_confirmed: true } })).version;
      }
      await qc.invalidateQueries({ queryKey: ['content'] });
      toast.success('Draft saved');
      if (existing) { setFile(null); setPdfText(null); setConfirmed(false); onSaved?.(); } else await navigate({ to: '/content/$id', params: { id } });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to save';
      // A new draft may already exist when the file step fails; open it so a retry does not create a duplicate.
      if (!existing && id) { toast.error(`Draft saved, but the file was not accepted: ${message}`); await qc.invalidateQueries({ queryKey: ['content'] }); await navigate({ to: '/content/$id', params: { id } }); }
      else setError(message);
    } finally { setBusy(false); }
  }

  return <form onSubmit={submit} className="space-y-6 rounded-lg border bg-card p-6">
    {!existing && <fieldset><legend className="text-sm font-medium">Content type</legend><div className="mt-2 grid gap-3 sm:grid-cols-3">{typeOptions.map(o => <button type="button" key={o.v} aria-pressed={type === o.v} onClick={() => { setType(o.v); setFile(null); setPdfText(null); setError(''); }} className={`flex items-center gap-3 rounded-md border p-4 text-left text-sm ${type === o.v ? 'border-primary bg-accent font-medium' : 'hover:bg-muted'}`}><o.icon className="size-4 text-primary" />{o.label}</button>)}</div></fieldset>}
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="title">Title</Label><Input id="title" value={f.title} maxLength={160} onChange={e => set('title', e.target.value)} /></div>
      <div className="space-y-1.5"><Label htmlFor="channel">Channel</Label><select id="channel" className="h-9 w-full rounded-md border bg-card px-3 text-sm" value={f.channel} onChange={e => set('channel', e.target.value)}>{channels.map(c => <option key={c}>{c}</option>)}</select></div>
      <div className="space-y-1.5"><Label htmlFor="audience">Audience</Label><Input id="audience" value={f.audience} maxLength={300} onChange={e => set('audience', e.target.value)} /></div>
      <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="goal">Goal</Label><Input id="goal" value={f.goal} maxLength={500} onChange={e => set('goal', e.target.value)} /></div>
    </div>
    {type === 'text' && <div className="space-y-1.5"><Label htmlFor="body">Text</Label><Textarea id="body" rows={12} value={f.body_text} onChange={e => set('body_text', e.target.value)} /><p className={`text-xs ${f.body_text.length > TEXT_LIMIT ? 'text-destructive' : 'text-muted-foreground'}`} aria-live="polite">{f.body_text.length.toLocaleString()} / {TEXT_LIMIT.toLocaleString()} characters</p></div>}
    {type !== 'text' && <div className="space-y-1.5"><Label htmlFor="file">{existing?.file_name ? 'Replace file' : type === 'image' ? 'Image' : 'PDF'}</Label>
      <label htmlFor="file" className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed p-4 text-sm text-muted-foreground"><Upload className="size-4" />{file ? file.name : existing?.file_name ? `Current: ${existing.file_name}` : `Choose a file (${contentFileRules[type].label})`}</label>
      <input id="file" type="file" className="sr-only" accept={Object.keys(contentFileRules[type].types).join(',')} onChange={e => void pickFile(e.target.files?.[0] ?? null)} />
      {existing?.file_name && <p className="text-xs text-muted-foreground">Earlier files stay in the version history.</p>}</div>}
    {type === 'image' && <div className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-1.5 sm:col-span-3"><Label htmlFor="alt">Alt text</Label><Input id="alt" value={f.alt_text ?? ''} maxLength={500} onChange={e => set('alt_text', e.target.value)} /><p className="text-xs text-muted-foreground">Describe the image for screen readers. You can leave it empty; a later check will flag it.</p></div>
      <div className="space-y-1.5"><Label htmlFor="tc">Text colour (optional)</Label><Input id="tc" placeholder="#1F2A44" value={f.text_color ?? ''} onChange={e => set('text_color', e.target.value || null)} /></div>
      <div className="space-y-1.5"><Label htmlFor="bg">Background colour (optional)</Label><Input id="bg" placeholder="#FFFFFF" value={f.background_color ?? ''} onChange={e => set('background_color', e.target.value || null)} /></div>
    </div>}
    {type === 'pdf' && existing && !file && <div className="space-y-1.5"><Label>Saved text</Label><p className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md border bg-muted p-3 text-sm">{f.body_text || 'No text saved.'}</p></div>}
    {type === 'pdf' && pdfText !== null && <div className="space-y-2"><Label>Extracted text</Label><p className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border bg-muted p-3 text-sm">{pdfText || 'No text found in this PDF.'}</p>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={confirmed} onCheckedChange={v => setConfirmed(v === true)} aria-label="I confirm the extracted text is correct" />I confirm the extracted text is correct</label></div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex justify-end"><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save draft'}</Button></div>
  </form>;
}
