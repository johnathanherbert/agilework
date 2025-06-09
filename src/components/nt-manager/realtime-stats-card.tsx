"use client";

import { useState, useEffect } from 'react';
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

  const fetchStats = async () => {
    try {
      // Chamar função do PostgreSQL para obter estatísticas
      const { data, error } = await supabase.rpc('get_timeline_stats');
      
      if (error) {
        console.error('Erro ao buscar estatísticas:', error);
        return;
      }

      setStats(data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Erro na função fetchStats:', error);
    } finally {
      setLoading(false);
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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
