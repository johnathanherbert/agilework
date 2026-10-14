   "use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/components/providers/supabase-provider';

import { PageLoader } from '@/components/line-loader';

export default function Home() {
  const router = useRouter();
  const { user, loading } = useSupabase();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  return <PageLoader fullScreen label="Carregando AgileWork…" />;
}