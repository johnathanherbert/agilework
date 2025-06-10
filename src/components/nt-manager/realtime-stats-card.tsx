"use client";

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Activity, Clock, Users, Wifi } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RealtimeStats {
  total_paid_today: number;
  total_paid_this_week: number;
  realtime_logs_count: number;
  last_activity: string | null;
}

interface RealtimeStatsCardProps {
  className?: string;
}

export function RealtimeStatsCard({ className = "" }: RealtimeStatsCardProps) {
  const [stats, setStats] = useState<RealtimeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  // Ref para controlar throttling de atualizações por foco/visibilidade
  const lastFocusUpdateRef = useRef<Date>(new Date());  const fetchStats = async () => {
    try {
      // Chamar função do PostgreSQL para obter estatísticas
      const { data, error } = await supabase.rpc('get_timeline_stats');
      
      if (error) {
        console.error('❌ Erro ao buscar estatísticas:', error);
        
        // Se a função não existir, vamos criar uma consulta manual
        if (error.message?.includes('function') || error.message?.includes('does not exist')) {
          await fetchStatsManual();
          return;
        }
        return;
      }

      setStats(data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('❌ Erro na função fetchStats:', error);
    } finally {
      setLoading(false);
    }
  };  const fetchStatsManual = async () => {
    try {
      // Buscar estatísticas manualmente
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay()); // Início da semana

      // Pagos hoje
      const { count: paidTodayCount, error: errorToday } = await supabase
        .from('nt_items')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Pago')
        .gte('updated_at', startOfDay.toISOString());

      // Pagos esta semana
      const { count: paidWeekCount, error: errorWeek } = await supabase
        .from('nt_items')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Pago')
        .gte('updated_at', startOfWeek.toISOString());      // Última atividade - buscar pela data mais recente, considerando payment_time ou updated_at
      const { data: lastActivity } = await supabase
        .from('nt_items')
        .select('updated_at, payment_time')
        .eq('status', 'Pago')
        .order('updated_at', { ascending: false })
        .limit(1);

      // Determinar a data mais recente entre payment_time e updated_at
      let lastActivityDate = null;
      if (lastActivity?.[0]) {
        const item = lastActivity[0];
        const updatedAt = item.updated_at ? new Date(item.updated_at) : null;
        const paymentTime = item.payment_time ? new Date(item.payment_time) : null;
        
        // Usar a data mais recente entre payment_time e updated_at
        if (paymentTime && updatedAt) {
          lastActivityDate = paymentTime > updatedAt ? paymentTime.toISOString() : updatedAt.toISOString();
        } else if (paymentTime) {
          lastActivityDate = paymentTime.toISOString();
        } else if (updatedAt) {
          lastActivityDate = updatedAt.toISOString();
        }
      }

      if (errorToday || errorWeek) {
        console.error('❌ Erro nas consultas manuais:', errorToday || errorWeek);
        return;
      }      const stats = {
        total_paid_today: paidTodayCount || 0,
        total_paid_this_week: paidWeekCount || 0,
        realtime_logs_count: 0, // Por enquanto, implementar depois se necessário
        last_activity: lastActivityDate
      };
      
      setStats(stats);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('❌ Erro na consulta manual:', error);
    }
  };

  // Atualizar estatísticas a cada minuto
  useEffect(() => {
    fetchStats();
    
    const interval = setInterval(fetchStats, 60000); // 1 minuto
    
    return () => clearInterval(interval);
  }, []);

  // Subscribe para atualizações em tempo real
  useEffect(() => {
    const channel = supabase
      .channel('realtime_stats')
      .on(
        'postgres_changes',
        { 
          event: '*',
          schema: 'public', 
          table: 'nt_items',
          filter: 'status=eq.Pago'
        },
        () => {
          // Buscar estatísticas atualizadas quando houver mudanças
          setTimeout(fetchStats, 1000); // Delay de 1s para garantir que os dados foram processados
        }
      )
      .subscribe();    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Focus/Visibility Change - Atualiza quando o usuário volta à aba/janela
  useEffect(() => {
    const checkForStatsUpdate = () => {
      const now = new Date();
      const timeSinceLastUpdate = now.getTime() - lastFocusUpdateRef.current.getTime();
        // Se passou mais de 5 segundos desde a última atualização, atualizar
      if (timeSinceLastUpdate > 5000) {
        fetchStats();
      }
      
      lastFocusUpdateRef.current = now;
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Usuário voltou à aba
        checkForStatsUpdate();
      }
    };

    const handleFocus = () => {
      // Janela ganhou foco
      checkForStatsUpdate();
    };

    // Adicionar listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);
  const formatLastActivity = (dateString: string | null) => {
    if (!dateString) return 'Nunca';
      const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    
    if (diffMinutes < 1) return 'Agora há pouco';
    if (diffMinutes < 60) return `${diffMinutes}m atrás`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h atrás`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d atrás`;
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Estatísticas Realtime
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-3 w-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          Estatísticas Realtime
          {lastUpdate && (
            <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">
              (atualizado {formatLastActivity(lastUpdate.toISOString())})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
              <Clock className="w-3 h-3" />
              Pagos hoje
            </div>
            <span className="text-sm font-semibold text-green-600 dark:text-green-400">
              {stats?.total_paid_today || 0}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
              <Clock className="w-3 h-3" />
              Pagos esta semana
            </div>
            <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
              {stats?.total_paid_this_week || 0}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
              <Wifi className="w-3 h-3" />
              Eventos hoje
            </div>
            <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">
              {stats?.realtime_logs_count || 0}
            </span>
          </div>
          
          <div className="flex justify-between items-center pt-1 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
              <Users className="w-3 h-3" />
              Última atividade
            </div>            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatLastActivity(stats?.last_activity || null)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
