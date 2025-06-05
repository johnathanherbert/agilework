"use client";

import { useEffect } from 'react';
import { useAppUpdate } from '@/hooks/useAppUpdate';

export function AppUpdateManager() {
  const { updateAvailable, checkForUpdate, currentVersion, resetUpdateState } = useAppUpdate();

  // O hook já faz a verificação automática, este componente apenas
  // garante que o sistema esteja ativo no layout principal
  useEffect(() => {
    // Log para desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Sistema de auto-atualização inicializado');
      console.log('📱 Versão atual:', currentVersion);
      console.log('⚠️  Auto-update desabilitado em desenvolvimento');
      
      // Disponibilizar função de reset no console para debugging
      (window as any).resetAppUpdateState = resetUpdateState;
      console.log('🛠️  Use window.resetAppUpdateState() para resetar o estado de update');
    } else {
      console.log('🚀 Sistema de auto-atualização ativo em produção');
      console.log('📱 Versão atual:', currentVersion);
      
      // Verificar se existe versão conhecida no localStorage
      const lastKnownVersion = localStorage.getItem('app_last_known_version');
      if (lastKnownVersion) {
        console.log('💾 Última versão conhecida:', lastKnownVersion);
      } else {
        console.log('🆕 Primeira execução - registrando versão');
      }
    }
  }, [currentVersion, resetUpdateState]);

  // Este componente não renderiza nada visualmente
  // Toda a lógica está no hook useAppUpdate
  return null;
}
