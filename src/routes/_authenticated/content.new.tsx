import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, FilePlus2, ShieldCheck } from 'lucide-react';
import { useWorkspace } from '@/components/app-shell';
import { AccessRequired } from '@/components/content/content-ui';
import { ContentEditor } from '@/components/content/content-editor';
import { canCreateContent } from '@/lib/content';
import { meta } from '@/lib/access';

export const Route = createFileRoute('/_authenticated/content/new')({ head: () => meta('New content', 'Create a text, image or PDF draft.'), component: NewContent });

function NewContent() {
  const ws = useWorkspace();
  if (!canCreateContent(ws.role)) return <AccessRequired message="Only creators in this workspace can create content." />;
  return <main className="mx-auto max-w-[1380px]">
    <Link to="/content" className="group inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"><span className="flex size-8 items-center justify-center rounded-lg border bg-card transition-colors group-hover:border-brand-blue/30 group-hover:text-brand-blue"><ArrowLeft className="size-4" /></span>My content</Link>
    <header className="mt-5 flex flex-wrap items-center justify-between gap-5 overflow-hidden rounded-2xl border border-t-4 border-border border-t-brand-blue bg-card px-5 py-5 shadow-sm sm:px-7 sm:py-6">
      <div className="flex min-w-0 items-start gap-4"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-800"><FilePlus2 className="size-5" /></span><div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-blue">{ws.name} · Creator workspace</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-brand-ink sm:text-[1.8rem]">Create new content</h1><p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Prepare a clear, review-ready draft with the context and source material your team needs.</p></div></div>
      <div className="flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-medium text-teal-900"><ShieldCheck className="size-4 text-teal-700" />Draft first · submit when ready</div>
    </header>
    <div className="mt-5"><ContentEditor key={ws.id} workspaceId={ws.id} /></div>
  </main>;
}
