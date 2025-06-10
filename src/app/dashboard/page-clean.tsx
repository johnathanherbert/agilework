"use client";

import { useState, useEffect } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Sidebar } from "@/components/layout/sidebar";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/components/providers/supabase-provider";
import ProtectedRoute from "@/components/auth/protected-route";
import { Clock, TrendingUp, Package, Users, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RealtimeStatsCard } from "@/components/nt-manager/realtime-stats-card";

interface DashboardStats {
  totalNTs: number;
  totalItems: number;
  pendingItems: number;
  paidToday: number;
  paidThisWeek: number;
  overdueItems: number;
  completedNTs: number;
  recentActivity: string | null;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalNTs: 0,
    totalItems: 0,
    pendingItems: 0,
    paidToday: 0,
    paidThisWeek: 0,
    overdueItems: 0,
    completedNTs: 0,
    recentActivity: null
  });
  const [loading, setLoading] = useState(true);
  const { user } = useSupabase();

  // Fetch realistic stats based on recent data (last 7 days)
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - 7); // Last 7 days
        
        // Get recent NTs (last 7 days)
        const { data: ntsData, error: ntsError } = await supabase
          .from("nts")
          .select(`
            id,
            created_at,
            items:nt_items(*)
          `)
          .gte('created_at', startOfWeek.toISOString())
          .order('created_at', { ascending: false });
        
        if (ntsError) throw ntsError;

        // Calculate stats from the fetched data
        const totalNTs = ntsData?.length || 0;
        let totalItems = 0;
        let pendingItems = 0;
        let paidToday = 0;
        let paidThisWeek = 0;
        let overdueItems = 0;
        let completedNTs = 0;
        let recentActivity: string | null = null;

        // Process each NT and its items
        ntsData?.forEach(nt => {
          if (nt.items && nt.items.length > 0) {
            const ntItems = nt.items;
            totalItems += ntItems.length;

            // Check if NT is completed (all items paid)
            const allPaid = ntItems.every(item => item.status === 'Pago');
            if (allPaid) completedNTs++;

            ntItems.forEach(item => {
              if (item.status === 'Pago') {
                const paidDate = new Date(item.updated_at);
                
                // Check if paid today
                if (paidDate >= today) {
                  paidToday++;
                }
                
                // Check if paid this week
                if (paidDate >= startOfWeek) {
                  paidThisWeek++;
                }
                
                // Update recent activity
                if (!recentActivity || paidDate > new Date(recentActivity)) {
                  recentActivity = item.updated_at;
                }
              } else {
                pendingItems++;
                
                // Check for overdue items (created more than 2 days ago and still pending)
                const createdDate = new Date(item.created_at);
                const twoDaysAgo = new Date(today);
                twoDaysAgo.setDate(today.getDate() - 2);
                
                if (createdDate < twoDaysAgo) {
                  overdueItems++;
                }
              }
            });
          }
        });

        setStats({
          totalNTs,
          totalItems,
          pendingItems,
          paidToday,
          paidThisWeek,
          overdueItems,
          completedNTs,
          recentActivity
        });
        
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchStats();
    }
    
    // Subscribe to real-time changes in NT items for stats updates
    const channel = supabase
      .channel("nt_items_stats_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "nt_items" },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

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
            
            {/* Stats grid com informações reais e úteis */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {/* NTs Recentes */}
              <Card className="overflow-hidden border-t-4 border-t-blue-500 dark:border-t-blue-400 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full h-12 w-12 flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex-shrink-0">
                      <Package size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">NTs Recentes</p>
                      <p className="text-2xl font-bold">{loading ? '...' : stats.totalNTs}</p>
                      <p className="text-xs text-gray-400">últimos 7 dias</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Total de Itens */}
              <Card className="overflow-hidden border-t-4 border-t-purple-500 dark:border-t-purple-400 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full h-12 w-12 flex items-center justify-center bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex-shrink-0">
                      <TrendingUp size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total de Itens</p>
                      <p className="text-2xl font-bold">{loading ? '...' : stats.totalItems}</p>
                      <p className="text-xs text-gray-400">nos últimos 7 dias</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Itens Pendentes */}
              <Card className="overflow-hidden border-t-4 border-t-orange-500 dark:border-t-orange-400 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full h-12 w-12 flex items-center justify-center bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex-shrink-0">
                      <Clock size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Itens Pendentes</p>
                      <p className="text-2xl font-bold">{loading ? '...' : stats.pendingItems}</p>
                      <p className="text-xs text-gray-400">aguardando pagamento</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* NTs Concluídas */}
              <Card className="overflow-hidden border-t-4 border-t-green-500 dark:border-t-green-400 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full h-12 w-12 flex items-center justify-center bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex-shrink-0">
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">NTs Concluídas</p>
                      <p className="text-2xl font-bold">{loading ? '...' : stats.completedNTs}</p>
                      <p className="text-xs text-gray-400">100% pagas</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Seção de Ações Rápidas */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Card de Ações Rápidas */}
              <Card className="lg:col-span-2 shadow-sm border border-gray-200 dark:border-gray-700">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    Ações Rápidas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Link 
                      href="/almoxarifado/nts" 
                      className="group p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-all hover:shadow-md bg-white dark:bg-gray-800"
                    >
                      <div className="flex items-center gap-3">
                        <Package className="h-8 w-8 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-gray-100">Gerenciar NTs</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Ver e editar NTs ativas</p>
                        </div>
                      </div>
                    </Link>

                    <Link 
                      href="/almoxarifado/nts?status=concluida" 
                      className="group p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-600 transition-all hover:shadow-md bg-white dark:bg-gray-800"
                    >
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400 group-hover:scale-110 transition-transform" />
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-gray-100">NTs Concluídas</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Ver histórico completo</p>
                        </div>
                      </div>
                    </Link>
                  </div>

                  {/* Informações úteis */}
                  <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Pagos Hoje</p>
                        <p className="text-xl font-bold text-green-600 dark:text-green-400">{loading ? '...' : stats.paidToday}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Pagos esta Semana</p>
                        <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{loading ? '...' : stats.paidThisWeek}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Itens Atrasados</p>
                        <p className="text-xl font-bold text-red-600 dark:text-red-400">{loading ? '...' : stats.overdueItems}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Timeline Card */}
              <Card className="shadow-sm border border-gray-200 dark:border-gray-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    Estatísticas em Tempo Real
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <RealtimeStatsCard />
                  <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Última Atividade</p>
                    <p className="text-sm font-medium">{formatLastActivity(stats.recentActivity)}</p>
                    <Link 
                      href="/almoxarifado/nts" 
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center justify-center mt-2"
                    >
                      Ver timeline completo
                      <span className="ml-1">→</span>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
            
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
