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

  // Função para recarregar o app limpando caches
  const reloadApp = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        // Limpar service workers se houver
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then(registrations => {
            registrations.forEach(registration => registration.unregister());
          }).catch(() => {});
        }
        
        // Limpar CacheStorage do navegador
        if ('caches' in window) {
          caches.keys().then(names => {
            names.forEach(name => caches.delete(name));
          }).catch(() => {});
        }
      } catch (err) {
        console.warn('Erro ao limpar caches antes do reload:', err);
      }
      
      // Forçar recarregamento completo
      window.location.reload();
    }
  }, []);

  // Função para verificar se há uma nova versão
  const checkForUpdate = useCallback(async () => {
    if (typeof window === 'undefined') return;

    // Não verificar atualizações em desenvolvimento local
    if (process.env.NODE_ENV === 'development') {
      return;
    }

    setState(prev => ({ ...prev, isChecking: true }));

    try {
      // Fazer request com timestamp para contornar qualquer proxy/CDN cache
      const response = await fetch(`/api/version?_t=${Date.now()}`, { 
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        // Usar assinatura única da build (versão + buildNumber/timestamp)
        const serverSignature = data.buildSignature || (data.buildNumber ? `${data.version}-${data.buildNumber}` : data.version);
        
        // Obter a última assinatura/versão conhecida do localStorage
        const lastKnownSignature = localStorage.getItem('app_last_known_signature') || localStorage.getItem('app_last_known_version');
        
        // Na primeira execução no terminal, registrar a versão atual do servidor
        if (!lastKnownSignature && process.env.NODE_ENV === 'production') {
          localStorage.setItem('app_last_known_signature', serverSignature);
          localStorage.setItem('app_last_known_version', data.version);
          setState({
            updateAvailable: false,
            isChecking: false,
            lastChecked: new Date(),
          });
          console.log('🔄 Versão inicial registrada no terminal:', serverSignature);
          return;
        }

        // Verificar se há uma nova versão comparando a assinatura
        const updateAvailable = Boolean(
          lastKnownSignature && 
          serverSignature !== lastKnownSignature && 
          serverSignature !== 'development' && 
          lastKnownSignature !== 'development'
        );
                                
        setState({
          updateAvailable,
          isChecking: false,
          lastChecked: new Date(),
        });

        // Se há uma atualização disponível, mostrar notificação e atualizar automaticamente
        if (
          updateAvailable && 
          toastShownForVersion.current !== serverSignature && 
          reloadTriggeredForVersion.current !== serverSignature
        ) {
          toastShownForVersion.current = serverSignature;
          reloadTriggeredForVersion.current = serverSignature;
          
          console.log('🚀 Nova versão detectada no VPS/Coolify:', serverSignature, 'anterior:', lastKnownSignature);
          
          // Atualizar o localStorage antes do reload
          localStorage.setItem('app_last_known_signature', serverSignature);
          localStorage.setItem('app_last_known_version', data.version);
          
          toast.success(`Nova versão (${data.version}) disponível! Atualizando terminal...`, {
            duration: 3500,
            icon: '🚀',
          });

          // Aguardar 2s para o usuário ler o aviso e recarregar limpando os caches
          setTimeout(() => {
            reloadApp();
          }, 2000);
        }
      }
    } catch (error) {
      console.log('Erro ao verificar atualizações:', error);
      setState(prev => ({ ...prev, isChecking: false, lastChecked: new Date() }));
    }
  }, [reloadApp]);

  // Função para resetar o estado de update (útil para debugging)
  const resetUpdateState = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('app_last_known_signature');
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
  }, []);

  // Verificar atualizações periodicamente e monitorar erros de chunk (ChunkLoadError)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      return;
    }

    // Verificar imediatamente quando o hook é montado
    checkForUpdate();

    // Verificação periódica a cada 45 segundos (garante que kiosks e painéis atualizem rápido após deploy no Coolify)
    const interval = setInterval(checkForUpdate, 45 * 1000);

    // Verificar quando a aba ganha foco
    const handleFocus = () => {
      const now = new Date();
      const lastCheck = state.lastChecked;
      if (!lastCheck || (now.getTime() - lastCheck.getTime()) > 15 * 1000) {
        checkForUpdate();
      }
    };

    // Verificar quando a aba fica visível
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        const now = new Date();
        const lastCheck = state.lastChecked;
        if (!lastCheck || (now.getTime() - lastCheck.getTime()) > 15 * 1000) {
          checkForUpdate();
        }
      }
    };

    // Verificar assim que a conexão de rede voltar (após o container swap no Coolify)
    const handleOnline = () => {
      checkForUpdate();
    };

    // Auto-recuperação de ChunkLoadError:
    // Se o Next.js falhar ao carregar um chunk antigo porque um novo container subiu no VPS,
    // recarrega a página automaticamente evitando tela branca.
    const handleError = (event: ErrorEvent) => {
      const msg = event.message || '';
      if (
        msg.includes('ChunkLoadError') ||
        msg.includes('Loading chunk') ||
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('Importing a module script failed')
      ) {
        console.warn('⚠️ Chunk antigo 404 detectado após redeploy. Atualizando página...');
        reloadApp();
      }
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason?.message || String(event.reason || '');
      if (
        reason.includes('ChunkLoadError') ||
        reason.includes('Loading chunk') ||
        reason.includes('Failed to fetch dynamically imported module') ||
        reason.includes('Importing a module script failed')
      ) {
        console.warn('⚠️ Chunk antigo 404 em Promise detectado após redeploy. Atualizando página...');
        reloadApp();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [checkForUpdate, reloadApp, state.lastChecked]);

  return {
    ...state,
    checkForUpdate,
    reloadApp,
    resetUpdateState,
    currentVersion,
  };
};
