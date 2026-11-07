import { CheckCheck } from 'lucide-react';
export function Brand({ inverse = false, size = 'default' }: { inverse?: boolean; size?: 'default' | 'large' }) {
  const isLarge = size === 'large';
  return (
    <span className={`inline-flex items-center gap-2.5 font-semibold tracking-[-0.045em] ${isLarge ? 'text-2xl sm:text-[1.8rem]' : 'text-xl'} ${inverse ? 'text-white' : 'text-foreground'}`}>
      <span className={`flex items-center justify-center rounded-xl shadow-sm ${isLarge ? 'size-10 sm:size-11' : 'size-8'} ${inverse ? 'bg-white text-brand-ink' : 'bg-primary text-primary-foreground'}`}>
        <CheckCheck className={isLarge ? 'size-6' : 'size-5'} aria-hidden="true" />
      </span>
      Markwise<span className={`-ml-1 ${inverse ? 'text-brand-teal' : 'text-primary'}`}>.</span>
    </span>
  );
}
