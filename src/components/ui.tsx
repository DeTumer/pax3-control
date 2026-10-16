import type { ButtonHTMLAttributes, ReactNode } from 'react';

export const Card = ({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) => (
  <section className={`rounded-2xl border border-edge bg-panel p-4 ${className}`}>
    {(title || actions) && (
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">{title}</h2>
        <div className="flex flex-wrap gap-2">{actions}</div>
      </header>
    )}
    {children}
  </section>
);

type Variant = 'primary' | 'ghost' | 'danger';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-black hover:brightness-110',
  ghost: 'border border-edge hover:bg-white/5',
  danger: 'border border-red-500/50 text-red-300 hover:bg-red-500/10',
};

export const Button = ({ variant = 'ghost', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) => (
  <button
    {...props}
    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
  />
);

export const Badge = ({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'ok' | 'warn' | 'bad' | 'accent' }) => {
  const tones = {
    muted: 'bg-white/5 text-muted',
    ok: 'bg-emerald-500/15 text-emerald-300',
    warn: 'bg-amber-500/15 text-amber-300',
    bad: 'bg-red-500/15 text-red-300',
    accent: 'bg-accent/15 text-accent',
  };
  return <span className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
};

export const Hex = ({ value, className = '' }: { value?: string; className?: string }) => (
  <code className={`font-mono text-xs break-all ${className}`}>{value ? value.replace(/(..)/g, '$1 ').trim() : '—'}</code>
);

export const Row = ({ label, children }: { label: ReactNode; children: ReactNode }) => (
  <div className="flex items-baseline justify-between gap-3 py-1 text-sm">
    <span className="text-muted">{label}</span>
    <span className="text-right">{children}</span>
  </div>
);

export const hexByte = (n: number) => `0x${n.toString(16).padStart(2, '0')}`;

export const downloadJson = (name: string, data: unknown) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
};

/** Experimental writes ask first; formats are unconfirmed. */
export const confirmExperimental = (what: string) =>
  window.confirm(`${what}\n\nThis attribute's format is not confirmed. Send anyway?`);
