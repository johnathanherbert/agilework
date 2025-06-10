"use client";

import { useState, useEffect } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/components/providers/supabase-provider";
import ProtectedRoute from "@/components/auth/protected-route";
import { Bell, CheckCircle2, AlertCircle, Clock, TrendingUp, Package, Users } from "lucide-react";
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
              // Count pending items
              if (item.status === 'Ag. Pagamento') {
                pendingItems++;
                
                // Check if overdue (more than 3 days old)
                const itemDate = new Date(item.created_at);
                const threeDaysAgo = new Date();
                threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
                
                if (itemDate < threeDaysAgo) {
                  overdueItems++;
                }
              }

              // Count paid items
              if (item.status === 'Pago') {
                paidThisWeek++;
                
                // Check if paid today
                const updatedAt = new Date(item.updated_at);
                if (updatedAt >= today) {
                  paidToday++;
                }

                // Track most recent activity
                if (!recentActivity || item.updated_at > recentActivity) {
                  recentActivity = item.updated_at;
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
                      <p className="text-2xl font-bold">{stats.totalNTs}</p>
                      <p className="text-xs text-gray-400">últimos 7 dias</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                    <Link 
                      href="/almoxarifado/nts" 
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center"
                    >
                      Gerenciar NTs
                      <span className="ml-1">→</span>
                    </Link>
                  </div>
                </CardContent>
              </Card>
              
              {/* Itens Pendentes */}
              <Card className="overflow-hidden border-t-4 border-t-amber-500 dark:border-t-amber-400 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full h-12 w-12 flex items-center justify-center bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex-shrink-0">
                      <Clock size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Pendentes</p>
                      <p className="text-2xl font-bold">{stats.pendingItems}</p>
                      <p className="text-xs text-gray-400">aguardando pagamento</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                    <Link 
                      href="/almoxarifado/nts?status=pendente" 
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center"
                    >
                      Ver pendências
                      <span className="ml-1">→</span>
                    </Link>
                  </div>
                </CardContent>
              </Card>
              
              {/* Pagos Hoje */}
              <Card className="overflow-hidden border-t-4 border-t-green-500 dark:border-t-green-400 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full h-12 w-12 flex items-center justify-center bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex-shrink-0">
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Pagos Hoje</p>
                      <p className="text-2xl font-bold">{stats.paidToday}</p>
                      <p className="text-xs text-gray-400">{stats.paidThisWeek} esta semana</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                    <Link 
                      href="/almoxarifado/nts?status=concluida" 
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center"
                    >
                      Ver pagamentos
                      <span className="ml-1">→</span>
                    </Link>
                  </div>
                </CardContent>
              </Card>
              
              {/* Itens Atrasados */}
              <Card className="overflow-hidden border-t-4 border-t-red-500 dark:border-t-red-400 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full h-12 w-12 flex items-center justify-center bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex-shrink-0">
                      <AlertCircle size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Atrasados</p>
                      <p className="text-2xl font-bold">{stats.overdueItems}</p>
                      <p className="text-xs text-gray-400">+3 dias pendentes</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                    <Link 
                      href="/almoxarifado/nts?overdue=true" 
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center"
                    >
                      Priorizar atrasados
                      <span className="ml-1">→</span>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Cards de visão geral */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {/* Resumo de Produtividade */}
              <Card className="col-span-1">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    Produtividade
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">NTs Completas</span>
                    <span className="font-semibold">{stats.completedNTs}/{stats.totalNTs}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Total de Itens</span>
                    <span className="font-semibold">{stats.totalItems}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Taxa de Conclusão</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      {stats.totalNTs > 0 ? Math.round((stats.completedNTs / stats.totalNTs) * 100) : 0}%
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Estatísticas Realtime */}
              <RealtimeStatsCard className="col-span-1" />

              {/* Atividade Recente */}
              <Card className="col-span-1">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    Atividade Recente
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center py-4">
                    <Clock className="h-8 w-8 mx-auto mb-2 text-gray-400 dark:text-gray-500" />
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {stats.recentActivity 
                        ? `Último pagamento: ${new Date(stats.recentActivity).toLocaleString('pt-BR')}`
                        : 'Nenhuma atividade recente'
                      }
                    </p>
                  </div>
                  <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
                    <Link 
                      href="/almoxarifado/nts" 
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center justify-center"
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