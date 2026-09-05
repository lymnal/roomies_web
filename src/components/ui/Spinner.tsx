// src/components/ui/Spinner.tsx
export default function Spinner({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const dims = size === 'sm' ? 'h-5 w-5 border-2' : size === 'lg' ? 'h-12 w-12 border-b-2 border-t-2' : 'h-8 w-8 border-b-2';
  return <div className={`animate-spin rounded-full border-blue-500 ${dims} ${className}`} aria-label="Loading" />;
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}
