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
}

export const NTCard = ({ nt, isExpanded, onToggle, onEdit, onDelete, onRefresh }: NTCardProps) => {
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
  
  // Get status counts and check for delays
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
    <TooltipProvider>      <Card 
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
          "transition-all duration-200 hover:shadow-lg border cursor-pointer group",
          "border-slate-200 dark:border-slate-700/60",
          "bg-white dark:bg-slate-900 backdrop-blur-sm",
          // Left border color indicator - compact but visible
          `border-l-4 hover:border-l-[5px]`,          isDelayed 
            ? "border-l-red-500 hover:border-l-red-600 dark:border-l-red-400 dark:hover:border-l-red-300" 
            : delayedCount > 0 
              ? "border-l-amber-500 hover:border-l-amber-600 dark:border-l-amber-400 dark:hover:border-l-amber-300"
              : ntStatus.color === "emerald" 
                ? "border-l-emerald-500 hover:border-l-emerald-600 dark:border-l-emerald-400 dark:hover:border-l-emerald-300"
                : ntStatus.color === "blue"
                  ? "border-l-blue-500 hover:border-l-blue-600 dark:border-l-blue-400 dark:hover:border-l-blue-300"
                  : ntStatus.color === "red"
                    ? "border-l-red-500 hover:border-l-red-600 dark:border-l-red-400 dark:hover:border-l-red-300"
                    : ntStatus.color === "amber"
                      ? "border-l-amber-500 hover:border-l-amber-600 dark:border-l-amber-400 dark:hover:border-l-amber-300"
                      : "border-l-slate-400 hover:border-l-slate-500 dark:border-l-slate-300 dark:hover:border-l-slate-200",
          // Enhanced shadow for better card definition
          "rounded-lg shadow-sm hover:shadow-md dark:shadow-black/10 dark:hover:shadow-black/20"
        )}>
        <CardHeader className="pb-2 pt-3 px-4 space-y-2">
          {/* Main header row */}
          <div className="flex items-center justify-between">
            {/* Left side - NT info */}
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                  NT {nt.nt_number}
                </h3>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyNTNumber}
                      className="h-6 w-6 p-0 hover:bg-slate-100 dark:hover:bg-slate-800 interactive-element transition-all"
                    >
                      {isCopied ? (
                        <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs font-medium">{isCopied ? 'Copiado!' : 'Copiar número da NT'}</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Compact status badge */}
              <Badge 
                variant={ntStatus.variant}
                className={cn(                  "text-xs px-2 py-0.5 font-semibold shadow-sm",
                  ntStatus.color === "emerald" && "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
                  ntStatus.color === "blue" && "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
                  ntStatus.color === "amber" && "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
                  ntStatus.color === "slate" && "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
                  ntStatus.color === "red" && "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800"
                )}
              >
                {ntStatus.label}
              </Badge>
            </div>

            {/* Right side - Stats and actions */}
            <div className="flex items-center gap-3">
              {/* Compact warning and category indicators */}
              <div className="flex items-center gap-1.5">
                {isDelayed && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center cursor-pointer interactive-element shadow-sm">
                        <AlertTriangle className="h-3 w-3 text-white" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs font-medium">NT em atraso: {ntDelayInfo.formattedDelayTime}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {delayedCount > 0 && !isDelayed && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center relative cursor-pointer interactive-element shadow-sm">
                        <Clock className="h-3 w-3 text-white" />
                        {delayedCount > 1 && (
                          <span className="absolute -top-1 -right-1 bg-amber-600 text-white text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold shadow-sm">
                            {delayedCount}
                          </span>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs font-medium">{delayedCount} {delayedCount === 1 ? 'item em atraso' : 'itens em atraso'}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {hasCFA && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="w-5 h-5 bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 rounded-full flex items-center justify-center cursor-pointer interactive-element shadow-sm">
                        <Snowflake className="h-3 w-3" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs font-medium">Contém itens de Câmara Fria</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {hasINF && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="w-5 h-5 bg-orange-100 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400 rounded-full flex items-center justify-center cursor-pointer interactive-element shadow-sm">
                        <Flame className="h-3 w-3" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs font-medium">Contém itens Inflamáveis</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>

              {/* Inline compact stats */}
              {total > 0 && (                <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 font-medium">
                  <div className="flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5" />
                    <span>{total}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>{completionPercentage}%</span>
                  </div>
                </div>
              )}              {/* Action buttons - compact */}
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={onEdit} className="h-7 w-7 p-0 hover:bg-blue-50 dark:hover:bg-blue-900/20 interactive-element rounded-md transition-all">
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p className="text-xs font-medium">Editar NT</p></TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => setShowAddItemModal(true)} className="h-7 w-7 p-0 hover:bg-green-50 dark:hover:bg-green-900/20 interactive-element rounded-md transition-all">
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p className="text-xs font-medium">Adicionar item</p></TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={onDelete} className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-500 dark:hover:text-red-400 dark:hover:bg-red-900/20 interactive-element rounded-md transition-all">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p className="text-xs font-medium">Excluir NT</p></TooltipContent>
                </Tooltip>

                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onToggle} 
                  className="h-7 w-7 p-0 interactive-element rounded-md transition-all"
                >
                  {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Progress bar and details - compact */}
          {total > 0 && (            <div className="space-y-1.5">
              {/* Progress bar with better visibility */}
              <div className="w-full bg-slate-200 dark:bg-slate-700/50 rounded-full h-1 overflow-hidden">
                <div 
                  className={cn(
                    "h-1 rounded-full transition-all duration-500 ease-out",
                    completionPercentage === 100 ? "bg-gradient-to-r from-emerald-500 to-emerald-600 dark:from-emerald-400 dark:to-emerald-500" :
                    completionPercentage > 0 ? "bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-500" : 
                    "bg-slate-400 dark:bg-slate-500"
                  )}
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>

              {/* Compact status breakdown and timestamp */}              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-3">
                  {paidCount > 0 && (
                    <span className="flex items-center gap-1.5 font-medium">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-sm"></div>
                      {paidCount} pago{paidCount !== 1 ? 's' : ''}
                    </span>
                  )}
                  {partialCount > 0 && (
                    <span className="flex items-center gap-1.5 font-medium">
                      <div className="w-2 h-2 bg-blue-500 rounded-full shadow-sm"></div>
                      {partialCount} parcial{partialCount !== 1 ? 'is' : ''}
                    </span>
                  )}
                  {pendingCount > 0 && (
                    <span className="flex items-center gap-1.5 font-medium">
                      <div className="w-2 h-2 bg-amber-500 rounded-full shadow-sm"></div>
                      {pendingCount} pendente{pendingCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                
                <div className="text-slate-500 dark:text-slate-500 font-medium">
                  {nt.created_date} {nt.created_time?.substring(0, 5)}
                </div>
              </div>
            </div>
          )}
        </CardHeader>        {/* Expanded content */}        
        {isExpanded && (
          <CardContent className="pt-0 px-0 pb-3 expanded-content">
            <div className="border-t border-slate-200 dark:border-slate-700/50 pt-3">
              {total === 0 ? (
                <div className="text-center py-6 text-slate-500 dark:text-slate-400">
                  <Package className="h-8 w-8 mx-auto mb-3 text-slate-400 dark:text-slate-500" />
                  <p className="text-sm font-medium mb-3">Nenhum item nesta NT</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowAddItemModal(true)}
                    className="interactive-element text-xs h-8 shadow-sm"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Adicionar primeiro item
                  </Button>
                </div>
              ) : (
                <div className="w-full">
                  <div className="w-full expanded-content table-container overflow-x-auto">
                    <table className="w-full min-w-full table-auto">
                      <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700/60">
                        <tr className="text-xs text-slate-600 dark:text-slate-400">
                          <th className="py-2 px-3 text-left font-bold">#</th>
                          <th className="py-2 px-3 text-left font-bold">Código</th>
                          <th className="py-2 px-3 text-left font-bold">Descrição</th>
                          <th className="py-2 px-3 text-center font-bold">Qtd</th>
                          <th className="py-2 px-3 text-left font-bold">Lote</th>
                          <th className="py-2 px-3 text-left font-bold">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {nt.items?.map((item) => (
                          <NTItemRow 
                            key={item.id} 
                            item={item} 
                            onEdit={() => console.log('Edit item:', item.id)}
                            onDelete={() => {}}
                            onToggleStatus={() => console.log('Toggle status for item:', item.id)}
                            onSuccess={onRefresh}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
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
