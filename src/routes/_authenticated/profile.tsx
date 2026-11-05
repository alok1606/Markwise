import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { Camera, Save, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { accessOptions } from '@/lib/queries';
import { saveProfile } from '@/lib/foundation.functions';
import { meta, profileSchema } from '@/lib/access';
import { supabase } from '@/integrations/supabase/client';
export const Route = createFileRoute('/_authenticated/profile')({ head: () => meta('Your profile', 'Manage your name and private avatar in Markwise.'), component: Profile });
function Profile() {
  const { data } = useSuspenseQuery(accessOptions); const [name, setName] = useState(data.profile.full_name); const [file, setFile] = useState<File | null>(null); const [busy,setBusy]=useState(false); const [message,setMessage]=useState(''); const [error,setError]=useState('');
  const save = useServerFn(saveProfile); const queryClient = useQueryClient();
  async function submit(e: React.FormEvent) { e.preventDefault(); setBusy(true); setError(''); setMessage(''); let uploaded: string | null = null;
    try { const profile=profileSchema.parse({full_name:name}); let path=data.profile.avatar_url;
      if(file) { const extensions: Record<string,string>={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}; const extension=extensions[file.type]; if(!extension || file.size>2*1024*1024) throw new Error('Choose a PNG, JPEG or WebP image under 2 MB.'); path=`${data.profile.id}/${crypto.randomUUID()}.${extension}`; const result=await supabase.storage.from('avatars').upload(path,file,{contentType:file.type}); if(result.error) throw result.error; uploaded=path; }
      await save({data:{...profile,avatar_url:path}}); await queryClient.invalidateQueries({queryKey:['access']}); if(uploaded && data.profile.avatar_url) await supabase.storage.from('avatars').remove([data.profile.avatar_url]); setFile(null);setMessage('Profile saved.');
    } catch(e) { if(uploaded) await supabase.storage.from('avatars').remove([uploaded]); setError(e instanceof Error?e.message:'Unable to save your profile'); } finally {setBusy(false);} }
  return <><p className="mb-3 text-xs font-semibold uppercase text-primary">Your account</p><h1 className="text-3xl font-semibold">Profile</h1><p className="mt-3 text-muted-foreground">The person behind the work.</p><form onSubmit={submit} className="mt-10 max-w-xl space-y-7"><div className="flex items-center gap-5">{data.avatar?<img src={data.avatar} alt="Your avatar" className="size-20 rounded-full object-cover"/>:<span className="flex size-20 items-center justify-center rounded-full bg-accent text-3xl">{name.slice(0,1)||'M'}</span>}<div><Label htmlFor="avatar" className="mb-2 flex items-center gap-2"><Camera className="size-4"/>Profile photo</Label><Input id="avatar" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setFile(e.target.files?.[0]??null)}/><p className="mt-2 text-xs text-muted-foreground">PNG, JPEG or WebP · maximum 2 MB</p></div></div><div className="space-y-2"><Label htmlFor="name">Full name</Label><Input id="name" value={name} onChange={e=>setName(e.target.value)} required maxLength={100}/></div><div className="space-y-2"><Label htmlFor="profile-email">Email address</Label><Input id="profile-email" value={data.profile.email} readOnly className="bg-muted"/></div>{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}{message&&<p role="status" className="text-sm text-primary">{message}</p>}<div className="border-t pt-6"><Button disabled={busy}>{busy?<LoaderCircle className="animate-spin"/>:<Save/>}Save changes</Button></div></form></>;
}