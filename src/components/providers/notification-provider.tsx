"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
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
  type: 'nt_created' | 'nt_updated' | 'system';
  entityId?: string; // ID da entidade relacionada (NT, item, etc.)
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
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ntsChannel);
    };
  }, [user, notificationsEnabled]);

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
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
