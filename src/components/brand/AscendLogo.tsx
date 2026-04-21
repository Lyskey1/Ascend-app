interface AscendLogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'full' | 'icon';
  className?: string;
}

const sizes = {
  sm: { icon: 20, text: 'text-sm', gap: 'gap-1.5' },
  md: { icon: 28, text: 'text-2xl', gap: 'gap-2' },
  lg: { icon: 36, text: 'text-3xl', gap: 'gap-2.5' },
};

/**
 * ASCEND brand logo.
 *
 * The icon is a stylised "A" / upward peak formed by three rising bars
 * that double as a bar-chart motif — communicating growth, progression,
 * and upward momentum.
 */
export function AscendLogo({ size = 'md', variant = 'full', className = '' }: AscendLogoProps) {
  const s = sizes[size];

  const icon = (
    <svg
      width={s.icon}
      height={s.icon}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="flex-shrink-0"
    >
      {/* Three rising bars forming an A-peak / upward chart */}
      <rect x="3" y="18" width="6" height="12" rx="2" fill="var(--color-zinc-500)" />
      <rect x="13" y="9" width="6" height="21" rx="2" fill="url(#ascend-grad)" />
      <rect x="23" y="14" width="6" height="16" rx="2" fill="var(--color-zinc-400)" />
      {/* Upward arrow / peak accent */}
      <path
        d="M16 2L20.5 8.5H11.5L16 2Z"
        fill="url(#ascend-grad)"
      />
      <defs>
        <linearGradient id="ascend-grad" x1="16" y1="0" x2="16" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3b82f6" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
      </defs>
    </svg>
  );

  if (variant === 'icon') {
    return <span className={className}>{icon}</span>;
  }

  return (
    <span className={`inline-flex items-end ${s.gap} ${className}`}>
      {icon}
      <span className={`${s.text} font-extrabold tracking-tight text-zinc-50`}>
        ASCEND
      </span>
    </span>
  );
}
