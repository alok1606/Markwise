import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect } from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BookOpenCheck,
  Check,
  CheckCheck,
  CircleAlert,
  FileCheck2,
  FileText,
  Fingerprint,
  Scale,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AksWordmark } from '@/components/aks-wordmark';
import { Brand } from '@/components/brand';
import { useAuth } from '@/components/auth-provider';
import { meta } from '@/lib/access';

export const Route = createFileRoute('/')({
  head: () => meta('Markwise — Create with confidence. Publish with proof.', 'Grounded brand governance for teams creating, reviewing and approving marketing content.'),
  component: Index,
});

const principles = [
  { number: '01', title: 'Grounded in your standards', text: 'Reviews draw on your approved guidelines, facts and glossary—not a generic idea of your brand.', icon: BookOpenCheck },
  { number: '02', title: 'Evidence behind findings', text: 'See the rule or source connected to a finding, with claims that need checking clearly marked.', icon: FileCheck2 },
  { number: '03', title: 'People make the call', text: 'Creators consider suggestions. Reviewers make the approval decision. Markwise never publishes for you.', icon: UsersRound },
];

const workflow = [
  ['01', 'Set the standard', 'Admins maintain approved rules, facts, glossary and visual identity.'],
  ['02', 'Create or submit', 'A Creator drafts content and submits the version for review.'],
  ['03', 'Check the content', 'Deterministic checks run first; AI review uses applicable workspace knowledge.'],
  ['04', 'Examine the evidence', 'Review findings, source passages and anything marked “Needs checking”.'],
  ['05', 'Make a human decision', 'Creators act on findings. Assigned Reviewers approve, request changes or reject.'],
] as const;

