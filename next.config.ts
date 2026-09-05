import type { NextConfig } from 'next';

const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : null;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Google profile pictures (OAuth sign-in)
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      // Avatars uploaded to Supabase Storage
      { protocol: 'https', hostname: supabaseHost ?? '*.supabase.co' },
    ],
  },
};

export default nextConfig;
