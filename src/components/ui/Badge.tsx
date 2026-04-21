import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'neutral';
  onClick?: () => void;
}

const variants = {
  default: 'bg-zinc-800 text-zinc-300',
  success: 'bg-emerald-500/15 text-emerald-400',
  warning: 'bg-amber-500/15 text-amber-400',
  danger: 'bg-red-500/15 text-red-400',
  neutral: 'bg-zinc-700/50 text-zinc-400',
};

export function Badge({ children, className = '', variant = 'default', onClick }: BadgeProps) {
  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${variants[variant]} ${
        onClick ? 'cursor-pointer active:opacity-70' : ''
      } ${className}`}
    >
      {children}
    </span>
  );
}
