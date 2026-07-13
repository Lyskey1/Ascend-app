import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`card-surface p-4 ${
        onClick ? 'cursor-pointer active:brightness-125 transition-[filter]' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h3 className={`text-[11px] font-medium uppercase tracking-wide text-zinc-500 ${className}`}>{children}</h3>;
}

export function CardValue({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`text-[28px] leading-tight font-medium tabular-nums text-zinc-100 ${className}`}>{children}</p>;
}
