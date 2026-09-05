// src/components/ui/Logo.tsx
import Link from 'next/link';
import { HiOutlineHomeModern } from 'react-icons/hi2';
import { cn } from '@/lib/utils';

interface LogoProps {
  href?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Wordmark colour; defaults to the current text colour. */
  className?: string;
  wordmark?: boolean;
}

const SIZES = {
  sm: { box: 'h-7 w-7 rounded-lg', icon: 'h-4 w-4', text: 'text-base' },
  md: { box: 'h-9 w-9 rounded-xl', icon: 'h-5 w-5', text: 'text-lg' },
  lg: { box: 'h-11 w-11 rounded-2xl', icon: 'h-6 w-6', text: 'text-2xl' },
};

export default function Logo({ href = '/', size = 'md', className = '', wordmark = true }: LogoProps) {
  const s = SIZES[size];
  const content = (
    <span className={cn('inline-flex items-center gap-2.5 font-semibold tracking-tight', s.text, className)}>
      <span className={cn('inline-flex items-center justify-center bg-gradient-to-br from-brand-500 to-teal-600 text-white shadow-sm', s.box)}>
        <HiOutlineHomeModern className={s.icon} />
      </span>
      {wordmark && <span>Roomies</span>}
    </span>
  );
  return href ? (
    <Link href={href} className="inline-flex" aria-label="Roomies home">
      {content}
    </Link>
  ) : (
    content
  );
}
