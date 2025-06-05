"use client";

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

interface AppUpdateState {
  updateAvailable: boolean;
  isChecking: boolean;
  lastChecked: Date | null;
}

export const useAppUpdate = () => {
  const [state, setState] = useState<AppUpdateState>({
    updateAvailable: false,
    isChecking: false,
    lastChecked: null,
  });

  // Versão atual do app (será gerada em build time)
  const currentVersion = process.env.NEXT_PUBLIC_BUILD_ID || 'development';

  // Função para verificar se há uma nova versão
  const checkForUpdate = useCallback(async () => {
    if (typeof window === 'undefined') return;

    setState(prev => ({ ...prev, isChecking: true }));

    try {
      // Fazer request para a API que retorna a versão atual
      const response = await fetch('/api/version', { 
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const serverVersion = data.version;
        
        // Comparar versões
        const updateAvailable = serverVersion !== currentVersion && serverVersion !== 'development';
        
        setState({
          updateAvailable,
          isChecking: false,
          lastChecked: new Date(),
        });        // Se há uma atualização disponível, mostrar notificação e atualizar automaticamente
        if (updateAvailable) {
          toast.success('Nova versão detectada! Atualizando aplicação...', {
            duration: 3000,
            icon: '🚀',
          });

          // Aguardar um pouco antes de recarregar para não interromper ações do usuário
          setTimeout(() => {
            reloadApp();
          }, 2000);
        }
      }
    } catch (error) {
      console.log('Erro ao verificar atualizações:', error);
      setState(prev => ({ ...prev, isChecking: false, lastChecked: new Date() }));
    }
  }, [currentVersion]);

  // Função para recarregar o app
  const reloadApp = useCallback(() => {
    if (typeof window !== 'undefined') {
      // Limpar cache e recarregar
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          registrations.forEach(registration => registration.unregister());
        });
      }
      
      // Limpar caches do navegador
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => caches.delete(name));
        });
      }
      
      // Forçar recarregamento completo
      window.location.reload();
    }
  }, []);

  // Verificar atualizações periodicamente
  useEffect(() => {
    // Verificar imediatamente quando o hook é montado
    checkForUpdate();

    // Configurar verificação periódica a cada 5 minutos
    const interval = setInterval(checkForUpdate, 5 * 60 * 1000);

    // Verificar quando a aba ganha foco
    const handleFocus = () => {
      const now = new Date();
      const lastCheck = state.lastChecked;
      
      // Verificar se passou mais de 2 minutos desde a última verificação
      if (!lastCheck || (now.getTime() - lastCheck.getTime()) > 2 * 60 * 1000) {
        checkForUpdate();
      }
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [checkForUpdate, state.lastChecked]);

  return {
    ...state,
    checkForUpdate,
    reloadApp,
    currentVersion,
  };
};
