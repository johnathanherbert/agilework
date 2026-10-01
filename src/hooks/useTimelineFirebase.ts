import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, where, orderBy, limit as firestoreLimit, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface TimelinePaidItem {
  id: string;
  code: string;
  description: string;
  quantity: string;
  batch: string | null;
  status: string;
  payment_time: string | null;
  created_date: string;
  created_time: string;
  nt_id: string;
  nt_number: string;
  paid_at: Date;
  elapsedTime?: string; // Tempo desde criação até pagamento
  isPriority?: boolean;
}

interface TimelineStats {
  totalPaidToday: number;
  averagePaymentTime: string;
  fastestPayment: string;
  slowestPayment: string;
}

interface UseTimelineFirebaseOptions {
  limit?: number;
  timeWindow?: 'today' | 'last24h' | 'all';
}

export function useTimelineFirebase(options: UseTimelineFirebaseOptions = {}) {
  const {
    limit = 30,
    timeWindow = 'today'
  } = options;

  const [paidItems, setPaidItems] = useState<TimelinePaidItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItemIds, setNewItemIds] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<TimelineStats>({
    totalPaidToday: 0,
    averagePaymentTime: '0h 0m',
    fastestPayment: '-',
    slowestPayment: '-'
  });
  const [isConnected, setIsConnected] = useState(false);

  const ntsMapRef = useRef<Map<string, string>>(new Map());
  const previousItemsRef = useRef<Set<string>>(new Set());

  // Utilitário para converter campos de data/hora em Date
  const parseDateTime = (dateStr?: string | null, timeStr?: string | null, timestamp?: any): Date | null => {
    try {
      if (timestamp) {
        if (timestamp instanceof Date && !isNaN(timestamp.getTime())) return timestamp;
        if (typeof timestamp.toDate === 'function') {
          const d = timestamp.toDate();
          if (!isNaN(d.getTime())) return d;
        }
        const d = new Date(timestamp);
        if (!isNaN(d.getTime())) return d;
      }

      if (!dateStr || typeof dateStr !== 'string') return null;

      if (dateStr.includes('T') || (dateStr.includes('-') && dateStr.length >= 10 && !dateStr.includes('/'))) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) return d;
      }

      let day = 1, month = 1, year = 1970;
      if (dateStr.includes('/')) {
        const parts = dateStr.split('/').map(Number);
        if (parts.length === 3) [day, month, year] = parts;
      } else if (dateStr.includes('-')) {
        const parts = dateStr.split('-').map(Number);
        if (parts.length === 3) {
          if (parts[0] > 1000) [year, month, day] = parts;
          else [day, month, year] = parts;
        }
      }

      let hours = 0, minutes = 0;
      if (timeStr && typeof timeStr === 'string') {
        const tParts = timeStr.split(':').map(Number);
        if (!isNaN(tParts[0])) hours = tParts[0];
        if (!isNaN(tParts[1])) minutes = tParts[1];
      }

      const d = new Date(year, month - 1, day, hours, minutes);
      return isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  };

  // Calcular tempo decorrido entre criação e pagamento
  const calculateElapsedTime = (
    createdDate?: string | null,
    createdTime?: string | null,
    paymentTime?: string | null,
    createdAt?: any,
    updatedAt?: any
  ): string => {
    try {
      const created = parseDateTime(createdDate, createdTime, createdAt);
      if (!created) return '-';

      let paid: Date | null = null;
      if (paymentTime && typeof paymentTime === 'string') {
        const pt = paymentTime.trim();
        if (pt.includes('T') || (pt.includes('-') && pt.length >= 10)) {
          const d = new Date(pt);
          if (!isNaN(d.getTime())) paid = d;
        } else {
          const match = pt.match(/^(\d{1,2}):(\d{2})/);
          if (match) {
            const h = parseInt(match[1], 10);
            const m = parseInt(match[2], 10);
            paid = new Date(created.getTime());
            paid.setHours(h, m, 0, 0);
            if (paid.getTime() < created.getTime()) {
              paid.setDate(paid.getDate() + 1);
            }
          }
        }
      }

      if (!paid && updatedAt) {
        paid = parseDateTime(null, null, updatedAt);
      }

      if (!paid) return '-';

      const diffMs = paid.getTime() - created.getTime();
      const diffMins = Math.max(0, Math.floor(diffMs / 60000));
      const hours = Math.floor(diffMins / 60);
      const minutes = diffMins % 60;

      return `${hours}h ${minutes < 10 ? '0' : ''}${minutes}m`;
    } catch (error) {
      return '-';
    }
  };

  // Calcular estatísticas
  const calculateStats = useCallback((items: TimelinePaidItem[]) => {
    if (items.length === 0) {
      setStats({
        totalPaidToday: 0,
        averagePaymentTime: '—',
        fastestPayment: '—',
        slowestPayment: '—'
      });
      return;
    }

    // Filtrar itens pagos hoje
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const paidToday = items.filter(item => {
      if (!item.paid_at || !(item.paid_at instanceof Date) || isNaN(item.paid_at.getTime())) return false;
      const itemDate = new Date(item.paid_at);
      itemDate.setHours(0, 0, 0, 0);
      return itemDate.getTime() === today.getTime();
    });

    // Usar itens pagos hoje se houver pelo menos um com tempo calculado, senão todos
    const targetItems = paidToday.some(item => item.elapsedTime && item.elapsedTime !== '-')
      ? paidToday
      : items;

    // Calcular tempos em minutos
    const times = targetItems
      .filter(item => item.elapsedTime && item.elapsedTime !== '-')
      .map(item => {
        const [hours, minutes] = item.elapsedTime!.split('h ').map(s => parseInt(s));
        return (isNaN(hours) ? 0 : hours) * 60 + (isNaN(minutes) ? 0 : minutes);
      })
      .filter(time => !isNaN(time) && time >= 0);

    if (times.length === 0) {
      setStats({
        totalPaidToday: paidToday.length,
        averagePaymentTime: '—',
        fastestPayment: '—',
        slowestPayment: '—'
      });
      return;
    }

    const avgMins = Math.floor(times.reduce((a, b) => a + b, 0) / times.length);
    const avgHours = Math.floor(avgMins / 60);
    const avgMinutes = avgMins % 60;

    const fastestMins = Math.min(...times);
    const fastestHours = Math.floor(fastestMins / 60);
    const fastestMinutes = fastestMins % 60;

    const slowestMins = Math.max(...times);
    const slowestHours = Math.floor(slowestMins / 60);
    const slowestMinutes = slowestMins % 60;

    setStats({
      totalPaidToday: paidToday.length,
      averagePaymentTime: `${avgHours}h ${avgMinutes < 10 ? '0' : ''}${avgMinutes}m`,
      fastestPayment: `${fastestHours}h ${fastestMinutes < 10 ? '0' : ''}${fastestMinutes}m`,
      slowestPayment: `${slowestHours}h ${slowestMinutes < 10 ? '0' : ''}${slowestMinutes}m`
    });
  }, []);

  useEffect(() => {
    console.log('🚀 Timeline Firebase - Inicializando listeners...');
    setLoading(true);

    // Listener para NTs (para pegar os números)
    const ntsRef = collection(db, 'nts');
    const unsubscribeNTs = onSnapshot(
      ntsRef,
      (snapshot) => {
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          ntsMapRef.current.set(doc.id, data.nt_number);
        });
        console.log('📋 Timeline Firebase - NTs mapeadas:', ntsMapRef.current.size);
      },
      (error) => {
        console.error('❌ Timeline Firebase - Erro ao carregar NTs:', error);
      }
    );

    // Listener para items pagos
    const itemsRef = collection(db, 'nt_items');
    const itemsQuery = query(
      itemsRef,
      where('status', 'in', ['Pago', 'Pago Parcial']),
      orderBy('updated_at', 'desc'),
      firestoreLimit(limit)
    );

    const unsubscribeItems = onSnapshot(
      itemsQuery,
      (snapshot) => {
        console.log('📦 Timeline Firebase - Items atualizados:', snapshot.docs.length);
        
        const items: TimelinePaidItem[] = [];
        const currentIds = new Set<string>();

        snapshot.docChanges().forEach((change) => {
          const itemId = change.doc.id;
          
          // Se o item foi removido
          if (change.type === 'removed') {
            console.log('🗑️ Timeline Firebase - Item removido da timeline:', itemId);
            // Remover do conjunto de IDs atuais
            currentIds.delete(itemId);
            // Remover dos itens destacados se estava lá
            setNewItemIds(prev => {
              const updated = new Set(prev);
              updated.delete(itemId);
              return updated;
            });
          }
        });

        snapshot.docs.forEach(doc => {
          const data = doc.data();
          const itemId = doc.id;
          
          // Garantir que a lógica antiga de status continue (já sendo feita na query, mas mantida por segurança)
          if (data.status !== 'Pago' && data.status !== 'Pago Parcial') {
            return;
          }
          
          currentIds.add(itemId);

          // Pegar o número da NT do mapeamento
          const ntNumber = ntsMapRef.current.get(data.nt_id) || 'N/A';

          // Determinar data de criação e data de pagamento de forma robusta
          const createdDate = parseDateTime(data.created_date, data.created_time, data.created_at);

          let paidAt: Date | null = null;
          if (data.payment_time && typeof data.payment_time === 'string') {
            const pt = data.payment_time.trim();
            if (pt.includes('T') || (pt.includes('-') && pt.length >= 10)) {
              const d = new Date(pt);
              if (!isNaN(d.getTime())) paidAt = d;
            } else if (createdDate) {
              const match = pt.match(/^(\d{1,2}):(\d{2})/);
              if (match) {
                const h = parseInt(match[1], 10);
                const m = parseInt(match[2], 10);
                paidAt = new Date(createdDate.getTime());
                paidAt.setHours(h, m, 0, 0);
                if (paidAt.getTime() < createdDate.getTime()) {
                  paidAt.setDate(paidAt.getDate() + 1);
                }
              }
            }
          }
          if (!paidAt && data.updated_at) {
            paidAt = parseDateTime(null, null, data.updated_at);
          }
          if (!paidAt || isNaN(paidAt.getTime())) {
            paidAt = new Date();
          }

          // Calcular tempo decorrido
          const elapsedTime = calculateElapsedTime(
            data.created_date,
            data.created_time,
            data.payment_time,
            data.created_at,
            data.updated_at
          );

          items.push({
            id: itemId,
            code: data.code,
            description: data.description,
            quantity: data.quantity,
            batch: data.batch,
            status: data.status,
            payment_time: data.payment_time,
            created_date: data.created_date,
            created_time: data.created_time,
            nt_id: data.nt_id,
            nt_number: ntNumber,
            paid_at: paidAt,
            elapsedTime,
            isPriority: data.priority || false
          });
        });

        // Detectar novos itens (apenas adições, não remoções)
        const newIds = new Set<string>();
        currentIds.forEach(id => {
          if (!previousItemsRef.current.has(id)) {
            newIds.add(id);
          }
        });

        if (newIds.size > 0) {
          console.log('🆕 Timeline Firebase - Novos itens:', newIds.size);
          setNewItemIds(newIds);
          
          // Remover highlight após 45 segundos
          setTimeout(() => {
            setNewItemIds(new Set());
          }, 45000);
        }

        previousItemsRef.current = currentIds;
        setPaidItems(items);
        calculateStats(items);
        setIsConnected(true);
        setLoading(false);
      },
      (error) => {
        console.error('❌ Timeline Firebase - Erro no listener:', error);
        setIsConnected(false);
        setLoading(false);
      }
    );

    // Cleanup
    return () => {
      console.log('🧹 Timeline Firebase - Cleanup');
      unsubscribeNTs();
      unsubscribeItems();
    };
  }, [limit, calculateStats]);

  const refreshItems = useCallback(() => {
    console.log('🔄 Timeline Firebase - Refresh manual (listeners automáticos ativos)');
    // Não precisa fazer nada - os listeners já mantêm tudo atualizado
  }, []);

  return {
    paidItems,
    loading,
    newItemIds,
    stats,
    isConnected,
    refreshItems,
    hasNewItems: newItemIds.size > 0
  };
}
