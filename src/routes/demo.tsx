import { createFileRoute, Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { AksWordmark } from '@/components/aks-wordmark';
import { Brand } from '@/components/brand';
import { meta } from '@/lib/access';

export const Route = createFileRoute('/demo')({
  head: () => meta('Try the demo', 'Walk through the AKS Company demo: a fictional company, one risky sentence, cited findings and a human approval.'),
  component: DemoPage,
});

const steps = [
  ['Admin', 'Open Knowledge Base and choose "Load demo data". This adds fictional AKS Company rules, facts, glossary and colours, including FACT-014 and LEGAL-03.'],
  ['Creator', 'Choose New Content, paste the test sentence above, save it and submit it.'],
  ['Markwise', 'Automatic checks run first, then the AI review. Each finding cites the rule or fact it relies on, and anything that cannot be confirmed is marked "Needs checking".'],
  ['Creator', 'Accept, edit or dismiss each finding. Dismissing needs a reason. Every change saves a new version; earlier versions are kept.'],
  ['Creator', 'Send for approval. Claim or legal findings route the item to a named Reviewer.'],
  ['Reviewer', 'Open the Review Queue, read the findings and citations, and approve, request changes or reject with a comment.'],
] as const;

function DemoPage() {
  return <div className="mx-auto max-w-3xl px-6 py-10">
    <Link to="/"><Brand /></Link>
    <h1 className="mt-16 text-3xl font-semibold">Try the demo</h1>
    <p className="mt-4 leading-7 text-muted-foreground">The demo uses <strong className="font-semibold"><AksWordmark /></strong>, a fictional company. All demo data is labelled "Demo data: fictional company".</p>
    <figure className="mt-8 rounded-lg border bg-card p-6">
      <figcaption className="text-xs font-semibold uppercase text-muted-foreground">Test sentence</figcaption>
      <blockquote className="mt-2 text-xl font-medium">“We cut onboarding time by 60%, guaranteed!”</blockquote>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">The demo knowledge base contains FACT-014 (“Reduces onboarding time by up to 40% (2025 customer study)”) and LEGAL-03, which restricts the word “guaranteed”. AI results can vary between runs, so Markwise shows what was actually found rather than a fixed answer.</p>
    </figure>
    <h2 className="mt-10 text-xl font-semibold">Steps</h2>
    <ol className="mt-4 space-y-4">{steps.map(([who, text], i) => <li key={i} className="flex gap-4"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{i + 1}</span><p className="leading-7"><strong>{who}.</strong> <span className="text-muted-foreground">{text}</span></p></li>)}</ol>
    <h2 className="mt-10 text-xl font-semibold">Access</h2>
    <p className="mt-3 leading-7 text-muted-foreground">Public role selection is turned off. New sign-ups get their own workspace as a Creator; roles are assigned by a workspace Admin. Judges receive dedicated role accounts privately.</p>
    <div className="mt-8 flex flex-wrap gap-3"><Button asChild><Link to="/auth">Sign in</Link></Button><Button asChild variant="outline"><Link to="/signup">Create a workspace</Link></Button></div>
  </div>;
}
