   "use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useFirebase } from './firebase-provider';

// DEPRECATED: This provider is being replaced by FirebaseProvider
// Keeping for backward compatibility during migration
// TODO: Remove after all components migrate to useFirebase

interface SupabaseContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{
    error: any;
    success: boolean;
  }>;
  signUp: (email: string, password: string, name: string) => Promise<{
    error: any;
    success: boolean;
  }>;
  signOut: () => Promise<{ error: any }>;
}

const SupabaseContext = createContext<SupabaseContextType | undefined>(
  undefined
);

export function SupabaseProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Redirect to Firebase
  const firebase = useFirebase();
  
  // Convert Firebase user to Supabase-like format
  const user = firebase.user ? {
    id: firebase.user.uid,
    ...firebase.user
  } as any : null;

  const value = {
    user,
    session: null, // Firebase doesn't use sessions the same way
    loading: firebase.loading,
    signIn: firebase.signIn,
    signUp: firebase.signUp,
    signOut: firebase.signOut,
  };

  return (
    <SupabaseContext.Provider value={value}>
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabase() {
  const context = useContext(SupabaseContext);
  if (context === undefined) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
}