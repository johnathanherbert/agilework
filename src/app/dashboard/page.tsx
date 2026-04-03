"use client";

import { useState, useEffect } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Sidebar } from "@/components/layout/sidebar";
import { useFirebase } from "@/components/providers/firebase-provider";
import ProtectedRoute from "@/components/auth/protected-route";
import { Clock, TrendingUp, Package, CheckCircle2, Zap, AlertTriangle, Activity, ArrowRight, Calendar, BarChart3, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { collection, query, where, getDocs, orderBy, limit, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/utils";

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
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const { user } = useFirebase();

  // Fetch realistic stats based on recent data (last 7 days)
  const fetchStats = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - 7);
        
        // Get all NTs
        const ntsRef = collection(db, 'nts');
        const ntsSnapshot = await getDocs(ntsRef);
        
        // Get all items
        const itemsRef = collection(db, 'nt_items');
        const itemsSnapshot = await getDocs(itemsRef);
        
        // Calculate stats
        const totalNTs = ntsSnapshot.size;
        const totalItems = itemsSnapshot.size;
        let pendingItems = 0;
        let paidToday = 0;
        let paidThisWeek = 0;
        let overdueItems = 0;
        let completedNTs = 0;
  let recentActivityDate: Date | null = null;

        // Group items by NT
        const itemsByNT = new Map<string, any[]>();
        itemsSnapshot.forEach(doc => {
          const itemData = doc.data();
          const item = { id: doc.id, ...itemData };
          const ntId = itemData.nt_id as string;
          if (!itemsByNT.has(ntId)) {
            itemsByNT.set(ntId, []);
          }
          itemsByNT.get(ntId)?.push(item);
        });

        // Calculate NT completion
        ntsSnapshot.forEach(ntDoc => {
          const items = itemsByNT.get(ntDoc.id) || [];
          if (items.length > 0) {
            const allPaid = items.every(item => item.status === 'Pago');
            if (allPaid) completedNTs++;
          }
        });

        // Helper: convert various stored date/time formats to JS Date
        const toDateFromField = (field: any, timeField?: any, fallbackDate?: Date | null) => {
          if (!field && !timeField) return fallbackDate || null;
          // Firestore Timestamp
          if (field && typeof field === 'object' && typeof field.toDate === 'function') {
            // If there's also a timeField that's a simple time (HH:MM), try to combine
            if (timeField && typeof timeField === 'string' && /^\d{1,2}:\d{2}/.test(timeField)) {
              const base = field.toDate();
              const [h, m] = timeField.split(':').map((s: string) => parseInt(s, 10) || 0);
              return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m);
            }
            return field.toDate();
          }

          // ISO string or other parsable strings
          if (typeof field === 'string') {
            // Try ISO parse
            const iso = new Date(field);
            if (!isNaN(iso.getTime())) return iso;

            // Try DD/MM/YYYY possibly combined with timeField
            const dateParts = field.split('/');
            if (dateParts.length === 3) {
              const day = parseInt(dateParts[0], 10);
              const month = parseInt(dateParts[1], 10) - 1;
              const year = parseInt(dateParts[2], 10);
              if (timeField && typeof timeField === 'string' && /^\d{1,2}:\d{2}/.test(timeField)) {
                const [h, m] = timeField.split(':').map((s: string) => parseInt(s, 10) || 0);
                return new Date(year, month, day, h, m);
              }
              return new Date(year, month, day);
            }
          }

          // Fallback to combining fallbackDate and timeField
          if (fallbackDate && timeField && typeof timeField === 'string' && /^\d{1,2}:\d{2}/.test(timeField)) {
            const [h, m] = timeField.split(':').map((s: string) => parseInt(s, 10) || 0);
            return new Date(fallbackDate.getFullYear(), fallbackDate.getMonth(), fallbackDate.getDate(), h, m);
          }

          return fallbackDate || null;
        };

        // Calculate item stats
        itemsSnapshot.forEach(doc => {
          const item = doc.data();

          // Determine timestamps robustly
          const createdAt = toDateFromField(item.created_at, item.created_time) || toDateFromField(item.created_date, item.created_time);
          const updatedAt = toDateFromField(item.updated_at) || createdAt || new Date();

          // Payment timestamp: could be ISO, time-only (combined with created_date) or recorded in updated_at
          let paidTimestamp: Date | null = null;
          if (item.payment_time) {
            // If payment_time looks like ISO or full date
            if (typeof item.payment_time === 'string' && (item.payment_time.includes('T') || item.payment_time.includes('-'))) {
              const parsed = new Date(item.payment_time);
              if (!isNaN(parsed.getTime())) paidTimestamp = parsed;
            }

            // If payment_time is a time only (HH:MM), combine with created_date or createdAt
            if (!paidTimestamp && typeof item.payment_time === 'string' && /^\d{1,2}:\d{2}/.test(item.payment_time)) {
              paidTimestamp = toDateFromField(item.created_date, item.payment_time, createdAt) || toDateFromField(item.created_at, item.payment_time, createdAt);
            }
          }

          if (item.status === 'Pago' || item.status === 'Pago Parcial') {
            const effectivePaid = paidTimestamp || updatedAt || new Date();

            // Check if paid today
            if (effectivePaid >= today) {
              paidToday++;
            }

            // Check if paid this week
            if (effectivePaid >= startOfWeek) {
              paidThisWeek++;
            }

            // Update recent activity (keep as Date)
            if (!recentActivityDate || effectivePaid > recentActivityDate) {
              recentActivityDate = effectivePaid;
            }
          } else {
            pendingItems++;

            // Check for overdue items (created more than 2 hours ago)
            const createdTimestamp = createdAt || updatedAt || new Date();
            const twoHoursAgo = new Date(now.getTime() - (2 * 60 * 60 * 1000));

            if (createdTimestamp < twoHoursAgo) {
              overdueItems++;
            }
          }
        });
        
        const recentActivityISO = recentActivityDate ? (recentActivityDate as unknown as Date).toISOString() : null;

        setStats({
          totalNTs,
          totalItems,
          pendingItems,
          paidToday,
          paidThisWeek,
          overdueItems,
          completedNTs,
          recentActivity: recentActivityISO
        });
        
        setLastUpdate(new Date());
        
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };

  // Initial fetch
  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(() => {
      fetchStats(true);
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
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
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col ml-[64px] transition-all duration-300">
          <Topbar />
          <main className="flex-1 p-6 overflow-y-auto">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between gap-4 mb-3">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                    <BarChart3 className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                      Dashboard
                    </h1>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                      Visão geral do sistema de gestão de NTs
                    </p>
                  </div>
                </div>
                
                {/* Refresh button */}
                <div className="flex items-center gap-3">
                  {lastUpdate && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                      Atualizado {formatLastActivity(lastUpdate.toISOString())}
                    </span>
                  )}
                  <button
                    onClick={() => fetchStats(true)}
                    disabled={refreshing}
                    className="p-2 border rounded-lg bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-gray-600 dark:text-gray-400"
                  >
                    <RefreshCw className={cn(
                      "w-4 h-4",
                      refreshing && "animate-spin"
                    )} />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Stats grid - Modern UI 2.0 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* Auto-refresh indicator */}
              {refreshing && (
                <div className="col-span-full flex items-center justify-center gap-2 py-2">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                  <span className="text-xs font-bold text-primary">Atualizando dados...</span>
                </div>
              )}
              {/* Total NTs */}
              <Card className="border bg-card shadow-sm">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Total Notas Técnicas</p>
                    <p className="text-3xl font-bold text-foreground">
                      {loading ? <span className="inline-block w-16 h-8 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /> : stats.totalNTs}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-primary">
                    <Package className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>

              {/* Total Itens */}
              <Card className="border bg-card shadow-sm">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Total de Itens</p>
                    <p className="text-3xl font-bold text-foreground">
                      {loading ? <span className="inline-block w-16 h-8 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /> : stats.totalItems}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>

              {/* Pendentes */}
              <Card className="border bg-card shadow-sm">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Aguardando Pagamento</p>
                    <p className="text-3xl font-bold text-foreground">
                      {loading ? <span className="inline-block w-16 h-8 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /> : stats.pendingItems}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600">
                    <Clock className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>

              {/* Concluídas */}
              <Card className="border bg-card shadow-sm">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">NTs Concluídas</p>
                    <p className="text-3xl font-bold text-foreground">
                      {loading ? <span className="inline-block w-16 h-8 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /> : stats.completedNTs}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-green-600">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Seção de Ações Rápidas e Estatísticas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Card de Ações Rápidas */}
                <Card className="border bg-card shadow-sm">
                  <CardHeader className="pb-4 border-b border-border/50">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" />
                      Ações Rápidas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Link 
                        href="/almoxarifado/nts" 
                        className="group flex items-center gap-3 p-4 rounded-lg border hover:border-primary/40 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                          <Package className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Gerenciar NTs</h3>
                          <p className="text-xs text-muted-foreground">Ver e editar NTs</p>
                        </div>
                        <ArrowRight className="ml-auto w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>

                      <button 
                        onClick={() => {
                          window.location.href = "/almoxarifado/nts?view=timeline";
                        }}
                        className="group text-left flex items-center gap-3 p-4 rounded-lg border hover:border-green-500/40 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                          <Activity className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Visão de Pagamentos</h3>
                          <p className="text-xs text-muted-foreground">Portal antigo</p>
                        </div>
                        <ArrowRight className="ml-auto w-4 h-4 text-green-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </div>
                  </CardContent>
                </Card>

                {/* Estatísticas Detalhadas */}
                <Card className="border bg-card shadow-sm">
                  <CardHeader className="pb-4 border-b border-border/50">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                      <Activity className="h-4 w-4 text-primary" />
                      Estatísticas Detalhadas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="space-y-4">
                      {/* Pagos Hoje */}
                      <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/20">
                        <div>
                          <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide">Pagos Hoje</p>
                          <p className="text-2xl font-bold text-green-800 dark:text-green-500">
                            {loading ? <span className="inline-block w-8 h-6 bg-green-200 dark:bg-green-800 animate-pulse rounded" /> : stats.paidToday}
                          </p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-800/30 flex items-center justify-center text-green-600 dark:text-green-400">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                      </div>

                      {/* Pagos na Semana */}
                      <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20">
                        <div>
                          <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">Esta Semana</p>
                          <p className="text-2xl font-bold text-blue-800 dark:text-blue-500">
                            {loading ? <span className="inline-block w-8 h-6 bg-blue-200 dark:bg-blue-800 animate-pulse rounded" /> : stats.paidThisWeek}
                          </p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-800/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                          <Calendar className="w-5 h-5" />
                        </div>
                      </div>

                      {/* Itens Atrasados */}
                      <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20">
                        <div>
                          <p className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide">Atrasados</p>
                          <p className="text-2xl font-bold text-red-800 dark:text-red-500">
                            {loading ? <span className="inline-block w-8 h-6 bg-red-200 dark:bg-red-800 animate-pulse rounded" /> : stats.overdueItems}
                          </p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-800/30 flex items-center justify-center text-red-600 dark:text-red-400">
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                      </div>

                      {/* Última Atividade */}
                      <div className="pt-2">
                        <p className="text-xs text-muted-foreground mb-1">Última Atividade Registrada</p>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-foreground">{formatLastActivity(stats.recentActivity)}</p>
                        </div>
                      </div>
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
