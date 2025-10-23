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
            "relative flex items-start gap-2 p-3 rounded-lg transition-all duration-500 text-xs border backdrop-blur-sm cursor-pointer",
            showHighlight 
              ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-200 dark:border-blue-700/50 shadow-sm dark:shadow-blue-900/20'
              : 'bg-white/60 dark:bg-gray-800/60 border-gray-200/50 dark:border-gray-700/50 hover:bg-gray-50/80 dark:hover:bg-gray-700/70 hover:border-gray-300/60 dark:hover:border-gray-600/60'
          )}>
            {/* Timeline dot with status indicator */}
            <div className={cn(
              "mt-1 w-2 h-2 rounded-full flex-shrink-0 transition-all duration-300",
              showHighlight 
                ? 'bg-blue-500 dark:bg-blue-400 shadow-md shadow-blue-500/40 dark:shadow-blue-400/80 ring-2 ring-blue-200 dark:ring-blue-800/50'
                : item.status === 'Pago'
                  ? 'bg-green-500 dark:bg-green-400 shadow-sm'
                  : 'bg-yellow-500 dark:bg-yellow-400 shadow-sm'
            )} />
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1 mb-1">
                <div className="flex items-center gap-1.5">
                  <span className={cn(
                    "text-xs font-semibold truncate",
                    showHighlight 
                      ? 'text-blue-700 dark:text-blue-200'
                      : 'text-gray-800 dark:text-gray-100'
                  )}>
                    {item.code}
                  </span>
                  
                  {/* Priority badge */}
                  {item.isPriority && (
                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                  )}
                  
                  {/* Status badge */}
                  {item.status === 'Pago Parcial' && (
                    <span className="text-[10px] bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 px-1.5 py-0.5 rounded-full font-bold">
                      PARCIAL
                    </span>
                  )}
                </div>
                
                <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-0.5 flex-shrink-0">
                  <Clock className="w-2.5 h-2.5" />
                  {formatTime(item.paid_at)}
                </span>
              </div>
              
              <p className={cn(
                "text-xs leading-tight mb-1 truncate",
                showHighlight 
                  ? 'text-blue-700 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-300'
              )} title={item.description}>
                {item.description}
              </p>
              
              <div className="flex items-center justify-between text-xs gap-2">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "font-medium",
                    showHighlight 
                      ? 'text-blue-600 dark:text-blue-300'
                      : 'text-gray-600 dark:text-gray-400'
                  )}>
                    Qtd: {item.quantity}
                  </span>
                  
                  {/* Elapsed time indicator */}
                  {item.elapsedTime && item.elapsedTime !== '-' && (
                    <span className={cn(
                      "flex items-center gap-0.5 px-1.5 py-0.5 rounded font-bold",
                      isDelayed
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                        : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                    )}>
                      <Zap className="w-2.5 h-2.5" />
                      {item.elapsedTime}
                    </span>
                  )}
                </div>
                
                <span className="text-xs text-gray-500 dark:text-gray-500 text-right bg-gray-100 dark:bg-gray-700/50 px-1.5 py-0.5 rounded font-medium">
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
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {!isCollapsed && <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
          {!isCollapsed && (
            <>
              <span className="text-sm font-medium text-gray-800 dark:text-gray-100">Timeline de Pagamentos</span>
              <span className="text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 px-2 py-0.5 rounded-full border border-blue-200/50 dark:border-blue-700/50">
                {paidItems.length}
              </span>
              
              {/* Live indicator */}
              <div className={cn(
                "flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium",
                isConnected 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 border border-green-200/50 dark:border-green-700/50' 
                  : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 border border-red-200/50 dark:border-red-700/50'
              )}>
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
                )} />
                <span>LIVE</span>
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
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/40 dark:to-blue-900/60 p-2.5 rounded-lg border border-blue-200/50 dark:border-blue-700/50">
              <div className="flex items-center gap-1.5 mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span className="text-[10px] font-medium text-blue-700 dark:text-blue-300">Pagos Hoje</span>
              </div>
              <span className="text-lg font-bold text-blue-900 dark:text-blue-100">{stats.totalPaidToday}</span>
            </div>
            
            <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/40 dark:to-green-900/60 p-2.5 rounded-lg border border-green-200/50 dark:border-green-700/50">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                <span className="text-[10px] font-medium text-green-700 dark:text-green-300">Tempo Médio</span>
              </div>
              <span className="text-sm font-bold text-green-900 dark:text-green-100">{stats.averagePaymentTime}</span>
            </div>
            
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/40 dark:to-emerald-900/60 p-2.5 rounded-lg border border-emerald-200/50 dark:border-emerald-700/50">
              <div className="flex items-center gap-1.5 mb-1">
                <Zap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300">Mais Rápido</span>
              </div>
              <span className="text-sm font-bold text-emerald-900 dark:text-emerald-100">{stats.fastestPayment}</span>
            </div>
            
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/40 dark:to-amber-900/60 p-2.5 rounded-lg border border-amber-200/50 dark:border-amber-700/50">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingDown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300">Mais Lento</span>
              </div>
              <span className="text-sm font-bold text-amber-900 dark:text-amber-100">{stats.slowestPayment}</span>
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
              <div className="text-center py-12 px-4">
                <div className="bg-white/40 dark:bg-gray-800/40 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-6">
                  <Package className="w-10 h-10 mx-auto mb-3 text-gray-400 dark:text-gray-500 opacity-60" />
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                    Nenhum item pago ainda
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Os itens pagos aparecerão aqui em tempo real
                  </p>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
