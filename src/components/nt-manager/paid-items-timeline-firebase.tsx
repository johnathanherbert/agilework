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
    if (isLatest || isNew) {
      setShowHighlight(true);
      const timer = setTimeout(() => {
        setShowHighlight(false);
      }, 5000); // Pisca/destaca por apenas 5 segundos
      return () => clearTimeout(timer);
    } else {
      setShowHighlight(false);
    }
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
            "relative flex items-start gap-3 p-3 rounded-xl transition-all duration-500 text-xs border cursor-pointer shadow-sm hover:shadow-md",
            showHighlight 
              ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700/50'
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/80',
            "focus-visible:outline-none"
          )}>
            
            {/* Timeline dot with enhanced glow */}
            <div className={cn(
              "mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 z-10",
              showHighlight 
                ? 'bg-blue-500'
                : item.status === 'Pago'
                  ? 'bg-green-500'
                  : item.status === 'Pago Parcial' ? 'bg-amber-500'
                  : item.status === 'Ag. Pagamento' ? 'bg-blue-500'
                  : 'bg-gray-400'
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
                    <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                      <Star className="w-3 h-3 text-white fill-white" />
                    </div>
                  )}
                  
                  {/* Status badge */}
                  {item.status === 'Pago' ? (
                    <span className="text-[10px] bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200 px-2 py-1 rounded-full font-bold border border-green-300 dark:border-green-700 shadow-sm">
                      PAGO
                    </span>
                  ) : item.status === 'Pago Parcial' ? (
                    <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 px-2 py-1 rounded-full font-bold border border-amber-300 dark:border-amber-700 shadow-sm">
                      PARCIAL
                    </span>
                  ) : item.status === 'Ag. Pagamento' ? (
                    <span className="text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200 px-2 py-1 rounded-full font-bold border border-blue-300 dark:border-blue-700 shadow-sm">
                      AG. PGTO
                    </span>
                  ) : (
                    <span className="text-[10px] bg-gray-100 text-gray-800 dark:bg-gray-800/40 dark:text-gray-200 px-2 py-1 rounded-full font-bold border border-gray-300 dark:border-gray-700 shadow-sm uppercase">
                      {item.status}
                    </span>
                  )}
                </div>
                
                <span className={cn(
                  "text-xs flex items-center gap-1 flex-shrink-0 font-semibold px-2 py-0.5 rounded-lg border border-transparent",
                  showHighlight
                    ? "text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/40 border-blue-100 dark:border-blue-800"
                    : "text-slate-500 dark:text-slate-400 bg-transparent"
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
                    "font-bold px-2 py-1 rounded-lg border border-transparent",
                    showHighlight 
                      ? 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/40 border-blue-100 dark:border-blue-800'
                      : 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  )}>
                    Qtd: {item.quantity}
                  </span>
                  
                  {/* Elapsed time indicator */}
                  {item.elapsedTime && item.elapsedTime !== '-' && (
                    <span className={cn(
                      "flex items-center gap-1 px-2 py-1 rounded-lg font-bold border",
                      isDelayed
                        ? "bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/50"
                        : "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                    )}>
                      <Zap className="w-3 h-3" />
                      {item.elapsedTime}
                    </span>
                  )}
                </div>
                
                <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 text-right bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-md font-bold shadow-sm">
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
            {!isCollapsed && <span className="text-sm font-medium">Feed de Atividades</span>}
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
              <div key={i} className="flex items-start gap-3 p-3 bg-white/60 dark:bg-gray-800/60 border border-gray-200/50 dark:border-gray-700/50 rounded-lg animate-pulse ">
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
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" />
            </div>
          )}
          {!isCollapsed && (
            <>
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                Feed de Atividades
              </span>
              <span className="text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-2.5 py-1 rounded-lg">
                {paidItems.length}
              </span>
              
              {/* Live indicator */}
              <div className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all duration-300",
                isConnected 
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' 
                  : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
              )}>
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  isConnected ? "bg-green-500" : "bg-red-500"
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
                  className="h-12 w-12 p-0 rounded-2xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-all duration-300 ease-out hover:scale-110 active:scale-95 group"
                  title="Expandir feed de atividades"
                >
                  <div className="relative flex items-center justify-center">
                    <Activity className="w-5 h-5 text-gray-600 dark:text-gray-300 group-hover:text-gray-700 dark:group-hover:text-gray-200" />
                    <ChevronLeft className="w-3 h-3 text-gray-500 dark:text-gray-400 absolute -right-0.5 -top-0.5 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
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
                title="Recolher feed"
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
            <div className="relative overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 rounded-xl shadow-sm">
              <div className="flex items-center gap-2 mb-1.5 relative z-10">
                <div className="w-6 h-6 rounded-md bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                </div>
                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Pagos Hoje</span>
              </div>
              <span className="text-2xl font-black text-gray-900 dark:text-white relative z-10">{stats.totalPaidToday}</span>
            </div>
            
            <div className="relative overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 rounded-xl shadow-sm">
              <div className="flex items-center gap-2 mb-1.5 relative z-10">
                <div className="w-6 h-6 rounded-md bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-primary" />
                </div>
                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Tempo Médio</span>
              </div>
              <span className="text-lg font-black text-gray-900 dark:text-white relative z-10">{stats.averagePaymentTime}</span>
            </div>
            
            <div className="relative overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 rounded-xl shadow-sm">
              <div className="flex items-center gap-2 mb-1.5 relative z-10">
                <div className="w-6 h-6 rounded-md bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-primary" />
                </div>
                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Mais Rápido</span>
              </div>
              <span className="text-lg font-black text-gray-900 dark:text-white relative z-10">{stats.fastestPayment}</span>
            </div>
            
            <div className="relative overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 rounded-xl shadow-sm">
              <div className="flex items-center gap-2 mb-1.5 relative z-10">
                <div className="w-6 h-6 rounded-md bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                  <TrendingDown className="w-4 h-4 text-primary" />
                </div>
                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Mais Lento</span>
              </div>
              <span className="text-lg font-black text-gray-900 dark:text-white relative z-10">{stats.slowestPayment}</span>
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
                <div className="relative bg-gradient-to-br from-white via-gray-50/50 to-white dark:from-gray-900/60 dark:via-gray-900/40 dark:to-gray-900/60  border-2 border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-8 overflow-hidden shadow-lg">
                  {/* Background decorative elements */}
                  <div className="absolute top-4 right-4 w-24 h-24 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full " />
                  <div className="absolute bottom-4 left-4 w-24 h-24 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-full " />
                  
                  <div className="relative z-10">
                    <div className="relative inline-block mb-4">
                      <Package className="w-14 h-14 mx-auto text-gray-400 dark:text-gray-500 animate-float" />
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full  opacity-50" />
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