function Index() {
  const { user } = useAuth();
  const workspaceTo = user ? '/dashboard' : '/signup';
  const workspaceLabel = user ? 'Open workspace' : 'Create your workspace';

  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>('[data-landing-reveal]');
    const revealAll = () => elements.forEach((element) => element.classList.add('is-visible'));

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      revealAll();
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -36px 0px' });

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing-page min-h-screen w-full min-w-0 overflow-x-clip bg-[#f5f3ed] text-[#142235]">
      <header className="border-b border-[#142235]/10">
        <div className="mx-auto flex h-[5.25rem] w-full min-w-0 max-w-[1440px] items-center justify-between gap-3 px-5 sm:px-8 lg:px-12">
          <Link to="/" aria-label="Markwise home" className="landing-brand shrink-0"><Brand size="large" /></Link>
          <nav aria-label="Main navigation" className="hidden items-center gap-7 text-[13px] font-medium text-[#546174] lg:flex">
            <a className="transition-colors hover:text-[#142235]" href="#platform">Platform</a>
            <a className="transition-colors hover:text-[#142235]" href="#workflow">How it works</a>
            <Link className="transition-colors hover:text-[#142235]" to="/how-ai-works">AI transparency</Link>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/demo" className="hidden px-2 py-2 text-[13px] font-medium text-[#435168] hover:text-[#142235] sm:inline-flex">Explore demo <ArrowUpRight className="ml-1 size-3.5" aria-hidden="true" /></Link>
            {!user && <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link to="/auth">Sign in</Link></Button>}
            <Button asChild size="sm" className="bg-[#142235] text-white hover:bg-[#263a52]">
              <Link to={workspaceTo}><span className="sm:hidden">{user ? 'Workspace' : 'Start'}</span><span className="hidden sm:inline">{workspaceLabel}</span><ArrowRight aria-hidden="true" /></Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative border-b border-[#142235]/10">
          <div className="mx-auto grid w-full max-w-[1440px] min-w-0 gap-10 px-5 pb-12 pt-12 sm:px-8 sm:pb-16 sm:pt-16 lg:grid-cols-[minmax(19rem,0.78fr)_minmax(0,1.22fr)] lg:items-center lg:gap-12 lg:px-12 lg:py-20">
            <div data-landing-reveal className="relative z-10 min-w-0">
              <p className="mb-6 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#2858d8]"><span className="h-px w-8 bg-[#159b8b]" />Brand governance for the work before publication</p>
              <h1 className="landing-title max-w-[650px] text-[clamp(2.1rem,9.2vw,2.75rem)] font-semibold leading-[1.03] tracking-[-0.06em] sm:text-6xl lg:text-[4.55rem]"><span className="landing-title-line landing-title-line-one">Create with<br className="sm:hidden" /> confidence.</span><br /><span className="landing-title-line landing-title-line-two landing-title-accent">Publish with proof.</span></h1>
              <p className="mt-6 w-full max-w-[34rem] break-words text-[15px] leading-7 text-[#526074] sm:text-base sm:leading-7">Markwise grounds content review in your approved brand knowledge, explains what needs attention, and leaves the final decision to your people.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button asChild size="lg" className="h-12 justify-between bg-[#142235] px-5 text-white hover:bg-[#263a52] sm:justify-center"><Link to={workspaceTo}>{workspaceLabel}<ArrowRight aria-hidden="true" /></Link></Button>
                <Button asChild size="lg" variant="outline" className="h-12 justify-between border-[#142235]/20 bg-transparent px-5 text-[#142235] hover:bg-white/70 sm:justify-center"><Link to="/demo">Explore the demo<ArrowUpRight aria-hidden="true" /></Link></Button>
              </div>
              <p className="mt-5 flex items-center gap-2 text-xs text-[#687487]"><ShieldCheck className="size-4 text-[#078779]" aria-hidden="true" />Human judgment. Always the final word.</p>
            </div>

            <ProductPreview />
          </div>
          <div className="mx-auto flex max-w-[1440px] items-center justify-between border-t border-[#142235]/10 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#738093] sm:px-8 lg:px-12">
            <span>Illustrative product preview</span><span>Fictional AKS Company demo content</span>
          </div>
        </section>

        <section id="platform" className="scroll-mt-8 border-b border-[#142235]/10 bg-[#eeece5]">
          <div className="mx-auto grid max-w-[1440px] gap-0 px-5 sm:px-8 md:grid-cols-3 lg:px-12">
            {principles.map(({ number, title, text, icon: Icon }, index) => (
              <article data-landing-reveal key={number} style={{ animationDelay: `${index * 85}ms` }} className="grid grid-cols-[2.75rem_1fr] gap-4 border-b border-[#142235]/10 py-6 last:border-b-0 md:border-b-0 md:border-r md:px-6 md:first:pl-0 md:last:border-r-0 md:last:pr-0 lg:py-8">
                <span className="pt-1 text-xs font-semibold tabular-nums text-[#778396]">{number}</span>
                <div><Icon className="mb-3 size-[18px] text-[#078779]" aria-hidden="true" /><h2 className="text-[15px] font-semibold tracking-[-0.02em]">{title}</h2><p className="mt-2 max-w-sm text-[13px] leading-5 text-[#647084]">{text}</p></div>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto grid max-w-[1440px] gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:px-12 lg:py-28">
          <div data-landing-reveal>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2858d8]">The challenge</p>
            <h2 className="max-w-xl text-3xl font-semibold leading-[1.1] tracking-[-0.045em] sm:text-4xl">Your brand standard has to travel farther than one document.</h2>
            <p className="mt-5 max-w-lg text-sm leading-6 text-[#647084]">Different teams create across channels and deadlines. Guidance can be hard to apply consistently, and a flagged sentence is hard to act on when the reason is unclear.</p>
          </div>
          <div data-landing-reveal className="grid gap-0 border-y border-[#142235]/15 sm:grid-cols-3 sm:divide-x sm:divide-[#142235]/15">
            <ProblemColumn index="A" title="Scattered guidance" text="Rules, approved claims and terminology need a shared home." />
            <ProblemColumn index="B" title="Unclear feedback" text="A finding should show what it refers to and why it matters." />
            <ProblemColumn index="C" title="People in the loop" text="Review support should help a person decide, never decide for them." />
          </div>
        </section>

        <section id="workflow" className="scroll-mt-8 bg-[#142235] text-white">
          <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
            <div data-landing-reveal className="grid gap-5 border-b border-white/15 pb-8 lg:grid-cols-[1fr_22rem] lg:items-end lg:pb-10">
              <div><p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#66c6b8]">A review with a clear trail</p><h2 className="max-w-2xl text-3xl font-semibold leading-tight tracking-[-0.045em] sm:text-5xl">From approved knowledge to a human decision.</h2></div>
              <p className="text-sm leading-6 text-[#bac4d1]">A defined sequence keeps standards, evidence and accountability connected before content is published.</p>
            </div>
            <ol className="grid gap-0 sm:grid-cols-2 lg:grid-cols-5">
              {workflow.map(([number, title, text], index) => (
                <li data-landing-reveal key={number} style={{ animationDelay: `${index * 90}ms` }} className={`group relative border-b border-white/15 py-6 sm:px-5 sm:first:pl-0 lg:border-b-0 lg:border-r lg:py-8 lg:first:pl-0 lg:last:border-r-0 ${index > 1 ? 'sm:border-b-0' : ''}`}>
                  <span className="mb-8 flex size-8 items-center justify-center rounded-full border border-white/25 text-[11px] font-semibold text-[#66c6b8] transition-colors duration-300 group-hover:border-[#66c6b8]/70 group-hover:bg-[#66c6b8]/10">{number}</span>
                  <h3 className="text-[15px] font-semibold">{title}</h3><p className="mt-2 pr-3 text-[13px] leading-5 text-[#bac4d1]">{text}</p>
                  {index < workflow.length - 1 && <ArrowDownRight className="absolute right-5 top-8 hidden size-4 text-[#66c6b8] transition-transform duration-300 group-hover:translate-x-1 group-hover:translate-y-1 lg:block" aria-hidden="true" />}
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto grid max-w-[1440px] gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.72fr_1.28fr] lg:items-center lg:gap-20 lg:px-12 lg:py-28">
          <div data-landing-reveal>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2858d8]">The platform</p>
            <h2 className="text-3xl font-semibold leading-[1.1] tracking-[-0.045em] sm:text-4xl">The right context for every review.</h2>
            <p className="mt-5 text-sm leading-6 text-[#647084]">Keep approved knowledge connected to content, make findings understandable, and preserve a clear human approval path.</p>
            <ul className="mt-7 space-y-4">
              <Capability icon={BookOpenCheck} title="Manage brand knowledge" text="Admins maintain guidelines, facts, glossary and visual identity." />
              <Capability icon={Fingerprint} title="Check against your standards" text="Deterministic checks and AI review use their defined sources." />
              <Capability icon={Scale} title="Keep review accountable" text="Findings, citations and human decisions remain visible in the workflow." />
            </ul>
            <Link to="/how-ai-works" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[#2858d8] hover:text-[#1747c1]">How Markwise uses AI<ArrowRight className="size-4" aria-hidden="true" /></Link>
          </div>
          <EvidencePanel />
        </section>

        <section className="border-y border-[#142235]/10 bg-[#eeece5]">
          <div className="mx-auto grid max-w-[1440px] gap-9 px-5 py-14 sm:px-8 sm:py-16 lg:grid-cols-[0.75fr_1.25fr] lg:items-center lg:px-12 lg:py-20">
            <div data-landing-reveal><p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#078779]">AI with clear boundaries</p><h2 className="text-3xl font-semibold leading-tight tracking-[-0.04em]">Assistance should be explainable. Authority should stay human.</h2></div>
            <div data-landing-reveal style={{ animationDelay: '90ms' }} className="grid gap-5 sm:grid-cols-2">
              <p className="border-l-2 border-[#2858d8] pl-4 text-sm leading-6 text-[#526074]">AI reviews submitted content against applicable workspace knowledge. It does not edit, approve, reject or publish.</p>
              <p className="border-l-2 border-[#078779] pl-4 text-sm leading-6 text-[#526074]">Citations are checked against the sources used. If a claim cannot be confirmed, Markwise labels it “Needs checking”.</p>
            </div>
            <Link to="/how-ai-works" className="inline-flex items-center gap-2 text-sm font-semibold text-[#2858d8] hover:text-[#1747c1] lg:col-start-2">Read about AI, citations and data handling<ArrowRight className="size-4" aria-hidden="true" /></Link>
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
          <div data-landing-reveal className="grid gap-8 rounded-2xl bg-[#142235] px-6 py-9 text-white sm:px-10 sm:py-12 lg:grid-cols-[1fr_auto] lg:items-end lg:px-14 lg:py-14">
            <div><p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#66c6b8]">Before the next publish</p><h2 className="max-w-2xl text-3xl font-semibold leading-tight tracking-[-0.045em] sm:text-5xl">Give every decision a standard to stand on.</h2><p className="mt-4 max-w-xl text-sm leading-6 text-[#bac4d1]">Create a workspace for your team, or explore the fictional product demo to see the review flow.</p></div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Button asChild size="lg" className="h-12 justify-between bg-white px-5 text-[#142235] hover:bg-[#e8edf3]"><Link to={workspaceTo}>{workspaceLabel}<ArrowRight aria-hidden="true" /></Link></Button>
              <Button asChild size="lg" variant="outline" className="h-12 justify-between border-white/30 bg-transparent px-5 text-white hover:bg-white/10 hover:text-white"><Link to="/demo">Explore demo<ArrowUpRight aria-hidden="true" /></Link></Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#142235]/10 bg-[#eeece5]">
        <div className="mx-auto grid max-w-[1440px] gap-8 px-5 py-8 sm:px-8 md:grid-cols-[1fr_auto] md:items-center lg:px-12">
          <div><Link to="/" aria-label="Markwise home" className="landing-brand inline-flex"><Brand size="large" /></Link><p className="mt-3 max-w-sm text-xs leading-5 text-[#687487]">Create with confidence. Publish with proof. Human judgment remains the final word.</p></div>
          <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-6 gap-y-3 text-[13px] font-medium text-[#526074]">
            <a href="#platform" className="hover:text-[#142235]">Platform</a><a href="#workflow" className="hover:text-[#142235]">How it works</a><Link to="/demo" className="hover:text-[#142235]">Demo</Link><Link to="/how-ai-works" className="hover:text-[#142235]">AI transparency</Link><Link to="/auth" className="hover:text-[#142235]">Sign in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function ProductPreview() {
  return (
    <div data-landing-reveal style={{ animationDelay: '120ms' }} className="relative min-w-0 rounded-xl border border-[#c9c8c0] bg-[#e9e7df] p-2 shadow-[0_24px_60px_-32px_rgba(20,34,53,0.45)] sm:p-3">
      <div className="overflow-hidden rounded-lg border border-[#d9dce1] bg-white">
        <div className="flex h-11 items-center justify-between border-b border-[#e6e9ed] bg-white px-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-2 text-[11px] font-semibold text-[#26364b]"><span className="flex size-5 items-center justify-center rounded bg-[#142235] text-white"><Check className="size-3" aria-hidden="true" /></span><span className="truncate"><AksWordmark compact /></span><span className="text-[#a0a8b2]">/</span><span className="truncate font-normal text-[#687487]">Launch email</span></div>
          <span className="ml-2 shrink-0 rounded-full bg-[#f5f1e7] px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-[#827049]">Demo · fictional</span>
        </div>
        <div className="grid min-h-[19rem] min-w-0 md:grid-cols-[minmax(0,1.05fr)_minmax(13rem,0.95fr)]">
          <div className="min-w-0 p-4 sm:p-6">
            <div className="mb-5 flex items-center justify-between"><span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#8791a0]">Content preview</span><span className="rounded-full border border-[#e3e6eb] px-2 py-1 text-[9px] text-[#687487]">Email</span></div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#2858d8]">Subject · Make onboarding effortless</p>
            <h3 className="mt-3 text-xl font-semibold leading-tight tracking-[-0.035em] text-[#142235] sm:text-2xl">A smoother start for every new hire.</h3>
            <p className="mt-4 text-xs leading-5 text-[#59677b]">With AKS Company, teams can get set up quickly and keep every new employee moving forward.</p>
            <div className="mt-4 rounded-md border-l-2 border-[#d18b37] bg-[#fbf7ed] px-3 py-2.5"><p className="text-[11px] leading-5 text-[#26364b]">“We cut onboarding time by <span className="rounded bg-[#f2d9aa] px-0.5 font-semibold">60%</span>, <span className="rounded bg-[#f2d9aa] px-0.5 font-semibold">guaranteed</span>!”</p><p className="mt-1 text-[9px] font-medium text-[#98713a]">Example claim from the fictional demo</p></div>
            <div className="mt-5 flex items-center justify-between border-t border-[#edf0f2] pt-3"><span className="flex items-center gap-1.5 text-[10px] text-[#687487]"><FileText className="size-3.5" aria-hidden="true" />Version 1 · submitted</span><span className="flex items-center gap-1.5 text-[10px] font-medium text-[#687487]"><UsersRound className="size-3.5" aria-hidden="true" />Human review</span></div>
          </div>
          <aside className="border-t border-[#e6e9ed] bg-[#f8f9fb] p-4 sm:p-5 md:border-l md:border-t-0" aria-label="Illustrative review findings">
            <div className="flex items-center justify-between"><h3 className="text-xs font-semibold text-[#142235]">Review findings</h3><span className="rounded-full bg-[#edf1f8] px-2 py-1 text-[9px] font-medium text-[#526074]">Illustrative</span></div>
            <div className="mt-3 space-y-2.5">
              <div className="rounded-md border border-[#ead9b8] bg-white p-3">
                <div className="flex items-start gap-2"><CircleAlert className="mt-0.5 size-3.5 shrink-0 text-[#bb7828]" aria-hidden="true" /><div className="min-w-0"><p className="text-[10px] font-semibold text-[#26364b]">Claim needs checking</p><p className="mt-1 text-[9px] leading-4 text-[#687487]">“60%” exceeds the approved claim.</p></div></div>
                <div className="mt-2.5 border-t border-[#eff0f2] pt-2"><p className="text-[8px] font-semibold uppercase tracking-[0.1em] text-[#8290a1]">Source · FACT-014</p><p className="mt-1 text-[9px] leading-4 text-[#526074]">“Reduces onboarding time by up to 40%”</p></div>
              </div>
              <div className="rounded-md border border-[#e6e9ed] bg-white p-3">
                <div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-[#2858d8]" aria-hidden="true" /><div><p className="text-[10px] font-semibold text-[#26364b]">Restricted phrase</p><p className="mt-1 text-[9px] leading-4 text-[#687487]">“guaranteed” matches rule LEGAL-03.</p></div></div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-md bg-[#eaf4f1] px-3 py-2"><span className="flex items-center gap-1.5 text-[9px] font-medium text-[#186f66]"><CheckCheck className="size-3.5" aria-hidden="true" />Evidence for a person to review</span><ArrowRight className="size-3.5 text-[#186f66]" aria-hidden="true" /></div>
            <div className="mt-3 flex gap-2"><span className="inline-flex h-7 flex-1 items-center justify-center rounded bg-[#142235] px-2 text-[9px] font-semibold text-white">Review findings</span><span className="inline-flex h-7 items-center justify-center rounded border border-[#d8dde4] px-2 text-[9px] font-medium text-[#526074]">Approval stays human</span></div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function ProblemColumn({ index, title, text }: { index: string; title: string; text: string }) {
  return <article className="border-b border-[#142235]/15 py-5 last:border-b-0 sm:border-b-0 sm:px-5 sm:py-6 sm:first:pl-0 sm:last:pr-0"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#078779]">{index}</p><h3 className="mt-3 text-sm font-semibold">{title}</h3><p className="mt-2 text-xs leading-5 text-[#647084]">{text}</p></article>;
}

function Capability({ icon: Icon, title, text }: { icon: typeof BookOpenCheck; title: string; text: string }) {
  return <li className="flex gap-3"><span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-[#e6eaf5] text-[#2858d8]"><Icon className="size-4" aria-hidden="true" /></span><div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs leading-5 text-[#647084]">{text}</p></div></li>;
}

function EvidencePanel() {
  return (
    <div data-landing-reveal style={{ animationDelay: '100ms' }} className="overflow-hidden rounded-xl border border-[#d8dce2] bg-white shadow-[0_20px_50px_-34px_rgba(20,34,53,0.45)]">
      <div className="flex items-center justify-between border-b border-[#e6e9ed] px-4 py-3 sm:px-5"><div><p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[#8791a0]">Inside the review</p><h3 className="mt-1 text-sm font-semibold text-[#142235]">A finding with its source</h3></div><span className="rounded-full bg-[#f8f0df] px-2.5 py-1 text-[9px] font-semibold text-[#8b692f]">Needs checking</span></div>
      <div className="grid md:grid-cols-[0.9fr_1.1fr]">
        <div className="border-b border-[#e6e9ed] bg-[#f8f9fb] p-5 md:border-b-0 md:border-r"><p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8791a0]">Submitted copy · fictional demo</p><blockquote className="mt-4 border-l-2 border-[#d18b37] pl-3 text-sm leading-6 text-[#26364b]">“We cut onboarding time by <span className="rounded bg-[#f2d9aa] px-1 font-semibold">60%</span>.”</blockquote><p className="mt-5 flex items-center gap-2 text-[10px] text-[#687487]"><CircleAlert className="size-3.5 text-[#bb7828]" aria-hidden="true" />Claim requires a person’s verification</p></div>
        <div className="p-5"><div className="flex items-center gap-2"><BookOpenCheck className="size-4 text-[#2858d8]" aria-hidden="true" /><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#526074]">Approved fact · FACT-014</p></div><p className="mt-3 text-sm leading-6 text-[#26364b]">“Reduces onboarding time by up to 40% (2025 customer study)”</p><div className="mt-4 flex items-start gap-2 border-t border-[#edf0f2] pt-3"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#078779]" aria-hidden="true" /><p className="text-[11px] leading-5 text-[#647084]">The source passage is shown with the finding so a reviewer can assess the claim and decide what happens next.</p></div><div className="mt-4 flex gap-2"><span className="inline-flex h-8 items-center gap-1.5 rounded bg-[#142235] px-3 text-[10px] font-semibold text-white"><Check className="size-3" aria-hidden="true" />Approve</span><span className="inline-flex h-8 items-center rounded border border-[#d8dde4] px-3 text-[10px] font-medium text-[#526074]">Request changes</span></div></div>
      </div>
      <p className="border-t border-[#e6e9ed] bg-[#f8f9fb] px-5 py-2.5 text-[9px] leading-4 text-[#778396]">Illustrative presentation using the fictional AKS Company demo. AI findings may vary; this is not a live review.</p>
    </div>
  );
}
