"use client";

import { NT } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ChevronDown, ChevronUp, Edit, Trash2, Plus, AlertTriangle, Clock, CheckCircle2, Package, Copy, Check, Snowflake, Flame } from 'lucide-react';
import { NTItemRow } from './nt-item-row';
import { parseDateTime, getDelayInfo, isItemDelayed, getMaterialCategory } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AddItemModal } from './add-item-modal';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface NTCardProps {
  nt: NT;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRefresh?: () => void;
  highlightedItems?: string[];
}

export const NTCard = ({ nt, isExpanded, onToggle, onEdit, onDelete, onRefresh, highlightedItems = [] }: NTCardProps) => {
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Function to copy NT number to clipboard
  const handleCopyNTNumber = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(nt.nt_number);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Check if NT is delayed
  const isNTDelayed = () => {
    try {
      const { creationDate } = parseDateTime(nt.created_date, nt.created_time);
      const { completionPercentage } = getStatusCounts();
      const delayInfo = getDelayInfo(creationDate);
      return delayInfo.isDelayed && completionPercentage < 100;
    } catch (error) {
      return false;
    }
  };

  // Get NT delay information
  const getNTDelayInfo = () => {
    try {
      const { creationDate } = parseDateTime(nt.created_date, nt.created_time);
      return getDelayInfo(creationDate);
    } catch (error) {
      return {
        isDelayed: false,
        delayTime: 0,
        formattedDelayTime: "",
        totalElapsed: 0,
        formattedTotalElapsed: ""
      };
    }
  };
  
  // Get status counts and check for delays in items
  const getStatusCounts = () => {
    if (!nt.items || nt.items.length === 0) {
      return { 
        pendingCount: 0, 
        paidCount: 0, 
        partialCount: 0, 
        delayedCount: 0,
        completionPercentage: 0,
        total: 0 
      };
    }
    
    const pendingCount = nt.items.filter(item => item.status === 'Ag. Pagamento').length;
    const paidCount = nt.items.filter(item => item.status === 'Pago').length;
    const partialCount = nt.items.filter(item => item.status === 'Pago Parcial').length;
    
    const delayedCount = nt.items.filter(item => {
      if (item.status !== 'Pago') {
        try {
          const [day, month, year] = item.created_date.split('/').map(Number);
          const [hours, minutes, seconds] = item.created_time.split(':').map(Number);
          const creationDate = new Date(year, month - 1, day, hours, minutes, seconds);
          if (isNaN(creationDate.getTime())) return false;
          // Usar a nova função que considera a categoria do material
          return isItemDelayed(creationDate, item.code);
        } catch (error) {
          return false;
        }
      }
      return false;
    }).length;
    
    const total = nt.items.length;
    const completionValue = paidCount + (partialCount * 0.5);
    const completionPercentage = total > 0 ? Math.round((completionValue / total) * 100) : 0;
    
    return {
      pendingCount,
      paidCount,
      partialCount,
      delayedCount,
      completionPercentage,
      total,
    };
  };
  
  const { pendingCount, paidCount, partialCount, delayedCount, completionPercentage, total } = getStatusCounts();

  // Get NT status with compact color coding
  const getNTStatus = () => {
    if (total === 0) return { 
      label: "Vazia", 
      variant: "secondary" as const,
      color: "slate" 
    };
    if (completionPercentage === 100) return { 
      label: "Concluída", 
      variant: "default" as const,
      color: "emerald" 
    };
    if (delayedCount > 0) return { 
      label: "Em atraso", 
      variant: "destructive" as const,
      color: "red" 
    };
    if (completionPercentage > 0) return { 
      label: "Em progresso", 
      variant: "default" as const,
      color: "blue" 
    };
    return { 
      label: "Pendente", 
      variant: "outline" as const,
      color: "amber"
    };
  };

  const ntStatus = getNTStatus();
  const ntDelayInfo = getNTDelayInfo();
  const isDelayed = isNTDelayed();

  // Check if NT contains special category items (CFA or INF)
  const getNTCategories = () => {
    if (!nt.items || nt.items.length === 0) {
      return { hasCFA: false, hasINF: false };
    }

    const hasCFA = nt.items.some(item => getMaterialCategory(item.code) === 'CFA');
    const hasINF = nt.items.some(item => getMaterialCategory(item.code) === 'INF');

    return { hasCFA, hasINF };
  };

  const { hasCFA, hasINF } = getNTCategories();

  return (
    <TooltipProvider delayDuration={300}>
      <Card 
        onClick={(e) => {
          // Prevent card click when clicking on buttons, interactive elements or form controls
          if ((e.target as HTMLElement).closest('button') || 
              (e.target as HTMLElement).closest('[role="button"]') ||
              (e.target as HTMLElement).closest('.interactive-element') ||
              (e.target as HTMLElement).closest('input') ||
              (e.target as HTMLElement).closest('select') ||
              (e.target as HTMLElement).closest('textarea') ||
              (e.target as HTMLElement).closest('label') ||
              (e.target as HTMLElement).closest('[role="dialog"]') ||
              (e.target as HTMLElement).closest('.modal') ||
              (e.target as HTMLElement).closest('dialog')) {
            return;
          }
          
          // Prevent toggling when clicking inside expanded content
          if (isExpanded && (e.target as HTMLElement).closest('.expanded-content')) {
            return;
          }
          
          onToggle();
        }}        className={cn(
          "relative border cursor-pointer",
          "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900",
          "hover:border-primary/50 transition-colors",
          "",
          // Left border color indicator
          `border-l-[6px] hover:border-l-[8px]`,          isDelayed 
            ? "border-l-red-500 hover:border-l-red-600 dark:border-l-red-400 dark:hover:border-l-red-300 shadow-red-500/10 hover:shadow-red-500/20" 
            : delayedCount > 0 
              ? "border-l-amber-500 hover:border-l-amber-600 dark:border-l-amber-400 dark:hover:border-l-amber-300 shadow-amber-500/10 hover:shadow-amber-500/20"
              : ntStatus.color === "emerald" 
                ? "border-l-emerald-500 hover:border-l-emerald-600 dark:border-l-emerald-400 dark:hover:border-l-emerald-300 shadow-emerald-500/10 hover:shadow-emerald-500/20"
                : ntStatus.color === "blue"
                  ? "border-l-blue-500 hover:border-l-blue-600 dark:border-l-blue-400 dark:hover:border-l-blue-300 shadow-blue-500/10 hover:shadow-blue-500/20"
                  : ntStatus.color === "red"
                    ? "border-l-red-500 hover:border-l-red-600 dark:border-l-red-400 dark:hover:border-l-red-300 shadow-red-500/10 hover:shadow-red-500/20"
                    : ntStatus.color === "amber"
                      ? "border-l-amber-500 hover:border-l-amber-600 dark:border-l-amber-400 dark:hover:border-l-amber-300 shadow-amber-500/10 hover:shadow-amber-500/20"
                      : "border-l-gray-400 hover:border-l-gray-500 dark:border-l-gray-600 dark:hover:border-l-gray-500",
          // Modern card effects
          "rounded-lg shadow-sm"
        )}>
        
        <CardHeader className="pb-3 pt-4 px-5 space-y-3 relative z-10">
          {/* Main header row */}
          <div className="flex items-center justify-between">
            {/* Left side - NT info */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  NT {nt.nt_number}
                </h3>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyNTNumber}
                      className="h-7 w-7 p-0"
                    >
                      {isCopied ? (
                        <Check className="h-4 w-4 text-green-600 dark:text-green-400 animate-in zoom-in duration-200" />
                      ) : (
                        <Copy className="h-4 w-4 text-gray-400 dark:text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-gray-900 dark:bg-gray-800 text-white border-gray-700">
                    <p className="text-xs font-medium">{isCopied ? '✓ Copiado!' : 'Copiar número da NT'}</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Modern status badge with gradient */}
              <Badge 
                variant={ntStatus.variant}
                className={cn(                  "text-xs px-3 py-1 font-bold shadow-none  border-0",
                  ntStatus.color === "emerald" && "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/30",
                  ntStatus.color === "blue" && "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-200 dark:border-blue-800/30",
                  ntStatus.color === "amber" && "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30",
                  ntStatus.color === "slate" && "bg-slate-50 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50",
                  ntStatus.color === "red" && "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800/30"
                )}
              >
                {ntStatus.label}
              </Badge>
            </div>

            {/* Right side - Stats and actions */}
            <div className="flex items-center gap-4">
              {/* Modern warning and category indicators */}
              <div className="flex items-center gap-2">
                {isDelayed && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="relative w-7 h-7 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded-full flex items-center justify-center cursor-pointer border-0 p-0">
                        <AlertTriangle className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-red-600 text-white border-red-500">
                      <p className="text-xs font-bold">⚠️ NT em atraso: {ntDelayInfo.formattedDelayTime}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {delayedCount > 0 && !isDelayed && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="relative w-7 h-7 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 rounded-full flex items-center justify-center cursor-pointer border-0 p-0">
                        <Clock className="h-4 w-4" />
                        {delayedCount > 1 && (
                          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold shadow-md border border-white dark:border-gray-900">
                            {delayedCount}
                          </span>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-amber-600 text-white border-amber-500">
                      <p className="text-xs font-bold">⏰ {delayedCount} {delayedCount === 1 ? 'item em atraso' : 'itens em atraso'}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {hasCFA && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="w-7 h-7 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded-full flex items-center justify-center cursor-pointer border-0 p-0">
                        <Snowflake className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-blue-600 text-white border-blue-500">
                      <p className="text-xs font-bold">❄️ Contém itens de Câmara Fria</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {hasINF && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="w-7 h-7 bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 rounded-full flex items-center justify-center cursor-pointer border-0 p-0">
                        <Flame className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-orange-600 text-white border-orange-500">
                      <p className="text-xs font-bold">🔥 Contém itens Inflamáveis</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>

              {/* Modern inline stats with icons */}
              {total > 0 && (                <div className="flex items-center gap-4 text-sm text-gray-700 dark:text-gray-300 font-bold">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800/60 rounded-lg ">
                    <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span>{total}</span>
                  </div>
                  <div className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg border",
                    completionPercentage === 100
                      ? "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/50"
                      : completionPercentage > 0
                        ? "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/50"
                        : "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700/50"
                  )}>
                    {completionPercentage === 100 ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : completionPercentage > 0 ? (
                      <Package className="h-4 w-4" />
                    ) : (
                      <Clock className="h-4 w-4" />
                    )}
                    <span>{completionPercentage}%</span>
                  </div>
                </div>
              )}              {/* Modern action buttons */}
              <div className="flex items-center gap-1.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={onEdit} 
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-blue-600 text-white border-blue-500">
                    <p className="text-xs font-bold">✏️ Editar NT</p>
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setShowAddItemModal(true)} 
                      className="h-8 w-8 p-0"
                    >
                      <Plus className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-green-600 text-white border-green-500">
                    <p className="text-xs font-bold">➕ Adicionar item</p>
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={onDelete} 
                      className="h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-red-600 text-white border-red-500">
                    <p className="text-xs font-bold">🗑️ Excluir NT</p>
                  </TooltipContent>
                </Tooltip>

                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onToggle} 
                  className="h-8 w-8 p-0 interactive-element rounded-xl transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800/60 hover:scale-110"
                >
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Modern progress bar and details */}
          {total > 0 && (            <div className="space-y-2">
              {/* Gradient progress bar with glow */}
              <div className="relative w-full bg-gray-200 dark:bg-gray-700/50 rounded-full h-2 overflow-hidden shadow-inner">
                <div 
                  className={cn(
                    "h-2 rounded-full",
                    completionPercentage === 100 
                      ? "bg-emerald-500" :
                    completionPercentage > 0 
                      ? "bg-blue-500" : 
                    "bg-gray-400"
                  )}
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>

              {/* Modern status breakdown */}              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  {paidCount > 0 && (
                    <span className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-400">
                      <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                      {paidCount} pago{paidCount !== 1 ? 's' : ''}
                    </span>
                  )}
                  {partialCount > 0 && (
                    <span className="flex items-center gap-2 font-bold text-blue-700 dark:text-blue-400">
                      <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />
                      {partialCount} parcial{partialCount !== 1 ? 'is' : ''}
                    </span>
                  )}
                  {pendingCount > 0 && (
                    <span className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-400">
                      <div className="w-2.5 h-2.5 bg-amber-500 rounded-full" />
                      {pendingCount} pendente{pendingCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                
                <div className="text-gray-600 dark:text-gray-400 font-bold text-xs px-3 py-1 bg-gray-100 dark:bg-gray-800/60 rounded-lg ">
                  {nt.created_date} {nt.created_time?.substring(0, 5)}
                </div>
              </div>
            </div>
          )}
        </CardHeader>        {/* Expanded content */}        
        {isExpanded && (
          <CardContent className="pt-4 px-5 pb-5 expanded-content">
            {/* Divider */}
            <div className="h-px bg-gray-200 dark:bg-gray-700 mb-5" />
            
            {total === 0 ? (
              <div className="text-center py-12 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 ">
                <div className="relative inline-block">
                  <Package className="h-14 w-14 mx-auto mb-3 opacity-40" />
                </div>
                <p className="text-sm font-bold mb-2 text-gray-900 dark:text-gray-100">Nenhum item nesta NT</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowAddItemModal(true)}
                  className="mt-3"
                >
                  <Plus className="h-4 w-4 mr-2 text-green-600 dark:text-green-400" />
                  Adicionar primeiro item
                </Button>
              </div>
            ) : (
              <div className="w-full rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-full table-auto">
                    <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                      <tr className="text-xs text-gray-900 dark:text-gray-100">
                        <th className="py-3 px-4 text-left font-bold">#</th>
                        <th className="py-3 px-4 text-left font-bold">Código</th>
                        <th className="py-3 px-4 text-left font-bold">Descrição</th>
                        <th className="py-3 px-4 text-center font-bold">Qtd</th>
                        <th className="py-3 px-4 text-left font-bold">Lote</th>
                        <th className="py-3 px-4 text-center font-bold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200/50 dark:divide-gray-700/50">
                      {nt.items?.map((item) => (
                        <NTItemRow 
                          key={item.id} 
                          item={item} 
                          onEdit={() => console.log('Edit item:', item.id)}
                          onDelete={() => {}}
                          onToggleStatus={() => console.log('Toggle status for item:', item.id)}
                          onSuccess={onRefresh}
                          isHighlighted={highlightedItems.includes(item.id)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        )}{showAddItemModal && (
          <AddItemModal
            open={showAddItemModal}
            onOpenChange={setShowAddItemModal}
            onSuccess={() => {
              onRefresh?.();
            }}
            nt={nt}
          />
        )}
      </Card>
    </TooltipProvider>
  );
};
