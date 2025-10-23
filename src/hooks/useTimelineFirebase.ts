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

  // Calcular tempo decorrido entre criação e pagamento
  const calculateElapsedTime = (createdDate: string, createdTime: string, paymentTime: string): string => {
    try {
      // Parse created datetime
      const [day, month, year] = createdDate.split('/').map(Number);
      const [createdHours, createdMinutes] = createdTime.split(':').map(Number);
      const created = new Date(year, month - 1, day, createdHours, createdMinutes);

      // Parse payment time (formato HH:MM)
      const [paidHours, paidMinutes] = paymentTime.split(':').map(Number);
      const paid = new Date(year, month - 1, day, paidHours, paidMinutes);

      // Se o pagamento foi no dia seguinte (horário menor que criação)
      if (paid < created) {
        paid.setDate(paid.getDate() + 1);
      }

      const diffMs = paid.getTime() - created.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const hours = Math.floor(diffMins / 60);
      const minutes = diffMins % 60;

      return `${hours}h ${minutes}m`;
    } catch (error) {
      return '-';
    }
  };

  // Calcular estatísticas
  const calculateStats = useCallback((items: TimelinePaidItem[]) => {
    if (items.length === 0) {
      setStats({
        totalPaidToday: 0,
        averagePaymentTime: '0h 0m',
        fastestPayment: '-',
        slowestPayment: '-'
      });
      return;
    }

    // Filtrar itens pagos hoje
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const paidToday = items.filter(item => {
      const itemDate = new Date(item.paid_at);
      itemDate.setHours(0, 0, 0, 0);
      return itemDate.getTime() === today.getTime();
    });

    // Calcular tempos em minutos
    const times = items
      .filter(item => item.elapsedTime && item.elapsedTime !== '-')
      .map(item => {
        const [hours, minutes] = item.elapsedTime!.split('h ').map(s => parseInt(s));
        return hours * 60 + minutes;
      })
      .filter(time => !isNaN(time) && time >= 0);

    if (times.length === 0) {
      setStats({
        totalPaidToday: paidToday.length,
        averagePaymentTime: '-',
        fastestPayment: '-',
        slowestPayment: '-'
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
      averagePaymentTime: `${avgHours}h ${avgMinutes}m`,
      fastestPayment: `${fastestHours}h ${fastestMinutes}m`,
      slowestPayment: `${slowestHours}h ${slowestMinutes}m`
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
          
          // Se o item foi removido ou mudou para um status que não é Pago/Pago Parcial
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
          
          // Verificar se o status ainda é Pago ou Pago Parcial
          if (data.status !== 'Pago' && data.status !== 'Pago Parcial') {
            console.log('⚠️ Timeline Firebase - Item com status inválido ignorado:', itemId, data.status);
            return;
          }
          
          currentIds.add(itemId);

          // Pegar o número da NT do mapeamento
          const ntNumber = ntsMapRef.current.get(data.nt_id) || 'N/A';

          // Calcular tempo decorrido
          const elapsedTime = data.payment_time 
            ? calculateElapsedTime(data.created_date, data.created_time, data.payment_time)
            : '-';

          // Determinar data de pagamento
          let paidAt: Date;
          if (data.payment_time) {
            const [day, month, year] = data.created_date.split('/').map(Number);
            const [hours, minutes] = data.payment_time.split(':').map(Number);
            paidAt = new Date(year, month - 1, day, hours, minutes);
          } else if (data.updated_at && data.updated_at.toDate) {
            paidAt = data.updated_at.toDate();
          } else {
            paidAt = new Date();
          }

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
