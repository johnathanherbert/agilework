"use client";

import { useState, useEffect } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/components/providers/supabase-provider";
import ProtectedRoute from "@/components/auth/protected-route";
import { RobotAlert, NTStats } from "@/types";
import { Bell, CheckCircle2, AlertCircle, Clock, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

export default function Dashboard() {
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
        .from("robot_alerts")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error("Error fetching alerts:", error);
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
          .from("nts")
          .select("id");
        
        if (ntsError) throw ntsError;
        
        // Get pending items count
        const { data: pendingData, error: pendingError } = await supabase
          .from("nt_items")
          .select("id")
          .eq("status", "Ag. Pagamento");
          
        if (pendingError) throw pendingError;
        
        // Get paid today count
        const today = new Date().toISOString().split("T")[0];
        const { data: paidTodayData, error: paidTodayError } = await supabase
          .from("nt_items")
          .select("id")
          .eq("status", "Pago")
          .gte("payment_time", today);
          
        if (paidTodayError) throw paidTodayError;
        
        // Get overdue items
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        const threeDaysAgoStr = threeDaysAgo.toISOString().split("T")[0];
        
        const { data: overdueData, error: overdueError } = await supabase
          .from("nt_items")
          .select("id")
          .eq("status", "Ag. Pagamento")
          .lt("created_date", threeDaysAgoStr);
          
        if (overdueError) throw overdueError;
        
        setStats({
          totalNTs: ntsData?.length || 0,
          pendingItems: pendingData?.length || 0,
          paidToday: paidTodayData?.length || 0,
          overdueItems: overdueData?.length || 0
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      }
    };

    if (user) {
      fetchAlerts();
      fetchStats();
    }
    
    // Subscribe to changes in robot_alerts
    const channel = supabase
      .channel("robot_alerts_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "robot_alerts" },
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
      .from("robot_alerts")
      .update({ 
        active: false,
        resolved_at: new Date().toISOString()
      })
      .eq("id", alertId);
    
    if (error) {
      console.error("Error resolving alert:", error);
      return;
    }
    
    setActiveAlerts((prev) => prev.filter((alert) => alert.id !== alertId));
  };
  
  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
        <Sidebar />
        <div className="flex-1 flex flex-col ml-[64px] transition-all duration-300">
          <Topbar />
          <main className="flex-1 p-6 overflow-y-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
              <p className="text-gray-500 dark:text-gray-400">
                Bem-vindo ao Sistema de Gestão de NTs
              </p>
            </div>
            
            {/* Stats grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Card className="overflow-hidden border-t-4 border-t-blue-500 dark:border-t-blue-400 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full h-12 w-12 flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex-shrink-0">
                      <Bell size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total de NTs</p>
                      <p className="text-2xl font-bold">{stats.totalNTs}</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                    <Link 
                      href="/almoxarifado/nts" 
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center"
                    >
                      Ver todas as NTs
                      <span className="ml-1">→</span>
                    </Link>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="overflow-hidden border-t-4 border-t-amber-500 dark:border-t-amber-400 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full h-12 w-12 flex items-center justify-center bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex-shrink-0">
                      <Clock size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Itens Pendentes</p>
                      <p className="text-2xl font-bold">{stats.pendingItems}</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                    <Link 
                      href="/almoxarifado/nts" 
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center"
                    >
                      Gerenciar pendências
                      <span className="ml-1">→</span>
                    </Link>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="overflow-hidden border-t-4 border-t-green-500 dark:border-t-green-400 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full h-12 w-12 flex items-center justify-center bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex-shrink-0">
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Pagos Hoje</p>
                      <p className="text-2xl font-bold">{stats.paidToday}</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                    <Link 
                      href="/analytics" 
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center"
                    >
                      Ver análise
                      <span className="ml-1">→</span>
                    </Link>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="overflow-hidden border-t-4 border-t-red-500 dark:border-t-red-400 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full h-12 w-12 flex items-center justify-center bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex-shrink-0">
                      <AlertCircle size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Itens Atrasados</p>
                      <p className="text-2xl font-bold">{stats.overdueItems}</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                    <Link 
                      href="/almoxarifado/nts" 
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center"
                    >
                      Ver atrasados
                      <span className="ml-1">→</span>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Robot Alerts */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold flex items-center">
                  <AlertTriangle className="mr-2 h-5 w-5 text-amber-500" />
                  Alertas de Robôs
                </h2>
                <Link href="/robot-status">
                  <Button variant="outline" size="sm" className="text-sm hover:bg-gray-100 dark:hover:bg-gray-800">
                    Ver todos os alertas
                  </Button>
                </Link>
              </div>
              
              {loading ? (
                <Card className="p-4 text-center border border-gray-200 dark:border-gray-700 shadow-sm">
                  <div className="flex items-center justify-center text-gray-500 dark:text-gray-400 py-4">
                    <div className="animate-spin mr-3 h-5 w-5 border-2 border-gray-500 border-t-transparent rounded-full"></div>
                    <p>Carregando alertas...</p>
                  </div>
                </Card>
              ) : activeAlerts.length > 0 ? (
                <div className="space-y-3">
                  {activeAlerts.map((alert) => (
                    <Alert key={alert.id} className="border border-red-100 bg-red-50 dark:bg-red-900/10 dark:border-red-800 shadow-sm">
                      <div className="flex justify-between items-start">
                        <div className="flex items-start">
                          <div className="rounded-full p-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 mr-3">
                            <AlertTriangle className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center">
                              <h3 className="font-medium text-red-800 dark:text-red-300">
                                Alerta de Robô
                              </h3>
                              <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                                {new Date(alert.created_at).toLocaleString("pt-BR")}
                              </span>
                            </div>
                            <p className="mt-1 text-red-700 dark:text-red-300">{alert.message}</p>
                          </div>
                        </div>
                        
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handleResolveAlert(alert.id)}
                          className="border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/20"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Resolver
                        </Button>
                      </div>
                    </Alert>
                  ))}
                </div>
              ) : (
                <Alert className="bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-900 shadow-sm">
                  <div className="flex items-center">
                    <div className="rounded-full p-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 mr-3">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-medium">Todos os robôs estão operando normalmente</h3>
                      <p className="text-sm text-green-700 dark:text-green-400">Nenhum alerta ativo no momento.</p>
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