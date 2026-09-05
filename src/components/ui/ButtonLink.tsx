// src/components/ui/ButtonLink.tsx
// A Next.js Link that looks like a Button (navigation should stay a real link).
import Link, { LinkProps } from 'next/link';
import { AnchorHTMLAttributes, ReactNode } from 'react';
import { buttonClasses, type ButtonSize, type ButtonVariant } from './Button';

interface ButtonLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: LinkProps['href'];
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children: ReactNode;
}

export default function ButtonLink({ href, variant, size, fullWidth, leftIcon, rightIcon, className, children, ...props }: ButtonLinkProps) {
  return (
    <Link href={href} className={buttonClasses({ variant, size, fullWidth, className })} {...props}>
      {leftIcon && <span className="-ml-0.5 flex-shrink-0">{leftIcon}</span>}
      {children}
      {rightIcon && <span className="-mr-0.5 flex-shrink-0">{rightIcon}</span>}
    </Link>
  );
}
