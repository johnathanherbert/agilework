"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Clock, Package, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaidItem {
  id: string;
  code: string;
  description: string;
  quantity: number;
  paid_at: string;
  nt_number: string;
  paid_by_name?: string;
}

interface TimelineItemProps {
  item: PaidItem;
  isLatest: boolean;
}

const TimelineItem = ({ item, isLatest }: TimelineItemProps) => {
  const [showHighlight, setShowHighlight] = useState(isLatest);

  useEffect(() => {
    if (isLatest) {
      const timer = setTimeout(() => {
        setShowHighlight(false);
      }, 30000); // 30 segundos

      return () => clearTimeout(timer);
    }
  }, [isLatest]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit'
    });
  };  return (
    <div className={`
      relative flex items-start gap-2 p-3 rounded-lg transition-all duration-500 text-xs
      border backdrop-blur-sm
      ${showHighlight 
        ? 'bg-green-50/80 dark:bg-green-950/40 border-green-200 dark:border-green-700/50 shadow-sm dark:shadow-green-900/20' 
        : 'bg-white/60 dark:bg-gray-800/60 border-gray-200/50 dark:border-gray-700/50 hover:bg-gray-50/80 dark:hover:bg-gray-700/70 hover:border-gray-300/60 dark:hover:border-gray-600/60'
      }
    `}>
      {/* Timeline dot with glow effect */}
      <div className={`
        mt-1 w-2 h-2 rounded-full flex-shrink-0 transition-all duration-300
        ${showHighlight 
          ? 'bg-green-500 dark:bg-green-400 shadow-md shadow-green-500/40 dark:shadow-green-400/60 ring-2 ring-green-200 dark:ring-green-800/50' 
          : 'bg-gray-400 dark:bg-gray-500 shadow-sm dark:shadow-gray-700/50'
        }
      `} />
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-1">
          <span className={`
            text-xs font-semibold truncate
            ${showHighlight 
              ? 'text-green-700 dark:text-green-200' 
              : 'text-gray-800 dark:text-gray-100'
            }
          `}>
            {item.code}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-0.5 flex-shrink-0">
            <Clock className="w-2.5 h-2.5" />
            {formatTime(item.paid_at)}
          </span>
        </div>
        
        <p className={`
          text-xs leading-tight mb-1 truncate
          ${showHighlight 
            ? 'text-green-700 dark:text-green-300' 
            : 'text-gray-600 dark:text-gray-300'
          }
        `} title={item.description}>
          {item.description}
        </p>
        
        <div className="flex items-center justify-between text-xs">
          <span className={`
            font-medium
            ${showHighlight 
              ? 'text-green-600 dark:text-green-300' 
              : 'text-gray-600 dark:text-gray-400'
            }
          `}>
            Qtd: {item.quantity}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-500 text-right bg-gray-100 dark:bg-gray-700/50 px-1.5 py-0.5 rounded">
            NT {item.nt_number}
          </span>
        </div>
      </div>
    </div>
  );
};

