"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useFirebase, ADMIN_EMAIL } from './firebase-provider';
import { useAudioNotification, AudioConfig, SoundType } from '@/hooks/useAudioNotification';
import { PRODUCTION_COLLECTION } from '@/lib/production-helpers';
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
  type: 'nt_created' | 'nt_updated' | 'nt_deleted' | 'item_added' | 'item_updated' | 'item_deleted' | 'production_updated' | 'system';
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
  const { user, userData } = useFirebase();
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
  const playNotificationSound = (soundType?: 'notification' | 'subtle') => {
    if (!soundEnabled || !audioConfig.enabled) return;
    
    // Se um tipo específico foi passado, use-o temporariamente
    if (soundType) {
      playSound({ ...audioConfig, soundType });
    } else {
      playSound(audioConfig);
    }
  };

  // Função de teste de som
  const testSound = () => {
    testAudioSound(audioConfig);
  };

  // Firebase real-time listeners for notifications
  // NTs criadas/editadas e Items pagos
  useEffect(() => {
    if (!user || !notificationsEnabled) return;
    
    console.log('🔔 Configurando listeners de notificação Firebase para usuário:', user.uid);
    
    // Timestamp de quando o listener foi iniciado - ignora eventos anteriores
    const listenerStartTime = Date.now();
    
    // Listener para NTs criadas/editadas por outros usuários
    const ntsQuery = query(collection(db, 'nts'), orderBy('created_at', 'desc'));
    const unsubscribeNTs = onSnapshot(ntsQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const ntData = change.doc.data();
        const ntId = change.doc.id;
        
        console.log('🔔 Notificação - Mudança detectada em NT:', {
          type: change.type,
          ntId,
          nt_number: ntData.nt_number,
          created_by: ntData.created_by,
          created_by_name: ntData.created_by_name,
          updated_by: ntData.updated_by,
          updated_by_name: ntData.updated_by_name,
          currentUserId: user.uid
        });
        
        // Não notificar sobre ações do próprio usuário
        if (ntData.created_by === user.uid || ntData.updated_by === user.uid) {
          console.log('⏭️ Ignorando notificação - ação do próprio usuário');
          return;
        }
        
        // Notificar sobre NT criada
        if (change.type === 'added') {
          // Verificar se a NT foi criada recentemente (últimos 10 segundos)
          const createdAtTimestamp = ntData.created_at?.toMillis ? ntData.created_at.toMillis() : 0;
          const secondsSinceCreation = (Date.now() - createdAtTimestamp) / 1000;
          
          // Ignorar NTs antigas (criadas antes do listener iniciar ou há mais de 10s)
          if (createdAtTimestamp < listenerStartTime - 10000 || secondsSinceCreation > 10) {
            console.log(`⏭️ Ignorando NT antiga (criada há ${secondsSinceCreation.toFixed(0)}s)`);
            return;
          }
          
          const creatorName = ntData.created_by_name || 'Um usuário';
          console.log('📋 Notificando NT criada por:', creatorName);
          addNotification({
            title: 'Nova NT Criada',
            message: `${creatorName} criou a NT #${ntData.nt_number}`,
            type: 'nt_created',
            entityId: ntId,
          });
          playNotificationSound();
        }
        
        // Notificar sobre NT editada (número alterado)
        if (change.type === 'modified') {
          // Verificar se a NT foi atualizada recentemente (últimos 10 segundos)
          const updatedAtTimestamp = ntData.updated_at?.toMillis ? ntData.updated_at.toMillis() : 0;
          const secondsSinceUpdate = (Date.now() - updatedAtTimestamp) / 1000;
          
          // Ignorar atualizações antigas
          if (updatedAtTimestamp < listenerStartTime - 10000 || secondsSinceUpdate > 10) {
            console.log(`⏭️ Ignorando atualização antiga (atualizada há ${secondsSinceUpdate.toFixed(0)}s)`);
            return;
          }
          
          const editorName = ntData.updated_by_name || 'Um usuário';
          console.log('✏️ Notificando NT editada por:', editorName);
          addNotification({
            title: 'NT Atualizada',
            message: `${editorName} editou a NT #${ntData.nt_number}`,
            type: 'nt_updated',
            entityId: ntId,
          });
          playNotificationSound();
        }
        
        // Não notificamos sobre NTs deletadas para evitar excesso de notificações
      });
    });

    // Listener para items marcados como Pago/Pago Parcial por outros usuários
    const itemsQuery = query(collection(db, 'nt_items'), orderBy('updated_at', 'desc'));
    const unsubscribeItems = onSnapshot(itemsQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const itemData = change.doc.data();
        const itemId = change.doc.id;
        
        // Apenas notificar sobre modificações (mudança de status)
        if (change.type !== 'modified') {
          return;
        }
        
        console.log('🔔 Notificação - Item modificado:', {
          itemId,
          code: itemData.code,
          status: itemData.status,
          updated_by: itemData.updated_by,
          updated_by_name: itemData.updated_by_name,
          currentUserId: user.uid
        });
        
        // Não notificar sobre ações do próprio usuário
        if (itemData.updated_by === user.uid) {
          console.log('⏭️ Ignorando notificação - ação do próprio usuário');
          return;
        }
        
        // Notificar apenas quando item for marcado como Pago ou Pago Parcial
        if (itemData.status === 'Pago' || itemData.status === 'Pago Parcial') {
          // Verificar se o item foi atualizado recentemente (últimos 10 segundos)
          const updatedAtTimestamp = itemData.updated_at?.toMillis ? itemData.updated_at.toMillis() : 0;
          const secondsSinceUpdate = (Date.now() - updatedAtTimestamp) / 1000;
          
          // Ignorar atualizações antigas
          if (updatedAtTimestamp < listenerStartTime - 10000 || secondsSinceUpdate > 10) {
            console.log(`⏭️ Ignorando item pago antigo (atualizado há ${secondsSinceUpdate.toFixed(0)}s)`);
            return;
          }
          
          const payerName = itemData.updated_by_name || 'Um usuário';
          const statusText = itemData.status === 'Pago' ? 'pago' : 'pago parcialmente';
          console.log(`💰 Notificando item ${statusText} por:`, payerName);
          
          addNotification({
            title: `Item ${itemData.status}`,
            message: `${payerName} marcou o item ${itemData.code} como ${statusText}`,
            type: 'item_updated',
            entityId: itemId,
          });
          playNotificationSound('subtle'); // Som discreto para itens pagos
        }
      });
    });

    console.log('✅ Listeners de notificação Firebase configurados (NTs e Items pagos)');

    return () => {
      console.log('🔇 Desconectando listeners de notificação Firebase');
      unsubscribeNTs();
      unsubscribeItems();
    };
  }, [user, notificationsEnabled, audioConfig, soundEnabled]);

  // Listener para edições no Painel de Produção (somente para Líderes e Admin Global,
  // já que são os únicos que enxergam essa tela)
  useEffect(() => {
    const isLeaderOrAdmin = userData?.email === ADMIN_EMAIL || userData?.role === 'leader';
    if (!user || !notificationsEnabled || !isLeaderOrAdmin) return;

    console.log('🔔 Configurando listener de notificação do Painel de Produção');

    const listenerStartTime = Date.now();

    const productionQuery = collection(db, PRODUCTION_COLLECTION);
    const unsubscribeProduction = onSnapshot(productionQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'removed') return; // Evita ruído em exclusões

        const itemData = change.doc.data();
        const itemId = change.doc.id;

        // Não notificar sobre ações do próprio usuário
        if (itemData.updated_by === user.uid) return;

        const updatedAtTimestamp = itemData.updated_at?.toMillis ? itemData.updated_at.toMillis() : 0;
        const secondsSinceUpdate = (Date.now() - updatedAtTimestamp) / 1000;

        // Ignorar mudanças antigas (antes do listener iniciar ou há mais de 10s)
        if (updatedAtTimestamp < listenerStartTime - 10000 || secondsSinceUpdate > 10) return;

        const editorName = itemData.updated_by_name || 'Um usuário';
        const actionText = change.type === 'added' ? 'adicionou um item em' : 'atualizou';

        addNotification({
          title: 'Quadro de Produção',
          message: `${editorName} ${actionText} o quadro de produção (Turno ${itemData.turno})`,
          type: 'production_updated',
          entityId: itemId,
        });
        playNotificationSound('subtle');
      });
    });

    console.log('✅ Listener de notificação do Painel de Produção configurado');

    return () => {
      console.log('🔇 Desconectando listener de notificação do Painel de Produção');
      unsubscribeProduction();
    };
  }, [user, userData, notificationsEnabled, audioConfig, soundEnabled]);

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
      notification: '🔔 Notificação Moderna',
      subtle: '🔕 Discreto',
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
