"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useSupabase } from './supabase-provider';
import toast from 'react-hot-toast';

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

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);
  const [batchOperations, setBatchOperations] = useState<BatchOperation[]>([]);
  const batchTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const { user } = useSupabase();

  // Carregar configuração de notificações do localStorage ao iniciar
  useEffect(() => {
    if (user) {
      const savedSetting = localStorage.getItem(`notifications_enabled_${user.id}`);
      if (savedSetting !== null) {
        setNotificationsEnabled(savedSetting === 'true');
      }
      
      // Carregar notificações salvas do localStorage
      const savedNotifications = localStorage.getItem(`notifications_${user.id}`);
      if (savedNotifications) {
        try {
          const parsedNotifications = JSON.parse(savedNotifications);
          // Converter strings de data para objetos Date
          const formattedNotifications = parsedNotifications.map((notif: any) => ({
            ...notif,
            createdAt: new Date(notif.createdAt)
          }));
          setNotifications(formattedNotifications);
        } catch (error) {
          console.error('Erro ao carregar notificações:', error);
        }
      }
    }
  }, [user]);

  // Salvar notificações no localStorage quando houver mudanças
  useEffect(() => {
    if (user) {
      localStorage.setItem(`notifications_${user.id}`, JSON.stringify(notifications));
    }
  }, [notifications, user]);

  // Salvar configuração de notificações quando mudar
  useEffect(() => {
    if (user) {
      localStorage.setItem(`notifications_enabled_${user.id}`, notificationsEnabled.toString());
    }
  }, [notificationsEnabled, user]);
  // Escutar por eventos do Supabase para novas NTs
  useEffect(() => {
    if (!user || !notificationsEnabled) return;

    const ntsChannel = supabase
      .channel('nt_notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'nts' },
        (payload) => {
          if (notificationsEnabled) {
            const newNT = payload.new as any;
            
            // Check if this is part of a batch operation
            if (!isBatchOperationActive('nt_creation', newNT.id)) {
              addNotification({
                title: 'Nova NT Criada',
                message: `NT ${newNT.nt_number} foi criada às ${newNT.created_time}`,
                type: 'nt_created',
                entityId: newNT.id
              });
              
              // Mostrar toast para notificações imediatas
              toast.success(`Nova NT ${newNT.nt_number} criada!`, {
                icon: '🔔',
                duration: 5000,
              });
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'nt_items' },
        (payload) => {
          if (notificationsEnabled) {
            const newItem = payload.new as any;
            
            // Check if this is part of a batch operation (item addition or nt creation)
            if (!isBatchOperationActive('item_addition', newItem.nt_id) && 
                !isBatchOperationActive('nt_creation', newItem.nt_id)) {
              addNotification({
                title: 'Item Adicionado',
                message: `Item ${newItem.code} foi adicionado à NT`,
                type: 'item_added',
                entityId: newItem.id
              });
              
              toast.success(`Item ${newItem.code} adicionado!`, {
                icon: '➕',
                duration: 3000,
              });
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'nt_items' },
        (payload) => {
          if (notificationsEnabled) {
            const updatedItem = payload.new as any;
            
            addNotification({
              title: 'Item Atualizado',
              message: `Item ${updatedItem.code} foi atualizado`,
              type: 'item_updated',
              entityId: updatedItem.id
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'nt_items' },
        (payload) => {
          if (notificationsEnabled) {
            const deletedItem = payload.old as any;
            
            // Check if this is part of a batch operation (nt deletion)
            if (!isBatchOperationActive('nt_deletion', deletedItem.nt_id)) {
              addNotification({
                title: 'Item Removido',
                message: `Item ${deletedItem.code} foi removido`,
                type: 'item_deleted',
                entityId: deletedItem.id
              });
              
              toast.success(`Item ${deletedItem.code} removido!`, {
                icon: '🗑️',
                duration: 3000,
              });
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'nts' },
        (payload) => {
          if (notificationsEnabled) {
            const deletedNT = payload.old as any;
            
            // Check if this is part of a batch operation
            if (!isBatchOperationActive('nt_deletion', deletedNT.id)) {
              addNotification({
                title: 'NT Removida',
                message: `NT ${deletedNT.nt_number} foi removida`,
                type: 'nt_deleted',
                entityId: deletedNT.id
              });
              
              toast.success(`NT ${deletedNT.nt_number} removida!`, {
                icon: '🗑️',
                duration: 4000,
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ntsChannel);
    };
  }, [user, notificationsEnabled]);

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
    // This prevents stuck operations if something goes wrong
    const timeout = setTimeout(() => {
      endBatchOperation(operationId);
    }, 5000);
    
    batchTimeoutRef.current.set(operationId, timeout);
    
    return operationId;
  };

  const endBatchOperation = (operationId: string) => {
    const operation = batchOperations.find(op => op.id === operationId);
    
    if (operation) {
      // Clear timeout
      const timeout = batchTimeoutRef.current.get(operationId);
      if (timeout) {
        clearTimeout(timeout);
        batchTimeoutRef.current.delete(operationId);
      }
      
      // Remove operation from active operations
      setBatchOperations(prev => prev.filter(op => op.id !== operationId));
      
      // Show aggregated notification based on operation type
      if (notificationsEnabled) {
        switch (operation.type) {
          case 'nt_creation':
            if (operation.itemCount && operation.itemCount > 0) {
              const message = `NT foi criada com ${operation.itemCount} item${operation.itemCount > 1 ? 'ns' : ''}`;
              addNotification({
                title: 'NT Criada com Sucesso',
                message,
                type: 'nt_created',
                entityId: operation.entityId
              });
            }
            break;
            
          case 'item_addition':
            if (operation.itemCount && operation.itemCount > 0) {
              const message = `${operation.itemCount} item${operation.itemCount > 1 ? 'ns foram adicionados' : ' foi adicionado'} à NT`;
              addNotification({
                title: 'Itens Adicionados',
                message,
                type: 'item_added',
                entityId: operation.entityId
              });
            }
            break;
            
          case 'nt_deletion':
            addNotification({
              title: 'NT Removida',
              message: 'NT e todos os seus itens foram removidos',
              type: 'nt_deleted',
              entityId: operation.entityId
            });
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
  const value = {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    notificationsEnabled,
    setNotificationsEnabled,
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
