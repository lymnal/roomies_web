// src/components/ui/Avatar.tsx
'use client';

import { useEffect, useState } from 'react';
import { cn, initials } from '@/lib/utils';

interface AvatarProps {
  src?: string | null;
  name: string;
  /** Pixel size (width and height). */
  size?: number;
  className?: string;
}

const PALETTE = [
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200',
  'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-200',
  'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-200',
  'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-200',
  'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-200',
];

function toneFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

/** Profile picture with a colour-coded initials fallback. Plain <img>: avatars come from many hosts. */
export default function Avatar({ src, name, size = 40, className = '' }: AvatarProps) {
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) };
  // A stale or unreachable picture URL falls back to initials instead of a broken image.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  useEffect(() => {
    setFailedSrc(null);
  }, [src]);

  if (src && failedSrc !== src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        style={style}
        onError={() => setFailedSrc(src)}
        className={cn('flex-shrink-0 rounded-full bg-slate-200 object-cover ring-2 ring-white dark:bg-slate-700 dark:ring-slate-900', className)}
      />
    );
  }

  return (
    <div
      style={style}
      aria-label={name}
      className={cn('flex flex-shrink-0 items-center justify-center rounded-full font-semibold ring-2 ring-white dark:ring-slate-900', toneFor(name), className)}
    >
      {initials(name)}
    </div>
  );
}

/** Overlapping row of avatars ("+3" when there are more). */
export function AvatarStack({ people, size = 28, max = 4 }: { people: { name: string; avatar?: string | null }[]; size?: number; max?: number }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((person, index) => (
        <div key={`${person.name}-${index}`} className={index > 0 ? '-ml-2' : ''}>
          <Avatar src={person.avatar} name={person.name} size={size} />
        </div>
      ))}
      {extra > 0 && (
        <div
          style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
          className="-ml-2 flex items-center justify-center rounded-full bg-slate-200 font-medium text-slate-600 ring-2 ring-white dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-900"
        >
          +{extra}
        </div>
      )}
    </div>
  );
}
