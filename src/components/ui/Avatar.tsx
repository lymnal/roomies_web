// src/components/ui/Avatar.tsx
import { initials } from '@/lib/utils';

interface AvatarProps {
  src?: string | null;
  name: string;
  /** Pixel size (width and height). */
  size?: number;
  className?: string;
}

/** Profile picture with an initials fallback. Plain <img> because avatars come from many hosts. */
export default function Avatar({ src, name, size = 40, className = '' }: AvatarProps) {
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.4)) };

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        style={style}
        className={`rounded-full object-cover flex-shrink-0 bg-gray-200 dark:bg-gray-700 ${className}`}
      />
    );
  }

  return (
    <div
      style={style}
      aria-label={name}
      className={`rounded-full flex-shrink-0 flex items-center justify-center font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 ${className}`}
    >
      {initials(name)}
    </div>
  );
}
