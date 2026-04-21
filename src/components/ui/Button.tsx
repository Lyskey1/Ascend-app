import type { ReactNode, ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

const variants = {
  primary: 'bg-white text-zinc-900 font-semibold active:bg-zinc-200 shadow-lg shadow-white/10',
  secondary: 'bg-zinc-800 text-zinc-100 font-medium active:bg-zinc-700 border border-zinc-700',
  ghost: 'text-zinc-400 font-medium active:text-zinc-200 active:bg-zinc-800/50',
  danger: 'bg-red-500/15 text-red-400 font-medium active:bg-red-500/25',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-4 py-2.5 text-sm rounded-xl',
  lg: 'px-6 py-3.5 text-base rounded-2xl',
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:pointer-events-none ${
        variants[variant]
      } ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
