import { createFileRoute, Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Brand } from '@/components/brand';
import { meta } from '@/lib/access';

export const Route = createFileRoute('/how-ai-works')({
  head: () => meta('How Markwise uses AI', 'What the Markwise AI review does, how its citations are checked, what "Needs checking" means, and its limits.'),
  component: HowAiWorks,
});

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return <section className="border-t pt-8"><p className="text-xs font-semibold text-primary">{n}</p><h2 className="mt-1 text-xl font-semibold">{title}</h2><div className="mt-3 space-y-3 leading-7 text-muted-foreground">{children}</div></section>;
}

function HowAiWorks() {
  return <div className="mx-auto max-w-3xl px-6 py-10">
    <Link to="/"><Brand /></Link>
    <h1 className="mt-16 text-3xl font-semibold sm:text-4xl">How Markwise uses AI</h1>
    <p className="mt-4 leading-7 text-muted-foreground">Markwise uses AI to point out possible problems in content before it is published. The AI suggests; people decide. This page explains what it does and what it cannot do.</p>
    <div className="mt-10 space-y-10">
      <Section n="01" title="Provider and model">
        <p>AI reviews use the model <code className="rounded bg-muted px-1.5 py-0.5 text-sm text-foreground">google/gemini-3-flash-preview</code>, reached through the Lovable AI Gateway. The model, provider and prompt version are recorded with every review and every AI call.</p>
      </Section>
      <Section n="02" title="What happens during a review">
        <ol className="list-decimal space-y-2 pl-5">
          <li>A Creator submits a version of their content. That version is locked.</li>
          <li>Automatic checks run first. These are fixed rules (for example, restricted words or numbers that need a source) and do not use AI.</li>
          <li>The AI then reviews the same submitted version against the workspace's knowledge: active brand rules, approved facts that are currently valid, and glossary entries. Pending or expired facts are not sent.</li>
          <li>AI findings are saved and shown separately from the automatic findings. AI never changes or removes an automatic finding.</li>
        </ol>
        <p>If the AI review fails, the submission still stands and the failure is logged.</p>
      </Section>
      <Section n="03" title="Grounding and citations">
        <p>Each AI finding can cite the rule, fact or glossary entry it relies on, by its code (for example LEGAL-03 or FACT-014) and an exact quoted passage.</p>
        <p>Markwise does not trust the AI's answer as given. Before a citation is shown as verified, the server checks that the code was actually sent to the AI, that the quoted passage really appears in that entry, and that the quoted part of your content really appears in the version reviewed. If any check fails, the finding is downgraded to <strong className="text-foreground">Needs checking</strong> and the citation is removed.</p>
        <figure className="rounded-lg border bg-card p-5 text-sm">
          <figcaption className="text-xs font-semibold uppercase">Example</figcaption>
          <p className="mt-2 text-foreground">Content: “We cut onboarding time by 60%, guaranteed!”</p>
          <p className="mt-1">Possible finding: “60%” contradicts FACT-014 (“up to 40%”). Suggested wording: “up to 40%”. The citation is shown only after the passage is confirmed in FACT-014.</p>
        </figure>
      </Section>
      <Section n="04" title="What “Needs checking” means">
        <p>“Needs checking” means Markwise could not confirm the statement from your approved sources. It is common for numbers and claims that no approved fact covers.</p>
        <p>It does <strong className="text-foreground">not</strong> mean the statement is false. A person should verify it.</p>
      </Section>
      <Section n="05" title="People stay in control">
        <p>The AI never edits, approves, rejects or publishes content. Creators accept, edit or dismiss each finding (dismissing needs a reason). Reviewers approve, request changes or reject. Managers can see the workspace's submitted content. Every decision is recorded.</p>
      </Section>
      <Section n="06" title="Limitations">
        <ul className="list-disc space-y-2 pl-5">
          <li>Results can vary between runs on the same content.</li>
          <li>The AI can miss problems or produce incorrect findings.</li>
          <li>For images, only visible text read by the AI is reviewed.</li>
          <li>Findings are only as good as the workspace's rules and facts.</li>
          <li>Verify important claims and sources yourself.</li>
          <li>A clean AI review is not a guarantee of legal or regulatory compliance.</li>
        </ul>
      </Section>
      <Section n="07" title="Privacy and data handling">
        <p>For a review, Markwise sends the submitted text (or, for images, the image file) together with the workspace's applicable rules, facts and glossary to the model through the Lovable AI Gateway. Internal record IDs are not sent.</p>
        <p>The AI-call log kept by Markwise stores a short summary of what was sent (such as content type, length and number of sources), not the content itself. Only workspace Admins can read it.</p>
        <p>The knowledge base is managed by Admins only. However, when a finding cites an entry, the quoted passage is saved with that finding and can be seen by anyone allowed to view that content, such as its Creator, its Reviewer and workspace Managers.</p>
        <p>Data handling by the AI services is governed by their own terms: <a className="text-primary underline" href="https://lovable.dev/terms" target="_blank" rel="noreferrer">Lovable terms</a> and <a className="text-primary underline" href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noreferrer">Google Gemini API terms</a>.</p>
      </Section>
    </div>
    <div className="mt-12 flex flex-wrap gap-3"><Button asChild><Link to="/demo">Try the demo</Link></Button><Button asChild variant="outline"><Link to="/">Back to home</Link></Button></div>
  </div>;
}
