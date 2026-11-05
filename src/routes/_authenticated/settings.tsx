import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWorkspace } from '@/components/app-shell';
import { saveWorkspace } from '@/lib/foundation.functions';
import { meta } from '@/lib/access';
export const Route=createFileRoute('/_authenticated/settings')({head:()=>meta('Workspace settings','Manage your Markwise workspace identity.'),component:Settings});
function Settings(){const w=useWorkspace();const [name,setName]=useState(w.name);const [message,setMessage]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);const save=useServerFn(saveWorkspace);const qc=useQueryClient();return <><h1 className="text-3xl font-semibold">Workspace settings</h1><p className="mt-3 text-muted-foreground">A clear identity for your team.</p><form className="mt-10 max-w-xl space-y-5" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await save({data:{workspace_id:w.id,name}});await qc.invalidateQueries({queryKey:['access']});setMessage('Workspace saved.');}catch(e){setError(e instanceof Error?e.message:'Unable to save');}finally{setBusy(false);}}}><Label htmlFor="workspace-name">Workspace name</Label><Input id="workspace-name" value={name} onChange={e=>setName(e.target.value)} disabled={w.role!=='admin'} required maxLength={100}/>{w.role==='admin'?<Button disabled={busy}>Save workspace</Button>:<p className="text-sm text-muted-foreground">Only administrators can change workspace settings.</p>}{message&&<p role="status" className="text-primary">{message}</p>}{error&&<p role="alert" className="text-destructive">{error}</p>}</form></>;}