interface PaidItemsTimelineProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const PaidItemsTimeline = ({ isCollapsed = false, onToggleCollapse }: PaidItemsTimelineProps) => {
  const [paidItems, setPaidItems] = useState<PaidItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPaidItems = async () => {
    try {
      const { data, error } = await supabase
        .from('nt_items')
        .select(`
          id,
          code,
          description,
          quantity,
          updated_at,
          paid_by_name,
          nt:nt_id (
            nt_number
          )
        `)
        .eq('status', 'Pago')
        .order('updated_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error fetching paid items:', error);
        return;
      }

      const formattedItems: PaidItem[] = data?.map(item => ({
        id: item.id,
        code: item.code,
        description: item.description,
        quantity: item.quantity,
        paid_at: item.updated_at,
        nt_number: (item.nt as any)?.nt_number || 'N/A',
        paid_by_name: item.paid_by_name
      })) || [];

      setPaidItems(formattedItems);
    } catch (error) {
      console.error('Error in fetchPaidItems:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaidItems();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('paid_items_timeline')
      .on(
        'postgres_changes' as any,
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'nt_items',
          filter: 'status=eq.Pago'
        },
        (payload: any) => {
          console.log('Item paid - timeline update:', payload);
          fetchPaidItems();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);  if (loading) {
    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            {!isCollapsed && <span className="text-sm font-medium">Últimos Pagamentos</span>}
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
  }  return (
    <div className="w-full h-full flex flex-col">      {/* Header com botão de toggle otimizado para dark mode */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {!isCollapsed && <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
          {!isCollapsed && (
            <>
              <span className="text-sm font-medium text-gray-800 dark:text-gray-100">Últimos Pagamentos</span>
              <span className="text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 px-2 py-0.5 rounded-full border border-blue-200/50 dark:border-blue-700/50">
                {paidItems.length}
              </span>
            </>
          )}
        </div>
          {/* Botão de toggle ultra elegante */}
        {onToggleCollapse && (
          <div className="relative">
            {isCollapsed ? (
              // Botão quando colapsado - design premium
              <div className="relative group">                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggleCollapse}
                  className="
                    h-12 w-12 p-0 rounded-2xl
                    bg-gradient-to-br from-blue-50 to-blue-100 
                    dark:from-blue-950/60 dark:to-blue-900/80
                    hover:from-blue-100 hover:to-blue-200 
                    dark:hover:from-blue-900/80 dark:hover:to-blue-800/90
                    border border-blue-200/60 dark:border-blue-700/80
                    shadow-lg hover:shadow-xl 
                    dark:shadow-blue-950/40 dark:hover:shadow-blue-900/50
                    backdrop-blur-sm
                    transition-all duration-300 ease-out
                    hover:scale-110 active:scale-95
                    relative overflow-hidden
                    group
                  "
                  title="Expandir timeline de pagamentos"
                >
                  {/* Enhanced glow effect for dark mode */}
                  <div className="
                    absolute inset-0 rounded-2xl
                    bg-gradient-to-br from-blue-400/0 via-blue-400/10 to-blue-500/20
                    dark:from-blue-300/0 dark:via-blue-400/15 dark:to-blue-500/25
                    opacity-0 group-hover:opacity-100
                    transition-opacity duration-300
                  " />
                  
                  <div className="relative flex items-center justify-center">
                    <Package className="
                      w-5 h-5 text-blue-600 dark:text-blue-300 
                      group-hover:text-blue-700 dark:group-hover:text-blue-200 
                      transition-all duration-300 group-hover:scale-110
                      drop-shadow-sm dark:drop-shadow-md
                    " />
                    <ChevronLeft className="
                      w-3 h-3 text-blue-500 dark:text-blue-400 
                      absolute -right-0.5 -top-0.5 
                      group-hover:text-blue-600 dark:group-hover:text-blue-300
                      transition-all duration-300 group-hover:scale-125
                      drop-shadow-sm dark:drop-shadow-md
                    " />
                  </div>
                </Button>
                  {/* Indicador de itens quando colapsado - otimizado para dark mode */}
                {paidItems.length > 0 && (
                  <div className="
                    absolute -top-1.5 -right-1.5 
                    w-6 h-6 
                    bg-gradient-to-br from-green-400 to-green-600 
                    dark:from-green-500 dark:to-green-700
                    rounded-full 
                    border-2 border-white dark:border-gray-900
                    shadow-lg dark:shadow-green-900/60
                    flex items-center justify-center
                    animate-pulse
                    ring-2 ring-green-200/50 dark:ring-green-700/60
                  ">
                    <span className="text-xs font-bold text-white drop-shadow-md">
                      {paidItems.length > 99 ? '99+' : paidItems.length}
                    </span>
                  </div>
                )}

                {/* Enhanced ripple effect for dark mode */}
                <div className="
                  absolute inset-0 rounded-2xl
                  bg-blue-400/20 dark:bg-blue-300/30 scale-0 group-hover:scale-100
                  transition-transform duration-500 ease-out
                  pointer-events-none
                " />
              </div>
            ) : (              // Botão quando expandido - elegante com melhor dark mode
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleCollapse}
                className="
                  h-8 w-8 p-0 rounded-xl
                  hover:bg-gray-100 dark:hover:bg-gray-700/70
                  border border-transparent 
                  hover:border-gray-200 dark:hover:border-gray-600/80
                  hover:shadow-md dark:hover:shadow-gray-900/30
                  transition-all duration-300 ease-out
                  hover:scale-105 active:scale-95
                "
                title="Recolher timeline"
              >
                <ChevronRight className="
                  w-4 h-4 text-gray-500 dark:text-gray-400 
                  hover:text-gray-700 dark:hover:text-gray-200 
                  transition-all duration-200
                  drop-shadow-sm
                " />
              </Button>
            )}
          </div>
        )}
      </div>
      
      {!isCollapsed && (        <div className="flex-1 overflow-y-auto">
          {paidItems.length > 0 ? (
            <div className="space-y-3">
              {paidItems.map((item, index) => (
                <TimelineItem 
                  key={item.id} 
                  item={item} 
                  isLatest={index === 0}
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
                  Os itens pagos aparecerão aqui
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
