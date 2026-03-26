"use client";

import { useFirebase } from '@/components/providers/firebase-provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, userData, loading } = useFirebase();
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

  // Se temos um user mas userData ainda está carregando, seguramos a tela
  if (user && !userData) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-blue-500"></div>
          <p className="text-lg text-gray-500 dark:text-gray-400">Verificando conta...</p>
        </div>
      </div>
    );
  }

  // Verifica se o usuário tem a flag de aprovado
  if (userData && !userData.isApproved) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-slate-900 p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 p-8 rounded-lg shadow-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100 mb-6">
            <svg className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-4 dark:text-white">Conta Pendente</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6 font-medium">
            Sua conta está aguardando aprovação ou foi desabilitada por um administrador.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Entre em contato com johnathan.herbert47@gmail.com para solicitar o acesso.
          </p>
          <button
            onClick={() => {
              // Limpar a sessão e mandar pro login
              import('@/components/providers/firebase-provider').then(({ useFirebase }) => {
                 // apenas força reload no browser pra deslogar dado que signOut do hook seria complexo chamar aqui fora de contexto
                 window.location.href = '/login';
              })
            }}
            className="w-full bg-stone-100 hover:bg-stone-200 text-stone-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white font-medium py-2 px-4 rounded transition-colors"
          >
            Voltar para Login
          </button>
        </div>
      </div>
    );
  }

  // If we have an approved user, render the children
  return <>{children}</>;
}
