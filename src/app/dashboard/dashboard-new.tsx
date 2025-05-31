"use client";

import { useState, useEffect } from 'react';
import { Topbar } from '@/components/layout/topbar';
import { Sidebar } from '@/components/layout/sidebar';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { supabase } from '@/lib/supabase';
import { useSupabase } from '@/components/providers/supabase-provider';
import ProtectedRoute from '@/components/auth/protected-route';
import { RobotAlert, NTStats } from '@/types';
import { Bell, CheckCircle2, AlertCircle, Clock, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';

export default function DashboardPage() {
  const [activeAlerts, setActiveAlerts] = useState<RobotAlert[]>([]);
  const [stats, setStats] = useState<NTStats>({
    totalNTs: 0,
    pendingItems: 0,
    paidToday: 0,
    overdueItems: 0
  });
  const [loading, setLoading] = useState(true);
  const { user } = useSupabase();

  // Fetch active robot alerts
  useEffect(() => {
    const fetchAlerts = async () => {
      const { data, error } = await supabase
        .from('robot_alerts')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching alerts:', error);
        return;
      }
      
      setActiveAlerts(data || []);
      setLoading(false);
    };

    // Fetch stats
    const fetchStats = async () => {
      try {
        // Get NT counts
        const { data: ntsData, error: ntsError } = await supabase
          .from('nts')
          .select('id');
        
        if (ntsError) throw ntsError;
        
        // Get pending items count
        const { data: pendingData, error: pendingError } = await supabase
          .from('nt_items')
          .select('id')
          .eq('status', 'Ag. Pagamento');
          
        if (pendingError) throw pendingError;
        
        // Get paid today count
        const today = new Date().toISOString().split('T')[0];
        const { data: paidTodayData, error: paidTodayError } = await supabase
          .from('nt_items')
          .select('id')
          .eq('status', 'Pago')
          .gte('payment_time', today);
          
        if (paidTodayError) throw paidTodayError;
        
        // Get overdue items
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];
        
        const { data: overdueData, error: overdueError } = await supabase
          .from('nt_items')
          .select('id')
          .eq('status', 'Ag. Pagamento')
          .lt('created_date', threeDaysAgoStr);
          
        if (overdueError) throw overdueError;
        
        setStats({
          totalNTs: ntsData?.length || 0,
          pendingItems: pendingData?.length || 0,
          paidToday: paidTodayData?.length || 0,
          overdueItems: overdueData?.length || 0
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    if (user) {
      fetchAlerts();
      fetchStats();
    }
    
    // Subscribe to changes in robot_alerts
    const channel = supabase
      .channel('robot_alerts_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'robot_alerts' },
        (payload: any) => {
          fetchAlerts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Handle resolving an alert
  const handleResolveAlert = async (alertId: string) => {
    const { error } = await supabase
      .from('robot_alerts')
      .update({ 
        active: false,
        resolved_at: new Date().toISOString()
      })
      .eq('id', alertId);
    
    if (error) {
      console.error('Error resolving alert:', error);
      return;
    }
    
    setActiveAlerts((prev) => prev.filter((alert) => alert.id !== alertId));
  };
  
  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Topbar />
          <main className="flex-1 p-6 overflow-y-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
              <p className="text-gray-500 dark:text-gray-400">
                Bem-vindo ao Sistema de Gestão de NTs
              </p>
            </div>
            
            {/* Stats grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card className="bg-white dark:bg-gray-800">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total de NTs</p>
                      <p className="text-3xl font-bold mt-2">{stats.totalNTs}</p>
                    </div>
                    <div className="rounded-full p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                      <Bell size={20} />
                    </div>
                  </div>
                  <div className="mt-4">
                    <Link 
                      href="/almoxarifado/nts" 
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Ver todas as NTs
                    </Link>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-white dark:bg-gray-800">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Itens Pendentes</p>
                      <p className="text-3xl font-bold mt-2">{stats.pendingItems}</p>
                    </div>
                    <div className="rounded-full p-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">
                      <Clock size={20} />
                    </div>
                  </div>
                  <div className="mt-4">
                    <Link 
                      href="/almoxarifado/nts" 
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Gerenciar pendências
                    </Link>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-white dark:bg-gray-800">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Pagos Hoje</p>
                      <p className="text-3xl font-bold mt-2">{stats.paidToday}</p>
                    </div>
                    <div className="rounded-full p-2 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400">
                      <CheckCircle2 size={20} />
                    </div>
                  </div>
                  <div className="mt-4">
                    <Link 
                      href="/analytics" 
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Ver análise
                    </Link>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-white dark:bg-gray-800">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Itens Atrasados</p>
                      <p className="text-3xl font-bold mt-2">{stats.overdueItems}</p>
                    </div>
                    <div className="rounded-full p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
                      <AlertCircle size={20} />
                    </div>
                  </div>
                  <div className="mt-4">
                    <Link 
                      href="/almoxarifado/nts" 
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Ver atrasados
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Robot Alerts */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Alertas de Robôs</h2>
                <Link href="/robot-status">
                  <Button variant="outline" size="sm" className="text-sm">
                    Ver todos os alertas
                  </Button>
                </Link>
              </div>
              
              {loading ? (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow text-center">
                  <p>Carregando alertas...</p>
                </div>
              ) : activeAlerts.length > 0 ? (
                <div className="space-y-4">
                  {activeAlerts.map((alert) => (
                    <Alert key={alert.id} className="border-l-4 border-red-600 dark:border-red-400 bg-white dark:bg-gray-800">
                      <div className="flex justify-between items-start">
                        <div className="flex items-start">
                          <AlertTriangle className="h-5 w-5 mt-0.5 mr-3 text-red-600 dark:text-red-400" />
                          <div>
                            <h3 className="font-medium">
                              Alerta de Robô
                              <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                                {new Date(alert.created_at).toLocaleString('pt-BR')}
                              </span>
                            </h3>
                            <p className="mt-1">{alert.message}</p>
                          </div>
                        </div>
                        
                        <Button size="sm" variant="outline" onClick={() => handleResolveAlert(alert.id)}>
                          Marcar como Resolvido
                        </Button>
                      </div>
                    </Alert>
                  ))}
                </div>
              ) : (
                <Alert className="bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-900">
                  <div className="flex">
                    <CheckCircle2 className="h-5 w-5 mt-0.5 mr-3" />
                    <div>
                      <h3 className="font-medium">Todos os robôs estão operando normalmente</h3>
                      <p className="mt-1 text-sm">Nenhum alerta de robô encontrado no momento.</p>
                    </div>
                  </div>
                </Alert>
              )}
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
