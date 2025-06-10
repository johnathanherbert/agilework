import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface PaidItem {
  id: string;
  code: string;
  description: string;
  quantity: number;
  paid_at: string;
  nt_number: string;
  paid_by_name?: string;
  updated_at: string;
  status: string;
}

interface RealtimeConnectionStatus {
  connected: boolean;
  lastUpdate: Date | null;
  reconnectAttempts: number;
  error?: string;
}

interface UseTimelineRealtimeOptions {
  limit?: number;
  autoReconnect?: boolean;
  debounceMs?: number;
}

export function useTimelineRealtime(options: UseTimelineRealtimeOptions = {}) {
  const {
    limit = 20,
    autoReconnect = true,
    debounceMs = 500
  } = options;
  const [paidItems, setPaidItems] = useState<PaidItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItemIds, setNewItemIds] = useState<Set<string>>(new Set());
  const [connectionStatus, setConnectionStatus] = useState<RealtimeConnectionStatus>({
    connected: false,
    lastUpdate: null,
    reconnectAttempts: 0
  });

  // Referencias para controle
  const channelRef = useRef<RealtimeChannel | null>(null);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchRef = useRef<Date>(new Date());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const visibilityTimeRef = useRef<Date>(new Date());

  // Função para buscar itens pagos
  const fetchPaidItems = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);

      const { data, error } = await supabase
        .from('nt_items')
        .select(`
          id,
          code,
          description,
          quantity,
          status,
          updated_at,
          paid_by_name,
          nt:nt_id (
            nt_number
          )
        `)
        .eq('status', 'Pago')
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ Timeline Hook - Error fetching paid items:', error);
        setConnectionStatus(prev => ({
          ...prev,
          error: error.message
        }));
        return;
      }

      const formattedItems: PaidItem[] = data?.map(item => ({
        id: item.id,
        code: item.code,
        description: item.description,
        quantity: item.quantity,
        paid_at: item.updated_at,
        nt_number: (item.nt as any)?.nt_number || 'N/A',
        paid_by_name: item.paid_by_name,
        updated_at: item.updated_at,
        status: item.status
      })) || [];

      // Detectar novos itens
      setPaidItems(prevItems => {
        const currentIds = new Set(prevItems.map(item => item.id));
        const newIds = new Set(formattedItems
          .filter(item => !currentIds.has(item.id))
          .map(item => item.id)
        );

        if (newIds.size > 0) {
          setNewItemIds(newIds);
          // Remover highlight após 45 segundos
          setTimeout(() => {
            setNewItemIds(new Set());
          }, 45000);
        }

        return formattedItems;
      });

      setConnectionStatus(prev => ({
        ...prev,
        lastUpdate: new Date(),
        reconnectAttempts: 0,
        error: undefined
      }));
      
      lastFetchRef.current = new Date();
    } catch (error) {
      console.error('❌ Timeline Hook - Error in fetchPaidItems:', error);
      setConnectionStatus(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    } finally {
      setLoading(false);
    }
  }, [limit]);

  // Debounced fetch
  const debouncedFetch = useCallback((delay = debounceMs) => {
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    fetchTimeoutRef.current = setTimeout(() => {
      fetchPaidItems();
    }, delay);
  }, [fetchPaidItems, debounceMs]);

  // Configurar canal de realtime
  const setupRealtimeChannel = useCallback(() => {
    console.log('🔧 Timeline Hook - Configurando canal realtime...');

    // Limpar canal anterior
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel('timeline_realtime_enhanced', {
        config: {
          presence: {
            key: 'timeline-user'
          },
          broadcast: {
            self: false
          }
        }
      })
      .on(
        'postgres_changes',
        { 
          event: '*',
          schema: 'public', 
          table: 'nt_items',
          filter: 'status=eq.Pago'
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          console.log('📦 Timeline Hook - Postgres change (Pago):', payload);
          
          const now = new Date();
          const timeSinceLastFetch = now.getTime() - lastFetchRef.current.getTime();
          
          if (timeSinceLastFetch < debounceMs) {
            console.log(`⏳ Timeline Hook - Debouncing (${timeSinceLastFetch}ms < ${debounceMs}ms)`);
            return;
          }

          debouncedFetch(300);
        }
      )
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE',
          schema: 'public', 
          table: 'nt_items',
          filter: 'status=eq.Pago Parcial'
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          console.log('📦 Timeline Hook - Postgres change (Pago Parcial):', payload);
          debouncedFetch(500);
        }
      )
      .on('broadcast', { event: 'item-paid' }, (payload) => {
        console.log('📢 Timeline Hook - Broadcast recebido:', payload);
        debouncedFetch(200);
      })
      .on('presence', { event: 'sync' }, () => {
        console.log('👥 Timeline Hook - Presence sync');
      });

    channelRef.current = channel;

    // Subscribe com retry
    const subscribeWithRetry = async (attempts = 0) => {
      try {
        await channel.subscribe((status, err) => {
          console.log(`📡 Timeline Hook - Status: ${status}`, err);
          
          setConnectionStatus(prev => {
            switch (status) {
              case 'SUBSCRIBED':
                return {
                  ...prev,
                  connected: true,
                  reconnectAttempts: 0,
                  error: undefined
                };
              case 'CHANNEL_ERROR':
              case 'TIMED_OUT':
              case 'CLOSED':
                return {
                  ...prev,
                  connected: false,
                  error: err?.message || status
                };
              default:
                return prev;
            }
          });

          // Auto reconnect
          if (autoReconnect && (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && attempts < 5) {
            const delay = Math.min(1000 * Math.pow(2, attempts), 10000);
            console.log(`🔄 Timeline Hook - Reconectando em ${delay}ms (tentativa ${attempts + 1})`);
            
            setConnectionStatus(prev => ({
              ...prev,
              reconnectAttempts: prev.reconnectAttempts + 1
            }));

            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current);
            }

            reconnectTimeoutRef.current = setTimeout(() => {
              subscribeWithRetry(attempts + 1);
            }, delay);
          }
        });
      } catch (error) {
        console.error('❌ Timeline Hook - Erro na subscrição:', error);
        
        if (autoReconnect && attempts < 3) {
          setTimeout(() => {
            subscribeWithRetry(attempts + 1);
          }, 2000);
        }
      }
    };

    subscribeWithRetry();

    return channel;
  }, [debouncedFetch, autoReconnect, debounceMs]);

  // Função manual para reconectar
  const reconnect = useCallback(() => {
    console.log('🔄 Timeline Hook - Reconexão manual iniciada...');
    setupRealtimeChannel();
  }, [setupRealtimeChannel]);

  // Função para forçar refresh
  const refreshItems = useCallback(() => {
    console.log('🔄 Timeline Hook - Refresh manual...');
    fetchPaidItems(true);
  }, [fetchPaidItems]);

  // Função para broadcast manual (útil para testes)
  const broadcastItemPaid = useCallback((itemData: any) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'item-paid',
        payload: itemData
      });
    }
  }, []);

  // Efeito principal
  useEffect(() => {
    console.log('🚀 Timeline Hook - Inicializando...');
    
    // Fetch inicial
    fetchPaidItems(true);

    // Configurar realtime
    const channel = setupRealtimeChannel();

    // Cleanup
    return () => {
      console.log('🧹 Timeline Hook - Cleanup...');
      
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (channel) {
        supabase.removeChannel(channel);
      }
    };  }, [fetchPaidItems, setupRealtimeChannel]);
  // Page Visibility API e Window Focus - Atualiza quando o usuário volta à aba/janela
  useEffect(() => {
    const checkForTimelineUpdate = () => {
      const now = new Date();      const timeSinceLastVisibility = now.getTime() - visibilityTimeRef.current.getTime();
      
      // Se passou mais de 5 segundos desde a última atualização, atualizar
      if (timeSinceLastVisibility > 5000) {
        fetchPaidItems();
        
        // Se o canal realtime não estiver conectado, tentar reconectar
        if (!connectionStatus.connected && autoReconnect) {
          console.log('🔄 Timeline Hook - Reconectando canal realtime...');
          setupRealtimeChannel();
        }
      }
      
      visibilityTimeRef.current = now;
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Usuário voltou à aba
        checkForTimelineUpdate();
      }
    };

    const handleFocus = () => {
      // Janela ganhou foco
      checkForTimelineUpdate();
    };

    // Adicionar listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchPaidItems, setupRealtimeChannel, connectionStatus.connected, autoReconnect]);

  return {
    // Data
    paidItems,
    loading,
    newItemIds,
    connectionStatus,
    
    // Actions
    refreshItems,
    reconnect,
    broadcastItemPaid,
    
    // Utilities
    isConnected: connectionStatus.connected,
    hasNewItems: newItemIds.size > 0,
    lastUpdate: connectionStatus.lastUpdate,
    error: connectionStatus.error
  };
}
