"use client";

import { useState, useEffect } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Sidebar } from "@/components/layout/sidebar";
import { useFirebase, ADMIN_EMAIL } from "@/components/providers/firebase-provider";
import ProtectedRoute from "@/components/auth/protected-route";
import { Clock, TrendingUp, Package, CheckCircle2, Zap, AlertTriangle, Activity, ArrowRight, Calendar, BarChart3, RefreshCw, Factory, Shield, Settings } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { collection, getDocs } from "firebase/firestore";
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

interface StatCardProps {
  label: string;
  value: number;
  loading: boolean;
  icon: React.ReactNode;
  tone: "blue" | "emerald" | "amber" | "green";
  helperText: string;
}

const statToneMap: Record<StatCardProps["tone"], string> = {
  blue: "from-blue-50 to-blue-100/60 border-blue-200 dark:from-blue-950/30 dark:to-blue-900/20 dark:border-blue-900/60",
  emerald: "from-emerald-50 to-emerald-100/60 border-emerald-200 dark:from-emerald-950/30 dark:to-emerald-900/20 dark:border-emerald-900/60",
  amber: "from-amber-50 to-amber-100/60 border-amber-200 dark:from-amber-950/30 dark:to-amber-900/20 dark:border-amber-900/60",
  green: "from-green-50 to-green-100/60 border-green-200 dark:from-green-950/30 dark:to-green-900/20 dark:border-green-900/60",
};

