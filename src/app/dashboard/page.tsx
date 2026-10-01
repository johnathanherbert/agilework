"use client";

import { useState, useEffect, useMemo } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Sidebar } from "@/components/layout/sidebar";
import { useFirebase, ADMIN_EMAIL } from "@/components/providers/firebase-provider";
import ProtectedRoute from "@/components/auth/protected-route";
import {
  Clock,
  TrendingUp,
  Package,
  CheckCircle2,
  AlertTriangle,
  Activity,
  ArrowRight,
  RefreshCw,
  Factory,
  Shield,
  ShieldAlert,
  Lock,
  Settings,
  Flame,
  FileText,
  Users,
  Timer,
  Check,
  Zap,
  ArrowUpRight
} from "lucide-react";
import Link from "next/link";
import { collection, query, orderBy, onSnapshot, limit as firestoreLimit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { getCurrentActiveShift, getShiftPhase, SHIFT_SCHEDULES } from "@/lib/production-schedule";
import { PRODUCTION_COLLECTION } from "@/lib/production-helpers";
import { ProductionItem, NT, NTItem } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type RequiredRole = "all" | "leader" | "maoDeObra" | "solicitacoes" | "admin";

interface QuickLinkItem {
  href: string;
  title: string;
  subtitle: string;
  badge: string;
  badgeTone: string;
  icon: any;
  requiredRole: RequiredRole;
  requiredRoleLabel: string;
  restrictionReason: string;
}

interface TimelineFeedItem {
  id: string;
  code: string;
  description: string;
  quantity: string;
  batch?: string | null;
  nt_number?: string;
  paid_time?: string;
  paid_at: Date;
  durationMin?: number;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function dur(min: number): string {
  min = Math.max(0, Math.round(min));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m < 10 ? "0" : ""}${m}m`;
}

function parseDate(dateStr?: string | null, timeStr?: string | null, timestamp?: any): Date | null {
  if (timestamp) {
    if (timestamp instanceof Date && !isNaN(timestamp.getTime())) return timestamp;
    if (typeof timestamp.toDate === "function") {
      const d = timestamp.toDate();
      if (!isNaN(d.getTime())) return d;
    }
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) return d;
  }
  if (!dateStr || typeof dateStr !== "string") return null;
  if (dateStr.includes("T") || (dateStr.includes("-") && dateStr.length >= 10 && !dateStr.includes("/"))) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
  }
  let day = 1,
    month = 1,
    year = 1970;
  if (dateStr.includes("/")) {
    const parts = dateStr.split("/").map(Number);
    if (parts.length === 3) [day, month, year] = parts;
  } else if (dateStr.includes("-")) {
    const parts = dateStr.split("-").map(Number);
    if (parts.length === 3) {
      if (parts[0] > 1000) [year, month, day] = parts;
      else [day, month, year] = parts;
    }
  }
  let hours = 0,
    minutes = 0;
  if (timeStr && typeof timeStr === "string") {
    const tParts = timeStr.split(":").map(Number);
    if (!isNaN(tParts[0])) hours = tParts[0];
    if (!isNaN(tParts[1])) minutes = tParts[1];
  }
  const d = new Date(year, month - 1, day, hours, minutes);
  return isNaN(d.getTime()) ? null : d;
}

export default function Dashboard() {
  const { user, userData } = useFirebase();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState<Date>(() => new Date());

  // Real-time Collections Data
  const [rawNts, setRawNts] = useState<any[]>([]);
  const [rawItems, setRawItems] = useState<any[]>([]);
  const [rawProduction, setRawProduction] = useState<ProductionItem[]>([]);

  const isAdmin = userData?.email === ADMIN_EMAIL;
  const isLeaderOrAdmin = isAdmin || userData?.role === "leader" || userData?.role === "supervisor";
  const isMaoDeObraAllowed = isAdmin || userData?.role === "supervisor" || (userData?.role === "leader" && Boolean(userData?.allowedMaoDeObra));
  const isSolicitacoesAllowed = isAdmin || userData?.role === "supervisor" || Boolean(userData?.allowedSolicitacoes);

  // Relógio ao vivo a cada segundo
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Listeners em tempo real do Firestore
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    // 1. NTs
    const qNts = query(collection(db, "nts"), orderBy("created_at", "desc"));
    const unsubNts = onSnapshot(
      qNts,
      (snap) => {
        const loaded: any[] = [];
        snap.forEach((d) => loaded.push({ id: d.id, ...d.data() }));
        setRawNts(loaded);
      },
      (err) => console.error("Erro no listener de NTs:", err)
    );

    // 2. NT Items
    const qItems = query(collection(db, "nt_items"));
    const unsubItems = onSnapshot(
      qItems,
      (snap) => {
        const loaded: any[] = [];
        snap.forEach((d) => loaded.push({ id: d.id, ...d.data() }));
        setRawItems(loaded);
        setLoading(false);
      },
      (err) => console.error("Erro no listener de itens:", err)
    );

    // 3. Produção
    const qProd = collection(db, PRODUCTION_COLLECTION);
    const unsubProd = onSnapshot(
      qProd,
      (snap) => {
        const loaded: ProductionItem[] = [];
        snap.forEach((d) => {
          const data = d.data();
          loaded.push({
            id: d.id,
            turno: data.turno,
            tipo: data.tipo,
            via: data.via,
            familia: data.familia,
            lp: data.lp ?? false,
            codigoReceita: data.codigoReceita,
            produto: data.produto,
            prog: data.prog ?? 0,
            real: data.real ?? 0,
            locked: data.locked ?? false,
            splitChildId: data.splitChildId,
            splitParentId: data.splitParentId,
            created_at: data.created_at?.toDate ? data.created_at.toDate().toISOString() : data.created_at,
            updated_at: data.updated_at?.toDate ? data.updated_at.toDate().toISOString() : data.updated_at,
          });
        });
        setRawProduction(loaded);
      },
      (err) => console.error("Erro no listener de produção:", err)
    );

    return () => {
      unsubNts();
      unsubItems();
      unsubProd();
    };
  }, [user]);

  // Turno ativo e progresso
  const activeShift = useMemo(() => getCurrentActiveShift(now), [now]);
  const activeShiftPhase = useMemo(() => {
    if (!activeShift) return null;
    return getShiftPhase(activeShift.n, now);
  }, [activeShift, now]);

  // Métricas agregadas e estatísticas da Pesagem
  const metrics = useMemo(() => {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    // Mapear número da NT por ID
    const ntsMap = new Map<string, string>();
    rawNts.forEach((n) => {
      if (n.id && n.nt_number) ntsMap.set(n.id, n.nt_number);
    });

    // Itens por NT para calcular NTs concluídas
    const itemsByNT = new Map<string, any[]>();
    rawItems.forEach((item) => {
      const ntId = item.nt_id;
      if (!ntId) return;
      if (!itemsByNT.has(ntId)) itemsByNT.set(ntId, []);
      itemsByNT.get(ntId)?.push(item);
    });

    let completedNTsCount = 0;
    let openNTsCount = 0;
    rawNts.forEach((n) => {
      const items = itemsByNT.get(n.id) || [];
      if (items.length > 0 && items.every((i) => i.status === "Pago")) {
        completedNTsCount++;
      } else {
        openNTsCount++;
      }
    });

    let pendingCount = 0;
    let paidCount = 0;
    let paidTodayCount = 0;
    let paidThisWeekCount = 0;
    let overdueCount = 0;
    let urgentPendingCount = 0;
    let totalKgPending = 0;
    let totalKgPaidToday = 0;

    const durationsToday: number[] = [];
    const recentPaidItems: TimelineFeedItem[] = [];

    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    rawItems.forEach((item) => {
      const isPaid = item.status === "Pago";
      const isPartial = item.status === "Pago Parcial";
      const createdDate = parseDate(item.created_date, item.created_time, item.created_at) || new Date();
      const rawQty = parseFloat(String(item.quantity || "0").replace(",", ".")) || 0;

      if (isPaid || isPartial) {
        paidCount++;

        // Determinar timestamp de pagamento
        let paidDate: Date = createdDate;
        if (item.payment_time) {
          const pt = String(item.payment_time).trim();
          if (pt.includes("T") || (pt.includes("-") && pt.length >= 10)) {
            const d = new Date(pt);
            if (!isNaN(d.getTime())) paidDate = d;
          } else {
            const match = pt.match(/^(\d{1,2}):(\d{2})/);
            if (match) {
              const h = parseInt(match[1], 10);
              const m = parseInt(match[2], 10);
              const b = new Date(createdDate.getTime());
              b.setHours(h, m, 0, 0);
              if (b.getTime() < createdDate.getTime()) b.setDate(b.getDate() + 1);
              paidDate = b;
            }
          }
        } else if (item.updated_at) {
          const d = parseDate(null, null, item.updated_at);
          if (d) paidDate = d;
        }

        const isToday = paidDate >= today;
        const isThisWeek = paidDate >= sevenDaysAgo;

        if (isToday) {
          paidTodayCount++;
          totalKgPaidToday += rawQty;
          const diffMs = paidDate.getTime() - createdDate.getTime();
          const durationMin = Math.max(0, Math.floor(diffMs / 60000));
          durationsToday.push(durationMin);
        }

        if (isThisWeek) {
          paidThisWeekCount++;
        }

        const diffMs = paidDate.getTime() - createdDate.getTime();
        const durationMin = Math.max(0, Math.floor(diffMs / 60000));

        recentPaidItems.push({
          id: item.id,
          code: item.code || "—",
          description: item.description || "Material",
          quantity: item.quantity ? `${item.quantity}` : "0",
          batch: item.batch,
          nt_number: ntsMap.get(item.nt_id) || item.nt_number || "—",
          paid_time: item.payment_time || (paidDate ? `${pad(paidDate.getHours())}:${pad(paidDate.getMinutes())}` : undefined),
          paid_at: paidDate,
          durationMin,
        });
      } else {
        pendingCount++;
        totalKgPending += rawQty;

        if (item.priority) {
          urgentPendingCount++;
        }

        if (createdDate < twoHoursAgo) {
          overdueCount++;
        }
      }
    });

    // Ordenar histórico de pagamentos mais recentes
    recentPaidItems.sort((a, b) => b.paid_at.getTime() - a.paid_at.getTime());

    // KPIs de SLA / Tempo de Ciclo
    let avgMin = 0;
    let fastMin = 0;
    let slowMin = 0;
    if (durationsToday.length > 0) {
      avgMin = Math.round(durationsToday.reduce((a, b) => a + b, 0) / durationsToday.length);
      fastMin = Math.min(...durationsToday);
      slowMin = Math.max(...durationsToday);
    }

    return {
      totalNTs: rawNts.length,
      openNTsCount,
      completedNTsCount,
      totalItems: rawItems.length,
      pendingCount,
      paidCount,
      paidTodayCount,
      paidThisWeekCount,
      overdueCount,
      urgentPendingCount,
      totalKgPending: Math.round(totalKgPending),
      totalKgPaidToday: Math.round(totalKgPaidToday),
      avgCycleTime: durationsToday.length > 0 ? dur(avgMin) : "—",
      fastestTime: durationsToday.length > 0 ? dur(fastMin) : "—",
      slowestTime: durationsToday.length > 0 ? dur(slowMin) : "—",
      recentPaidFeed: recentPaidItems.slice(0, 8),
    };
  }, [rawNts, rawItems, now]);

  // Métricas do Quadro de Produção
  const prodSummary = useMemo(() => {
    let totalProg = 0;
    let totalReal = 0;
    let ordersCount = 0;
    let completedOrders = 0;

    const currentShiftItems = activeShift
      ? rawProduction.filter((it) => it.turno === activeShift.n)
      : rawProduction;

    currentShiftItems.forEach((it) => {
      if (it.tipo === "ordem") {
        ordersCount++;
        totalProg += it.prog || 0;
        totalReal += it.real || 0;
        if (it.prog > 0 && it.real >= it.prog) {
          completedOrders++;
        }
      }
    });

    const completionRate = totalProg > 0 ? Math.round((totalReal / totalProg) * 100) : 0;

    return {
      ordersCount,
      completedOrders,
      totalProg,
      totalReal,
      completionRate,
      currentShiftItems: currentShiftItems.slice(0, 6),
    };
  }, [rawProduction, activeShift]);

  // Estado do Modal de Acesso Restrito (Design Black)
  const [restrictedModal, setRestrictedModal] = useState<{
    open: boolean;
    title: string;
    requiredRoleLabel: string;
    description: string;
  }>({
    open: false,
    title: "",
    requiredRoleLabel: "",
    description: "",
  });

  const getUserRoleLabel = (role?: string, email?: string) => {
    if (email === ADMIN_EMAIL || (role as string) === "admin") return "Administrador";
    if (role === "supervisor") return "Supervisor";
    if (role === "leader") return "Líder de Produção";
    return "Operador";
  };

  const hasPermission = (requiredRole: RequiredRole): boolean => {
    if (requiredRole === "all") return true;
    if (!userData) return false;
    if (userData.email === ADMIN_EMAIL || (userData.role as string) === "admin") return true;

    if (requiredRole === "admin") {
      return userData.email === ADMIN_EMAIL || (userData.role as string) === "admin";
    }

    if (requiredRole === "leader") {
      return userData.role === "leader" || userData.role === "supervisor";
    }

    if (requiredRole === "maoDeObra") {
      return (
        userData.role === "supervisor" ||
        (userData.role === "leader" && Boolean(userData.allowedMaoDeObra))
      );
    }

    if (requiredRole === "solicitacoes") {
      return (
        userData.role === "supervisor" ||
        Boolean(userData.allowedSolicitacoes)
      );
    }

    return false;
  };

  const handleRestrictedAction = (
    e: React.MouseEvent,
    requiredRole: RequiredRole,
    title: string,
    requiredRoleLabel: string,
    description: string
  ) => {
    if (!hasPermission(requiredRole)) {
      e.preventDefault();
      e.stopPropagation();
      setRestrictedModal({
        open: true,
        title,
        requiredRoleLabel,
        description,
      });
      return false;
    }
    return true;
  };

  // Lista de Atalhos Operacionais Completa para Todos os Usuários
  const quickLinks: QuickLinkItem[] = useMemo(() => [
    {
      href: "/almoxarifado/nts",
      title: "Notas Técnicas",
      subtitle: `${metrics.openNTsCount} abertas · ${metrics.pendingCount} itens pendentes`,
      badge: metrics.overdueCount > 0 ? `${metrics.overdueCount} em atraso` : "Em dia",
      badgeTone: metrics.overdueCount > 0 ? "bg-[var(--red)]/15 text-[var(--red)] border-[var(--red)]/30" : "bg-[var(--green)]/15 text-[var(--green)] border-[var(--green)]/30",
      icon: FileText,
      requiredRole: "all",
      requiredRoleLabel: "Acesso Livre",
      restrictionReason: "Acesso liberado para todos os operadores da fábrica.",
    },
    {
      href: "/producao",
      title: "Painel de Produção",
      subtitle: activeShift ? `${activeShift.label} · ${prodSummary.totalReal}/${prodSummary.totalProg} bateladas` : "Acompanhamento por turno",
      badge: `${prodSummary.completionRate}% atingido`,
      badgeTone: prodSummary.completionRate >= 85 ? "bg-[var(--green)]/15 text-[var(--green)] border-[var(--green)]/30" : "bg-[var(--amber)]/15 text-[var(--amber)] border-[var(--amber)]/30",
      icon: Factory,
      requiredRole: "leader",
      requiredRoleLabel: "Líder de Produção ou Supervisor",
      restrictionReason: "O Painel de Produção e controle de apontamentos é restrito aos líderes de turno e supervisores.",
    },
    {
      href: "/heijunka",
      title: "Heijunka",
      subtitle: "Balanceamento e ritmo de produção",
      badge: "Operacional",
      badgeTone: "bg-[var(--purple)]/15 text-[var(--purple)] border-[var(--purple)]/30",
      icon: TrendingUp,
      requiredRole: "leader",
      requiredRoleLabel: "Líder de Produção ou Supervisor",
      restrictionReason: "O quadro de nivelamento Heijunka é restrito à gestão de linhas de envase e líderes de turno.",
    },
    {
      href: "/mao-de-obra",
      title: "Mão de Obra",
      subtitle: "Presença, absentismo, folgas, gestão de pessoas",
      badge: "Turno ativo",
      badgeTone: "bg-[var(--accent-weak)] text-[var(--accent)] border-[var(--accent)]/30",
      icon: Users,
      requiredRole: "maoDeObra",
      requiredRoleLabel: "Supervisor ou Líder Autorizado",
      restrictionReason: "A gestão de efetivo, faltas e alocação de postos exige autorização de Mão de Obra pelo supervisor.",
    },
    {
      href: "/solicitacoes",
      title: "Solicitações",
      subtitle: "Pedidos e requisições de materiais",
      badge: "Fluxo ativo",
      badgeTone: "bg-[var(--surface-2)] text-[var(--text-2)] border-[var(--border)]",
      icon: Package,
      requiredRole: "solicitacoes",
      requiredRoleLabel: "Supervisor ou Usuário Autorizado",
      restrictionReason: "A criação de solicitações de materiais requer permissão específica habilitada no seu perfil.",
    },
    {
      href: "/settings/users",
      title: "Gestão de Usuários",
      subtitle: "Controle de aprovações e cargos",
      badge: "Admin",
      badgeTone: "bg-[var(--amber)]/15 text-[var(--amber)] border-[var(--amber)]/30",
      icon: Shield,
      requiredRole: "admin",
      requiredRoleLabel: "Administrador do Sistema",
      restrictionReason: "O cadastro, aprovação de contas e concessão de privilégios de acesso é restrito ao administrador.",
    },
    {
      href: "/settings",
      title: "Configurações",
      subtitle: "Preferências de som e tema",
      badge: "Geral",
      badgeTone: "bg-[var(--surface-2)] text-[var(--text-3)] border-[var(--border)]",
      icon: Settings,
      requiredRole: "all",
      requiredRoleLabel: "Acesso Livre",
      restrictionReason: "Configurações locais de tema, sons e preferências pessoais.",
    },
  ], [metrics, prodSummary, activeShift]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 600);
  };

  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-[var(--bg)] text-[var(--text)] overflow-hidden">
        <Sidebar />

        <div className="flex-1 flex flex-col pl-[52px] min-w-0 h-screen overflow-hidden">
          <Topbar />

          <main className="flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-7 min-w-0">
            {/* 1. Header do Dashboard */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-xl font-bold tracking-tight text-[var(--text)] font-sans">
                    Dashboard · AgileWork
                  </h1>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--green)]/10 text-[var(--green)] border border-[var(--green)]/20 text-[11px] font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)] animate-pulse" />
                    ao vivo
                  </span>
                </div>
                <p className="text-xs text-[var(--text-3)] mt-1">
                  Última atualização: {now.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                </p>
              </div>

              {/* Status do Turno Ativo */}
              <div className="flex items-center gap-2.5">
                {activeShift && (
                  <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-xs shadow-2xs">
                    <Clock size={13} className="text-[var(--accent)]" />
                    <div>
                      <span className="font-semibold text-[var(--text)]">{activeShift.label}</span>
                      {activeShiftPhase?.leftMinutes !== undefined && (
                        <span className="text-[var(--text-3)] font-mono ml-1.5">
                          (restam {dur(activeShiftPhase.leftMinutes)})
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleManualRefresh}
                  disabled={refreshing}
                  className="h-8 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] hover:bg-[var(--hover)] text-xs font-medium text-[var(--text-2)] hover:text-[var(--text)] transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
                >
                  <RefreshCw size={13} className={cn(refreshing && "animate-spin text-[var(--accent)]")} />
                  <span>{refreshing ? "Sincronizando..." : "Atualizar"}</span>
                </button>
              </div>
            </div>

            {/* 2. Quatro Indicadores Principais de Topo */}
            <div className="grid grid-cols-2 lg:grid-cols-4 border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--surface)] divide-x divide-y sm:divide-y-0 divide-[var(--border)] overflow-hidden shadow-2xs mb-6">
              {/* NTs em Aberto */}
              <div className="p-4 sm:p-4.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-[var(--text-2)] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                    NTs em Aberto
                  </span>
                  <span className="text-[11px] font-mono text-[var(--text-3)]">
                    {metrics.totalNTs} total
                  </span>
                </div>
                <strong className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text)] font-mono block">
                  {loading ? "—" : metrics.openNTsCount}
                </strong>
                <div className="flex items-center justify-between text-[11.5px] text-[var(--text-3)] mt-1.5">
                  <span>{metrics.completedNTsCount} concluídas</span>
                  <span className="text-[var(--green)] font-mono font-medium">
                    {metrics.totalNTs > 0 ? `${Math.round((metrics.completedNTsCount / metrics.totalNTs) * 100)}%` : "0%"}
                  </span>
                </div>
              </div>

              {/* Fila de Itens Pendentes */}
              <div className="p-4 sm:p-4.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-[var(--amber)] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--amber)]" />
                    Itens Aguardando
                  </span>
                  {metrics.urgentPendingCount > 0 && (
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-[var(--red)]/15 text-[var(--red)] border border-[var(--red)]/30">
                      {metrics.urgentPendingCount} urgente{metrics.urgentPendingCount > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <strong className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--amber)] font-mono block">
                  {loading ? "—" : metrics.pendingCount}
                </strong>
                <div className="flex items-center justify-between text-[11.5px] text-[var(--text-3)] mt-1.5 font-mono">
                  <span>Carga total</span>
                  <span className="text-[var(--text-2)] font-semibold">{metrics.totalKgPending} kg</span>
                </div>
              </div>

              {/* Pagos Hoje */}
              <div className="p-4 sm:p-4.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-[var(--green)] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)]" />
                    Mps pagas hoje
                  </span>
                  <span className="text-[11px] font-mono text-[var(--text-3)]">
                    {metrics.paidThisWeekCount} na semana
                  </span>
                </div>
                <strong className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--green)] font-mono block">
                  {loading ? "—" : metrics.paidTodayCount}
                </strong>
                <div className="flex items-center justify-between text-[11.5px] text-[var(--text-3)] mt-1.5 font-mono">
                  <span>Volume transportado</span>
                  <span className="text-[var(--green)] font-semibold">{metrics.totalKgPaidToday} kg</span>
                </div>
              </div>

              {/* Tempo Médio de Ciclo (SLA) */}
              <div className="p-4 sm:p-4.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-[var(--text-2)] flex items-center gap-1.5">
                    <Timer size={13} className="text-[var(--accent)]" />
                    Tempo Médio (SLA)
                  </span>
                  <span className="text-[10.5px] font-mono text-[var(--text-3)]">
                    alvo &lt; 60m
                  </span>
                </div>
                <strong className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text)] font-mono block">
                  {loading ? "—" : metrics.avgCycleTime}
                </strong>
                <div className="flex items-center justify-between text-[11.5px] text-[var(--text-3)] mt-1.5 font-mono">
                  <span>Rápido: <b className="text-[var(--green)] font-normal">{metrics.fastestTime}</b></span>
                  <span>Lento: <b className={cn("font-normal", metrics.slowestTime !== "—" && "text-[var(--red)]")}>{metrics.slowestTime}</b></span>
                </div>
              </div>
            </div>

            {/* 3. Grid Principal: 2 Colunas */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Coluna Esquerda: Atalhos Rápidos & Quadro do Turno */}
              <div className="lg:col-span-7 space-y-6">
                {/* Módulos do Sistema */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-3)]">
                      Módulos Operacionais
                    </h2>
                    <span className="text-[11px] text-[var(--text-3)]">
                      Acesso rápido por perfil
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {quickLinks.map((item) => {
                      const Icon = item.icon;
                      const isAllowed = hasPermission(item.requiredRole);

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={(e) =>
                            handleRestrictedAction(
                              e,
                              item.requiredRole,
                              item.title,
                              item.requiredRoleLabel,
                              item.restrictionReason
                            )
                          }
                          className={cn(
                            "flex items-center justify-between p-3.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)] hover:bg-[var(--hover)] transition-all group shadow-2xs cursor-pointer relative",
                            !isAllowed && "hover:border-[var(--amber)]/40"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0 pr-2">
                            <div
                              className={cn(
                                "w-8 h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] group-hover:border-[var(--accent)] text-[var(--text-2)] group-hover:text-[var(--accent)] grid place-items-center transition-colors shrink-0",
                                !isAllowed && "group-hover:border-[var(--amber)] group-hover:text-[var(--amber)]"
                              )}
                            >
                              <Icon size={16} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <h3
                                  className={cn(
                                    "text-xs font-semibold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors truncate",
                                    !isAllowed && "group-hover:text-[var(--amber)]"
                                  )}
                                >
                                  {item.title}
                                </h3>
                                {!isAllowed && (
                                  <Lock size={11} className="text-[var(--text-3)] group-hover:text-[var(--amber)] transition-colors shrink-0" />
                                )}
                              </div>
                              <p className="text-[11px] text-[var(--text-3)] truncate mt-0.5">
                                {item.subtitle}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={cn("text-[10px] font-mono font-medium px-2 py-0.5 rounded border", item.badgeTone)}>
                              {item.badge}
                            </span>
                            <ArrowUpRight
                              size={14}
                              className={cn(
                                "text-[var(--text-3)] group-hover:text-[var(--text)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5",
                                !isAllowed && "group-hover:text-[var(--amber)]"
                              )}
                            />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>

                {/* Resumo do Turno Atual da Fábrica (Visível para todos, com interceptador de acesso) */}
                <div className="border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] p-4 sm:p-5 shadow-2xs">
                  <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-3.5">
                    <div className="flex items-center gap-2">
                      <Factory size={15} className="text-[var(--accent)]" />
                      <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text)]">
                        Painel de Produção · {activeShift?.label || "Turno Operacional"}
                      </h2>
                    </div>
                    <Link
                      href="/producao"
                      onClick={(e) =>
                        handleRestrictedAction(
                          e,
                          "leader",
                          "Painel de Produção",
                          "Líder de Produção ou Supervisor",
                          "O Painel de Produção e controle de apontamentos é restrito aos líderes de turno e supervisores."
                        )
                      }
                      className="text-xs font-medium text-[var(--accent)] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      Ver quadro completo
                      <ArrowRight size={12} />
                    </Link>
                  </div>

                  {/* Barra de Progresso do Turno */}
                  <div className="space-y-1.5 mb-4">
                    <div className="flex justify-between text-xs font-mono text-[var(--text-2)]">
                      <span>Progresso de bateladas: {prodSummary.totalReal} / {prodSummary.totalProg}</span>
                      <span className="font-semibold text-[var(--text)]">{prodSummary.completionRate}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--surface-2)] border border-[var(--border)] overflow-hidden">
                      <div
                        className="h-full bg-[var(--green)] transition-all duration-500 rounded-full"
                        style={{ width: `${Math.min(prodSummary.completionRate, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Mini lista de ordens do turno */}
                  {prodSummary.currentShiftItems.length > 0 ? (
                    <div className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-[var(--radius)] overflow-hidden bg-[var(--bg)] text-xs">
                      {prodSummary.currentShiftItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-2.5 px-3">
                          <div className="min-w-0 pr-2">
                            <span className="font-medium text-[var(--text)] truncate block">
                              {item.produto}
                            </span>
                            <span className="text-[10.5px] font-mono text-[var(--text-3)]">
                              {item.via ? `Via ${item.via}` : "Linha padrão"} {item.codigoReceita ? `· ${item.codigoReceita}` : ""}
                            </span>
                          </div>
                          <div className="font-mono text-xs font-semibold text-[var(--text)] shrink-0">
                            {item.real} / {item.prog}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-4 text-center text-xs text-[var(--text-3)] font-mono">
                      Nenhuma ordem programada para este turno ainda.
                    </div>
                  )}
                </div>
              </div>

              {/* Coluna Direita: Live Feed de Pesagem em Tempo Real */}
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-3)]">
                      Últimos itens pagos nas NTs
                    </h2>
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)] animate-pulse" />
                  </div>
                  <Link
                    href="/almoxarifado/nts"
                    className="text-xs font-medium text-[var(--accent)] hover:underline flex items-center gap-1"
                  >
                    Gerenciar NTs
                    <ArrowRight size={12} />
                  </Link>
                </div>

                <div className="border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] overflow-hidden shadow-2xs">
                  {metrics.recentPaidFeed.length > 0 ? (
                    <div className="divide-y divide-[var(--border)]">
                      {metrics.recentPaidFeed.map((item) => (
                        <div
                          key={item.id}
                          className="p-3 hover:bg-[var(--hover)] transition-colors flex items-start justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-[var(--accent)]">
                                {item.code}
                              </span>
                              <span className="text-[10.5px] font-mono text-[var(--text-3)]">
                                (NT #{item.nt_number})
                              </span>
                            </div>
                            <p className="text-[11.5px] text-[var(--text-2)] truncate mt-0.5" title={item.description}>
                              {item.description}
                            </p>
                            {item.batch && (
                              <span className="font-mono text-[10.5px] text-[var(--text-3)]">
                                Lote: {item.batch}
                              </span>
                            )}
                          </div>

                          <div className="text-right shrink-0">
                            <span className="font-mono font-bold text-[var(--text)] block">
                              {item.quantity} kg
                            </span>
                            <span className="font-mono text-[10.5px] text-[var(--green)] block mt-0.5">
                              {item.paid_time ? `${item.paid_time}` : "Pago"}
                            </span>
                            {item.durationMin !== undefined && item.durationMin > 0 && (
                              <span className="font-mono text-[10px] text-[var(--text-3)] block">
                                ciclo: {dur(item.durationMin)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-xs text-[var(--text-3)]">
                      Nenhum item pago recentemente.
                    </div>
                  )}

                  {/* Rodapé do Feed */}
                  <div className="p-2.5 px-3.5 bg-[var(--surface-2)] border-t border-[var(--border)] flex items-center justify-between text-[11px] text-[var(--text-3)]">
                    <span>{metrics.paidTodayCount} itens pagos hoje</span>
                    <Link
                      href="/almoxarifado/nts"
                      className="text-[var(--accent)] font-medium hover:underline"
                    >
                      Abrir lista de NTs →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>

        {/* Modal de Acesso Restrito (Design Black Industrial) */}
        <Dialog
          open={restrictedModal.open}
          onOpenChange={(open) => setRestrictedModal((prev) => ({ ...prev, open }))}
        >
          <DialogContent className="max-w-md p-0 overflow-hidden bg-[#0e1014] border border-[var(--border-strong)] rounded-xl shadow-2xl text-[var(--text)]">
            {/* Header Visual */}
            <div className="relative p-6 pb-4 bg-gradient-to-b from-[var(--surface)] to-transparent">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-[var(--amber)]/10 border border-[var(--amber)]/30 flex items-center justify-center text-[var(--amber)] shrink-0 shadow-inner">
                  <ShieldAlert size={22} />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--amber)]/15 text-[var(--amber)] border border-[var(--amber)]/25">
                      Acesso Restrito
                    </span>
                  </div>
                  <DialogTitle className="text-base font-bold text-[var(--text)] tracking-tight">
                    {restrictedModal.title}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-[var(--text-3)] mt-0.5">
                    Permissão insuficiente para acessar este módulo.
                  </DialogDescription>
                </div>
              </div>
            </div>

            {/* Conteúdo Explicativo */}
            <div className="px-6 py-3 space-y-3.5 text-xs">
              <p className="text-[var(--text-2)] leading-relaxed">
                {restrictedModal.description}
              </p>

              {/* Box de Comparação de Níveis */}
              <div className="rounded-lg bg-[var(--surface-2)]/70 border border-[var(--border)] p-3.5 space-y-2.5 font-mono text-[11.5px]">
                <div className="flex items-center justify-between text-[var(--text-3)]">
                  <span>Seu perfil atual:</span>
                  <span className="font-semibold text-[var(--text)] bg-[var(--surface)] px-2 py-0.5 rounded border border-[var(--border)]">
                    {getUserRoleLabel(userData?.role, userData?.email)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[var(--text-3)]">
                  <span>Nível exigido:</span>
                  <span className="font-semibold text-[var(--amber)] bg-[var(--amber)]/10 px-2 py-0.5 rounded border border-[var(--amber)]/25">
                    {restrictedModal.requiredRoleLabel}
                  </span>
                </div>
              </div>

              {/* Dica de Solicitação */}
              <div className="flex items-center gap-2.5 p-3 rounded-lg bg-[var(--surface)]/50 border border-[var(--border)] text-[11.5px] text-[var(--text-3)]">
                <Lock size={14} className="text-[var(--amber)] shrink-0" />
                <span>
                  Para solicitar liberação de acesso, entre em contato com seu <b>supervisor</b> ou <b>administrador</b> do sistema.
                </span>
              </div>
            </div>

            {/* Rodapé / Ação */}
            <div className="p-4 px-6 bg-[var(--surface-2)]/50 border-t border-[var(--border)] flex justify-end">
              <button
                type="button"
                onClick={() => setRestrictedModal((prev) => ({ ...prev, open: false }))}
                className="px-4 py-2 rounded-lg bg-[var(--text)] text-[var(--bg)] hover:opacity-90 transition-opacity text-xs font-semibold shadow-xs cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
}
