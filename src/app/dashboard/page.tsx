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
  const isLeaderOrAdmin = isAdmin || userData?.role === "leader" || userData?.role === "supervisor";

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
      <div className="flex h-screen bg-[var(--bg)] text-[var(--text)] overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col pl-[52px] min-w-0 h-screen overflow-hidden">
          <Topbar />
          <main className="flex-1 p-5 sm:p-6 overflow-y-auto min-w-0">
            {/* Header da Página */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-lg font-semibold tracking-tight text-[var(--text)]">Visão Geral · Painel Operacional</h1>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Tempo real
                  </span>
                </div>
                <p className="text-xs text-[var(--text-3)] mt-0.5">
                  Telemetria de fluxo contínuo, ritmo de pagamentos de NTs e indicadores de turno
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchStats(true)}
                  disabled={refreshing}
                  className="inline-flex items-center gap-2 h-8 px-3 rounded-md border border-[var(--border-strong)] bg-[var(--surface)] hover:bg-[var(--hover)] text-xs font-medium text-[var(--text-2)] hover:text-[var(--text)] transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
                  <span>{refreshing ? "Atualizando..." : "Sincronizar"}</span>
                </button>
              </div>
            </div>

            {/* Faixa de Indicadores Principais */}
            <div className="grid grid-cols-2 lg:grid-cols-4 border border-[var(--border)] rounded-md bg-[var(--surface)] divide-x divide-y sm:divide-y-0 divide-[var(--border)] overflow-hidden mb-5">
              <div className="p-4">
                <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-3)] mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-3)]" />
                  Total de NTs
                </label>
                <strong className="text-2xl font-semibold tracking-tight text-[var(--text)] font-mono block">
                  {loading ? "--" : stats.totalNTs}
                </strong>
                <p className="text-[11px] text-[var(--text-3)] mt-1 font-mono">notas cadastradas</p>
              </div>

              <div className="p-4">
                <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-3)] mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Total de Itens
                </label>
                <strong className="text-2xl font-semibold tracking-tight text-[var(--text)] font-mono block">
                  {loading ? "--" : stats.totalItems}
                </strong>
                <p className="text-[11px] text-[var(--text-3)] mt-1 font-mono">pagos</p>
              </div>

              <div className="p-4">
                <label className="flex items-center gap-1.5 text-[11px] text-amber-400 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Pendentes
                </label>
                <strong className="text-2xl font-semibold tracking-tight text-amber-400 font-mono block">
                  {loading ? "--" : stats.pendingItems}
                </strong>
                <p className="text-[11px] text-[var(--text-3)] mt-1 font-mono">aguardando pagamento</p>
              </div>

              <div className="p-4">
                <label className="flex items-center gap-1.5 text-[11px] text-emerald-400 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Concluídas 100%
                </label>
                <strong className="text-2xl font-semibold tracking-tight text-emerald-400 font-mono block">
                  {loading ? "--" : stats.completedNTs}
                </strong>
                <p className="text-[11px] text-[var(--text-3)] mt-1 font-mono">
                  {stats.totalNTs > 0 ? `${Math.round((stats.completedNTs / stats.totalNTs) * 100)}% de conclusão` : "0%"}
                </p>
              </div>
            </div>

            {/* Seções de Acesso Rápido e Pulso */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-5">
              <div className="lg:col-span-7 space-y-3">
                <h2 className="text-xs font-semibold text-[var(--text)] uppercase tracking-wider">Atalhos Operacionais</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {quickSections.map((section) => (
                    <Link
                      key={section.href}
                      href={section.href}
                      className="flex items-center gap-3 p-3.5 rounded-md border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--hover)] transition-colors group"
                    >
                      <div className="w-9 h-9 rounded bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[var(--text-2)] group-hover:text-[var(--text)] transition-colors">
                        {section.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-xs text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
                          {section.title}
                        </h3>
                        <p className="text-[11px] text-[var(--text-3)] truncate">{section.description}</p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-[var(--text-3)] group-hover:text-[var(--text)] transition-colors" />
                    </Link>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-5 space-y-3">
                <h2 className="text-xs font-semibold text-[var(--text)] uppercase tracking-wider">Pulso Operacional</h2>
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded p-2.5 border border-emerald-500/20 bg-emerald-500/5 text-center">
                      <p className="text-[10px] uppercase font-mono text-emerald-400">Pagos Hoje</p>
                      <p className="text-xl font-semibold font-mono text-emerald-400 mt-0.5">{stats.paidToday}</p>
                    </div>
                    <div className="rounded p-2.5 border border-blue-500/20 bg-blue-500/5 text-center">
                      <p className="text-[10px] uppercase font-mono text-blue-400">Semana</p>
                      <p className="text-xl font-semibold font-mono text-blue-400 mt-0.5">{stats.paidThisWeek}</p>
                    </div>
                    <div className="rounded p-2.5 border border-red-500/20 bg-red-500/5 text-center">
                      <p className="text-[10px] uppercase font-mono text-red-400">Atrasados</p>
                      <p className="text-xl font-semibold font-mono text-red-400 mt-0.5">{stats.overdueItems}</p>
                    </div>
                  </div>

                  <div className="border-t border-[var(--border)] pt-3 flex items-center justify-between text-xs text-[var(--text-3)] font-mono">
                    <span>Última atividade registrada</span>
                    <span className="text-[var(--text-2)]">{formatLastActivity(stats.recentActivity)}</span>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