function StatCard({ label, value, loading, icon, tone, helperText }: StatCardProps) {
  return (
    <Card className={cn("border bg-gradient-to-br shadow-sm", statToneMap[tone])}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">{label}</p>
            <p className="text-3xl font-black text-slate-900 dark:text-white mt-1 leading-none">
              {loading ? <span className="inline-block w-16 h-8 bg-slate-200 dark:bg-slate-700 animate-pulse rounded" /> : value}
            </p>
          </div>
          <div className="h-11 w-11 rounded-xl bg-white/80 dark:bg-slate-900/40 border border-white/70 dark:border-slate-700 flex items-center justify-center">
            {icon}
          </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 font-medium">{helperText}</p>
      </CardContent>
    </Card>
  );
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
  const { user, userData } = useFirebase();
  const isAdmin = userData?.email === ADMIN_EMAIL;
  const isLeaderOrAdmin = isAdmin || userData?.role === "leader";

  const quickSections: Array<{ href: string; title: string; description: string; icon: React.ReactNode; tone: string }> = [
    {
      href: "/almoxarifado/nts",
      title: "Gerenciar NTs",
      description: "Consulta e edição das notas técnicas.",
      icon: <Package className="h-5 w-5 text-primary" />,
      tone: "blue",
    },
    {
      href: "/settings",
      title: "Configurações",
      description: "Preferências pessoais e do sistema.",
      icon: <Settings className="h-5 w-5 text-slate-700 dark:text-slate-300" />,
      tone: "slate",
    },
  ];

  if (isLeaderOrAdmin) {
    quickSections.push(
      {
        href: "/producao",
        title: "Painel de Produção",
        description: "Acompanhamento operacional por turno.",
        icon: <Factory className="h-5 w-5 text-emerald-600" />,
        tone: "green",
      },
      {
        href: "/heijunka",
        title: "Heijunka",
        description: "Indicadores e histórico de balanceamento.",
        icon: <TrendingUp className="h-5 w-5 text-violet-600" />,
        tone: "violet",
      }
    );
  }

  if (isAdmin) {
    quickSections.push({
      href: "/settings/users",
      title: "Gestão de Usuários",
      description: "Controle de aprovação e permissões.",
      icon: <Shield className="h-5 w-5 text-amber-600" />,
      tone: "amber",
    });
  }

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
          <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
            <section className="mb-6 rounded-2xl border border-blue-800/40 bg-gradient-to-br from-[#0c2f4f] via-[#114a75] to-[#1d6a9e] text-white shadow-lg p-5 sm:p-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Dashboard Operacional</h1>
                    <p className="text-sm text-white/85 mt-1">Visão consolidada de desempenho, pendências e ritmo de pagamento.</p>
                    <div className="flex items-center gap-2 mt-3">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-white/15 px-2.5 py-1 rounded-full border border-white/20">
                        <Activity className="w-3.5 h-3.5" />
                        Última atividade: {formatLastActivity(stats.recentActivity)}
                      </span>
                      {lastUpdate && (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-white/15 px-2.5 py-1 rounded-full border border-white/20">
                          Atualizado {formatLastActivity(lastUpdate.toISOString())}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => fetchStats(true)}
                  disabled={refreshing}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-white/30 bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
                  <span className="text-sm font-semibold">Atualizar agora</span>
                </button>
              </div>
            </section>

            {refreshing && (
              <div className="mb-4 flex items-center justify-center gap-2 py-2">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                <span className="text-xs font-bold text-primary">Atualizando dados...</span>
              </div>
            )}

            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
              <StatCard
                label="Total de NTs"
                value={stats.totalNTs}
                loading={loading}
                tone="blue"
                helperText="Volume total de notas registradas."
                icon={<Package className="w-5 h-5 text-primary" />}
              />
              <StatCard
                label="Total de Itens"
                value={stats.totalItems}
                loading={loading}
                tone="emerald"
                helperText="Itens processados em toda a base."
                icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
              />
              <StatCard
                label="Pendentes"
                value={stats.pendingItems}
                loading={loading}
                tone="amber"
                helperText="Itens aguardando pagamento."
                icon={<Clock className="w-5 h-5 text-amber-600" />}
              />
              <StatCard
                label="Concluídas"
                value={stats.completedNTs}
                loading={loading}
                tone="green"
                helperText="NTs com itens 100% pagos."
                icon={<CheckCircle2 className="w-5 h-5 text-green-600" />}
              />
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-6">
              <Card className="xl:col-span-7 border shadow-sm">
                <CardHeader className="pb-3 border-b border-border/60">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    Atalhos Operacionais
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {quickSections.map((section) => (
                      <Link
                        key={section.href}
                        href={section.href}
                        className={cn(
                          "group flex items-center gap-3 p-4 rounded-xl border border-border transition-all",
                          section.tone === "blue" && "hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/10",
                          section.tone === "slate" && "hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50/60 dark:hover:bg-slate-800/50",
                          section.tone === "green" && "hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50/60 dark:hover:bg-emerald-900/10",
                          section.tone === "violet" && "hover:border-violet-300 dark:hover:border-violet-700 hover:bg-violet-50/60 dark:hover:bg-violet-900/10",
                          section.tone === "amber" && "hover:border-amber-300 dark:hover:border-amber-700 hover:bg-amber-50/60 dark:hover:bg-amber-900/10"
                        )}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center",
                          section.tone === "blue" && "bg-blue-50 dark:bg-blue-900/20",
                          section.tone === "slate" && "bg-slate-100 dark:bg-slate-800/80",
                          section.tone === "green" && "bg-emerald-50 dark:bg-emerald-900/20",
                          section.tone === "violet" && "bg-violet-50 dark:bg-violet-900/20",
                          section.tone === "amber" && "bg-amber-50 dark:bg-amber-900/20"
                        )}>
                          {section.icon}
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm text-foreground">{section.title}</h3>
                          <p className="text-xs text-muted-foreground">{section.description}</p>
                        </div>
                        <ArrowRight className="ml-auto w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="xl:col-span-5 border shadow-sm">
                <CardHeader className="pb-3 border-b border-border/60">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    Pulso do Sistema
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-900/15 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-green-700 dark:text-green-300">Pagos Hoje</p>
                      <p className="text-2xl font-black text-green-700 dark:text-green-300 mt-1">
                        {loading ? <span className="inline-block w-8 h-6 bg-green-200 dark:bg-green-800 animate-pulse rounded" /> : stats.paidToday}
                      </p>
                    </div>

                    <div className="rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/15 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">Semana</p>
                      <p className="text-2xl font-black text-blue-700 dark:text-blue-300 mt-1">
                        {loading ? <span className="inline-block w-8 h-6 bg-blue-200 dark:bg-blue-800 animate-pulse rounded" /> : stats.paidThisWeek}
                      </p>
                    </div>

                    <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/15 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-red-700 dark:text-red-300">Atrasados</p>
                      <p className="text-2xl font-black text-red-700 dark:text-red-300 mt-1">
                        {loading ? <span className="inline-block w-8 h-6 bg-red-200 dark:bg-red-800 animate-pulse rounded" /> : stats.overdueItems}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-muted/20 p-3.5 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Última atividade registrada</p>
                      <p className="text-sm font-bold text-foreground mt-0.5">{formatLastActivity(stats.recentActivity)}</p>
                    </div>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </section>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
