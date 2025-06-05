"use client";

import { useEffect } from 'react';
import { useAppUpdate } from '@/hooks/useAppUpdate';

export function AppUpdateManager() {
  const { updateAvailable, checkForUpdate } = useAppUpdate();

  // O hook já faz a verificação automática, este componente apenas
  // garante que o sistema esteja ativo no layout principal
  useEffect(() => {
    // Log para desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      console.log('Sistema de auto-atualização ativo');
    }
  }, []);

  // Este componente não renderiza nada visualmente
  // Toda a lógica está no hook useAppUpdate
  return null;
}
