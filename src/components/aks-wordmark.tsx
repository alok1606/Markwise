type AksWordmarkProps = {
  className?: string;
  compact?: boolean;
};

/** Stylized wordmark for the fictional AKS Company demo brand. */
export function AksWordmark({ className = '', compact = false }: AksWordmarkProps) {
  return (
    <span role="img" aria-label="AKS Company" className={`inline-flex items-baseline gap-1.5 whitespace-nowrap ${className}`}>
      <span className="font-extrabold tracking-[-0.075em] text-[#142235]">AKS</span>
      <span aria-hidden="true" className={`inline-block w-px translate-y-[0.08em] bg-[#0f766e] ${compact ? 'h-[0.8em]' : 'h-[0.9em]'}`} />
      <span className={`font-semibold tracking-[0.16em] text-[#526174] ${compact ? 'text-[0.68em]' : 'text-[0.72em]'}`}>COMPANY</span>
    </span>
  );
}
