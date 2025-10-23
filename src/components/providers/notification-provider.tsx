"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useFirebase } from './firebase-provider';
import { useAudioNotification, AudioConfig, SoundType } from '@/hooks/useAudioNotification';
import toast from 'react-hot-toast';

// Helper function to get user display name
const getUserDisplayName = (user: any): string => {
  if (user?.user_metadata?.name) {
    return user.user_metadata.name;
  }
  if (user?.email) {
    return user.email.split('@')[0];
  }
  return 'usuário';
};

// Definição do tipo de notificação
export type Notification = {
  id: string;
  title: string;
  message: string;
  createdAt: Date;
  read: boolean;
  type: 'nt_created' | 'nt_updated' | 'nt_deleted' | 'item_added' | 'item_updated' | 'item_deleted' | 'system';
  entityId?: string; // ID da entidade relacionada (NT, item, etc.)
};

// Tipo para operações em lote
type BatchOperation = {
  id: string;
  type: 'nt_creation' | 'item_addition' | 'nt_deletion';
  entityId: string;
  startTime: number;
  itemCount?: number;
};

// Contexto de notificação
type NotificationContextType = {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;  // Audio configuration
  audioConfig: AudioConfig;
  setAudioConfig: (config: AudioConfig) => void;
  updateAudioConfig: (config: Partial<AudioConfig>) => void;
  testSound: () => void;
  // Batch operation tracking
  startBatchOperation: (type: BatchOperation['type'], entityId: string, itemCount?: number) => string;
  endBatchOperation: (operationId: string) => void;
  isBatchOperationActive: (type: BatchOperation['type'], entityId?: string) => boolean;
};

