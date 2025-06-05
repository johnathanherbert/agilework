"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
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
  
  // Versão atual do app - usar versão semântica do environment
  const currentVersion = process.env.NEXT_PUBLIC_APP_VERSION || process.env.NEXT_PUBLIC_BUILD_ID || 'development';
  
  // Ref para controlar se já foi mostrado o toast para esta versão
  const toastShownForVersion = useRef<string | null>(null);
  
  // Ref para controlar se já foi feito o reload para esta versão
  const reloadTriggeredForVersion = useRef<string | null>(null);

  // Função para verificar se há uma nova versão
  const checkForUpdate = useCallback(async () => {
    if (typeof window === 'undefined') return;

    // Não verificar atualizações em desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      console.log('Auto-update desabilitado em desenvolvimento');
      return;
    }

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
        
        // Obter a última versão conhecida do localStorage
        const lastKnownVersion = localStorage.getItem('app_last_known_version');
        
        // Em produção, inicializar com a versão do servidor se não existe versão conhecida
        if (!lastKnownVersion && process.env.NODE_ENV === 'production') {
          localStorage.setItem('app_last_known_version', serverVersion);
          setState({
            updateAvailable: false,
            isChecking: false,
            lastChecked: new Date(),
          });
          console.log('🔄 Versão inicial registrada:', serverVersion);
          return;
        }
          // Verificar se há uma nova versão comparando com a última versão conhecida
        const updateAvailable = Boolean(lastKnownVersion && 
                                serverVersion !== lastKnownVersion && 
                                serverVersion !== 'development' && 
                                lastKnownVersion !== 'development');
                                
        setState({
          updateAvailable,
          isChecking: false,
          lastChecked: new Date(),
        });

        // Se há uma atualização disponível, mostrar notificação e atualizar automaticamente
        // Mas apenas se ainda não foi mostrado o toast para esta versão E não foi feito reload
        if (updateAvailable && 
            toastShownForVersion.current !== serverVersion && 
            reloadTriggeredForVersion.current !== serverVersion) {
          
          toastShownForVersion.current = serverVersion;
          reloadTriggeredForVersion.current = serverVersion;
          
          console.log('🚀 Nova versão detectada:', serverVersion, 'anterior:', lastKnownVersion);
          
          // Atualizar a versão conhecida antes de fazer reload
          localStorage.setItem('app_last_known_version', serverVersion);
          
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

  // Função para resetar o estado de update (útil para debugging)
  const resetUpdateState = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('app_last_known_version');
      toastShownForVersion.current = null;
      reloadTriggeredForVersion.current = null;
      setState({
        updateAvailable: false,
        isChecking: false,
        lastChecked: null,
      });
      console.log('🔄 Estado de auto-update resetado');
    }
  }, []);// Verificar atualizações periodicamente
  useEffect(() => {
    // Em desenvolvimento, não verificar atualizações automaticamente
    if (process.env.NODE_ENV === 'development') {
      console.log('Auto-update desabilitado em desenvolvimento');
      return;
    }

    // Verificar imediatamente quando o hook é montado (apenas em produção)
    checkForUpdate();

    // Configurar verificação periódica a cada 10 minutos (aumentado para reduzir checagens)
    const interval = setInterval(checkForUpdate, 10 * 60 * 1000);

    // Verificar quando a aba ganha foco (apenas em produção)
    const handleFocus = () => {
      const now = new Date();
      const lastCheck = state.lastChecked;
      
      // Verificar se passou mais de 5 minutos desde a última verificação (aumentado)
      if (!lastCheck || (now.getTime() - lastCheck.getTime()) > 5 * 60 * 1000) {
        checkForUpdate();
      }
    };

    // Verificar quando a aba fica visível (mais específico que focus)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        const now = new Date();
        const lastCheck = state.lastChecked;
        
        // Verificar se passou mais de 5 minutos desde a última verificação
        if (!lastCheck || (now.getTime() - lastCheck.getTime()) > 5 * 60 * 1000) {
          checkForUpdate();
        }
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkForUpdate, state.lastChecked]);
  return {
    ...state,
    checkForUpdate,
    reloadApp,
    resetUpdateState,
    currentVersion,
  };
};
