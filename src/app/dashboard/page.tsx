"use client";

import { useState, useEffect } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Sidebar } from "@/components/layout/sidebar";
import { useFirebase } from "@/components/providers/firebase-provider";
import ProtectedRoute from "@/components/auth/protected-route";
import { Clock, TrendingUp, Package, CheckCircle2, Zap, AlertTriangle, Activity, ArrowRight, Calendar, BarChart3, RefreshCw, ArrowUpRight, ArrowDownRight } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { collection, query, where, getDocs, orderBy, limit, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { cn, getCurrentShift } from "@/lib/utils";

interface ShiftStats {
  shiftNumber: number;
  totalNTs: number;
  totalItems: number;
  paidItems: number;
  pendingItems: number;
  completedNTs: number;
  averagePaymentTime: number;
}

interface DashboardStats {
  totalNTs: number;
  totalItems: number;
  pendingItems: number;
  paidToday: number;
  paidThisWeek: number;
  overdueItems: number;
  completedNTs: number;
  recentActivity: string | null;
  currentShift: ShiftStats;
  previousShift: ShiftStats;
}

export default function Dashboard() {
  const currentShiftNum = getCurrentShift();
  const previousShiftNum = currentShiftNum === 1 ? 3 : currentShiftNum - 1;
  
  const [stats, setStats] = useState<DashboardStats>({
    totalNTs: 0,
    totalItems: 0,
    pendingItems: 0,
    paidToday: 0,
    paidThisWeek: 0,
    overdueItems: 0,
    completedNTs: 0,
    recentActivity: null,
    currentShift: {
      shiftNumber: currentShiftNum,
      totalNTs: 0,
      totalItems: 0,
      paidItems: 0,
      pendingItems: 0,
      completedNTs: 0,
      averagePaymentTime: 0
    },
    previousShift: {
      shiftNumber: previousShiftNum,
      totalNTs: 0,
      totalItems: 0,
      paidItems: 0,
      pendingItems: 0,
      completedNTs: 0,
      averagePaymentTime: 0
    }
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

      // Helper function to check if a time string is in a specific shift
      const isInShift = (timeStr: string, shiftNum: number): boolean => {
        const time = new Date(timeStr);
        const hours = time.getHours();
        const minutes = time.getMinutes();
        const totalMinutes = hours * 60 + minutes;
        
        // Shift 1: 7:20-15:50 (440-950 minutes)
        // Shift 2: 15:50-23:00 (950-1380 minutes)
        // Shift 3: 23:00-7:20 (1380+ or 0-440 minutes)
        if (shiftNum === 1) return totalMinutes >= 440 && totalMinutes < 950;
        if (shiftNum === 2) return totalMinutes >= 950 && totalMinutes < 1380;
        if (shiftNum === 3) return totalMinutes >= 1380 || totalMinutes < 440;
        return false;
      };

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

      // Calculate shift-specific statistics (last 24 hours only)
      const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
      const currentShiftData: ShiftStats = {
        shiftNumber: currentShiftNum,
        totalNTs: 0,
        totalItems: 0,
        paidItems: 0,
        pendingItems: 0,
        completedNTs: 0,
        averagePaymentTime: 0
      };
      const previousShiftData: ShiftStats = {
        shiftNumber: previousShiftNum,
        totalNTs: 0,
        totalItems: 0,
        paidItems: 0,
        pendingItems: 0,
        completedNTs: 0,
        averagePaymentTime: 0
      };

      const shiftPaymentTimes: { current: number[], previous: number[] } = { current: [], previous: [] };

      ntsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const createdAt = toDateFromField(data.created_at);
        
        if (!createdAt || createdAt < twentyFourHoursAgo) return;

        const createdTimeStr = createdAt.toISOString();
        const isCurrentShift = isInShift(createdTimeStr, currentShiftNum);
        const isPreviousShift = isInShift(createdTimeStr, previousShiftNum);

        if (isCurrentShift) {
          currentShiftData.totalNTs++;
          const ntItems = itemsByNT.get(doc.id);
          if (ntItems) {
            const allPaid = ntItems.every((item: any) => item.status?.toLowerCase() === 'pago');
            if (allPaid && ntItems.length > 0) currentShiftData.completedNTs++;
          }
        } else if (isPreviousShift) {
          previousShiftData.totalNTs++;
          const ntItems = itemsByNT.get(doc.id);
          if (ntItems) {
            const allPaid = ntItems.every((item: any) => item.status?.toLowerCase() === 'pago');
            if (allPaid && ntItems.length > 0) previousShiftData.completedNTs++;
          }
        }
      });

      itemsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const createdAt = toDateFromField(data.created_at);
        const updatedAt = toDateFromField(data.updated_at);
        
        if (!createdAt || createdAt < twentyFourHoursAgo) return;

        const createdTimeStr = createdAt.toISOString();
        const isCurrentShift = isInShift(createdTimeStr, currentShiftNum);
        const isPreviousShift = isInShift(createdTimeStr, previousShiftNum);

        if (isCurrentShift) {
          currentShiftData.totalItems++;
          const statusLower = data.status?.toLowerCase();
          if (statusLower === 'pago' || statusLower === 'pago parcial') {
            currentShiftData.paidItems++;
            // Calculate payment time
            if (updatedAt && createdAt) {
              const paymentTimeMinutes = (updatedAt.getTime() - createdAt.getTime()) / (1000 * 60);
              shiftPaymentTimes.current.push(paymentTimeMinutes);
            }
          } else if (statusLower === 'pendente') {
            currentShiftData.pendingItems++;
          }
        } else if (isPreviousShift) {
          previousShiftData.totalItems++;
          const statusLower = data.status?.toLowerCase();
          if (statusLower === 'pago' || statusLower === 'pago parcial') {
            previousShiftData.paidItems++;
            // Calculate payment time
            if (updatedAt && createdAt) {
              const paymentTimeMinutes = (updatedAt.getTime() - createdAt.getTime()) / (1000 * 60);
              shiftPaymentTimes.previous.push(paymentTimeMinutes);
            }
          } else if (statusLower === 'pendente') {
            previousShiftData.pendingItems++;
          }
        }
      });

      // Calculate average payment times
      if (shiftPaymentTimes.current.length > 0) {
        const sum = shiftPaymentTimes.current.reduce((a, b) => a + b, 0);
        currentShiftData.averagePaymentTime = Math.round(sum / shiftPaymentTimes.current.length);
      }
      if (shiftPaymentTimes.previous.length > 0) {
        const sum = shiftPaymentTimes.previous.reduce((a, b) => a + b, 0);
        previousShiftData.averagePaymentTime = Math.round(sum / shiftPaymentTimes.previous.length);
      }

      // Debug: Log shift data
      console.log('Shift Debug:', {
        currentShiftNum,
        previousShiftNum,
        currentShiftData,
        previousShiftData,
        twentyFourHoursAgo,
        totalNTsInDB: ntsSnapshot.size,
        totalItemsInDB: itemsSnapshot.size
      });

      setStats({
        totalNTs,
        totalItems,
        pendingItems,
        paidToday,
        paidThisWeek,
        overdueItems,
        completedNTs,
        recentActivity: recentActivityISO,
        currentShift: currentShiftData,
        previousShift: previousShiftData
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

  const getShiftName = (shiftNum: number): string => {
    if (shiftNum === 1) return '1° Turno (7:20-15:50)';
    if (shiftNum === 2) return '2° Turno (15:50-23:00)';
    if (shiftNum === 3) return '3° Turno (23:00-7:20)';
    return 'Desconhecido';
  };

  const formatMinutes = (minutes: number): string => {
    if (minutes === 0) return '-';
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  };
  
  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
        <Sidebar />
        <div className="flex-1 flex flex-col ml-[64px] transition-all duration-300">
          <Topbar />
          <main className="flex-1 p-6 overflow-y-auto">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between gap-4 mb-3">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                    <BarChart3 className="w-6 h-6 text-white drop-shadow-md" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-black bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900 dark:from-white dark:via-gray-200 dark:to-white bg-clip-text text-transparent">
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
                    className="p-3 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 hover:shadow-xl hover:shadow-blue-500/30 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    <RefreshCw className={cn(
                      "w-5 h-5 text-white drop-shadow-md transition-transform duration-500",
                      refreshing && "animate-spin"
                    )} />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Shift Analysis Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Auto-refresh indicator */}
              {refreshing && (
                <div className="col-span-full flex items-center justify-center gap-2 py-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">Atualizando dados...</span>
                </div>
              )}
              {/* Current Shift Card */}
              <Card className="border-none shadow-xl overflow-hidden">
                <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm font-bold text-white/90 uppercase tracking-wide">Turno Atual</p>
                      <p className="text-2xl font-black text-white drop-shadow-lg mt-1">
                        {getShiftName(stats.currentShift.shiftNumber)}
                      </p>
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Clock className="w-7 h-7 text-white drop-shadow-md" />
                    </div>
                  </div>
                </div>
                <CardContent className="p-6 bg-white dark:bg-gray-800">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Total NTs */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-800">
                      <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">NTs Criadas</p>
                      <p className="text-3xl font-black text-blue-700 dark:text-blue-300">
                        {loading ? <span className="inline-block w-12 h-8 bg-blue-200 dark:bg-blue-800 rounded animate-pulse" /> : stats.currentShift.totalNTs}
                      </p>
                    </div>

                    {/* Total Items */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-100 dark:border-purple-800">
                      <p className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wide mb-1">Total Itens</p>
                      <p className="text-3xl font-black text-purple-700 dark:text-purple-300">
                        {loading ? <span className="inline-block w-12 h-8 bg-purple-200 dark:bg-purple-800 rounded animate-pulse" /> : stats.currentShift.totalItems}
                      </p>
                    </div>

                    {/* Paid Items */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-100 dark:border-green-800">
                      <p className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wide mb-1">Itens Pagos</p>
                      <p className="text-3xl font-black text-green-700 dark:text-green-300">
                        {loading ? <span className="inline-block w-12 h-8 bg-green-200 dark:bg-green-800 rounded animate-pulse" /> : stats.currentShift.paidItems}
                      </p>
                    </div>

                    {/* Pending Items */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border border-orange-100 dark:border-orange-800">
                      <p className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wide mb-1">Pendentes</p>
                      <p className="text-3xl font-black text-orange-700 dark:text-orange-300">
                        {loading ? <span className="inline-block w-12 h-8 bg-orange-200 dark:bg-orange-800 rounded animate-pulse" /> : stats.currentShift.pendingItems}
                      </p>
                    </div>

                    {/* Completed NTs */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 border border-teal-100 dark:border-teal-800">
                      <p className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wide mb-1">NTs Completas</p>
                      <p className="text-3xl font-black text-teal-700 dark:text-teal-300">
                        {loading ? <span className="inline-block w-12 h-8 bg-teal-200 dark:bg-teal-800 rounded animate-pulse" /> : stats.currentShift.completedNTs}
                      </p>
                    </div>

                    {/* Average Payment Time */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 border border-indigo-100 dark:border-indigo-800">
                      <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-1">Tempo Médio</p>
                      <p className="text-2xl font-black text-indigo-700 dark:text-indigo-300">
                        {loading ? <span className="inline-block w-16 h-7 bg-indigo-200 dark:bg-indigo-800 rounded animate-pulse" /> : formatMinutes(stats.currentShift.averagePaymentTime)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Previous Shift Card */}
              <Card className="border-none shadow-xl overflow-hidden">
                <div className="bg-gradient-to-br from-gray-600 via-slate-600 to-zinc-600 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm font-bold text-white/90 uppercase tracking-wide">Turno Anterior</p>
                      <p className="text-2xl font-black text-white drop-shadow-lg mt-1">
                        {getShiftName(stats.previousShift.shiftNumber)}
                      </p>
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Clock className="w-7 h-7 text-white drop-shadow-md" />
                    </div>
                  </div>
                </div>
                <CardContent className="p-6 bg-white dark:bg-gray-800">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Total NTs - with comparison */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-900/40 dark:to-slate-900/40 border border-gray-200 dark:border-gray-700">
                      <div className="flex items-start justify-between mb-1">
                        <p className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">NTs Criadas</p>
                        {stats.previousShift.totalNTs > 0 && stats.currentShift.totalNTs > stats.previousShift.totalNTs && (
                          <ArrowUpRight className="w-4 h-4 text-green-500" />
                        )}
                        {stats.previousShift.totalNTs > 0 && stats.currentShift.totalNTs < stats.previousShift.totalNTs && (
                          <ArrowDownRight className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                      <p className="text-3xl font-black text-gray-700 dark:text-gray-300">
                        {loading ? <span className="inline-block w-12 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /> : stats.previousShift.totalNTs}
                      </p>
                    </div>

                    {/* Total Items */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-900/40 dark:to-slate-900/40 border border-gray-200 dark:border-gray-700">
                      <div className="flex items-start justify-between mb-1">
                        <p className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Total Itens</p>
                        {stats.previousShift.totalItems > 0 && stats.currentShift.totalItems > stats.previousShift.totalItems && (
                          <ArrowUpRight className="w-4 h-4 text-green-500" />
                        )}
                        {stats.previousShift.totalItems > 0 && stats.currentShift.totalItems < stats.previousShift.totalItems && (
                          <ArrowDownRight className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                      <p className="text-3xl font-black text-gray-700 dark:text-gray-300">
                        {loading ? <span className="inline-block w-12 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /> : stats.previousShift.totalItems}
                      </p>
                    </div>

                    {/* Paid Items */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-900/40 dark:to-slate-900/40 border border-gray-200 dark:border-gray-700">
                      <div className="flex items-start justify-between mb-1">
                        <p className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Itens Pagos</p>
                        {stats.previousShift.paidItems > 0 && stats.currentShift.paidItems > stats.previousShift.paidItems && (
                          <ArrowUpRight className="w-4 h-4 text-green-500" />
                        )}
                        {stats.previousShift.paidItems > 0 && stats.currentShift.paidItems < stats.previousShift.paidItems && (
                          <ArrowDownRight className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                      <p className="text-3xl font-black text-gray-700 dark:text-gray-300">
                        {loading ? <span className="inline-block w-12 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /> : stats.previousShift.paidItems}
                      </p>
                    </div>

                    {/* Pending Items */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-900/40 dark:to-slate-900/40 border border-gray-200 dark:border-gray-700">
                      <div className="flex items-start justify-between mb-1">
                        <p className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Pendentes</p>
                        {stats.previousShift.pendingItems > 0 && stats.currentShift.pendingItems < stats.previousShift.pendingItems && (
                          <ArrowUpRight className="w-4 h-4 text-green-500" />
                        )}
                        {stats.previousShift.pendingItems > 0 && stats.currentShift.pendingItems > stats.previousShift.pendingItems && (
                          <ArrowDownRight className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                      <p className="text-3xl font-black text-gray-700 dark:text-gray-300">
                        {loading ? <span className="inline-block w-12 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /> : stats.previousShift.pendingItems}
                      </p>
                    </div>

                    {/* Completed NTs */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-900/40 dark:to-slate-900/40 border border-gray-200 dark:border-gray-700">
                      <div className="flex items-start justify-between mb-1">
                        <p className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">NTs Completas</p>
                        {stats.previousShift.completedNTs > 0 && stats.currentShift.completedNTs > stats.previousShift.completedNTs && (
                          <ArrowUpRight className="w-4 h-4 text-green-500" />
                        )}
                        {stats.previousShift.completedNTs > 0 && stats.currentShift.completedNTs < stats.previousShift.completedNTs && (
                          <ArrowDownRight className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                      <p className="text-3xl font-black text-gray-700 dark:text-gray-300">
                        {loading ? <span className="inline-block w-12 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /> : stats.previousShift.completedNTs}
                      </p>
                    </div>

                    {/* Average Payment Time */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-900/40 dark:to-slate-900/40 border border-gray-200 dark:border-gray-700">
                      <div className="flex items-start justify-between mb-1">
                        <p className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Tempo Médio</p>
                        {stats.previousShift.averagePaymentTime > 0 && stats.currentShift.averagePaymentTime < stats.previousShift.averagePaymentTime && (
                          <ArrowUpRight className="w-4 h-4 text-green-500" />
                        )}
                        {stats.previousShift.averagePaymentTime > 0 && stats.currentShift.averagePaymentTime > stats.previousShift.averagePaymentTime && (
                          <ArrowDownRight className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                      <p className="text-2xl font-black text-gray-700 dark:text-gray-300">
                        {loading ? <span className="inline-block w-16 h-7 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /> : formatMinutes(stats.previousShift.averagePaymentTime)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Stats grid - Modern UI 2.0 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* Total NTs */}
              <Card className="relative overflow-hidden border-gray-200/50 dark:border-gray-700/50 shadow-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-blue-600 dark:from-blue-600 dark:via-indigo-600 dark:to-blue-700 hover:shadow-2xl hover:shadow-blue-500/30 transition-all duration-300 hover:scale-105 group animate-in fade-in slide-in-from-bottom-4"
                style={{ animationDelay: '0ms', animationDuration: '500ms' }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
                <CardContent className="p-6 relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Package className="w-6 h-6 text-white drop-shadow-lg" />
                    </div>
                    <span className="text-xs font-bold text-white/80 uppercase tracking-wider">Total</span>
                  </div>
                  <p className="text-4xl font-black text-white mb-1 drop-shadow-lg">
                    {loading ? (
                      <span className="inline-block w-16 h-10 bg-white/30 rounded-lg animate-pulse" />
                    ) : stats.totalNTs}
                  </p>
                  <p className="text-sm font-bold text-white/90">Notas Técnicas</p>
                </CardContent>
              </Card>

              {/* Total Itens */}
              <Card className="relative overflow-hidden border-gray-200/50 dark:border-gray-700/50 shadow-xl bg-gradient-to-br from-purple-500 via-pink-500 to-purple-600 dark:from-purple-600 dark:via-pink-600 dark:to-purple-700 hover:shadow-2xl hover:shadow-purple-500/30 transition-all duration-300 hover:scale-105 group animate-in fade-in slide-in-from-bottom-4"
                style={{ animationDelay: '100ms', animationDuration: '500ms' }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
                <CardContent className="p-6 relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-white drop-shadow-lg" />
                    </div>
                    <span className="text-xs font-bold text-white/80 uppercase tracking-wider">Itens</span>
                  </div>
                  <p className="text-4xl font-black text-white mb-1 drop-shadow-lg">
                    {loading ? (
                      <span className="inline-block w-16 h-10 bg-white/30 rounded-lg animate-pulse" />
                    ) : stats.totalItems}
                  </p>
                  <p className="text-sm font-bold text-white/90">Total de Itens</p>
                </CardContent>
              </Card>

              {/* Pendentes */}
              <Card className="relative overflow-hidden border-gray-200/50 dark:border-gray-700/50 shadow-xl bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 dark:from-amber-600 dark:via-orange-600 dark:to-amber-700 hover:shadow-2xl hover:shadow-amber-500/30 transition-all duration-300 hover:scale-105 group animate-in fade-in slide-in-from-bottom-4"
                style={{ animationDelay: '200ms', animationDuration: '500ms' }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
                <CardContent className="p-6 relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Clock className="w-6 h-6 text-white drop-shadow-lg" />
                    </div>
                    <span className="text-xs font-bold text-white/80 uppercase tracking-wider">Aguardando</span>
                  </div>
                  <p className="text-4xl font-black text-white mb-1 drop-shadow-lg">
                    {loading ? (
                      <span className="inline-block w-16 h-10 bg-white/30 rounded-lg animate-pulse" />
                    ) : stats.pendingItems}
                  </p>
                  <p className="text-sm font-bold text-white/90">Itens Pendentes</p>
                </CardContent>
              </Card>

              {/* Concluídas */}
              <Card className="relative overflow-hidden border-gray-200/50 dark:border-gray-700/50 shadow-xl bg-gradient-to-br from-green-500 via-emerald-500 to-green-600 dark:from-green-600 dark:via-emerald-600 dark:to-green-700 hover:shadow-2xl hover:shadow-green-500/30 transition-all duration-300 hover:scale-105 group animate-in fade-in slide-in-from-bottom-4"
                style={{ animationDelay: '300ms', animationDuration: '500ms' }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
                <CardContent className="p-6 relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6 text-white drop-shadow-lg" />
                    </div>
                    <span className="text-xs font-bold text-white/80 uppercase tracking-wider">100%</span>
                  </div>
                  <p className="text-4xl font-black text-white mb-1 drop-shadow-lg">
                    {loading ? (
                      <span className="inline-block w-16 h-10 bg-white/30 rounded-lg animate-pulse" />
                    ) : stats.completedNTs}
                  </p>
                  <p className="text-sm font-bold text-white/90">NTs Concluídas</p>
                </CardContent>
              </Card>
            </div>

            {/* Seção de Ações Rápidas e Estatísticas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Card de Ações Rápidas */}
              <Card className="relative overflow-hidden border-gray-200/50 dark:border-gray-700/50 shadow-xl bg-gradient-to-br from-white via-gray-50/30 to-white dark:from-gray-900 dark:via-gray-900/50 dark:to-gray-900 backdrop-blur-sm">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                      <Zap className="h-5 w-5 text-white drop-shadow-md" />
                    </div>
                    Ações Rápidas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Link 
                      href="/almoxarifado/nts" 
                      className="group relative overflow-hidden p-5 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 transition-all hover:shadow-xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-800/50 hover:scale-105"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="flex items-center gap-3 relative z-10">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                          <Package className="h-6 w-6 text-white drop-shadow-md" />
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-1">Gerenciar NTs</h3>
                          <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Ver e editar NTs ativas</p>
                        </div>
                      </div>
                      <ArrowRight className="absolute bottom-3 right-3 w-5 h-5 text-blue-500 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-1" />
                    </Link>

                    <button 
                      onClick={() => {
                        // Navegar para NTs e abrir timeline
                        window.location.href = "/almoxarifado/nts?view=timeline";
                      }}
                      className="group relative overflow-hidden p-5 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-green-400 dark:hover:border-green-500 transition-all hover:shadow-xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-800/50 hover:scale-105 w-full text-left cursor-pointer"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="flex items-center gap-3 relative z-10">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                          <Activity className="h-6 w-6 text-white drop-shadow-md" />
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-1">Timeline ao Vivo</h3>
                          <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Acompanhar pagamentos</p>
                        </div>
                      </div>
                      <ArrowRight className="absolute bottom-3 right-3 w-5 h-5 text-green-500 dark:text-green-400 opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-1" />
                    </button>
                  </div>
                </CardContent>
              </Card>

              {/* Estatísticas Detalhadas */}
              <Card className="relative overflow-hidden border-gray-200/50 dark:border-gray-700/50 shadow-xl bg-gradient-to-br from-white via-gray-50/30 to-white dark:from-gray-900 dark:via-gray-900/50 dark:to-gray-900 backdrop-blur-sm">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-red-500" />
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg">
                      <Activity className="h-5 w-5 text-white drop-shadow-md" />
                    </div>
                    Estatísticas Detalhadas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-4">
                    {/* Pagos Hoje */}
                    <div className="p-4 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 shadow-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-white/90 uppercase tracking-wide">Pagos Hoje</p>
                          <p className="text-3xl font-black text-white drop-shadow-lg mt-1">
                            {loading ? (
                              <span className="inline-block w-12 h-9 bg-white/30 rounded-lg animate-pulse" />
                            ) : stats.paidToday}
                          </p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                          <CheckCircle2 className="w-6 h-6 text-white drop-shadow-md" />
                        </div>
                      </div>
                    </div>

                    {/* Pagos na Semana */}
                    <div className="p-4 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 shadow-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-white/90 uppercase tracking-wide">Esta Semana</p>
                          <p className="text-3xl font-black text-white drop-shadow-lg mt-1">
                            {loading ? (
                              <span className="inline-block w-12 h-9 bg-white/30 rounded-lg animate-pulse" />
                            ) : stats.paidThisWeek}
                          </p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                          <Calendar className="w-6 h-6 text-white drop-shadow-md" />
                        </div>
                      </div>
                    </div>

                    {/* Itens Atrasados */}
                    <div className="p-4 rounded-xl bg-gradient-to-r from-red-500 to-pink-600 shadow-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-white/90 uppercase tracking-wide">Atrasados</p>
                          <p className="text-3xl font-black text-white drop-shadow-lg mt-1">
                            {loading ? (
                              <span className="inline-block w-12 h-9 bg-white/30 rounded-lg animate-pulse" />
                            ) : stats.overdueItems}
                          </p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                          <AlertTriangle className="w-6 h-6 text-white drop-shadow-md" />
                        </div>
                      </div>
                    </div>

                    {/* Última Atividade */}
                    <div className="mt-2 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <p className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">Última Atividade</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatLastActivity(stats.recentActivity)}</p>
                      <Link 
                        href="/almoxarifado/nts" 
                        className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mt-3 group"
                      >
                        Ver timeline completo
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </Link>
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
