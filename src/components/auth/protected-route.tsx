"use client";

import { useFirebase } from '@/components/providers/firebase-provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useFirebase();
  const router = useRouter();

  useEffect(() => {
    // Check if the user is loaded and not authenticated
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-blue-500"></div>
          <p className="text-lg text-gray-500 dark:text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  // If no user and not loading, don't render children (will redirect in effect)
  if (!user) {
    return null;
  }

  // If we have a user, render the children
  return <>{children}</>;
}
