"use client";

import { useState, useEffect } from 'react';
import { Clock, Package, ChevronLeft, ChevronRight, Zap, TrendingUp, TrendingDown, Activity, AlertTriangle, CheckCircle2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTimelineFirebase, TimelinePaidItem } from '@/hooks/useTimelineFirebase';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface TimelineItemProps {
  item: TimelinePaidItem;
  isLatest: boolean;
  isNew?: boolean;
}

const TimelineItem = ({ item, isLatest, isNew = false }: TimelineItemProps) => {
  const [showHighlight, setShowHighlight] = useState(isLatest || isNew);

  useEffect(() => {
    if (isLatest) {
      setShowHighlight(true);
      return;
    }
    
    if (isNew) {
      const timer = setTimeout(() => {
        setShowHighlight(false);
      }, 45000);
      return () => clearTimeout(timer);
    }
  }, [isLatest, isNew]);

  useEffect(() => {
    setShowHighlight(isLatest || isNew);
  }, [isLatest, isNew]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  // Verificar se está em atraso (mais de 2 horas)
  const isDelayed = item.elapsedTime && item.elapsedTime !== '-' && parseInt(item.elapsedTime) > 2;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "relative flex items-start gap-3 p-3 rounded-xl transition-all duration-500 text-xs border backdrop-blur-sm cursor-pointer group overflow-hidden",
            showHighlight 
              ? 'bg-gradient-to-br from-blue-50 via-indigo-50/50 to-blue-50 dark:from-blue-950/60 dark:via-indigo-950/40 dark:to-blue-950/60 border-blue-300 dark:border-blue-600/50 shadow-lg shadow-blue-500/20 dark:shadow-blue-900/30 hover:shadow-xl hover:shadow-blue-500/30 dark:hover:shadow-blue-900/40'
              : 'bg-gradient-to-br from-white via-gray-50/30 to-white dark:from-gray-800/60 dark:via-gray-800/40 dark:to-gray-800/60 border-gray-200/50 dark:border-gray-700/50 hover:bg-gradient-to-br hover:from-gray-50 hover:via-gray-100/50 hover:to-gray-50 dark:hover:from-gray-700/70 dark:hover:via-gray-700/50 dark:hover:to-gray-700/70 hover:border-gray-300/70 dark:hover:border-gray-600/70 hover:shadow-lg',
            "hover:scale-[1.02] active:scale-[0.99]"
          )}>
            {/* Gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            
            {/* Timeline dot with enhanced glow */}
            <div className={cn(
              "relative mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all duration-300 z-10",
              showHighlight 
                ? 'bg-gradient-to-br from-blue-400 to-indigo-600 shadow-lg shadow-blue-500/50 dark:shadow-blue-400/80 ring-4 ring-blue-200/50 dark:ring-blue-800/30 animate-pulse'
                : item.status === 'Pago'
                  ? 'bg-gradient-to-br from-green-400 to-emerald-600 shadow-md shadow-green-500/40 ring-2 ring-green-200/50 dark:ring-green-800/30'
                  : 'bg-gradient-to-br from-amber-400 to-orange-600 shadow-md shadow-amber-500/40 ring-2 ring-amber-200/50 dark:ring-amber-800/30'
            )}>
              {showHighlight && (
                <div className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-75" />
              )}
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0 relative z-10">
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className={cn(
                    "text-xs font-bold truncate px-2 py-0.5 rounded-lg",
                    showHighlight 
                      ? 'text-blue-800 dark:text-blue-100 bg-blue-100/80 dark:bg-blue-900/40'
                      : 'text-gray-800 dark:text-gray-100 bg-gray-100 dark:bg-gray-700/60'
                  )}>
                    {item.code}
                  </span>
                  
                  {/* Priority badge */}
                  {item.isPriority && (
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-md">
                      <Star className="w-3 h-3 text-white fill-white" />
                    </div>
                  )}
                  
                  {/* Status badge */}
                  {item.status === 'Pago Parcial' && (
                    <span className="text-[10px] bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800 dark:from-amber-900/40 dark:to-orange-900/40 dark:text-amber-200 px-2 py-1 rounded-full font-bold border border-amber-300/50 dark:border-amber-700/50 shadow-sm">
                      PARCIAL
                    </span>
                  )}
                </div>
                
                <span className={cn(
                  "text-xs flex items-center gap-1 flex-shrink-0 font-semibold px-2 py-0.5 rounded-lg",
                  showHighlight
                    ? "text-blue-700 dark:text-blue-300 bg-blue-100/80 dark:bg-blue-900/40"
                    : "text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/60"
                )}>
                  <Clock className="w-3 h-3" />
                  {formatTime(item.paid_at)}
                </span>
              </div>
              
              <p className={cn(
                "text-xs leading-tight mb-2 truncate font-medium",
                showHighlight 
                  ? 'text-blue-800 dark:text-blue-200'
                  : 'text-gray-700 dark:text-gray-300'
              )} title={item.description}>
                {item.description}
              </p>
              
              <div className="flex items-center justify-between text-xs gap-2">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "font-bold px-2 py-1 rounded-lg",
                    showHighlight 
                      ? 'text-blue-700 dark:text-blue-300 bg-blue-100/80 dark:bg-blue-900/40'
                      : 'text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700/60'
                  )}>
                    Qtd: {item.quantity}
                  </span>
                  
                  {/* Elapsed time indicator */}
                  {item.elapsedTime && item.elapsedTime !== '-' && (
                    <span className={cn(
                      "flex items-center gap-1 px-2 py-1 rounded-lg font-bold shadow-sm",
                      isDelayed
                        ? "bg-gradient-to-r from-red-500 to-pink-600 text-white border border-red-600/50 shadow-red-500/30"
                        : "bg-gradient-to-r from-green-500 to-emerald-600 text-white border border-green-600/50 shadow-green-500/30"
                    )}>
                      <Zap className="w-3 h-3" />
                      {item.elapsedTime}
                    </span>
                  )}
                </div>
                
                <span className="text-xs text-white text-right bg-gradient-to-r from-gray-700 to-gray-800 dark:from-gray-600 dark:to-gray-700 px-2 py-1 rounded-lg font-bold shadow-sm">
                  NT {item.nt_number}
                </span>
              </div>
            </div>
          </div>
        </TooltipTrigger>
        
        <TooltipContent side="left" className="max-w-xs">
          <div className="space-y-1.5 text-xs">
            <p className="font-semibold">{item.description}</p>
            <div className="pt-1.5 border-t space-y-1">
              <p><strong>Código:</strong> {item.code}</p>
              <p><strong>Quantidade:</strong> {item.quantity}</p>
              {item.batch && <p><strong>Lote:</strong> {item.batch}</p>}
              <p><strong>NT:</strong> {item.nt_number}</p>
              <p><strong>Criado:</strong> {item.created_date} às {item.created_time}</p>
              <p><strong>Pago:</strong> {formatTime(item.paid_at)}</p>
              {item.elapsedTime && item.elapsedTime !== '-' && (
                <p><strong>Tempo de atendimento:</strong> {item.elapsedTime}</p>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

interface PaidItemsTimelineFirebaseProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const PaidItemsTimelineFirebase = ({ isCollapsed = false, onToggleCollapse }: PaidItemsTimelineFirebaseProps) => {
  const { 
    paidItems, 
    loading, 
    newItemIds, 
    stats,
    isConnected,
    refreshItems,
    hasNewItems 
  } = useTimelineFirebase({ limit: 30 });

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            {!isCollapsed && <span className="text-sm font-medium">Timeline de Pagamentos</span>}
          </div>
          {onToggleCollapse && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleCollapse}
              className="h-6 w-6 p-0"
            >
              {isCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </Button>
          )}
        </div>
          
        {!isCollapsed && (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-white/60 dark:bg-gray-800/60 border border-gray-200/50 dark:border-gray-700/50 rounded-lg animate-pulse backdrop-blur-sm">
                <div className="w-2 h-2 bg-gray-300 dark:bg-gray-600 rounded-full mt-1 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="h-3 w-16 bg-gray-300 dark:bg-gray-600 rounded" />
                    <div className="h-3 w-12 bg-gray-300 dark:bg-gray-600 rounded" />
                  </div>
                  <div className="h-3 w-full bg-gray-300 dark:bg-gray-600 rounded" />
                  <div className="flex justify-between items-center">
                    <div className="h-2.5 w-12 bg-gray-300 dark:bg-gray-600 rounded" />
                    <div className="h-2.5 w-14 bg-gray-300 dark:bg-gray-600 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          {!isCollapsed && (
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Activity className="w-4 h-4 text-white drop-shadow-md" />
            </div>
          )}
          {!isCollapsed && (
            <>
              <span className="text-sm font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent">
                Timeline de Pagamentos
              </span>
              <span className="text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-2.5 py-1 rounded-lg shadow-md shadow-blue-500/30">
                {paidItems.length}
              </span>
              
              {/* Live indicator */}
              <div className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold shadow-md transition-all duration-300",
                isConnected 
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-green-500/30 animate-pulse' 
                  : 'bg-gradient-to-r from-red-500 to-pink-600 text-white shadow-red-500/30'
              )}>
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  isConnected ? "bg-white shadow-lg shadow-white/50" : "bg-white"
                )} />
                <span className="uppercase tracking-wide">LIVE</span>
              </div>
            </>
          )}
        </div>
          
        {/* Toggle button */}
        {onToggleCollapse && (
          <div className="relative">
            {isCollapsed ? (
              <div className="relative group">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggleCollapse}
                  className="h-12 w-12 p-0 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/60 dark:to-blue-900/80 hover:from-blue-100 hover:to-blue-200 dark:hover:from-blue-900/80 dark:hover:to-blue-800/90 border border-blue-200/60 dark:border-blue-700/80 shadow-lg hover:shadow-xl dark:shadow-blue-950/40 dark:hover:shadow-blue-900/50 backdrop-blur-sm transition-all duration-300 ease-out hover:scale-110 active:scale-95 group"
                  title="Expandir timeline de pagamentos"
                >
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-400/0 via-blue-400/10 to-blue-500/20 dark:from-blue-300/0 dark:via-blue-400/15 dark:to-blue-500/25 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  
                  <div className="relative flex items-center justify-center">
                    <Activity className="w-5 h-5 text-blue-600 dark:text-blue-300 group-hover:text-blue-700 dark:group-hover:text-blue-200 transition-all duration-300 group-hover:scale-110 drop-shadow-sm dark:drop-shadow-md" />
                    <ChevronLeft className="w-3 h-3 text-blue-500 dark:text-blue-400 absolute -right-0.5 -top-0.5 group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-all duration-300 group-hover:scale-125 drop-shadow-sm dark:drop-shadow-md" />
                  </div>
                </Button>
                  
                {paidItems.length > 0 && (
                  <div className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-gradient-to-br from-green-400 to-green-600 dark:from-green-500 dark:to-green-700 rounded-full border-2 border-white dark:border-gray-900 shadow-lg dark:shadow-green-900/60 flex items-center justify-center animate-pulse ring-2 ring-green-200/50 dark:ring-green-700/60">
                    <span className="text-xs font-bold text-white drop-shadow-md">
                      {paidItems.length > 99 ? '99+' : paidItems.length}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleCollapse}
                className="h-8 w-8 p-0 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700/70 border border-transparent hover:border-gray-200 dark:hover:border-gray-600/80 hover:shadow-md dark:hover:shadow-gray-900/30 transition-all duration-300 ease-out hover:scale-105 active:scale-95"
                title="Recolher timeline"
              >
                <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-all duration-200 drop-shadow-sm" />
              </Button>
            )}
          </div>
        )}
      </div>
      
      {!isCollapsed && (
        <>
          {/* Statistics Cards */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="relative overflow-hidden bg-gradient-to-br from-blue-500 via-indigo-500 to-blue-600 dark:from-blue-600 dark:via-indigo-600 dark:to-blue-700 p-3 rounded-xl shadow-lg shadow-blue-500/30 dark:shadow-blue-900/40 border border-blue-400/50 dark:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-300 hover:scale-105 group">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
              <div className="flex items-center gap-2 mb-1.5 relative z-10">
                <div className="w-6 h-6 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-white drop-shadow-md" />
                </div>
                <span className="text-[10px] font-bold text-white/90 uppercase tracking-wide">Pagos Hoje</span>
              </div>
              <span className="text-2xl font-black text-white drop-shadow-lg relative z-10">{stats.totalPaidToday}</span>
            </div>
            
            <div className="relative overflow-hidden bg-gradient-to-br from-green-500 via-emerald-500 to-green-600 dark:from-green-600 dark:via-emerald-600 dark:to-green-700 p-3 rounded-xl shadow-lg shadow-green-500/30 dark:shadow-green-900/40 border border-green-400/50 dark:border-green-500/50 hover:shadow-xl hover:shadow-green-500/40 transition-all duration-300 hover:scale-105 group">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
              <div className="flex items-center gap-2 mb-1.5 relative z-10">
                <div className="w-6 h-6 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-white drop-shadow-md" />
                </div>
                <span className="text-[10px] font-bold text-white/90 uppercase tracking-wide">Tempo Médio</span>
              </div>
              <span className="text-lg font-black text-white drop-shadow-lg relative z-10">{stats.averagePaymentTime}</span>
            </div>
            
            <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-600 dark:from-emerald-600 dark:via-teal-600 dark:to-emerald-700 p-3 rounded-xl shadow-lg shadow-emerald-500/30 dark:shadow-emerald-900/40 border border-emerald-400/50 dark:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/40 transition-all duration-300 hover:scale-105 group">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
              <div className="flex items-center gap-2 mb-1.5 relative z-10">
                <div className="w-6 h-6 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Zap className="w-4 h-4 text-white drop-shadow-md" />
                </div>
                <span className="text-[10px] font-bold text-white/90 uppercase tracking-wide">Mais Rápido</span>
              </div>
              <span className="text-lg font-black text-white drop-shadow-lg relative z-10">{stats.fastestPayment}</span>
            </div>
            
            <div className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 dark:from-amber-600 dark:via-orange-600 dark:to-amber-700 p-3 rounded-xl shadow-lg shadow-amber-500/30 dark:shadow-amber-900/40 border border-amber-400/50 dark:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/40 transition-all duration-300 hover:scale-105 group">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
              <div className="flex items-center gap-2 mb-1.5 relative z-10">
                <div className="w-6 h-6 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <TrendingDown className="w-4 h-4 text-white drop-shadow-md" />
                </div>
                <span className="text-[10px] font-bold text-white/90 uppercase tracking-wide">Mais Lento</span>
              </div>
              <span className="text-lg font-black text-white drop-shadow-lg relative z-10">{stats.slowestPayment}</span>
            </div>
          </div>

          {/* Timeline Items */}
          <div className="flex-1 overflow-y-auto">
            {paidItems.length > 0 ? (
              <div className="space-y-3">
                {paidItems.map((item, index) => (
                  <TimelineItem 
                    key={item.id} 
                    item={item} 
                    isLatest={index === 0}
                    isNew={newItemIds.has(item.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 px-4">
                <div className="relative bg-gradient-to-br from-white via-gray-50/50 to-white dark:from-gray-900/60 dark:via-gray-900/40 dark:to-gray-900/60 backdrop-blur-sm border-2 border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-8 overflow-hidden shadow-xl">
                  {/* Background decorative elements */}
                  <div className="absolute top-4 right-4 w-24 h-24 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-2xl" />
                  <div className="absolute bottom-4 left-4 w-24 h-24 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-full blur-2xl" />
                  
                  <div className="relative z-10">
                    <div className="relative inline-block mb-4">
                      <Package className="w-14 h-14 mx-auto text-gray-400 dark:text-gray-500 animate-float" />
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full blur-2xl opacity-50" />
                    </div>
                    
                    <h3 className="text-base font-bold mb-2 bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent">
                      Nenhum item pago ainda
                    </h3>
                    
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                      Os itens pagos aparecerão aqui em tempo real ⚡
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