const NotificationContext = createContext<NotificationContextType | null>(null);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications deve ser usado dentro de um NotificationProvider');
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useFirebase();
  const { playSound, testSound: testAudioSound, loadAudioConfig, saveAudioConfig } = useAudioNotification();
  
  // Estados das notificações
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // Configuração de áudio
  const [audioConfig, setAudioConfig] = useState<AudioConfig>({
    enabled: true,
    volume: 0.5,
    soundType: 'default' as SoundType
  });

  // Batch operations tracking
  const [batchOperations, setBatchOperations] = useState<BatchOperation[]>([]);
  const batchTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
  // Carregar notificações do localStorage
  useEffect(() => {
    if (user) {
      const savedNotifications = localStorage.getItem(`notifications_${user.uid}`);
      if (savedNotifications) {
        try {
          const parsed = JSON.parse(savedNotifications);
          setNotifications(parsed.map((notif: any) => ({
            ...notif,
            createdAt: new Date(notif.createdAt)
          })));
        } catch (error) {
          console.error('Error parsing saved notifications:', error);
        }
      }

      // Carregar configuração de notificações
      const savedNotificationsEnabled = localStorage.getItem(`notifications_enabled_${user.uid}`);
      if (savedNotificationsEnabled !== null) {
        setNotificationsEnabled(savedNotificationsEnabled === 'true');
      }

      // Carregar configuração de áudio usando o hook
      const loadedAudioConfig = loadAudioConfig(user.uid);
      setAudioConfig(loadedAudioConfig);
      setSoundEnabled(loadedAudioConfig.enabled);
    }
  }, [user, loadAudioConfig]);

  // Salvar notificações no localStorage quando mudarem
  useEffect(() => {
    if (user) {
      localStorage.setItem(`notifications_${user.uid}`, JSON.stringify(notifications));
    }
  }, [notifications, user]);

  // Salvar configuração de notificações quando mudar
  useEffect(() => {
    if (user) {
      localStorage.setItem(`notifications_enabled_${user.uid}`, notificationsEnabled.toString());
    }
  }, [notificationsEnabled, user]);
  // Salvar configuração de áudio quando mudar
  useEffect(() => {
    if (user) {
      saveAudioConfig(audioConfig, user.uid);
    }
  }, [audioConfig, user, saveAudioConfig]);

  // Atualizar soundEnabled quando audioConfig.enabled mudar
  useEffect(() => {
    setSoundEnabled(audioConfig.enabled);
  }, [audioConfig.enabled]);

  // Função para tocar som de notificação
  const playNotificationSound = () => {
    if (!soundEnabled || !audioConfig.enabled) return;
    playSound(audioConfig);
  };

  // Função de teste de som
  const testSound = () => {
    testAudioSound(audioConfig);
  };

  // Firebase real-time listeners for notifications
  // Apenas para NTs criadas e atualizadas (não items para evitar spam)
  useEffect(() => {
    if (!user || !notificationsEnabled) return;
    
    console.log('🔔 Configurando listeners de notificação Firebase para usuário:', user.uid);
    
    // Listener para NTs criadas/editadas por outros usuários
    const ntsQuery = query(collection(db, 'nts'), orderBy('created_at', 'desc'));
    const unsubscribeNTs = onSnapshot(ntsQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const ntData = change.doc.data();
        const ntId = change.doc.id;
        
        // Não notificar sobre ações do próprio usuário
        if (ntData.created_by === user.uid || ntData.updated_by === user.uid) {
          return;
        }
        
        // Notificar sobre NT criada
        if (change.type === 'added') {
          const creatorName = ntData.created_by_name || 'Um usuário';
          addNotification({
            title: 'Nova NT Criada',
            message: `${creatorName} criou a NT #${ntData.nt_number}`,
            type: 'nt_created',
            entityId: ntId,
          });
          playNotificationSound();
          toast.success(`Nova NT #${ntData.nt_number} criada por ${creatorName}`, {
            icon: '📋',
            duration: 4000,
          });
        }
        
        // Notificar sobre NT editada (número alterado)
        if (change.type === 'modified') {
          const editorName = ntData.updated_by_name || 'Um usuário';
          addNotification({
            title: 'NT Atualizada',
            message: `${editorName} editou a NT #${ntData.nt_number}`,
            type: 'nt_updated',
            entityId: ntId,
          });
          playNotificationSound();
          toast.success(`NT #${ntData.nt_number} editada por ${editorName}`, {
            icon: '✏️',
            duration: 4000,
          });
        }
        
        // Não notificamos sobre NTs deletadas para evitar excesso de notificações
      });
    });

    console.log('✅ Listeners de notificação Firebase configurados (apenas NTs)');

    return () => {
      console.log('🔇 Desconectando listeners de notificação Firebase');
      unsubscribeNTs();
    };
  }, [user, notificationsEnabled, audioConfig, soundEnabled]);

  // Batch operation management
  const startBatchOperation = (type: BatchOperation['type'], entityId: string, itemCount?: number): string => {
    const operationId = crypto.randomUUID();
    const operation: BatchOperation = {
      id: operationId,
      type,
      entityId,
      startTime: Date.now(),
      itemCount
    };
    
    setBatchOperations(prev => [...prev, operation]);
    
    // Set a timeout to automatically end the operation after 5 seconds
    const timeout = setTimeout(() => {
      endBatchOperation(operationId);
    }, 5000);
    
    batchTimeoutRef.current[operationId] = timeout;
    
    return operationId;
  };

  const endBatchOperation = (operationId: string) => {
    const operation = batchOperations.find(op => op.id === operationId);
    
    if (operation) {
      // Clear timeout
      const timeout = batchTimeoutRef.current[operationId];
      if (timeout) {
        clearTimeout(timeout);
        delete batchTimeoutRef.current[operationId];
      }
      
      // Remove operation from active operations
      setBatchOperations(prev => prev.filter(op => op.id !== operationId));
      
      // Show aggregated notification based on operation type
      if (notificationsEnabled) {
        switch (operation.type) {
          case 'nt_creation':
            if (operation.itemCount && operation.itemCount > 0) {
              const message = `NT criada com ${operation.itemCount} item${operation.itemCount > 1 ? 'ns' : ''}`;
              addNotification({
                title: 'NT Criada com Sucesso',
                message,
                type: 'nt_created',
                entityId: operation.entityId
              });
            }
            break;
            
          // Não mostrar notificações para outras operações
          case 'item_addition':
          case 'nt_deletion':
            break;
        }
      }
    }
  };

  const isBatchOperationActive = (type: BatchOperation['type'], entityId?: string): boolean => {
    return batchOperations.some(op => 
      op.type === type && (!entityId || op.entityId === entityId)
    );
  };

  // Calcular número de notificações não lidas
  const unreadCount = notifications.filter(notif => !notif.read).length;

  // Adicionar nova notificação
  const addNotification = (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
    if (!notificationsEnabled) return;
    
    const newNotification: Notification = {
      ...notification,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      read: false,
    };

    setNotifications(prev => [newNotification, ...prev]);
  };

  // Marcar notificação como lida
  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
  };

  // Marcar todas as notificações como lidas
  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(notif => ({ ...notif, read: true }))
    );
  };
  // Limpar todas as notificações
  const clearNotifications = () => {
    setNotifications([]);
  };

  // Atualizar configuração de áudio com feedback
  const updateAudioConfig = (newConfig: Partial<AudioConfig>) => {
    const updatedConfig = { ...audioConfig, ...newConfig };
    setAudioConfig(updatedConfig);
    setSoundEnabled(updatedConfig.enabled);
    
    // Feedback visual baseado na mudança
    if (newConfig.enabled !== undefined) {
      if (newConfig.enabled) {
        toast.success('Sons de notificação ativados', { icon: '🔊' });
      } else {
        toast.success('Sons de notificação desativados', { icon: '🔇' });
      }
    }
    
    if (newConfig.soundType !== undefined) {
      toast.success(`Som alterado para: ${getSoundTypeName(newConfig.soundType)}`, { icon: '🎵' });
    }
    
    if (newConfig.volume !== undefined) {
      const volumePercent = Math.round(newConfig.volume * 100);
      toast.success(`Volume: ${volumePercent}%`, { icon: '🔊', duration: 2000 });
    }
  };
  // Helper para obter nome amigável do tipo de som
  const getSoundTypeName = (soundType: SoundType): string => {
    const names = {
      impact: '💥 Impacto Dramático',
      triumph: '🏆 Triunfo Épico',
      alert: '🚨 Alerta Urgente',
      fanfare: '🎺 Fanfarra Completa',
      power: '⚡ Poder Absoluto',
      classic: '👑 Clássico Refinado'
    };
    return names[soundType] || soundType;
  };
  const value = {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    notificationsEnabled,
    setNotificationsEnabled,
    soundEnabled,
    setSoundEnabled,
    audioConfig,
    setAudioConfig,
    updateAudioConfig,
    testSound,
    startBatchOperation,
    endBatchOperation,
    isBatchOperationActive,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
