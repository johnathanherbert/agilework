   "use client";

import { NT, NTItem } from '@/types';
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Clock, Check, Package } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface NTStatsProps {
  nts: NT[];
}

export function NTStats({ nts }: NTStatsProps) {
  // Calculate statistics
  const getStats = () => {
    let totalItems = 0;
    let pendingItems = 0;
    let paidItems = 0;
    let delayedItems = 0;

    nts.forEach(nt => {
      if (!nt.items) return;

      nt.items.forEach(item => {
        totalItems++;
        if (item.status === 'Ag. Pagamento') {
          pendingItems++;
          // Check if item is delayed (more than 2 hours old)
          const twoHoursInMs = 2 * 60 * 60 * 1000;
          try {
            const [year, month, day] = item.created_date.split('-').map(Number);
            const [hours, minutes, seconds] = item.created_time.split(':').map(Number);
            const creationDate = new Date(year, month - 1, day, hours, minutes, seconds);
            
            if (isNaN(creationDate.getTime())) return;
            
            const elapsed = Date.now() - creationDate.getTime();
            if (elapsed > twoHoursInMs) {
              delayedItems++;
            }
          } catch (error) {
            console.error('Error parsing date:', error);
          }
        } else if (item.status === 'Pago') {
          paidItems++;
        }
      });
    });

    return {
      total: totalItems,
      pending: pendingItems,
      paid: paidItems,
      delayed: delayedItems,
      completion: totalItems > 0 ? Math.round((paidItems / totalItems) * 100) : 0
    };
  };

  const stats = getStats();

  return (
    <div className="flex items-center space-x-2">
      <TooltipProvider>
        {/* Total items */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-full">
              <Package className="h-3 w-3" />
              <span>{stats.total}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs font-medium">{stats.total} {stats.total === 1 ? 'item' : 'itens'} no total</p>
          </TooltipContent>
        </Tooltip>

        {/* Pending items */}
        {stats.pending > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 text-xs bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-2 py-1 rounded-full border border-yellow-200 dark:border-yellow-700">
                <Clock className="h-3 w-3" />
                <span className="font-medium">{stats.pending}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs font-medium">{stats.pending} {stats.pending === 1 ? 'item pendente' : 'itens pendentes'}</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Paid items */}
        {stats.paid > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 text-xs bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded-full border border-green-200 dark:border-green-700">
                <Check className="h-3 w-3" />
                <span className="font-medium">{stats.paid}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs font-medium">{stats.paid} {stats.paid === 1 ? 'item pago' : 'itens pagos'}</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Delayed items */}
        {stats.delayed > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 text-xs bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-1 rounded-full border-2 border-orange-300 dark:border-orange-600">
                <AlertTriangle className="h-3 w-3" />
                <span className="font-bold">{stats.delayed}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs font-bold text-orange-600 dark:text-orange-400">
                {stats.delayed} {stats.delayed === 1 ? 'item em atraso' : 'itens em atraso'}
              </p>
            </TooltipContent>
          </Tooltip>
        )}
      </TooltipProvider>
    </div>
  );
}