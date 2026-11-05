import { createFileRoute } from '@tanstack/react-router';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useWorkspace } from '@/components/app-shell';
import { knowledgeOptions } from '@/lib/queries';
import { brandProfileSchema } from '@/lib/knowledge';
import { saveBrandProfile } from '@/lib/knowledge.functions';
import { meta } from '@/lib/access';

export const Route = createFileRoute('/_authenticated/knowledge/profile')({ head: () => meta('Brand profile', 'Your brand name, audience, mission and positioning.'), component: ProfilePage });
const fields = [
  { name: 'brand_name', label: 'Company / brand name *', long: false }, { name: 'industry', label: 'Industry', long: false }, { name: 'website', label: 'Website', long: false },
  { name: 'description', label: 'Description', long: true }, { name: 'target_audience', label: 'Target audience', long: true }, { name: 'mission', label: 'Brand mission', long: true }, { name: 'positioning', label: 'Positioning', long: true },
] as const;
type Key = (typeof fields)[number]['name'];

function ProfilePage() {
  const w = useWorkspace(); const { data } = useSuspenseQuery(knowledgeOptions(w.id)); const qc = useQueryClient(); const save = useServerFn(saveBrandProfile);
  const [values, setValues] = useState<Record<Key, string>>(() => Object.fromEntries(fields.map(f => [f.name, data.profile?.[f.name] ?? ''])) as Record<Key, string>);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError('');
    const parsed = brandProfileSchema.safeParse(values); if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Check the form'); return; }
    setBusy(true);
    try { await save({ data: { workspace_id: w.id, profile: parsed.data } }); await qc.invalidateQueries({ queryKey: ['knowledge', w.id] }); toast.success('Brand profile saved'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to save'); } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="max-w-3xl space-y-5">
    <div><h2 className="text-xl font-semibold">Brand profile</h2><p className="mt-1 text-sm text-muted-foreground">The foundation Markwise will use to understand your brand.{data.profile?.is_demo && ' Currently showing fictional demo data.'}</p></div>
    <div className="grid gap-5 sm:grid-cols-3">{fields.filter(f => !f.long).map(f => <div key={f.name} className="space-y-1.5"><Label htmlFor={f.name}>{f.label}</Label><Input id={f.name} value={values[f.name]} onChange={e => setValues(v => ({ ...v, [f.name]: e.target.value }))} placeholder={f.name === 'website' ? 'https://' : ''} /></div>)}</div>
    {fields.filter(f => f.long).map(f => <div key={f.name} className="space-y-1.5"><Label htmlFor={f.name}>{f.label}</Label><Textarea id={f.name} rows={3} value={values[f.name]} onChange={e => setValues(v => ({ ...v, [f.name]: e.target.value }))} /></div>)}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex items-center gap-4"><Button disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</Button>{data.profile && <span className="text-xs text-muted-foreground">Last updated {new Date(data.profile.updated_at).toLocaleString()}</span>}</div>
  </form>;
}
