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
      className={`rounded-2xl border border-zinc-800/50 bg-zinc-900/50 p-4 ${
        onClick ? 'cursor-pointer active:bg-zinc-800/50 transition-colors' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h3 className={`text-sm font-medium text-zinc-400 ${className}`}>{children}</h3>;
}

export function CardValue({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`text-2xl font-bold text-zinc-50 ${className}`}>{children}</p>;
}
