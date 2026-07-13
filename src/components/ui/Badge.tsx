import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'neutral';
  onClick?: () => void;
}

const variants = {
  default: 'bg-zinc-800 text-zinc-300',
  success: 'bg-positive/10 text-positive',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-negative/10 text-negative',
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
