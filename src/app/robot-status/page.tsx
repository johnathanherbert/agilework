"use client";

import { useState, useEffect } from 'react';
import { Topbar } from '@/components/layout/topbar';
import { Sidebar } from '@/components/layout/sidebar';
import { supabase } from '@/lib/supabase';
import { useSupabase } from '@/components/providers/supabase-provider';
import { RobotAlert } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import ProtectedRoute from '@/components/auth/protected-route';

export default function RobotStatusPage() {
  const [robotAlerts, setRobotAlerts] = useState<RobotAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useSupabase();

  // Fetch robot alerts
  const fetchRobotAlerts = async () => {
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('robot_alerts')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      setRobotAlerts(data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching robot alerts:', error);
      toast.error('Erro ao carregar status dos robôs');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchRobotAlerts();
      
      // Subscribe to changes in robot_alerts table
      const robotAlertsChannel = supabase
        .channel('robot_alerts_changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'robot_alerts' },
          (payload: any) => {
            console.log('Robot alert changed:', payload);
            fetchRobotAlerts();
            
            if (payload.eventType === 'INSERT') {
              toast.error('Novo alerta de robô detectado!');
            } else if (payload.eventType === 'UPDATE') {
              toast.success('Status de alerta atualizado');
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(robotAlertsChannel);
      };
    }
  }, [user]);
  
  // Resolve an alert
  const resolveAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('robot_alerts')
        .update({
          active: false,
          resolved_at: new Date().toISOString()
        })
        .eq('id', alertId);
        
      if (error) throw error;
      
      toast.success('Alerta resolvido com sucesso');
      fetchRobotAlerts();
    } catch (error) {
      console.error('Error resolving alert:', error);
      toast.error('Erro ao resolver alerta');
    }
  };
  
  const getAlertColor = (type: string, active: boolean) => {
    if (!active) return 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300';
    
    switch (type.toLowerCase()) {
      case 'critical':
        return 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      case 'warning':
        return 'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300';
      case 'info':
        return 'bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      default:
        return 'bg-gray-50 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };
  
  if (!user) {
    return null;
  }
    return (
    <ProtectedRoute>
      <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Topbar />
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold">Status dos Robôs</h1>
              <p className="text-gray-500 dark:text-gray-400">
                Monitore os alertas e status dos robôs
              </p>
            </div>
            
            <Button variant="outline" onClick={fetchRobotAlerts}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
            {loading ? (
            <Card className="p-6 text-center">
              <p>Carregando alertas...</p>
            </Card>
          ) : robotAlerts.length > 0 ? (
            <div className="space-y-4">
              {robotAlerts.map((alert) => (
                <Card key={alert.id} className={`border-l-4 ${getAlertColor(alert.alert_type, alert.active)}`}>
                  <div className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-start">
                        {alert.active ? (
                          <AlertCircle className="h-5 w-5 mt-0.5 mr-3" />
                        ) : (
                          <CheckCircle className="h-5 w-5 mt-0.5 mr-3 text-green-500" />
                        )}
                        <div>
                          <h3 className="font-medium">
                            {alert.active ? 'Alerta Ativo' : 'Alerta Resolvido'}
                            <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                              {new Date(alert.created_at).toLocaleString('pt-BR')}
                            </span>
                          </h3>
                          <p className="mt-1">{alert.message}</p>
                          {alert.resolved_at && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Resolvido em: {new Date(alert.resolved_at).toLocaleString('pt-BR')}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {alert.active && (
                        <Button size="sm" variant="outline" onClick={() => resolveAlert(alert.id)}>
                          Marcar como Resolvido
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow text-center">
              <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="text-gray-500 dark:text-gray-400">
                Nenhum alerta de robô encontrado. Todos os sistemas estão operando normalmente.
              </p>
            </div>
          )}
        </main>        </div>
      </div>
    </ProtectedRoute>
  );
}
